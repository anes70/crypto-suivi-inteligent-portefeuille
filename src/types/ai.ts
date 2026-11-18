import type { ActiveChainId } from './chain';

export type AiDecision =
  | 'CONSERVER'
  | 'RENFORCER'
  | 'VENDRE'
  | 'PRENDRE PROFITS'
  | 'ATTENDRE'
  | 'ÉVITER';

export type AiHorizon = 'Court terme' | 'Moyen terme' | 'Long terme';

export type AiProvider = 'groq' | 'gemini';

export interface AiScores {
  confidence: number;
  risk: number;
  potential: number;
  reinforcementStrength: number;
  horizon: AiHorizon;
}

export interface AiPriceRange {
  minUsd: number;
  maxUsd: number;
}

export interface AiStrategicLevels {
  targetPriceUsd: number;
  takeProfitUsd: number;
  stopLossUsd: number;
  idealBuyZone: AiPriceRange;
  dangerZone: AiPriceRange;
}

export interface AiTokenAnalysis {
  id: string;
  decision: AiDecision;
  summary: string;
  scores: AiScores;
  priceLevels: AiStrategicLevels;
  reasoning: string[];
  provider: AiProvider;
  model: string;
  generatedAt: number;
  priceAtAnalysisUsd: number;
}

export interface AnalyzeTokenPayload {
  preferredProvider?: 'auto' | AiProvider;
  token: {
    chain: ActiveChainId;
    address: string;
    symbol: string;
    name: string;
    isNative: boolean;
    currentPriceUsd: number;
    balance: number;
    valueUsd: number;
    portfolioWeightPct: number;
  };
  pnl: {
    hasCostBasis: boolean;
    avgBuyPriceUsd: number | null;
    costBasisSource: string | null;
    unrealizedPnlUsd: number | null;
    roiPercent: number | null;
    portfolioDailyChangePct: number | null;
    portfolioWeeklyChangePct: number | null;
    portfolioMonthlyChangePct: number | null;
  };
  onchain: {
    liquidityUsd: number | null;
    volume24hUsd: number | null;
    fdvUsd: number | null;
    marketCapUsd: number | null;
    priceChange1hPct: number | null;
    priceChange6hPct: number | null;
    priceChange24hPct: number | null;
    buys24h: number | null;
    sells24h: number | null;
    buyPressurePct: number | null;
    poolAgeLabel: string;
    poolCount: number;
    dexId: string | null;
    sector: string;
    riskLevel: string;
    liquidityScore: number;
  };
  technical: {
    timeframe: string;
    candleCount: number;
    globalTrend: string | null;
    trendReasons: string[];
    rsi14: number | null;
    rsiSignal: string | null;
    macdHistogram: number | null;
    macdBias: string | null;
    ema20: number | null;
    ema50: number | null;
    ema200: number | null;
    sma20: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
    bollingerBandwidthPct: number | null;
    atrPercent: number | null;
    supportsUsd: number[];
    resistancesUsd: number[];
  };
  social: {
    sentimentLabel: string | null;
    positivePct: number | null;
    neutralPct: number | null;
    negativePct: number | null;
    cgVotesUpPct: number | null;
    cgVotesDownPct: number | null;
    watchlistUsers: number | null;
    buzzIndex: number | null;
    buzzLabel: string | null;
    dominantNarrative: string | null;
    githubStars: number | null;
    commits4Weeks: number | null;
    newsCount: number;
    redditCount: number;
    recentHeadlines: string[];
  };
}

export interface AiAnalyzeApiSuccess {
  apiKeyMissing: false;
  analysis: AiTokenAnalysis;
}

export interface AiAnalyzeApiMissingKey {
  apiKeyMissing: true;
  error: string;
}
