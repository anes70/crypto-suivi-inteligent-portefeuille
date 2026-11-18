import type { CreateAlertInput, TokenAlert } from '../../types/alerts';

const ALERTS_STORAGE_KEY = 'meridian.smart_alerts.v1';

export function loadAlerts(): TokenAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: TokenAlert[]): void {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(alerts));
  } catch {
    // ignore storage quota errors
  }
}

export function createAlert(input: CreateAlertInput): TokenAlert[] {
  const existing = loadAlerts();
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const nextAlert: TokenAlert = {
    id,
    chain: input.chain,
    tokenAddress:
      input.chain !== 'solana'
        ? input.tokenAddress.toLowerCase()
        : input.tokenAddress.trim(),
    symbol: input.symbol,
    name: input.name,
    type: input.type,
    direction: input.direction,
    thresholdValue: input.thresholdValue,
    baselineValue: input.baselineValue,
    enabled: true,
    triggered: false,
    triggeredAt: null,
    triggeredMessage: null,
    acknowledged: false,
    createdAt: Date.now(),
  };

  const next = [nextAlert, ...existing];
  saveAlerts(next);
  return next;
}

export function toggleAlertEnabled(id: string): TokenAlert[] {
  const next = loadAlerts().map((a) =>
    a.id === id ? { ...a, enabled: !a.enabled } : a
  );
  saveAlerts(next);
  return next;
}

export function rearmAlert(id: string): TokenAlert[] {
  const next = loadAlerts().map((a) =>
    a.id === id
      ? {
          ...a,
          enabled: true,
          triggered: false,
          triggeredAt: null,
          triggeredMessage: null,
          acknowledged: false,
        }
      : a
  );
  saveAlerts(next);
  return next;
}

export function acknowledgeAlert(id: string): TokenAlert[] {
  const next = loadAlerts().map((a) =>
    a.id === id ? { ...a, acknowledged: true } : a
  );
  saveAlerts(next);
  return next;
}

export function acknowledgeAllAlerts(): TokenAlert[] {
  const next = loadAlerts().map((a) =>
    a.triggered ? { ...a, acknowledged: true } : a
  );
  saveAlerts(next);
  return next;
}

export function deleteAlert(id: string): TokenAlert[] {
  const next = loadAlerts().filter((a) => a.id !== id);
  saveAlerts(next);
  return next;
}
