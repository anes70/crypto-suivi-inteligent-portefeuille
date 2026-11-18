import type { ActiveChainId } from '../../types/chain';
import type {
  CostBasisEntry,
  OnChainCostBasisResponse,
  PeriodPnlMetric,
  PortfolioPnlSummary,
  TokenPnlResult,
} from '../../types/pnl';
import type {
  PortfolioSnapshot,
  PortfolioSummary,
  TokenHolding,
} from '../../types/portfolio';
import { makeCostBasisKey } from './costBasisStorage';

export function computeTokenPnl(
  holding: TokenHolding,
  costBasisMap: Record<string, CostBasisEntry>
): TokenPnlResult {
  const key = makeCostBasisKey(holding.chain, holding.address);
  const entry = costBasisMap[key];

  if (!entry || !Number.isFinite(entry.avgBuyPriceUsd) || entry.avgBuyPriceUsd <= 0) {
    return {
      avgBuyPriceUsd: null,
      costBasisUsd: null,
      currentValueUsd: holding.valueUsd,
      unrealizedPnlUsd: null,
      roiPercent: null,
      source: null,
    };
  }

  const costBasisUsd = entry.avgBuyPriceUsd * holding.balance;
  const unrealizedPnlUsd = holding.valueUsd - costBasisUsd;
  const roiPercent = costBasisUsd > 0 ? (unrealizedPnlUsd / costBasisUsd) * 100 : null;

  return {
    avgBuyPriceUsd: entry.avgBuyPriceUsd,
    costBasisUsd,
    currentValueUsd: holding.valueUsd,
    unrealizedPnlUsd,
    roiPercent,
    source: entry.source,
  };
}

function findSnapshotBefore(
  snapshots: PortfolioSnapshot[],
  targetTimestampMs: number
): PortfolioSnapshot | null {
  if (snapshots.length === 0) return null;
  let candidate: PortfolioSnapshot | null = null;
  for (const snap of snapshots) {
    if (snap.timestamp <= targetTimestampMs) {
      candidate = snap;
    }
  }
  return candidate;
}

function buildSnapshotPeriodMetric(
  label: string,
  currentTotalUsd: number,
  snapshots: PortfolioSnapshot[],
  windowMs: number,
  fallbackDaily?: { pnlUsd: number; pnlPct: number }
): PeriodPnlMetric {
  const now = Date.now();
  const baseline = findSnapshotBefore(snapshots, now - windowMs);

  if (baseline && baseline.totalValueUsd > 0) {
    const pnlUsd = currentTotalUsd - baseline.totalValueUsd;
    const pnlPercent = (pnlUsd / baseline.totalValueUsd) * 100;
    return {
      label,
      pnlUsd,
      pnlPercent,
      hasBaseline: true,
      note: 'Basé sur instantané IndexedDB',
    };
  }

  if (fallbackDaily && currentTotalUsd > 0) {
    return {
      label,
      pnlUsd: fallbackDaily.pnlUsd,
      pnlPercent: fallbackDaily.pnlPct,
      hasBaseline: true,
      note: 'Variation marché 24h pondérée',
    };
  }

  return {
    label,
    pnlUsd: null,
    pnlPercent: null,
    hasBaseline: false,
    note: 'Historique local en cours de collecte',
  };
}

export function computePortfolioPnlSummary(
  portfolio: PortfolioSummary,
  snapshots: PortfolioSnapshot[],
  costBasisMap: Record<string, CostBasisEntry>
): PortfolioPnlSummary {
  let totalCostBasisUsd = 0;
  let totalTrackedValueUsd = 0;
  let trackedTokenCount = 0;

  for (const holding of portfolio.holdings) {
    const res = computeTokenPnl(holding, costBasisMap);
    if (res.costBasisUsd !== null) {
      totalCostBasisUsd += res.costBasisUsd;
      totalTrackedValueUsd += res.currentValueUsd;
      trackedTokenCount += 1;
    }
  }

  const unrealizedPnlUsd =
    trackedTokenCount > 0 ? totalTrackedValueUsd - totalCostBasisUsd : null;
  const roiPercent =
    totalCostBasisUsd > 0 && unrealizedPnlUsd !== null
      ? (unrealizedPnlUsd / totalCostBasisUsd) * 100
      : null;

  const DAY_MS = 24 * 60 * 60 * 1000;
  const WEEK_MS = 7 * DAY_MS;
  const MONTH_MS = 30 * DAY_MS;

  return {
    totalCostBasisUsd,
    totalTrackedValueUsd,
    unrealizedPnlUsd,
    roiPercent,
    trackedTokenCount,
    daily: buildSnapshotPeriodMetric(
      'PnL 24h',
      portfolio.totalValueUsd,
      snapshots,
      DAY_MS,
      { pnlUsd: portfolio.change24hUsd, pnlPct: portfolio.change24hPercent }
    ),
    weekly: buildSnapshotPeriodMetric(
      'PnL 7j',
      portfolio.totalValueUsd,
      snapshots,
      WEEK_MS
    ),
    monthly: buildSnapshotPeriodMetric(
      'PnL 30j',
      portfolio.totalValueUsd,
      snapshots,
      MONTH_MS
    ),
  };
}

export async function importOnChainCostBasis(params: {
  chain: ActiveChainId;
  walletAddress: string;
  tokenAddress: string;
  poolAddress?: string | null;
  isNative: boolean;
}): Promise<OnChainCostBasisResponse> {
  const res = await fetch('/api/pnl/cost-basis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Impossible d’importer l’historique on-chain.');
  }
  return data as OnChainCostBasisResponse;
}
