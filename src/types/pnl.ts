import type { ActiveChainId } from './chain';

export type CostBasisSource = 'manual' | 'onchain-import';

export interface CostBasisEntry {
  key: string; // `${chain}:${tokenAddress.toLowerCase()}`
  chain: ActiveChainId;
  tokenAddress: string;
  avgBuyPriceUsd: number;
  source: CostBasisSource;
  updatedAt: number;
  txCount?: number;
}

export interface TokenPnlResult {
  avgBuyPriceUsd: number | null;
  costBasisUsd: number | null;
  currentValueUsd: number;
  unrealizedPnlUsd: number | null;
  roiPercent: number | null;
  source: CostBasisSource | null;
}

export interface PeriodPnlMetric {
  label: string;
  pnlUsd: number | null;
  pnlPercent: number | null;
  hasBaseline: boolean;
  note?: string;
}

export interface PortfolioPnlSummary {
  totalCostBasisUsd: number;
  totalTrackedValueUsd: number;
  unrealizedPnlUsd: number | null;
  roiPercent: number | null;
  trackedTokenCount: number;
  daily: PeriodPnlMetric;
  weekly: PeriodPnlMetric;
  monthly: PeriodPnlMetric;
}

export interface OnChainCostBasisResponse {
  chain: ActiveChainId;
  source: string;
  apiKeyMissing: boolean;
  apiKeyName: string | null;
  error?: string;
  avgBuyPriceUsd: number | null;
  transactionsAnalyzed?: number;
  transactions?: Array<{
    hash: string;
    timestamp: number;
    amount: number;
    estimatedPriceUsd: number | null;
  }>;
}
