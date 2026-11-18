import type { ActiveChainId } from '../../types/chain';
import type {
  OhlcvCandle,
  OnChainTokenMetrics,
  RiskLevel,
  TokenClassification,
  TokenSector,
} from '../../types/onchain';
import type { TokenHolding } from '../../types/portfolio';

export async function fetchOnChainTokenMetrics(
  chain: ActiveChainId,
  address: string
): Promise<OnChainTokenMetrics> {
  const res = await fetch('/api/onchain/token-metrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chain, address }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Impossible de charger les métriques on-chain.');
  }
  return data as OnChainTokenMetrics;
}

export async function fetchGeckoTerminalOhlcv(params: {
  chain: ActiveChainId;
  poolAddress: string;
  timeframe: 'minute' | 'hour' | 'day';
  aggregate: number;
  limit?: number;
}): Promise<OhlcvCandle[]> {
  const res = await fetch('/api/onchain/ohlcv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Impossible de charger les bougies OHLCV.');
  }
  return Array.isArray(data?.candles) ? (data.candles as OhlcvCandle[]) : [];
}

export function formatPoolAge(createdAtMs: number | null): string {
  if (!createdAtMs || !Number.isFinite(createdAtMs)) return 'Inconnu';
  const diffMs = Math.max(0, Date.now() - createdAtMs);
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} j`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mois`;
  const years = (days / 365).toFixed(1);
  return `${years} ans`;
}

const STABLE_SYMBOLS = new Set(['USDC', 'USDBC', 'USDT', 'DAI', 'EURC', 'PYUSD', 'USDS']);
const BLUECHIP_SYMBOLS = new Set(['ETH', 'WETH', 'SOL', 'WSOL', 'CBBTC', 'CBETH', 'WBTC', 'JLP']);
const DEFI_SYMBOLS = new Set(['AERO', 'WELL', 'JUP', 'RAY', 'ORCA', 'DRIFT', 'KMNO', 'UNI', 'AAVE']);

export function classifyTokenMetrics(
  holding: Pick<TokenHolding, 'symbol' | 'isNative' | 'liquidityUsd' | 'fdv'>,
  metrics?: OnChainTokenMetrics | null
): TokenClassification {
  const sym = holding.symbol.toUpperCase();
  const liq = metrics?.liquidityUsd ?? holding.liquidityUsd ?? 0;
  const fdv = metrics?.fdv ?? holding.fdv ?? 0;

  let sector: TokenSector = 'Écosystème / Mid-Cap';
  if (STABLE_SYMBOLS.has(sym)) {
    sector = 'Stablecoin';
  } else if (holding.isNative || BLUECHIP_SYMBOLS.has(sym)) {
    sector = 'Actif Majeur / L1-L2';
  } else if (DEFI_SYMBOLS.has(sym)) {
    sector = 'DeFi / DEX';
  } else if (liq < 150_000 || (fdv > 0 && fdv < 10_000_000)) {
    sector = 'Micro-Cap / Volatil';
  }

  // Liquidity score 0-100 calibrated from real pool USD liquidity
  let liquidityScore = 0;
  if (liq >= 5_000_000) liquidityScore = 95;
  else if (liq >= 1_000_000) liquidityScore = 82;
  else if (liq >= 250_000) liquidityScore = 64;
  else if (liq >= 50_000) liquidityScore = 42;
  else if (liq > 0) liquidityScore = 18;

  let riskLevel: RiskLevel = 'Modéré';
  if (sector === 'Stablecoin' || (sector === 'Actif Majeur / L1-L2' && liq >= 500_000)) {
    riskLevel = 'Faible';
  } else if (liq < 100_000 || sector === 'Micro-Cap / Volatil') {
    riskLevel = 'Élevé';
  }

  const liquidityLabel =
    liq >= 1_000_000
      ? 'Liquidité profonde'
      : liq >= 100_000
        ? 'Liquidité correcte'
        : liq > 0
          ? 'Liquidité faible'
          : 'Non mesurée';

  let buyPressurePercent: number | null = null;
  if (metrics?.txns24h) {
    const totalTx = metrics.txns24h.buys + metrics.txns24h.sells;
    if (totalTx > 0) {
      buyPressurePercent = (metrics.txns24h.buys / totalTx) * 100;
    }
  }

  return {
    sector,
    riskLevel,
    liquidityScore,
    liquidityLabel,
    buyPressurePercent,
    poolAgeLabel: formatPoolAge(metrics?.poolCreatedAt ?? null),
  };
}
