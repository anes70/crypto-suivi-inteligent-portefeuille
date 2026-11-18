import type { ActiveChainId } from './chain';

export interface TxnCountPair {
  buys: number;
  sells: number;
}

export interface OnChainTokenMetrics {
  chain: ActiveChainId;
  address: string;
  poolAddress: string | null;
  dexId: string | null;
  dexScreenerUrl: string | null;
  geckoTerminalUrl: string | null;
  priceUsd: number | null;
  priceChange1h: number | null;
  priceChange6h: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  volume24h: number | null;
  volume6h: number | null;
  volume1h: number | null;
  fdv: number | null;
  marketCap: number | null;
  txns24h: TxnCountPair | null;
  txns6h: TxnCountPair | null;
  txns1h: TxnCountPair | null;
  poolCreatedAt: number | null;
  poolCount: number;
  fetchedAt: number;
}

export interface OhlcvCandle {
  time: number; // UNIX seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type RiskLevel = 'Faible' | 'Modéré' | 'Élevé';
export type TokenSector =
  | 'Stablecoin'
  | 'Actif Majeur / L1-L2'
  | 'DeFi / DEX'
  | 'Écosystème / Mid-Cap'
  | 'Micro-Cap / Volatil';

export interface TokenClassification {
  sector: TokenSector;
  riskLevel: RiskLevel;
  liquidityScore: number; // 0-100 derived strictly from real liquidity USD & Liq/FDV ratio
  liquidityLabel: string;
  buyPressurePercent: number | null;
  poolAgeLabel: string;
}

export interface TechnicalLevel {
  price: number;
  type: 'support' | 'resistance';
  touches: number;
}

export type GlobalTrend = 'Haussier' | 'Baissier' | 'Neutre';

export interface TechnicalAnalysisResult {
  candleCount: number;
  latestClose: number;
  sma20: (number | null)[];
  ema20: (number | null)[];
  ema50: (number | null)[];
  ema200: (number | null)[];
  rsi14: (number | null)[];
  latestRsi14: number | null;
  rsiSignal: 'Suracheté' | 'Survendu' | 'Neutre' | 'Données insuffisantes';
  macd: {
    macdLine: (number | null)[];
    signalLine: (number | null)[];
    histogram: (number | null)[];
    latestMacd: number | null;
    latestSignal: number | null;
    latestHistogram: number | null;
    bias: 'Haussier' | 'Baissier' | 'Neutre';
  };
  bollinger: {
    upper: (number | null)[];
    middle: (number | null)[];
    lower: (number | null)[];
    bandwidthPercent: number | null;
  };
  atr14: (number | null)[];
  latestAtr14: number | null;
  atrPercent: number | null;
  supports: TechnicalLevel[];
  resistances: TechnicalLevel[];
  globalTrend: GlobalTrend;
  trendReasons: string[];
}
