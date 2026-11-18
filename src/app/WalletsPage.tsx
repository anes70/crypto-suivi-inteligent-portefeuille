import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  History,
  KeyRound,
  Plus,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { fetchRobinhoodTransactions } from '../services/chains/robinhoodAdapter';
import type { ChainTransactionsResult } from '../types/chain';
import type { TrackedWallet } from '../types/wallet';
import { formatRelativeTime, formatTokenAmount } from '../utils/format';
import {
  getChainLabel,
  getExplorerAddressUrl,
  getExplorerTxUrl,
  shortenAddress,
} from '../utils/validators';

interface WalletsPageProps {
  wallets: TrackedWallet[];
  onToggleWallet: (id: string) => void;
  onRemoveWallet: (id: string) => void;
  onOpenAddWallet: () => void;
  onGoToConfig?: () => void;
}

export function WalletsPage({
  wallets,
  onToggleWallet,
  onRemoveWallet,
  onOpenAddWallet,
  onGoToConfig,
}: WalletsPageProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedTxWalletId, setExpandedTxWalletId] = useState<string | null>(null);
  const [txResults, setTxResults] = useState<Record<string, ChainTransactionsResult>>({});
  const [txLoadingId, setTxLoadingId] = useState<string | null>(null);

  const handleCopy = async (id: string, address: string) => {
    try {
      await navigator.clipboard.writeText(address);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleToggleTransactions = async (wallet: TrackedWallet) => {
    if (expandedTxWalletId === wallet.id) {
      setExpandedTxWalletId(null);
      return;
    }

    setExpandedTxWalletId(wallet.id);
    if (txResults[wallet.id] && !txResults[wallet.id].error) {
      return;
    }

    setTxLoadingId(wallet.id);
    try {
      const res = await fetchRobinhoodTransactions(wallet.address);
      setTxResults((prev) => ({ ...prev, [wallet.id]: res }));
    } catch (err: any) {
      setTxResults((prev) => ({
        ...prev,
        [wallet.id]: {
          chain: wallet.chain,
          address: wallet.address,
          source: 'unavailable',
          apiKeyMissing: false,
          apiKeyName: null,
          error: err?.message || 'Impossible de charger les transactions.',
          transactions: [],
        },
      }));
    } finally {
      setTxLoadingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Portefeuilles suivis
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Stockage local sécurisé en lecture seule. Activez ou désactivez une adresse pour filtrer l&apos;agrégation globale.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddWallet}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter un wallet</span>
        </button>
      </div>

      {wallets.length === 0 ? (
        <div className="glass-panel rounded-xl p-10 text-center">
          <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Aucun portefeuille enregistré
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Ajoutez votre première adresse publique Base, Robinhood ou Solana pour commencer le suivi en temps réel.
          </p>
          <button
            type="button"
            onClick={onOpenAddWallet}
            className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter une adresse</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-xl divide-y divide-slate-200/80 dark:divide-slate-800/80 overflow-hidden">
          {wallets.map((wallet) => {
            const isExpanded = expandedTxWalletId === wallet.id;
            const txResult = txResults[wallet.id];
            const isLoadingTx = txLoadingId === wallet.id;

            return (
              <div key={wallet.id} className="transition-colors">
                <div className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/30">
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={wallet.enabled}
                      onChange={() => onToggleWallet(wallet.id)}
                      aria-label={`Inclure ${wallet.label}`}
                      className="mt-1 sm:mt-0 w-4 h-4 rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {wallet.label}
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          · {getChainLabel(wallet.chain)}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 hidden sm:inline">
                          ·{' '}
                          {wallet.mode === 'browser-wallet'
                            ? wallet.providerName || 'Wallet connecté'
                            : 'Adresse surveillée'}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs font-mono text-slate-500 dark:text-slate-400">
                        <span className="hidden md:inline">{wallet.address}</span>
                        <span className="md:hidden">{shortenAddress(wallet.address, 8, 6)}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(wallet.id, wallet.address)}
                          title="Copier l'adresse"
                          className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                        >
                          {copiedId === wallet.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {wallet.chain === 'robinhood' && (
                      <button
                        type="button"
                        onClick={() => handleToggleTransactions(wallet)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-800 transition-colors cursor-pointer"
                      >
                        <History className="w-3.5 h-3.5 text-[#00C805]" />
                        <span>Transactions</span>
                        {isExpanded ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}

                    <a
                      href={getExplorerAddressUrl(wallet.chain, wallet.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <span>Explorateur</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>

                    <button
                      type="button"
                      onClick={() => onRemoveWallet(wallet.id)}
                      title="Supprimer ce portefeuille"
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Expandable Robinhood Transaction History Panel */}
                {wallet.chain === 'robinhood' && isExpanded && (
                  <div className="px-4 sm:px-5 pb-4 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/35">
                    {isLoadingTx ? (
                      <div className="space-y-2 py-2">
                        <div className="h-8 rounded-md bg-slate-200/70 dark:bg-slate-800/50 animate-pulse" />
                        <div className="h-8 rounded-md bg-slate-200/70 dark:bg-slate-800/50 animate-pulse" />
                      </div>
                    ) : txResult?.apiKeyMissing ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs text-amber-700 dark:text-amber-300">
                        <div className="flex items-center gap-2">
                          <KeyRound className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {txResult.error ||
                              'Clé ROBINHOOD_ALCHEMY_API_KEY requise pour lire l’historique via Alchemy.'}
                          </span>
                        </div>
                        {onGoToConfig && (
                          <button
                            type="button"
                            onClick={onGoToConfig}
                            className="font-medium text-slate-900 dark:text-white hover:underline cursor-pointer"
                          >
                            Configurer
                          </button>
                        )}
                      </div>
                    ) : txResult?.error ? (
                      <p className="py-2 text-xs text-rose-600 dark:text-rose-400">
                        {txResult.error}
                      </p>
                    ) : !txResult || txResult.transactions.length === 0 ? (
                      <p className="py-2 text-xs text-slate-500 dark:text-slate-400">
                        Aucune transaction récente détectée sur Robinhood Chain pour cette adresse.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-200/60 dark:divide-slate-800/60">
                        {txResult.transactions.slice(0, 15).map((tx) => {
                          const isInbound = tx.direction === 'in';
                          const counterparty = isInbound ? tx.from : tx.to;
                          return (
                            <div
                              key={`${tx.hash}-${tx.direction}-${tx.asset}`}
                              className="py-2 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {isInbound ? (
                                  <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                ) : (
                                  <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                                <span className="font-medium text-slate-800 dark:text-slate-200">
                                  {tx.direction === 'in'
                                    ? 'Reçu'
                                    : tx.direction === 'out'
                                      ? 'Envoyé'
                                      : 'Auto'}
                                </span>
                                <span className="font-mono text-slate-900 dark:text-slate-100 tabular-nums truncate">
                                  {tx.value !== null
                                    ? `${formatTokenAmount(tx.value)} ${tx.asset}`
                                    : tx.asset}
                                </span>
                                <span className="hidden sm:inline font-mono text-[11px] text-slate-400">
                                  {counterparty ? shortenAddress(counterparty, 6, 4) : ''}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 shrink-0">
                                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                  {tx.timestamp ? formatRelativeTime(tx.timestamp) : '—'}
                                </span>
                                <a
                                  href={tx.explorerUrl || getExplorerTxUrl('robinhood', tx.hash)}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-mono text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
                                >
                                  <span>{shortenAddress(tx.hash, 5, 4)}</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
