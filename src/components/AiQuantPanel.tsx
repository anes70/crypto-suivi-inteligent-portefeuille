import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  BrainCircuit,
  Clock,
  Crosshair,
  History,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import {
  MissingAiKeyError,
  runQuantitativeAiAnalysis,
} from '../services/ai/aiAnalyzeService';
import {
  clearTokenAiHistory,
  loadTokenAiHistory,
  saveTokenAiAnalysis,
} from '../services/ai/aiHistoryStorage';
import type {
  AiDecision,
  AiProvider,
  AiTokenAnalysis,
  AnalyzeTokenPayload,
} from '../types/ai';
import type { ApiConfigStatus } from '../types/config';
import type {
  OnChainTokenMetrics,
  TechnicalAnalysisResult,
  TokenClassification,
} from '../types/onchain';
import type { PortfolioPnlSummary, TokenPnlResult } from '../types/pnl';
import type { TokenHolding } from '../types/portfolio';
import type { SocialPulseAnalysis, SocialPulsePayload } from '../types/social';
import { formatRelativeTime, formatTokenPrice } from '../utils/format';
import { ApiKeyRequiredCard } from './ApiKeyRequiredCard';

interface AiQuantPanelProps {
  holding: TokenHolding;
  totalPortfolioUsd: number;
  livePriceUsd: number;
  metrics: OnChainTokenMetrics | null;
  classification: TokenClassification;
  pnl: TokenPnlResult;
  portfolioPnl: PortfolioPnlSummary;
  technicalAnalysis: TechnicalAnalysisResult | null;
  timeframe: string;
  socialPayload: SocialPulsePayload | null;
  socialAnalysis: SocialPulseAnalysis | null;
  apiConfig: ApiConfigStatus | null;
  onGoToConfig: () => void;
}

function getDecisionStyle(decision: AiDecision): {
  accentClass: string;
  bgClass: string;
  borderClass: string;
} {
  switch (decision) {
    case 'RENFORCER':
      return {
        accentClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-500/10',
        borderClass: 'border-emerald-500/30',
      };
    case 'CONSERVER':
      return {
        accentClass: 'text-blue-600 dark:text-blue-400',
        bgClass: 'bg-blue-500/10',
        borderClass: 'border-blue-500/30',
      };
    case 'PRENDRE PROFITS':
      return {
        accentClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
      };
    case 'ATTENDRE':
      return {
        accentClass: 'text-slate-700 dark:text-slate-200',
        bgClass: 'bg-slate-500/10',
        borderClass: 'border-slate-500/30',
      };
    case 'VENDRE':
    case 'ÉVITER':
      return {
        accentClass: 'text-rose-600 dark:text-rose-400',
        bgClass: 'bg-rose-500/10',
        borderClass: 'border-rose-500/30',
      };
  }
}

function formatDeltaPct(targetPrice: number, referencePrice: number): string {
  if (!Number.isFinite(targetPrice) || !Number.isFinite(referencePrice) || referencePrice <= 0) {
    return '—';
  }
  const pct = ((targetPrice - referencePrice) / referencePrice) * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function ScoreGauge({
  label,
  value,
  inverseRisk = false,
}: {
  label: string;
  value: number;
  inverseRisk?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const barColor = inverseRisk
    ? clamped >= 70
      ? 'bg-rose-500'
      : clamped >= 40
        ? 'bg-amber-500'
        : 'bg-emerald-500'
    : clamped >= 70
      ? 'bg-emerald-500'
      : clamped >= 45
        ? 'bg-blue-500'
        : 'bg-slate-400 dark:bg-slate-500';

  return (
    <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
        <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
          {clamped} / 100
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
        <div
          className={`h-full transition-all ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

export function AiQuantPanel({
  holding,
  totalPortfolioUsd,
  livePriceUsd,
  metrics,
  classification,
  pnl,
  portfolioPnl,
  technicalAnalysis,
  timeframe,
  socialPayload,
  socialAnalysis,
  apiConfig,
  onGoToConfig,
}: AiQuantPanelProps) {
  const [history, setHistory] = useState<AiTokenAnalysis[]>(() =>
    loadTokenAiHistory(holding.chain, holding.address)
  );
  const [activeAnalysis, setActiveAnalysis] = useState<AiTokenAnalysis | null>(() => {
    const loaded = loadTokenAiHistory(holding.chain, holding.address);
    return loaded[0] ?? null;
  });
  const [preferredProvider, setPreferredProvider] = useState<'auto' | AiProvider>('auto');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Sync history when switching tokens
  useEffect(() => {
    const loaded = loadTokenAiHistory(holding.chain, holding.address);
    setHistory(loaded);
    setActiveAnalysis(loaded[0] ?? null);
    setError(null);
    setApiKeyMissing(false);
  }, [holding.chain, holding.address]);

  const noServerKeyConfigured =
    apiConfig !== null && !apiConfig.groqConfigured && !apiConfig.geminiConfigured;

  const buildPayload = (): AnalyzeTokenPayload => {
    const portfolioWeightPct =
      totalPortfolioUsd > 0 ? (holding.valueUsd / totalPortfolioUsd) * 100 : 0;

    return {
      preferredProvider,
      token: {
        chain: holding.chain,
        address: holding.address,
        symbol: holding.symbol,
        name: holding.name,
        isNative: holding.isNative,
        currentPriceUsd: livePriceUsd,
        balance: holding.balance,
        valueUsd: holding.valueUsd,
        portfolioWeightPct,
      },
      pnl: {
        hasCostBasis: pnl.avgBuyPriceUsd !== null,
        avgBuyPriceUsd: pnl.avgBuyPriceUsd,
        costBasisSource: pnl.source,
        unrealizedPnlUsd: pnl.unrealizedPnlUsd,
        roiPercent: pnl.roiPercent,
        portfolioDailyChangePct: portfolioPnl.daily.pnlPercent,
        portfolioWeeklyChangePct: portfolioPnl.weekly.pnlPercent,
        portfolioMonthlyChangePct: portfolioPnl.monthly.pnlPercent,
      },
      onchain: {
        liquidityUsd: metrics?.liquidityUsd ?? holding.liquidityUsd ?? null,
        volume24hUsd: metrics?.volume24h ?? null,
        fdvUsd: metrics?.fdv ?? holding.fdv ?? null,
        marketCapUsd: metrics?.marketCap ?? null,
        priceChange1hPct: metrics?.priceChange1h ?? null,
        priceChange6hPct: metrics?.priceChange6h ?? null,
        priceChange24hPct: metrics?.priceChange24h ?? holding.priceChange24h ?? null,
        buys24h: metrics?.txns24h?.buys ?? null,
        sells24h: metrics?.txns24h?.sells ?? null,
        buyPressurePct: classification.buyPressurePercent,
        poolAgeLabel: classification.poolAgeLabel,
        poolCount: metrics?.poolCount ?? 0,
        dexId: metrics?.dexId ?? holding.dexId ?? null,
        sector: classification.sector,
        riskLevel: classification.riskLevel,
        liquidityScore: classification.liquidityScore,
      },
      technical: {
        timeframe,
        candleCount: technicalAnalysis?.candleCount ?? 0,
        globalTrend: technicalAnalysis?.globalTrend ?? null,
        trendReasons: technicalAnalysis?.trendReasons ?? [],
        rsi14: technicalAnalysis?.latestRsi14 ?? null,
        rsiSignal: technicalAnalysis?.rsiSignal ?? null,
        macdHistogram: technicalAnalysis?.macd.latestHistogram ?? null,
        macdBias: technicalAnalysis?.macd.bias ?? null,
        ema20:
          technicalAnalysis && technicalAnalysis.ema20.length > 0
            ? technicalAnalysis.ema20[technicalAnalysis.ema20.length - 1]
            : null,
        ema50:
          technicalAnalysis && technicalAnalysis.ema50.length > 0
            ? technicalAnalysis.ema50[technicalAnalysis.ema50.length - 1]
            : null,
        ema200:
          technicalAnalysis && technicalAnalysis.ema200.length > 0
            ? technicalAnalysis.ema200[technicalAnalysis.ema200.length - 1]
            : null,
        sma20:
          technicalAnalysis && technicalAnalysis.sma20.length > 0
            ? technicalAnalysis.sma20[technicalAnalysis.sma20.length - 1]
            : null,
        bollingerUpper:
          technicalAnalysis && technicalAnalysis.bollinger.upper.length > 0
            ? technicalAnalysis.bollinger.upper[
                technicalAnalysis.bollinger.upper.length - 1
              ]
            : null,
        bollingerLower:
          technicalAnalysis && technicalAnalysis.bollinger.lower.length > 0
            ? technicalAnalysis.bollinger.lower[
                technicalAnalysis.bollinger.lower.length - 1
              ]
            : null,
        bollingerBandwidthPct: technicalAnalysis?.bollinger.bandwidthPercent ?? null,
        atrPercent: technicalAnalysis?.atrPercent ?? null,
        supportsUsd: technicalAnalysis?.supports.map((s) => s.price) ?? [],
        resistancesUsd: technicalAnalysis?.resistances.map((r) => r.price) ?? [],
      },
      social: {
        sentimentLabel: socialAnalysis?.sentimentLabel ?? null,
        positivePct: socialAnalysis?.positivePct ?? null,
        neutralPct: socialAnalysis?.neutralPct ?? null,
        negativePct: socialAnalysis?.negativePct ?? null,
        cgVotesUpPct: socialPayload?.coingeckoSentiment.votesUpPercent ?? null,
        cgVotesDownPct: socialPayload?.coingeckoSentiment.votesDownPercent ?? null,
        watchlistUsers: socialPayload?.coingeckoSentiment.watchlistUsers ?? null,
        buzzIndex: socialAnalysis?.buzzIndex ?? null,
        buzzLabel: socialAnalysis?.buzzLabel ?? null,
        dominantNarrative: socialAnalysis?.dominantNarrative ?? null,
        githubStars: socialPayload?.developerActivity.githubStars ?? null,
        commits4Weeks: socialPayload?.developerActivity.commits4Weeks ?? null,
        newsCount: socialPayload?.news.length ?? 0,
        redditCount: socialPayload?.redditPosts.length ?? 0,
        recentHeadlines:
          socialAnalysis?.feed.slice(0, 5).map((item) => item.title) ?? [],
      },
    };
  };

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setError(null);
    setApiKeyMissing(false);
    try {
      const result = await runQuantitativeAiAnalysis(buildPayload());
      const nextHistory = saveTokenAiAnalysis(
        holding.chain,
        holding.address,
        result
      );
      setHistory(nextHistory);
      setActiveAnalysis(result);
    } catch (err: any) {
      if (err instanceof MissingAiKeyError) {
        setApiKeyMissing(true);
      } else {
        setError(
          err?.message || "Impossible de générer l'analyse quantitative IA."
        );
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClearHistory = () => {
    const next = clearTokenAiHistory(holding.chain, holding.address);
    setHistory(next);
    setActiveAnalysis(null);
  };

  const decisionStyle = activeAnalysis
    ? getDecisionStyle(activeAnalysis.decision)
    : null;

  return (
    <div className="space-y-5">
      {/* Header & Action Bar */}
      <section className="glass-panel rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Moteur d&apos;Analyse Quantitative IA
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Synthèse multi-facteurs (On-Chain, Technique {timeframe}, PnL &amp; Pouls Social) en sortie JSON structurée.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {apiConfig?.groqConfigured && apiConfig?.geminiConfigured && (
            <select
              value={preferredProvider}
              onChange={(e) =>
                setPreferredProvider(e.target.value as 'auto' | AiProvider)
              }
              aria-label="Modèle IA"
              className="px-2.5 py-2 rounded-lg text-xs font-medium bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="auto">Auto (Groq / Gemini)</option>
              <option value="groq">Groq · Llama 3.3 70B</option>
              <option value="gemini">Google · Gemini 2.5 Flash</option>
            </select>
          )}

          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white disabled:opacity-60 transition-colors cursor-pointer"
          >
            {isAnalyzing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : activeAnalysis ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>
              {isAnalyzing
                ? 'Analyse en cours…'
                : activeAnalysis
                  ? "Régénérer l'analyse"
                  : "Lancer l'analyse IA"}
            </span>
          </button>
        </div>
      </section>

      {/* Missing API Key Banner */}
      {(apiKeyMissing || noServerKeyConfigured) && (
        <ApiKeyRequiredCard
          title="Clé API requise (Moteur IA)"
          description="Configurez GROQ_API_KEY (Llama 3.3 70B gratuit sur console.groq.com) dans votre .env ou activez GEMINI_API_KEY dans les Secrets serveur pour exécuter l'analyse quantitative."
          envKeyNames={['GROQ_API_KEY', 'GEMINI_API_KEY']}
          onGoToConfig={onGoToConfig}
        />
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50/70 dark:bg-rose-950/20 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-600 text-white hover:bg-rose-700 cursor-pointer shrink-0"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Empty State before first run */}
      {!activeAnalysis && !isAnalyzing && !apiKeyMissing && !noServerKeyConfigured && (
        <section className="glass-panel rounded-xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Aucune analyse générée pour {holding.symbol}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg mx-auto leading-relaxed">
            Cliquez sur &laquo;&nbsp;Lancer l&apos;analyse IA&nbsp;&raquo; pour transmettre les métriques on-chain, bougies techniques, données PnL et signaux sociaux réels au moteur quantitatif.
          </p>
        </section>
      )}

      {/* Loading Skeleton */}
      {isAnalyzing && !activeAnalysis && (
        <div className="space-y-4">
          <div className="h-36 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            <div className="xl:col-span-5 h-56 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
            <div className="xl:col-span-7 h-56 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
          </div>
        </div>
      )}

      {/* Active Analysis Results */}
      {activeAnalysis && decisionStyle && (
        <div className="space-y-5">
          {/* Verdict + 4 Quantitative Scores */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Verdict Card */}
            <section className="xl:col-span-5 glass-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Décision principale
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Horizon : {activeAnalysis.scores.horizon}</span>
                  </span>
                </div>

                <div
                  className={`rounded-lg border px-4 py-3 ${decisionStyle.bgClass} ${decisionStyle.borderClass}`}
                >
                  <div
                    className={`font-mono text-2xl font-bold tracking-tight ${decisionStyle.accentClass}`}
                  >
                    {activeAnalysis.decision}
                  </div>
                </div>

                {activeAnalysis.summary && (
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                    {activeAnalysis.summary}
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-mono">
                  {activeAnalysis.provider === 'groq' ? 'Groq' : 'Gemini'} ·{' '}
                  {activeAnalysis.model}
                </span>
                <span>
                  Prix référence :{' '}
                  <strong className="font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                    {formatTokenPrice(activeAnalysis.priceAtAnalysisUsd)}
                  </strong>{' '}
                  · {formatRelativeTime(activeAnalysis.generatedAt)}
                </span>
              </div>
            </section>

            {/* Scores Matrix (0-100) */}
            <section className="xl:col-span-7 glass-panel rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Scores quantitatifs (/ 100)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <ScoreGauge
                  label="Indice de Confiance"
                  value={activeAnalysis.scores.confidence}
                />
                <ScoreGauge
                  label="Score de Risque"
                  value={activeAnalysis.scores.risk}
                  inverseRisk
                />
                <ScoreGauge
                  label="Potentiel de Hausse"
                  value={activeAnalysis.scores.potential}
                />
                <ScoreGauge
                  label="Force de Renforcement"
                  value={activeAnalysis.scores.reinforcementStrength}
                />
              </div>
            </section>
          </div>

          {/* Strategic Price Levels + Factual Reasoning */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
            {/* Strategic Price Levels */}
            <section className="xl:col-span-5 glass-panel rounded-xl p-5 space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Niveaux de prix stratégiques
                </h3>
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Actuel : {formatTokenPrice(livePriceUsd)}
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <Target className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>Objectif de prix (Cible)</span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                      {formatTokenPrice(activeAnalysis.priceLevels.targetPriceUsd)}
                    </div>
                    <div className="text-[11px] text-blue-600 dark:text-blue-400">
                      {formatDeltaPct(
                        activeAnalysis.priceLevels.targetPriceUsd,
                        livePriceUsd
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Take Profit conseillé</span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {formatTokenPrice(activeAnalysis.priceLevels.takeProfitUsd)}
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {formatDeltaPct(
                        activeAnalysis.priceLevels.takeProfitUsd,
                        livePriceUsd
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Stop Loss conseillé</span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {formatTokenPrice(activeAnalysis.priceLevels.stopLossUsd)}
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-400">
                      {formatDeltaPct(
                        activeAnalysis.priceLevels.stopLossUsd,
                        livePriceUsd
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <Crosshair className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Zone idéale d&apos;achat</span>
                  </div>
                  <div className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
                    {formatTokenPrice(activeAnalysis.priceLevels.idealBuyZone.minUsd)}{' '}
                    –{' '}
                    {formatTokenPrice(activeAnalysis.priceLevels.idealBuyZone.maxUsd)}
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    <span>Zone de danger</span>
                  </div>
                  <div className="text-right font-mono text-xs font-semibold text-rose-700 dark:text-rose-300 tabular-nums">
                    {formatTokenPrice(activeAnalysis.priceLevels.dangerZone.minUsd)}{' '}
                    –{' '}
                    {formatTokenPrice(activeAnalysis.priceLevels.dangerZone.maxUsd)}
                  </div>
                </div>
              </div>
            </section>

            {/* Structured Factual Reasoning */}
            <section className="xl:col-span-7 glass-panel rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Raisonnement factuel structuré
                </h3>
                <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  {activeAnalysis.reasoning.length} points clés
                </span>
              </div>

              <ol className="space-y-3">
                {activeAnalysis.reasoning.map((point, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80"
                  >
                    <span className="font-mono text-xs font-semibold text-blue-600 dark:text-blue-400 mt-0.5 shrink-0 tabular-nums">
                      0{idx + 1}
                    </span>
                    <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                      {point}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </div>
      )}

      {/* Saved AI Decision History */}
      {history.length > 0 && (
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Historique des décisions IA ({holding.symbol})
              </h3>
            </div>
            <button
              type="button"
              onClick={handleClearHistory}
              className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Effacer</span>
            </button>
          </div>

          <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
            {history.map((item) => {
              const isSelected = activeAnalysis?.id === item.id;
              const style = getDecisionStyle(item.decision);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveAnalysis(item)}
                  className={`w-full text-left p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/70 dark:bg-blue-950/20'
                      : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`font-mono text-xs font-bold ${style.accentClass}`}
                    >
                      {item.decision}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {item.scores.horizon}
                    </span>
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 tabular-nums">
                      Conf. {item.scores.confidence}% · Risque {item.scores.risk}% · Potentiel {item.scores.potential}%
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                    <span>
                      Prix : {formatTokenPrice(item.priceAtAnalysisUsd)} → Cible{' '}
                      {formatTokenPrice(item.priceLevels.targetPriceUsd)}
                    </span>
                    <span className="text-[11px] font-sans">
                      {formatRelativeTime(item.generatedAt)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
