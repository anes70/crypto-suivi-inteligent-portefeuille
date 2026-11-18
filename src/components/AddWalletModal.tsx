import { useState, type FormEvent } from 'react';
import { ShieldCheck, Wallet, X } from 'lucide-react';
import {
  connectReadOnlyEvmWallet,
  connectReadOnlySolanaWallet,
  detectBrowserWallets,
} from '../services/walletConnector';
import type { ActiveChainId } from '../types/chain';
import type { TrackedWallet } from '../types/wallet';
import {
  detectAddressChain,
  getChainLabel,
  isEvmChain,
  isValidEvmAddress,
  isValidSolanaAddress,
} from '../utils/validators';

interface AddWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWallet: (wallet: TrackedWallet) => void;
  existingWallets: TrackedWallet[];
}

export function AddWalletModal({
  isOpen,
  onClose,
  onAddWallet,
  existingWallets,
}: AddWalletModalProps) {
  const [chain, setChain] = useState<ActiveChainId>('base');
  const [address, setAddress] = useState('');
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<ActiveChainId | null>(null);

  if (!isOpen) return null;

  const browserWallets = detectBrowserWallets();

  const handleAddressChange = (val: string) => {
    setAddress(val);
    setError(null);
    const detected = detectAddressChain(val);
    if (detected === 'base') {
      if (!isEvmChain(chain)) {
        setChain('base');
      }
    } else if (detected) {
      setChain(detected);
    }
  };

  const commitWallet = (
    targetChain: ActiveChainId,
    targetAddress: string,
    mode: 'watch' | 'browser-wallet',
    providerName?: string
  ) => {
    const cleanAddr = targetAddress.trim();
    const alreadyExists = existingWallets.some(
      (w) =>
        w.chain === targetChain &&
        w.address.toLowerCase() === cleanAddr.toLowerCase()
    );

    if (alreadyExists) {
      setError('Cette adresse est déjà suivie sur cette blockchain.');
      return;
    }

    const chainLabel = getChainLabel(targetChain);
    const defaultLabel =
      label.trim() ||
      (mode === 'browser-wallet' && providerName
        ? `${providerName} (${chainLabel})`
        : `${chainLabel} Wallet`);

    onAddWallet({
      id: `${targetChain}:${cleanAddr}:${Date.now()}`,
      chain: targetChain,
      address: cleanAddr,
      label: defaultLabel,
      mode,
      providerName,
      addedAt: Date.now(),
      enabled: true,
    });

    setAddress('');
    setLabel('');
    setError(null);
    onClose();
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = address.trim();
    if (!clean) {
      setError('Veuillez saisir une adresse publique.');
      return;
    }

    if (isEvmChain(chain) && !isValidEvmAddress(clean)) {
      setError(
        `Adresse ${getChainLabel(chain)} EVM invalide. Elle doit commencer par 0x et contenir 42 caractères.`
      );
      return;
    }

    if (chain === 'solana' && !isValidSolanaAddress(clean)) {
      setError('Adresse Solana Base58 invalide (32 à 44 caractères).');
      return;
    }

    commitWallet(chain, clean, 'watch');
  };

  const handleConnectBrowser = async (targetChain: ActiveChainId) => {
    setError(null);
    setConnecting(targetChain);
    try {
      const res = isEvmChain(targetChain)
        ? await connectReadOnlyEvmWallet()
        : await connectReadOnlySolanaWallet();
      commitWallet(targetChain, res.address, 'browser-wallet', res.providerName);
    } catch (err: any) {
      setError(err?.message || 'Connexion au wallet refusée.');
    } finally {
      setConnecting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-xl rounded-xl bg-white dark:bg-[#12161F] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Ajouter un portefeuille (lecture seule)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Adresse publique ou connexion navigateur sans signature ni clé privée.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Browser Wallet Quick Connect */}
          <div>
            <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2.5">
              Connexion wallet navigateur (lecture seule)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleConnectBrowser('base')}
                disabled={connecting !== null}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:border-blue-500/50 text-left transition-colors cursor-pointer disabled:opacity-60"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {browserWallets.evmLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {browserWallets.hasEvm ? 'Base (EVM 0x…)' : 'Non détecté'}
                  </div>
                </div>
                <Wallet className="w-4 h-4 text-[#0052FF] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleConnectBrowser('robinhood')}
                disabled={connecting !== null}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:border-emerald-500/50 text-left transition-colors cursor-pointer disabled:opacity-60"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {browserWallets.evmLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {browserWallets.hasEvm ? 'Robinhood (0x…)' : 'Non détecté'}
                  </div>
                </div>
                <Wallet className="w-4 h-4 text-[#00C805] shrink-0" />
              </button>

              <button
                type="button"
                onClick={() => handleConnectBrowser('solana')}
                disabled={connecting !== null}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 hover:border-emerald-500/50 text-left transition-colors cursor-pointer disabled:opacity-60"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {browserWallets.solanaLabel}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {browserWallets.hasSolana ? 'Solana (SPL)' : 'Non détecté'}
                  </div>
                </div>
                <Wallet className="w-4 h-4 text-[#14F195] shrink-0" />
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
            <span className="px-3 text-[11px] text-slate-400">ou adresse publique</span>
            <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
          </div>

          {/* Public Address Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setChain('base')}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  chain === 'base'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Base (0x…)
              </button>
              <button
                type="button"
                onClick={() => setChain('robinhood')}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  chain === 'robinhood'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Robinhood (0x…)
              </button>
              <button
                type="button"
                onClick={() => setChain('solana')}
                className={`py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  chain === 'solana'
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Solana (Base58)
              </button>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Adresse publique
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => handleAddressChange(e.target.value)}
                placeholder={
                  isEvmChain(chain)
                    ? '0x...'
                    : 'Adresse Solana (ex: 7xKX...)'
                }
                className="w-full px-3 py-2 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Libellé (optionnel)
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex : Trésorerie Base, Robinhood Chain, Trading Solana…"
                className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Aucune clé privée demandée</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                  Suivre cette adresse
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
