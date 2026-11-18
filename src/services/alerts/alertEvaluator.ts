import type { TokenAlert } from '../../types/alerts';
import type { ActiveChainId } from '../../types/chain';
import type { OnChainTokenMetrics } from '../../types/onchain';
import type { TokenHolding } from '../../types/portfolio';
import { formatTokenPrice, formatUsd } from '../../utils/format';

export function makeTokenAlertKey(chain: ActiveChainId, address: string): string {
  const normalized = chain !== 'solana' ? address.toLowerCase() : address.trim();
  return `${chain}:${normalized}`;
}

export type BrowserNotificationStatus = 'granted' | 'denied' | 'default' | 'unsupported';

export function getBrowserNotificationStatus(): BrowserNotificationStatus {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<BrowserNotificationStatus> {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return 'unsupported';
  }
  try {
    const res = await Notification.requestPermission();
    return res;
  } catch {
    return Notification.permission || 'denied';
  }
}

export function dispatchBrowserNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') {
    return;
  }
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        tag: `meridian-alert-${Date.now()}`,
      });
    } catch {
      // ignore sandbox/iframe notification restrictions
    }
  }
}

export interface EvaluateAlertsInput {
  alerts: TokenAlert[];
  holdings: TokenHolding[];
  metricsByToken?: Record<string, OnChainTokenMetrics | null>;
  rsiByToken?: Record<string, number | null>;
}

export interface EvaluateAlertsResult {
  updatedAlerts: TokenAlert[];
  newlyTriggered: TokenAlert[];
  changed: boolean;
}

export function evaluateAlerts({
  alerts,
  holdings,
  metricsByToken = {},
  rsiByToken = {},
}: EvaluateAlertsInput): EvaluateAlertsResult {
  if (alerts.length === 0) {
    return { updatedAlerts: alerts, newlyTriggered: [], changed: false };
  }

  const holdingMap = new Map<string, TokenHolding>();
  for (const h of holdings) {
    holdingMap.set(makeTokenAlertKey(h.chain, h.address), h);
  }

  const newlyTriggered: TokenAlert[] = [];
  let changed = false;

  const updatedAlerts = alerts.map((alert) => {
    if (!alert.enabled || alert.triggered) {
      return alert;
    }

    const key = makeTokenAlertKey(alert.chain, alert.tokenAddress);
    const holding = holdingMap.get(key);
    const metrics = metricsByToken[key] || null;
    const rsi14 = rsiByToken[key] ?? null;

    const currentPrice = metrics?.priceUsd ?? holding?.priceUsd ?? null;
    const currentLiquidity = metrics?.liquidityUsd ?? holding?.liquidityUsd ?? null;
    const currentVolume24h = metrics?.volume24h ?? null;

    let triggerMsg: string | null = null;

    if (alert.type === 'price_target' && currentPrice !== null) {
      if (alert.direction === 'above' && currentPrice >= alert.thresholdValue) {
        triggerMsg = `${alert.symbol} a atteint ${formatTokenPrice(currentPrice)} (cible ≥ ${formatTokenPrice(alert.thresholdValue)}).`;
      } else if (alert.direction === 'below' && currentPrice <= alert.thresholdValue) {
        triggerMsg = `${alert.symbol} est passé à ${formatTokenPrice(currentPrice)} (seuil ≤ ${formatTokenPrice(alert.thresholdValue)}).`;
      }
    } else if (alert.type === 'take_profit' && currentPrice !== null) {
      if (currentPrice >= alert.thresholdValue) {
        triggerMsg = `Take Profit atteint sur ${alert.symbol} : ${formatTokenPrice(currentPrice)} (seuil ${formatTokenPrice(alert.thresholdValue)}).`;
      }
    } else if (alert.type === 'stop_loss' && currentPrice !== null) {
      if (currentPrice <= alert.thresholdValue) {
        triggerMsg = `Stop Loss déclenché sur ${alert.symbol} : ${formatTokenPrice(currentPrice)} (seuil ${formatTokenPrice(alert.thresholdValue)}).`;
      }
    } else if (alert.type === 'rsi_threshold' && rsi14 !== null) {
      if (alert.direction === 'below' && rsi14 <= alert.thresholdValue) {
        triggerMsg = `RSI(14) survendu sur ${alert.symbol} : ${rsi14.toFixed(1)} (seuil ≤ ${alert.thresholdValue}).`;
      } else if (alert.direction === 'above' && rsi14 >= alert.thresholdValue) {
        triggerMsg = `RSI(14) suracheté sur ${alert.symbol} : ${rsi14.toFixed(1)} (seuil ≥ ${alert.thresholdValue}).`;
      }
    } else if (alert.type === 'liquidity_drop' && currentLiquidity !== null) {
      if (
        alert.direction === 'drop_pct' &&
        alert.baselineValue !== null &&
        alert.baselineValue > 0
      ) {
        const dropPct =
          ((alert.baselineValue - currentLiquidity) / alert.baselineValue) * 100;
        if (dropPct >= alert.thresholdValue) {
          triggerMsg = `Alerte Rug Pull / Liquidité sur ${alert.symbol} : chute de -${dropPct.toFixed(1)}% (${formatUsd(currentLiquidity, true)} vs ${formatUsd(alert.baselineValue, true)}).`;
        }
      } else if (
        alert.direction === 'below' &&
        currentLiquidity <= alert.thresholdValue
      ) {
        triggerMsg = `Liquidité critique sur ${alert.symbol} : ${formatUsd(currentLiquidity, true)} (≤ ${formatUsd(alert.thresholdValue, true)}).`;
      }
    } else if (alert.type === 'volume_spike' && currentVolume24h !== null) {
      if (
        alert.direction === 'spike_pct' &&
        alert.baselineValue !== null &&
        alert.baselineValue > 0
      ) {
        const spikePct =
          ((currentVolume24h - alert.baselineValue) / alert.baselineValue) * 100;
        if (spikePct >= alert.thresholdValue) {
          triggerMsg = `Pic de volume 24h sur ${alert.symbol} : +${spikePct.toFixed(1)}% (${formatUsd(currentVolume24h, true)}).`;
        }
      } else if (
        alert.direction === 'above' &&
        currentVolume24h >= alert.thresholdValue
      ) {
        triggerMsg = `Volume 24h élevé sur ${alert.symbol} : ${formatUsd(currentVolume24h, true)} (≥ ${formatUsd(alert.thresholdValue, true)}).`;
      }
    }

    if (triggerMsg) {
      changed = true;
      const triggeredAlert: TokenAlert = {
        ...alert,
        triggered: true,
        triggeredAt: Date.now(),
        triggeredMessage: triggerMsg,
        acknowledged: false,
      };
      newlyTriggered.push(triggeredAlert);
      return triggeredAlert;
    }

    return alert;
  });

  return { updatedAlerts, newlyTriggered, changed };
}
