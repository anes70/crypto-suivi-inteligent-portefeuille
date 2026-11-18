import type { ActiveChainId } from './chain';

export interface DexPriceData {
  address: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  symbol?: string;
  name?: string;
  imageUrl?: string;
  pairUrl?: string;
  dexId?: string;
}

export interface TokenHolding {
  id: string; // `${chain}:${tokenAddress}:${walletAddress}` or aggregated `${chain}:${tokenAddress}`
  chain: ActiveChainId;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  priceUsd: number | null;
  priceChange24h: number | null;
  valueUsd: number;
  liquidityUsd: number | null;
  fdv: number | null;
  isNative: boolean;
  logoUrl?: string;
  pairUrl?: string;
  dexId?: string;
  walletAddress: string;
  walletLabel?: string;
}

export interface ChainAllocation {
  chain: ActiveChainId;
  name: string;
  valueUsd: number;
  percentage: number;
  tokenCount: number;
  source: 'alchemy' | 'helius' | 'public-rpc' | 'unavailable' | 'idle';
  apiKeyMissing: boolean;
  apiKeyName: string | null;
  error?: string;
}

export interface DustFilterStats {
  totalRawCount: number;
  filteredZeroOrDustCount: number;
  thresholdUsd: number;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  change24hUsd: number;
  change24hPercent: number;
  holdings: TokenHolding[];
  allocations: ChainAllocation[];
  dustStats: DustFilterStats;
  lastUpdatedAt: number | null;
}

export interface PortfolioSnapshot {
  id?: number;
  timestamp: number;
  totalValueUsd: number;
  baseValueUsd: number;
  solanaValueUsd: number;
  robinhoodValueUsd?: number;
  walletSignature: string;
}
