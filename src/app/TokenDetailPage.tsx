import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { AiQuantPanel } from '../components/AiQuantPanel';
import { CommunityPulsePanel } from '../components/CommunityPulsePanel';
import { TokenAlertsAndNotesPanel } from '../components/TokenAlertsAndNotesPanel';
import { TokenIcon } from '../components/TokenIcon';
import { TokenPnlPanel } from '../components/TokenPnlPanel';
import {
  TokenPriceChart,
  type ChartTimeframe,
} from '../components/TokenPriceChart';
import { makeTokenMetadataKey } from '../services/notes/tokenMetadataStorage';
import {
  classifyTokenMetrics,
  fetchGeckoTerminalOhlcv,
  fetchOnChainTokenMetrics,
} from '../services/onchain/marketMetrics';
import { makeCostBasisKey } from '../services/pnl/costBasisStorage';
import {
  computePortfolioPnlSummary,
  computeTokenPnl,
} from '../services/pnl/pnlEngine';
import {
  fetchTokenSocialPulse,
  type TokenSocialPulseResult,
} from '../services/social/socialService';
import type { CreateAlertInput, TokenAlert } from '../types/alerts';
import type { ActiveChainId } from '../types/chain';
import type { ApiConfigStatus, ThemeMode } from '../types/config';
import type { TokenCustomMetadata } from '../types/metadata';
import type { OhlcvCandle, OnChainTokenMetrics } from '../types/onchain';
import type { CostBasisEntry } from '../types/pnl';
import type {
  PortfolioSnapshot,
  PortfolioSummary,
  TokenHolding,
} from '../types/portfolio';
import {
  formatPercent,
  formatTokenAmount,
  formatTokenPrice,
  formatUsd,
} from '../utils/format';
import { analyzeTechnicalIndicators } from '../utils/indicators';
import {
  getChainLabel,
  getExplorerName,
  getExplorerTokenUrl,
  shortenAddress,
} from '../utils/validators';

interface TokenDetailPageProps {
  holding: TokenHolding;
  allHoldings: TokenHolding[];
  portfolio: PortfolioSummary;
  snapshots: PortfolioSnapshot[];
  apiConfig: ApiConfigStatus | null;
  totalPortfolioUsd: number;
  theme: ThemeMode;
  costBasisMap: Record<string, CostBasisEntry>;
  alerts: TokenAlert[];
  metadataMap: Record<string, TokenCustomMetadata>;
  onSaveCostBasis: (
    chain: TokenHolding['chain'],
    tokenAddress: string,
    avgPriceUsd: number,
    source: 'manual' | 'onchain-import',
    txCount?: number
  ) => void;
  onDeleteCostBasis: (chain: TokenHolding['chain'], tokenAddress: string) => void;
  onCreateAlert: (input: CreateAlertInput) => void;
  onToggleAlert: (id: string) => void;
  onRearmAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onAcknowledgeAlert: (id: string) => void;
  onToggleFavorite: (chain: ActiveChainId, tokenAddress: string) => void;
  onSaveTags: (chain: ActiveChainId, tokenAddress: string, tags: string[]) => void;
  onSaveNote: (chain: ActiveChainId, tokenAddress: string, note: string) => void;
  onEvaluateTokenAlerts: (
    chain: ActiveChainId,
    tokenAddress: string,
    metrics: OnChainTokenMetrics | null,
    rsi14: number | null
  ) => void;
  onBack: () => void;
  onGoToConfig: () => void;
}

const TIMEFRAME_CONFIG: Record<
  ChartTimeframe,
  { timeframe: 'minute' | 'hour' | 'day'; aggregate: number; limit: number }
> = {
  '15m': { timeframe: 'minute', aggregate: 15, limit: 220 },
  '1H': { timeframe: 'hour', aggregate: 1, limit: 220 },
  '4H': { timeframe: 'hour', aggregate: 4, limit: 220 },
  '1D': { timeframe: 'day', aggregate: 1, limit: 220 },
};

export function TokenDetailPage({
  holding,
  allHoldings,
  portfolio,
  snapshots,
  apiConfig,
  totalPortfolioUsd,
  theme,
  costBasisMap,
  alerts,
  metadataMap,
  onSaveCostBasis,
  onDeleteCostBasis,
  onCreateAlert,
  onToggleAlert,
  onRearmAlert,
  onDeleteAlert,
  onAcknowledgeAlert,
  onToggleFavorite,
  onSaveTags,
  onSaveNote,
  onEvaluateTokenAlerts,
  onBack,
  onGoToConfig,
}: TokenDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'ta' | 'social' | 'ai' | 'manage'>('overview');
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('1H');
  const [showEma, setShowEma] = useState(true);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showLevels, setShowLevels] = useState(true);

  const [metrics, setMetrics] = useState<OnChainTokenMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [candles, setCandles] = useState<OhlcvCandle[]>([]);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [socialPulse, setSocialPulse] = useState<TokenSocialPulseResult | null>(null);
  const [socialLoading, setSocialLoading] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr] = useState(false);

  // Fetch DexScreener + GeckoTerminal combined metrics
  useEffect(() => {
    let active = true;
    setMetricsLoading(true);
    fetchOnChainTokenMetrics(holding.chain, holding.address)
      .then((res) => {
        if (active) setMetrics(res);
      })
      .catch(() => {
        if (active) setMetrics(null);
      })
      .finally(() => {
        if (active) setMetricsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [holding.chain, holding.address]);

  // Fetch GeckoTerminal OHLCV whenever poolAddress or timeframe changes
  useEffect(() => {
    const poolAddr = metrics?.poolAddress;
    if (!poolAddr) {
      setCandles([]);
      return;
    }
    let active = true;
    setCandlesLoading(true);
    const cfg = TIMEFRAME_CONFIG[timeframe];
    fetchGeckoTerminalOhlcv({
      chain: holding.chain,
      poolAddress: poolAddr,
      timeframe: cfg.timeframe,
      aggregate: cfg.aggregate,
      limit: cfg.limit,
    })
      .then((list) => {
        if (active) setCandles(list);
      })
      .catch(() => {
        if (active) setCandles([]);
      })
      .finally(() => {
        if (active) setCandlesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [holding.chain, metrics?.poolAddress, timeframe]);

  const loadSocialData = (force = false) => {
    setSocialLoading(true);
    setSocialError(null);
    fetchTokenSocialPulse({
      chain: holding.chain,
      address: holding.address,
      symbol: holding.symbol,
      name: holding.name,
      isNative: holding.isNative,
      force,
    })
      .then((res) => setSocialPulse(res))
      .catch((err: any) => setSocialError(err?.message || 'Erreur sociale.'))
      .finally(() => setSocialLoading(false));
  };

  useEffect(() => {
    let active = true;
    setSocialLoading(true);
    setSocialError(null);
    fetchTokenSocialPulse({
      chain: holding.chain,
      address: holding.address,
      symbol: holding.symbol,
      name: holding.name,
      isNative: holding.isNative,
    })
      .then((res) => {
        if (active) setSocialPulse(res);
      })
      .catch((err: any) => {
        if (active) setSocialError(err?.message || 'Erreur sociale.');
      })
      .finally(() => {
        if (active) setSocialLoading(false);
      });
    return () => {
      active = false;
    };
  }, [holding.chain, holding.address, holding.symbol, holding.name, holding.isNative]);

  const technicalAnalysis = useMemo(() => {
    if (candles.length === 0) return null;
    return analyzeTechnicalIndicators(candles);
  }, [candles]);

  useEffect(() => {
    onEvaluateTokenAlerts(
      holding.chain,
      holding.address,
      metrics,
      technicalAnalysis?.latestRsi14 ?? null
    );
  }, [
    holding.chain,
    holding.address,
    metrics,
    technicalAnalysis?.latestRsi14,
    onEvaluateTokenAlerts,
  ]);

  const classification = useMemo(
    () => classifyTokenMetrics(holding, metrics),
    [holding, metrics]
  );

  const pnl = useMemo(
    () => computeTokenPnl(holding, costBasisMap),
    [holding, costBasisMap]
  );

  const portfolioPnl = useMemo(
    () => computePortfolioPnlSummary(portfolio, snapshots, costBasisMap),
    [portfolio, snapshots, costBasisMap]
  );

  const costBasisEntry = costBasisMap[makeCostBasisKey(holding.chain, holding.address)];
  const metaKey = makeTokenMetadataKey(holding.chain, holding.address);
  const isFavorite = metadataMap[metaKey]?.isFavorite ?? false;
  const portfolioWeight =
    totalPortfolioUsd > 0 ? (holding.valueUsd / totalPortfolioUsd) * 100 : 0;

  const livePrice = metrics?.priceUsd ?? holding.priceUsd;
  const change24h = metrics?.priceChange24h ?? holding.priceChange24h;
  const isUp24h = (change24h ?? 0) >= 0;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(holding.address);
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Navigation & Token Identity Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Retour au portefeuille</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <TokenIcon
              logoUrl={holding.logoUrl}
              symbol={holding.symbol}
              chain={holding.chain}
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                  {holding.name}
                </h1>
                <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                  {holding.symbol}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(holding.chain, holding.address)}
                  aria-label={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  title={isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    isFavorite
                      ? 'text-amber-500'
                      : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
                  }`}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>{getChainLabel(holding.chain)}</span>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={handleCopyAddress}
                  className="inline-flex items-center gap-1 font-mono hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <span>{shortenAddress(holding.address, 6, 6)}</span>
                  {copiedAddr ? (
                    <Check className="w-3 h-3 text-emerald-500" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
                <span aria-hidden="true">·</span>
                <span>{classification.sector}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Price + Position + Direct Links */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6">
          <div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Prix actuel</span>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                {formatTokenPrice(livePrice)}
              </span>
              {change24h !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-xs tabular-nums ${
                    isUp24h
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isUp24h ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span>{formatPercent(change24h)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="pl-4 border-l border-slate-200 dark:border-slate-800">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Position ({portfolioWeight.toFixed(1)}%)
            </span>
            <div className="font-mono text-base font-semibold text-slate-900 dark:text-white tabular-nums">
              {formatUsd(holding.valueUsd)}
            </div>
            <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {formatTokenAmount(holding.balance)} {holding.symbol}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {(metrics?.dexScreenerUrl || holding.pairUrl) && (
              <a
                href={metrics?.dexScreenerUrl || holding.pairUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <span>DexScreener</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            {metrics?.geckoTerminalUrl && (
              <a
                href={metrics.geckoTerminalUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                <span>GeckoTerminal</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
            <a
              href={getExplorerTokenUrl(holding.chain, holding.address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
            >
              <span>{getExplorerName(holding.chain)}</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Mode Switch Tabs */}
      <div className="inline-flex flex-wrap items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'overview'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Aperçu, PnL &amp; Marché
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ta')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ta'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Analyse Technique
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('social')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'social'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Pouls Communautaire
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('ai')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'ai'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Analyse IA Quantitative
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('manage')}
          className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
            activeTab === 'manage'
              ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          Alertes, Notes &amp; Export
        </button>
      </div>

      {/* Interactive Chart Card (visible on Overview & TA tabs) */}
      {activeTab !== 'social' && activeTab !== 'ai' && activeTab !== 'manage' && (
      <section className="glass-panel rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
              {(['15m', '1H', '4H', '1D'] as ChartTimeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors cursor-pointer ${
                    timeframe === tf
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {metrics?.dexId && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Pool {metrics.dexId} · Âge : {classification.poolAgeLabel}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEma((v) => !v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                showEma
                  ? 'border-blue-500/60 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              EMA 20 / 50 / 200
            </button>
            <button
              type="button"
              onClick={() => setShowBollinger((v) => !v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                showBollinger
                  ? 'border-slate-500 bg-slate-500/10 text-slate-900 dark:text-slate-100'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              Bollinger
            </button>
            <button
              type="button"
              onClick={() => setShowLevels((v) => !v)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                showLevels
                  ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
              }`}
            >
              Supports / Résistances
            </button>
          </div>
        </div>

        {candlesLoading || metricsLoading ? (
          <div className="h-[340px] rounded-lg bg-slate-100/70 dark:bg-slate-800/35 animate-pulse" />
        ) : (
          <TokenPriceChart
            candles={candles}
            analysis={technicalAnalysis}
            theme={theme}
            showEma={showEma}
            showBollinger={showBollinger}
            showLevels={showLevels}
            showOscillators={activeTab === 'ta'}
          />
        )}
      </section>
      )}

      {activeTab === 'manage' ? (
        <TokenAlertsAndNotesPanel
          holding={holding}
          allHoldings={allHoldings}
          livePriceUsd={livePrice ?? 0}
          metrics={metrics}
          latestRsi14={technicalAnalysis?.latestRsi14 ?? null}
          alerts={alerts}
          metadataMap={metadataMap}
          costBasisMap={costBasisMap}
          onCreateAlert={onCreateAlert}
          onToggleAlert={onToggleAlert}
          onRearmAlert={onRearmAlert}
          onDeleteAlert={onDeleteAlert}
          onAcknowledgeAlert={onAcknowledgeAlert}
          onToggleFavorite={() => onToggleFavorite(holding.chain, holding.address)}
          onSaveTags={(tags) => onSaveTags(holding.chain, holding.address, tags)}
          onSaveNote={(note) => onSaveNote(holding.chain, holding.address, note)}
        />
      ) : activeTab === 'ai' ? (
        <AiQuantPanel
          holding={holding}
          totalPortfolioUsd={totalPortfolioUsd}
          livePriceUsd={livePrice ?? 0}
          metrics={metrics}
          classification={classification}
          pnl={pnl}
          portfolioPnl={portfolioPnl}
          technicalAnalysis={technicalAnalysis}
          timeframe={timeframe}
          socialPayload={socialPulse?.payload ?? null}
          socialAnalysis={socialPulse?.analysis ?? null}
          apiConfig={apiConfig}
          onGoToConfig={onGoToConfig}
        />
      ) : activeTab === 'social' ? (
        <CommunityPulsePanel
          payload={socialPulse?.payload ?? null}
          analysis={socialPulse?.analysis ?? null}
          isLoading={socialLoading}
          error={socialError}
          onRefresh={() => loadSocialData(true)}
        />
      ) : activeTab === 'overview' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Left 7 cols: PnL + Market Metrics */}
          <div className="xl:col-span-7 space-y-5">
            <TokenPnlPanel
              holding={holding}
              poolAddress={metrics?.poolAddress ?? null}
              pnl={pnl}
              costBasisEntry={costBasisEntry}
              onSaveCostBasis={(avg, src, txCount) =>
                onSaveCostBasis(holding.chain, holding.address, avg, src, txCount)
              }
              onDeleteCostBasis={() =>
                onDeleteCostBasis(holding.chain, holding.address)
              }
              onGoToConfig={onGoToConfig}
            />

            {/* Variations 1h / 6h / 24h & Volumes */}
            <section className="glass-panel rounded-xl p-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                Métriques de marché (DexScreener &amp; GeckoTerminal)
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Liquidité Pool</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatUsd(metrics?.liquidityUsd ?? holding.liquidityUsd, true)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Volume 24h</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatUsd(metrics?.volume24h, true)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Market Cap / FDV</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatUsd(metrics?.marketCap ?? metrics?.fdv ?? holding.fdv, true)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Variation 1h</span>
                  <div
                    className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                      (metrics?.priceChange1h ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatPercent(metrics?.priceChange1h)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Variation 6h</span>
                  <div
                    className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
                      (metrics?.priceChange6h ?? 0) >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatPercent(metrics?.priceChange6h)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">FDV Totale</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatUsd(metrics?.fdv ?? holding.fdv, true)}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right 5 cols: Liquidity Gauge, Buy/Sell Pressure, Risk Profile */}
          <div className="xl:col-span-5 space-y-5">
            <section className="glass-panel rounded-xl p-5 space-y-5">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pression On-Chain &amp; Liquidité
              </h2>

              {/* Buy vs Sell Pressure 24h */}
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Transactions 24h (Achats vs Ventes)
                  </span>
                  {classification.buyPressurePercent !== null ? (
                    <span className="font-mono text-slate-900 dark:text-slate-100 tabular-nums">
                      {classification.buyPressurePercent.toFixed(1)}% achats
                    </span>
                  ) : (
                    <span className="font-mono text-slate-400">—</span>
                  )}
                </div>

                <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  {classification.buyPressurePercent !== null ? (
                    <>
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{ width: `${classification.buyPressurePercent}%` }}
                      />
                      <div
                        className="h-full bg-rose-500 transition-all"
                        style={{ width: `${100 - classification.buyPressurePercent}%` }}
                      />
                    </>
                  ) : null}
                </div>

                {metrics?.txns24h && (
                  <div className="mt-2 flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {metrics.txns24h.buys.toLocaleString('fr-FR')} achats
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {metrics.txns24h.sells.toLocaleString('fr-FR')} ventes
                    </span>
                  </div>
                )}
              </div>

              {/* Liquidity Gauge */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Jauge de liquidité
                  </span>
                  <span className="font-mono text-slate-900 dark:text-slate-100">
                    {classification.liquidityLabel}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      classification.liquidityScore >= 70
                        ? 'bg-emerald-500'
                        : classification.liquidityScore >= 40
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                    }`}
                    style={{ width: `${classification.liquidityScore}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Âge de la pool : {classification.poolAgeLabel}</span>
                  <span>{metrics?.poolCount ?? 0} pool(s) indexée(s)</span>
                </div>
              </div>

              {/* Sector & Risk Classification */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Secteur</span>
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {classification.sector}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Profil de risque</span>
                  <span
                    className={`inline-flex items-center gap-1 font-medium ${
                      classification.riskLevel === 'Faible'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : classification.riskLevel === 'Modéré'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>{classification.riskLevel}</span>
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : (
        /* Technical Analysis Tab */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          {/* Verdict & Trend Breakdown */}
          <section className="xl:col-span-5 glass-panel rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Tendance Globale ({timeframe})
                </h2>
              </div>

              {technicalAnalysis && (
                <span
                  className={`font-mono text-xs font-semibold px-2.5 py-1 rounded-md ${
                    technicalAnalysis.globalTrend === 'Haussier'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                      : technicalAnalysis.globalTrend === 'Baissier'
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {technicalAnalysis.globalTrend}
                </span>
              )}
            </div>

            {technicalAnalysis ? (
              <>
                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  {technicalAnalysis.trendReasons.map((reason) => (
                    <li key={reason} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>

                {/* Supports & Resistances */}
                <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Supports clés
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {technicalAnalysis.supports.length > 0 ? (
                        technicalAnalysis.supports.map((s, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200"
                          >
                            <span>{formatTokenPrice(s.price)}</span>
                            <span className="text-[10px] text-slate-400">×{s.touches}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400">
                      Résistances clés
                    </span>
                    <div className="mt-1.5 space-y-1">
                      {technicalAnalysis.resistances.length > 0 ? (
                        technicalAnalysis.resistances.map((r, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-800 dark:text-slate-200"
                          >
                            <span>{formatTokenPrice(r.price)}</span>
                            <span className="text-[10px] text-slate-400">×{r.touches}</span>
                          </div>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Données OHLCV insuffisantes pour calculer la tendance technique.
              </p>
            )}
          </section>

          {/* Mathematical Indicator Readouts */}
          <section className="xl:col-span-7 glass-panel rounded-xl p-5">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
              Indicateurs calculés ({technicalAnalysis?.candleCount || 0} bougies GeckoTerminal)
            </h2>

            {technicalAnalysis ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">RSI (14)</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {technicalAnalysis.latestRsi14 !== null
                      ? technicalAnalysis.latestRsi14.toFixed(2)
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {technicalAnalysis.rsiSignal}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    MACD (12, 26, 9)
                  </span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {technicalAnalysis.macd.latestHistogram !== null
                      ? technicalAnalysis.macd.latestHistogram.toExponential(2)
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Biais : {technicalAnalysis.macd.bias}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">ATR (14)</span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {technicalAnalysis.atrPercent !== null
                      ? `${technicalAnalysis.atrPercent.toFixed(2)}%`
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Volatilité / bougie
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    EMA 20 / SMA 20
                  </span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatTokenPrice(
                      technicalAnalysis.ema20[technicalAnalysis.ema20.length - 1]
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    SMA:{' '}
                    {formatTokenPrice(
                      technicalAnalysis.sma20[technicalAnalysis.sma20.length - 1]
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    EMA 50 / EMA 200
                  </span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {formatTokenPrice(
                      technicalAnalysis.ema50[technicalAnalysis.ema50.length - 1]
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    200:{' '}
                    {formatTokenPrice(
                      technicalAnalysis.ema200[technicalAnalysis.ema200.length - 1]
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Largeur Bollinger (20, 2)
                  </span>
                  <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                    {technicalAnalysis.bollinger.bandwidthPercent !== null
                      ? `${technicalAnalysis.bollinger.bandwidthPercent.toFixed(2)}%`
                      : '—'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Compression / Expansion
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sélectionnez un actif disposant d&apos;une pool active sur GeckoTerminal.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
