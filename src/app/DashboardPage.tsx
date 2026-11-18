import { useMemo } from 'react';
import { ArrowRight, KeyRound, TrendingDown, TrendingUp } from 'lucide-react';
import { ApiKeyRequiredCard } from '../components/ApiKeyRequiredCard';
import { ChainAllocationCard } from '../components/ChainAllocationCard';
import { PortfolioHistoryChart } from '../components/PortfolioHistoryChart';
import { TokenTable } from '../components/TokenTable';
import { classifyTokenMetrics } from '../services/onchain/marketMetrics';
import { computePortfolioPnlSummary } from '../services/pnl/pnlEngine';
import type { TokenAlert } from '../types/alerts';
import type { ActiveChainId } from '../types/chain';
import type { ApiConfigStatus, ThemeMode } from '../types/config';
import type { TokenCustomMetadata } from '../types/metadata';
import type { RiskLevel } from '../types/onchain';
import type { CostBasisEntry } from '../types/pnl';
import type {
  PortfolioSnapshot,
  PortfolioSummary,
  TokenHolding,
} from '../types/portfolio';
import type { TrackedWallet } from '../types/wallet';
import { formatPercent, formatUsd } from '../utils/format';

interface DashboardPageProps {
  portfolio: PortfolioSummary;
  snapshots: PortfolioSnapshot[];
  wallets: TrackedWallet[];
  costBasisMap: Record<string, CostBasisEntry>;
  metadataMap: Record<string, TokenCustomMetadata>;
  alerts: TokenAlert[];
  apiConfig: ApiConfigStatus | null;
  theme: ThemeMode;
  selectedChain: 'all' | ActiveChainId;
  onSelectChain: (chain: 'all' | ActiveChainId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading: boolean;
  onOpenAddWallet: () => void;
  onGoToConfig: () => void;
  onSelectToken: (token: TokenHolding) => void;
  onToggleFavorite: (chain: ActiveChainId, tokenAddress: string) => void;
}

export function DashboardPage({
  portfolio,
  snapshots,
  wallets,
  costBasisMap,
  metadataMap,
  alerts,
  apiConfig,
  theme,
  selectedChain,
  onSelectChain,
  searchQuery,
  onSearchChange,
  isLoading,
  onOpenAddWallet,
  onGoToConfig,
  onSelectToken,
  onToggleFavorite,
}: DashboardPageProps) {
  const activeWalletCount = wallets.filter((w) => w.enabled).length;
  const isUp = portfolio.change24hUsd >= 0;

  const missingEnvKeys: string[] = [];
  if (apiConfig && !apiConfig.alchemyConfigured) {
    missingEnvKeys.push('NEXT_PUBLIC_ALCHEMY_API_KEY');
  }
  if (apiConfig && !apiConfig.heliusConfigured) {
    missingEnvKeys.push('NEXT_PUBLIC_HELIUS_API_KEY');
  }

  const pnlSummary = useMemo(
    () => computePortfolioPnlSummary(portfolio, snapshots, costBasisMap),
    [portfolio, snapshots, costBasisMap]
  );

  const riskBreakdown = useMemo(() => {
    const totals: Record<RiskLevel, number> = {
      Faible: 0,
      Modéré: 0,
      Élevé: 0,
    };
    for (const h of portfolio.holdings) {
      const cls = classifyTokenMetrics(h);
      totals[cls.riskLevel] += h.valueUsd;
    }
    const total = portfolio.totalValueUsd;
    return {
      lowPct: total > 0 ? (totals.Faible / total) * 100 : 0,
      medPct: total > 0 ? (totals.Modéré / total) * 100 : 0,
      highPct: total > 0 ? (totals.Élevé / total) * 100 : 0,
    };
  }, [portfolio.holdings, portfolio.totalValueUsd]);

  const isLatentUp = (pnlSummary.unrealizedPnlUsd ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Clean API Key Required State when .env keys are missing */}
      {missingEnvKeys.length > 0 && (
        <ApiKeyRequiredCard
          title="Clé API requise"
          description={
            !apiConfig?.alchemyConfigured && !apiConfig?.heliusConfigured
              ? 'Les clés gratuites Alchemy (Base ERC-20 complet) et Helius (Solana SPL fiable) ne sont pas configurées dans votre .env. Le mode RPC public Base reste actif pour ETH et les actifs principaux.'
              : !apiConfig?.alchemyConfigured
                ? 'Clé Alchemy manquante dans .env : Base utilise le RPC public (ETH + tokens principaux). Ajoutez la clé gratuite pour la découverte ERC-20 exhaustive.'
                : 'Clé Helius manquante dans .env : Solana utilise le RPC public qui peut limiter les requêtes. Ajoutez une clé Helius Free Tier dans .env.'
          }
          envKeyNames={missingEnvKeys}
          onGoToConfig={onGoToConfig}
        />
      )}

      {/* Discreet optional indicator for Robinhood Chain Alchemy API key */}
      {apiConfig && !apiConfig.robinhoodAlchemyConfigured && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-lg border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#00C805] shrink-0" aria-hidden="true" />
            <KeyRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">
              Réseau <strong className="font-medium text-slate-800 dark:text-slate-200">Robinhood Chain</strong> prêt : ajoutez{' '}
              <code className="font-mono text-[11px] text-slate-800 dark:text-slate-200">
                ROBINHOOD_ALCHEMY_API_KEY
              </code>{' '}
              dans <code className="font-mono text-[11px]">.env</code> pour activer le suivi RPC dédié.
            </span>
          </div>
          <button
            type="button"
            onClick={onGoToConfig}
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Configurer</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Top Row: Portfolio Value + History Chart (7 cols) & Chain Allocation (5 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        <section className="xl:col-span-7 glass-panel rounded-xl p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Valeur totale du portefeuille
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {activeWalletCount} {activeWalletCount > 1 ? 'wallets actifs' : 'wallet actif'} ·{' '}
                {portfolio.holdings.length}{' '}
                {portfolio.holdings.length > 1 ? 'tokens' : 'token'}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {isLoading && portfolio.holdings.length === 0 ? (
                <div className="h-10 w-48 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ) : (
                <h1 className="font-mono text-3xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums">
                  {formatUsd(portfolio.totalValueUsd)}
                </h1>
              )}

              {portfolio.totalValueUsd > 0 && (
                <div
                  className={`inline-flex items-center gap-1.5 text-xs font-mono font-medium tabular-nums ${
                    isUp
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isUp ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {isUp ? '+' : ''}
                    {formatUsd(portfolio.change24hUsd)} ({formatPercent(portfolio.change24hPercent)})
                  </span>
                  <span className="text-slate-400 dark:text-slate-500 font-sans">24h</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5">
            <PortfolioHistoryChart snapshots={snapshots} theme={theme} />
          </div>
        </section>

        <div className="xl:col-span-5">
          <ChainAllocationCard
            allocations={portfolio.allocations}
            selectedChain={selectedChain}
            onSelectChain={onSelectChain}
            onGoToConfig={onGoToConfig}
            isLoading={isLoading && portfolio.holdings.length === 0}
          />
        </div>
      </div>

      {/* Portfolio PnL & Risk Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>PnL Latent (PMA)</span>
            <span className="font-mono">
              {pnlSummary.trackedTokenCount} actif(s)
            </span>
          </div>
          {pnlSummary.unrealizedPnlUsd !== null ? (
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  isLatentUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isLatentUp ? '+' : ''}
                {formatUsd(pnlSummary.unrealizedPnlUsd)}
              </span>
              <span
                className={`font-mono text-xs tabular-nums ${
                  isLatentUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ({formatPercent(pnlSummary.roiPercent)})
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Cliquez sur un token pour saisir ou importer son PMA.
            </p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>PnL 24h</span>
            <span className="text-[11px]">{pnlSummary.daily.note}</span>
          </div>
          {pnlSummary.daily.pnlUsd !== null ? (
            <div className="mt-1.5 flex items-baseline gap-2">
              <span
                className={`font-mono text-lg font-semibold tabular-nums ${
                  pnlSummary.daily.pnlUsd >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {pnlSummary.daily.pnlUsd >= 0 ? '+' : ''}
                {formatUsd(pnlSummary.daily.pnlUsd)}
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                ({formatPercent(pnlSummary.daily.pnlPercent)})
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs font-mono text-slate-400">—</p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>PnL 7j / 30j</span>
            <span className="text-[11px]">Instantanés locaux</span>
          </div>
          {pnlSummary.weekly.hasBaseline || pnlSummary.monthly.hasBaseline ? (
            <div className="mt-1.5 flex items-center gap-3 font-mono text-xs tabular-nums">
              <span>
                7j:{' '}
                {pnlSummary.weekly.pnlPercent !== null
                  ? formatPercent(pnlSummary.weekly.pnlPercent)
                  : '—'}
              </span>
              <span>·</span>
              <span>
                30j:{' '}
                {pnlSummary.monthly.pnlPercent !== null
                  ? formatPercent(pnlSummary.monthly.pnlPercent)
                  : '—'}
              </span>
            </div>
          ) : (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
              Collecte en cours (historique réel IndexedDB &lt; 7j).
            </p>
          )}
        </div>

        <div className="glass-panel rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span>Répartition par risque</span>
            <span className="font-mono text-[11px]">On-Chain</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
            {portfolio.totalValueUsd > 0 && (
              <>
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${riskBreakdown.lowPct}%` }}
                  title={`Faible: ${riskBreakdown.lowPct.toFixed(1)}%`}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${riskBreakdown.medPct}%` }}
                  title={`Modéré: ${riskBreakdown.medPct.toFixed(1)}%`}
                />
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${riskBreakdown.highPct}%` }}
                  title={`Élevé: ${riskBreakdown.highPct.toFixed(1)}%`}
                />
              </>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            <span>Faible {riskBreakdown.lowPct.toFixed(0)}%</span>
            <span>Modéré {riskBreakdown.medPct.toFixed(0)}%</span>
            <span>Élevé {riskBreakdown.highPct.toFixed(0)}%</span>
          </div>
        </div>
      </div>

      {/* Dynamic Holdings Grid */}
      <TokenTable
        holdings={portfolio.holdings}
        totalPortfolioUsd={portfolio.totalValueUsd}
        costBasisMap={costBasisMap}
        metadataMap={metadataMap}
        alerts={alerts}
        selectedChain={selectedChain}
        onSelectChain={onSelectChain}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        dustStats={portfolio.dustStats}
        isLoading={isLoading}
        hasWallets={activeWalletCount > 0}
        onOpenAddWallet={onOpenAddWallet}
        onSelectToken={onSelectToken}
        onToggleFavorite={onToggleFavorite}
      />
    </div>
  );
}
