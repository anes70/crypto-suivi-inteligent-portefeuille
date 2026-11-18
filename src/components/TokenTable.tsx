import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Bell,
  ExternalLink,
  Filter,
  Star,
  StickyNote,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { makeTokenMetadataKey } from '../services/notes/tokenMetadataStorage';
import { computeTokenPnl } from '../services/pnl/pnlEngine';
import type { TokenAlert } from '../types/alerts';
import type { ActiveChainId } from '../types/chain';
import type { TokenCustomMetadata } from '../types/metadata';
import type { CostBasisEntry } from '../types/pnl';
import type { DustFilterStats, TokenHolding } from '../types/portfolio';
import {
  formatPercent,
  formatTokenAmount,
  formatTokenPrice,
  formatUsd,
} from '../utils/format';
import { getChainLabel, getExplorerTokenUrl, shortenAddress } from '../utils/validators';
import { TokenIcon } from './TokenIcon';

type SortField = 'valueUsd' | 'priceUsd' | 'priceChange24h' | 'balance' | 'symbol';
type SortDirection = 'asc' | 'desc';

interface TokenTableProps {
  holdings: TokenHolding[];
  totalPortfolioUsd: number;
  costBasisMap: Record<string, CostBasisEntry>;
  metadataMap: Record<string, TokenCustomMetadata>;
  alerts: TokenAlert[];
  selectedChain: 'all' | ActiveChainId;
  onSelectChain: (chain: 'all' | ActiveChainId) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  dustStats: DustFilterStats;
  isLoading: boolean;
  hasWallets: boolean;
  onOpenAddWallet: () => void;
  onSelectToken: (token: TokenHolding) => void;
  onToggleFavorite: (chain: ActiveChainId, tokenAddress: string) => void;
}

export function TokenTable({
  holdings,
  totalPortfolioUsd,
  costBasisMap,
  metadataMap,
  alerts,
  selectedChain,
  onSelectChain,
  searchQuery,
  onSearchChange,
  dustStats,
  isLoading,
  hasWallets,
  onOpenAddWallet,
  onSelectToken,
  onToggleFavorite,
}: TokenTableProps) {
  const [sortField, setSortField] = useState<SortField>('valueUsd');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string>('all');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const h of holdings) {
      const meta = metadataMap[makeTokenMetadataKey(h.chain, h.address)];
      if (meta?.tags) {
        for (const t of meta.tags) tagSet.add(t);
      }
    }
    return Array.from(tagSet).sort((a, b) => a.localeCompare(b));
  }, [holdings, metadataMap]);

  const filteredHoldings = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = holdings.filter((h) => {
      if (selectedChain !== 'all' && h.chain !== selectedChain) return false;
      const meta = metadataMap[makeTokenMetadataKey(h.chain, h.address)];
      if (favoritesOnly && !meta?.isFavorite) return false;
      if (selectedTag !== 'all' && !(meta?.tags || []).includes(selectedTag)) {
        return false;
      }
      if (!q) return true;
      return (
        h.symbol.toLowerCase().includes(q) ||
        h.name.toLowerCase().includes(q) ||
        h.address.toLowerCase().includes(q) ||
        (h.walletLabel || '').toLowerCase().includes(q) ||
        (meta?.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });

    return list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'symbol') {
        cmp = a.symbol.localeCompare(b.symbol);
      } else if (sortField === 'priceUsd') {
        cmp = (a.priceUsd ?? -1) - (b.priceUsd ?? -1);
      } else if (sortField === 'priceChange24h') {
        cmp = (a.priceChange24h ?? -9999) - (b.priceChange24h ?? -9999);
      } else if (sortField === 'balance') {
        cmp = a.balance - b.balance;
      } else {
        cmp = a.valueUsd - b.valueUsd;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [
    holdings,
    selectedChain,
    searchQuery,
    sortField,
    sortDir,
    favoritesOnly,
    selectedTag,
    metadataMap,
  ]);

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    }
    return sortDir === 'desc' ? (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    );
  };

  return (
    <section className="glass-panel rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Actifs détenus
          </h2>

          {/* Segmented Chain Filter */}
          <div className="inline-flex items-center p-1 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800">
            {(
              [
                { id: 'all', label: 'Toutes' },
                { id: 'base', label: 'Base' },
                { id: 'robinhood', label: 'Robinhood' },
                { id: 'solana', label: 'Solana' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectChain(tab.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedChain === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              favoritesOnly
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoritesOnly ? 'fill-current' : ''}`} />
            <span>Favoris</span>
          </button>

          {availableTags.length > 0 && (
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              aria-label="Filtrer par tag"
              className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              <option value="all">Tous les tags</option>
              {availableTags.map((tag) => (
                <option key={tag} value={tag}>
                  #{tag}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {/* Mobile search fallback */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filtrer un token…"
            className="md:hidden px-3 py-1.5 rounded-lg text-xs bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
          />

          <span className="inline-flex items-center gap-1.5 font-mono">
            <Filter className="w-3.5 h-3.5" />
            <span>
              &lt; ${dustStats.thresholdUsd.toFixed(2)} masqués
              {dustStats.filteredZeroOrDustCount > 0
                ? ` (${dustStats.filteredZeroOrDustCount})`
                : ''}
            </span>
          </span>
        </div>
      </div>

      {/* Table or Empty / Loading State */}
      {isLoading && holdings.length === 0 ? (
        <div className="p-4 sm:p-5 space-y-3">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={row}
              className="h-12 rounded-lg bg-slate-100/80 dark:bg-slate-800/40 animate-pulse"
            />
          ))}
        </div>
      ) : !hasWallets ? (
        <div className="px-6 py-14 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            Aucun portefeuille suivi pour le moment
          </p>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Ajoutez une adresse publique Base / Robinhood (0x…) ou Solana, ou connectez votre wallet navigateur en lecture seule pour agréger vos soldes réels.
          </p>
          <button
            type="button"
            onClick={onOpenAddWallet}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            Ajouter une adresse publique
          </button>
        </div>
      ) : filteredHoldings.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
            {searchQuery
              ? 'Aucun token ne correspond à votre recherche'
              : `Aucun actif ≥ $${dustStats.thresholdUsd.toFixed(2)} détecté`}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {searchQuery
              ? 'Essayez un autre ticker, nom ou adresse de contrat.'
              : 'Les soldes nuls, tokens vendus et poussières inférieures au seuil sont automatiquement exclus.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 dark:border-slate-800/80 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                <th className="py-3 pl-5 pr-3">
                  <button
                    type="button"
                    onClick={() => handleSort('symbol')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Actif</span>
                    {renderSortIcon('symbol')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('priceUsd')}
                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Prix (DexScreener)</span>
                    {renderSortIcon('priceUsd')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('priceChange24h')}
                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>24h</span>
                    {renderSortIcon('priceChange24h')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('balance')}
                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Quantité</span>
                    {renderSortIcon('balance')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('valueUsd')}
                    className="inline-flex items-center justify-end gap-1 hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <span>Valeur USD</span>
                    {renderSortIcon('valueUsd')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">PnL / ROI</th>
                <th className="py-3 pl-3 pr-5 text-right w-24">Fiche &amp; Liens</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-sm">
              {filteredHoldings.map((token) => {
                const weightPct =
                  totalPortfolioUsd > 0 ? (token.valueUsd / totalPortfolioUsd) * 100 : 0;
                const isUp = (token.priceChange24h ?? 0) >= 0;
                const pnl = computeTokenPnl(token, costBasisMap);
                const isPnlUp = (pnl.unrealizedPnlUsd ?? 0) >= 0;
                const meta = metadataMap[makeTokenMetadataKey(token.chain, token.address)];
                const isFav = meta?.isFavorite ?? false;
                const hasNote = Boolean(meta?.note && meta.note.trim().length > 0);
                const tokenTags = meta?.tags ?? [];
                const activeAlertCount = alerts.filter(
                  (a) =>
                    a.enabled &&
                    a.chain === token.chain &&
                    (token.chain !== 'solana'
                      ? a.tokenAddress.toLowerCase() === token.address.toLowerCase()
                      : a.tokenAddress === token.address)
                ).length;

                return (
                  <tr
                    key={token.id}
                    onClick={() => onSelectToken(token)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/35 transition-colors cursor-pointer"
                  >
                    <td className="py-3 pl-5 pr-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleFavorite(token.chain, token.address);
                          }}
                          aria-label={isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          className={`p-1 rounded-md transition-colors cursor-pointer shrink-0 ${
                            isFav
                              ? 'text-amber-500'
                              : 'text-slate-300 hover:text-amber-400 dark:text-slate-600 dark:hover:text-amber-400'
                          }`}
                        >
                          <Star className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                        </button>
                        <TokenIcon
                          logoUrl={token.logoUrl}
                          symbol={token.symbol}
                          chain={token.chain}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {token.symbol}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                              {token.name}
                            </span>
                            {hasNote && (
                              <span title="Contient une note privée">
                                <StickyNote className="w-3 h-3 text-blue-500 shrink-0" />
                              </span>
                            )}
                            {activeAlertCount > 0 && (
                              <span
                                title={`${activeAlertCount} alerte(s) active(s)`}
                                className="inline-flex items-center gap-0.5 text-[10px] font-mono text-amber-600 dark:text-amber-400"
                              >
                                <Bell className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            <span>{getChainLabel(token.chain)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">
                              {token.isNative
                                ? 'Natif'
                                : shortenAddress(token.address, 4, 4)}
                            </span>
                            {token.walletLabel && (
                              <>
                                <span aria-hidden="true" className="hidden md:inline">
                                  ·
                                </span>
                                <span className="hidden md:inline truncate max-w-[110px]">
                                  {token.walletLabel}
                                </span>
                              </>
                            )}
                            {tokenTags.slice(0, 2).map((t) => (
                              <span
                                key={t}
                                className="font-mono text-[10px] text-blue-600 dark:text-blue-400"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-200 tabular-nums whitespace-nowrap">
                      {formatTokenPrice(token.priceUsd)}
                    </td>

                    <td className="py-3 px-3 text-right hidden sm:table-cell whitespace-nowrap">
                      {token.priceChange24h !== null ? (
                        <span
                          className={`inline-flex items-center justify-end gap-1 font-mono text-xs tabular-nums ${
                            isUp
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isUp ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : (
                            <TrendingDown className="w-3 h-3" />
                          )}
                          <span>{formatPercent(token.priceChange24h)}</span>
                        </span>
                      ) : (
                        <span className="font-mono text-xs text-slate-400">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap">
                      {formatTokenAmount(token.balance)}
                    </td>

                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                        {formatUsd(token.valueUsd)}
                      </div>
                      <div className="mt-0.5 flex items-center justify-end gap-1.5">
                        <div className="w-12 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-500"
                            style={{ width: `${Math.min(100, Math.max(2, weightPct))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          {weightPct.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right hidden lg:table-cell whitespace-nowrap">
                      {pnl.unrealizedPnlUsd !== null ? (
                        <div>
                          <div
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              isPnlUp
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isPnlUp ? '+' : ''}
                            {formatUsd(pnl.unrealizedPnlUsd)}
                          </div>
                          <div
                            className={`font-mono text-[10px] tabular-nums ${
                              isPnlUp
                                ? 'text-emerald-600/80 dark:text-emerald-400/80'
                                : 'text-rose-600/80 dark:text-rose-400/80'
                            }`}
                          >
                            {formatPercent(pnl.roiPercent)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          Définir PMA
                        </span>
                      )}
                    </td>

                    <td
                      className="py-3 pl-3 pr-5 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => onSelectToken(token)}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Détails
                        </button>
                        {token.pairUrl && (
                          <a
                            href={token.pairUrl}
                            target="_blank"
                            rel="noreferrer"
                            title="Voir sur DexScreener"
                            className="p-1.5 rounded-md text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {!token.isNative && (
                          <a
                            href={getExplorerTokenUrl(token.chain, token.address)}
                            target="_blank"
                            rel="noreferrer"
                            title="Voir le contrat sur l'explorateur"
                            className="text-[11px] font-mono text-slate-500 hover:text-blue-500 dark:text-slate-400 dark:hover:text-blue-400"
                          >
                            Scan
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
