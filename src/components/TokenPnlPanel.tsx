import { useState, type FormEvent } from 'react';
import { Download, RotateCcw, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { importOnChainCostBasis } from '../services/pnl/pnlEngine';
import type { CostBasisEntry, TokenPnlResult } from '../types/pnl';
import type { TokenHolding } from '../types/portfolio';
import { formatPercent, formatTokenPrice, formatUsd } from '../utils/format';
import { ApiKeyRequiredCard } from './ApiKeyRequiredCard';

interface TokenPnlPanelProps {
  holding: TokenHolding;
  poolAddress: string | null;
  pnl: TokenPnlResult;
  costBasisEntry?: CostBasisEntry;
  onSaveCostBasis: (avgPriceUsd: number, source: 'manual' | 'onchain-import', txCount?: number) => void;
  onDeleteCostBasis: () => void;
  onGoToConfig: () => void;
}

export function TokenPnlPanel({
  holding,
  poolAddress,
  pnl,
  costBasisEntry,
  onSaveCostBasis,
  onDeleteCostBasis,
  onGoToConfig,
}: TokenPnlPanelProps) {
  const [inputPrice, setInputPrice] = useState(
    pnl.avgBuyPriceUsd !== null ? String(pnl.avgBuyPriceUsd) : ''
  );
  const [importing, setImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<string | null>(null);
  const [missingApiKey, setMissingApiKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSaveManual = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setImportFeedback(null);
    const parsed = Number(inputPrice.replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Veuillez saisir un prix moyen d’achat strictement positif.');
      return;
    }
    onSaveCostBasis(parsed, 'manual');
    setImportFeedback('Prix moyen d’achat enregistré.');
  };

  const handleImportOnChain = async () => {
    setImporting(true);
    setError(null);
    setImportFeedback(null);
    setMissingApiKey(null);
    try {
      const res = await importOnChainCostBasis({
        chain: holding.chain,
        walletAddress: holding.walletAddress,
        tokenAddress: holding.address,
        poolAddress,
        isNative: holding.isNative,
      });

      if (res.apiKeyMissing) {
        setMissingApiKey(
          res.apiKeyName ||
            (holding.chain === 'robinhood'
              ? 'ROBINHOOD_ALCHEMY_API_KEY'
              : 'NEXT_PUBLIC_HELIUS_API_KEY')
        );
        return;
      }

      if (res.avgBuyPriceUsd !== null && res.avgBuyPriceUsd > 0) {
        setInputPrice(String(Number(res.avgBuyPriceUsd.toFixed(6))));
        onSaveCostBasis(
          res.avgBuyPriceUsd,
          'onchain-import',
          res.transactionsAnalyzed
        );
        setImportFeedback(
          `${res.transactionsAnalyzed || 0} transaction(s) entrante(s) analysée(s) via ${
            res.source === 'helius'
              ? 'Helius'
              : holding.chain === 'robinhood'
                ? 'Alchemy Robinhood'
                : 'BaseScan / Blockscout'
          }.`
        );
      } else {
        setError(
          `Aucune transaction entrante valorisable détectée (${res.transactionsAnalyzed || 0} tx trouvée(s)). Saisissez votre PMA manuellement.`
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Échec de l’import on-chain.');
    } finally {
      setImporting(false);
    }
  };

  const isProfit = (pnl.unrealizedPnlUsd ?? 0) >= 0;

  return (
    <section className="glass-panel rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Suivi PnL &amp; Prix Moyen d&apos;Achat
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Saisie manuelle ou estimation depuis l&apos;historique on-chain (
            {holding.chain === 'base'
              ? 'BaseScan / Blockscout'
              : holding.chain === 'robinhood'
                ? 'Alchemy Robinhood'
                : 'Helius API'}
            ).
          </p>
        </div>

        {costBasisEntry && (
          <button
            type="button"
            onClick={() => {
              onDeleteCostBasis();
              setInputPrice('');
              setImportFeedback(null);
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-rose-500 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Réinitialiser</span>
          </button>
        )}
      </div>

      {/* Live PnL KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Prix moyen (PMA)</span>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {pnl.avgBuyPriceUsd !== null ? formatTokenPrice(pnl.avgBuyPriceUsd) : 'Non défini'}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Coût investi</span>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
            {pnl.costBasisUsd !== null ? formatUsd(pnl.costBasisUsd) : '—'}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">Profit / Perte ($)</span>
          <div
            className={`mt-1 font-mono text-sm font-semibold tabular-nums ${
              pnl.unrealizedPnlUsd === null
                ? 'text-slate-500 dark:text-slate-400'
                : isProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {pnl.unrealizedPnlUsd !== null
              ? `${isProfit ? '+' : ''}${formatUsd(pnl.unrealizedPnlUsd)}`
              : '—'}
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
          <span className="text-[11px] text-slate-500 dark:text-slate-400">ROI (%)</span>
          <div
            className={`mt-1 inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums ${
              pnl.roiPercent === null
                ? 'text-slate-500 dark:text-slate-400'
                : isProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {pnl.roiPercent !== null ? (
              <>
                {isProfit ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>{formatPercent(pnl.roiPercent)}</span>
              </>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>
      </div>

      {/* Manual input + On-chain import */}
      <form onSubmit={handleSaveManual} className="flex flex-col sm:flex-row gap-2.5">
        <div className="flex-1">
          <input
            type="text"
            inputMode="decimal"
            value={inputPrice}
            onChange={(e) => {
              setInputPrice(e.target.value);
              setError(null);
            }}
            placeholder="Saisir le prix moyen d'achat en USD (ex: 0.42)"
            className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Enregistrer PMA</span>
        </button>

        <button
          type="button"
          onClick={handleImportOnChain}
          disabled={importing}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{importing ? 'Analyse en cours…' : 'Importer via historique'}</span>
        </button>
      </form>

      {missingApiKey && (
        <ApiKeyRequiredCard
          compact
          title="Clé API requise"
          description={
            holding.chain === 'robinhood'
              ? 'L’import automatique des transactions historiques Robinhood Chain nécessite une clé ROBINHOOD_ALCHEMY_API_KEY dans votre fichier .env. Vous pouvez toujours saisir votre PMA manuellement ci-dessus.'
              : 'L’import automatique des transactions historiques Solana nécessite une clé Helius Free API dans votre fichier .env. Vous pouvez toujours saisir votre PMA manuellement ci-dessus.'
          }
          envKeyNames={[missingApiKey]}
          onGoToConfig={onGoToConfig}
        />
      )}

      {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      {importFeedback && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400">{importFeedback}</p>
      )}
    </section>
  );
}
