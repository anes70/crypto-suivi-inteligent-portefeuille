import { useState, type FormEvent } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
import type { ApiConfigStatus, AppPreferences } from '../types/config';
import { isValidBaseAddress } from '../utils/validators';

interface SettingsPageProps {
  apiConfig: ApiConfigStatus | null;
  preferences: AppPreferences;
  onUpdatePreferences: (next: AppPreferences) => void;
  onClearHistory: () => Promise<void>;
  snapshotCount: number;
}

const ENV_SNIPPET = `NEXT_PUBLIC_ALCHEMY_API_KEY="votre_cle_alchemy_gratuite"
ROBINHOOD_ALCHEMY_API_KEY="votre_cle_alchemy_robinhood"
NEXT_PUBLIC_HELIUS_API_KEY="votre_cle_helius_gratuite"
GROQ_API_KEY="votre_cle_groq_gratuite"`;

export function SettingsPage({
  apiConfig,
  preferences,
  onUpdatePreferences,
  onClearHistory,
  snapshotCount,
}: SettingsPageProps) {
  const [copiedEnv, setCopiedEnv] = useState(false);
  const [customTokenInput, setCustomTokenInput] = useState('');
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [cleared, setCleared] = useState(false);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(ENV_SNIPPET);
      setCopiedEnv(true);
      setTimeout(() => setCopiedEnv(false), 1800);
    } catch {
      // ignore
    }
  };

  const handleAddCustomToken = (e: FormEvent) => {
    e.preventDefault();
    const clean = customTokenInput.trim();
    if (!isValidBaseAddress(clean)) {
      setTokenError('Adresse de contrat ERC-20 Base invalide (0x...).');
      return;
    }
    const lower = clean.toLowerCase();
    if (preferences.customBaseTokens.some((t) => t.toLowerCase() === lower)) {
      setTokenError('Ce contrat est déjà suivi.');
      return;
    }

    onUpdatePreferences({
      ...preferences,
      customBaseTokens: [...preferences.customBaseTokens, clean],
    });
    setCustomTokenInput('');
    setTokenError(null);
  };

  const handleRemoveCustomToken = (addr: string) => {
    onUpdatePreferences({
      ...preferences,
      customBaseTokens: preferences.customBaseTokens.filter((t) => t !== addr),
    });
  };

  const handleClearDb = async () => {
    await onClearHistory();
    setCleared(true);
    setTimeout(() => setCleared(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Configuration & Clés API (.env)
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Toutes les APIs utilisées disposent d&apos;un tier 100 % gratuit. Les clés sont lues uniquement côté serveur depuis les variables d&apos;environnement.
        </p>
      </div>

      {/* API Status Matrix */}
      <section className="glass-panel rounded-xl divide-y divide-slate-200/80 dark:divide-slate-800/80 overflow-hidden">
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Base — Alchemy Free API
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                NEXT_PUBLIC_ALCHEMY_API_KEY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Permet l&apos;auto-découverte de tous les tokens ERC-20. Sans clé, le RPC public Base ({apiConfig?.basePublicRpc || 'https://mainnet.base.org'}) reste actif pour ETH et les actifs principaux.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {apiConfig?.alchemyConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configurée</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <KeyRound className="w-4 h-4" />
                <span>Clé API requise (.env)</span>
              </span>
            )}
            <a
              href="https://www.alchemy.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Tier gratuit</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Robinhood Chain — Alchemy RPC
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                ROBINHOOD_ALCHEMY_API_KEY · NEXT_PUBLIC_ROBINHOOD_ALCHEMY_API_KEY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Interroge l&apos;endpoint sécurisé côté serveur (
              <span className="font-mono">
                {apiConfig?.robinhoodRpcEndpoint ||
                  'https://robinhood-mainnet.g.alchemy.com/v2'}
              </span>
              ) pour les soldes natifs ETH, ERC-20 et l&apos;historique des transferts. Optionnelle au démarrage.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {apiConfig?.robinhoodAlchemyConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configurée</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <KeyRound className="w-4 h-4 text-amber-500" />
                <span>Optionnelle (.env)</span>
              </span>
            )}
            <a
              href="https://www.alchemy.com/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Tier gratuit</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Solana — Helius Free API
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                NEXT_PUBLIC_HELIUS_API_KEY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Fournit la DAS API et un RPC rapide sans saturation pour SOL et tous les SPL / Token-2022.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {apiConfig?.heliusConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Configurée</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <KeyRound className="w-4 h-4" />
                <span>Clé API requise (.env)</span>
              </span>
            )}
            <a
              href="https://www.helius.dev/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Tier gratuit</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                Analyse IA Quantitative — Groq (Llama 3.3 70B) / Gemini 2.5 Flash
              </span>
              <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                GROQ_API_KEY · GEMINI_API_KEY
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Alimente le moteur décisionnel JSON structuré (niveaux cibles, scores et raisonnement). Détecté côté serveur via Groq Free API ou Google AI Studio.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {apiConfig?.groqConfigured || apiConfig?.geminiConfigured ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {apiConfig?.groqConfigured && apiConfig?.geminiConfigured
                    ? 'Groq & Gemini actifs'
                    : apiConfig?.groqConfigured
                      ? 'Groq actif'
                      : 'Gemini actif'}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <KeyRound className="w-4 h-4" />
                <span>Clé API requise</span>
              </span>
            )}
            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Groq gratuit</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              Prix, On-Chain, Actualités &amp; Social — CryptoCompare, CoinGecko, DexScreener, GeckoTerminal &amp; Reddit
            </span>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              APIs publiques 100 % gratuites sans clé requise pour actualités temps réel, cours USD, bougies OHLCV, votes communautaires, activité GitHub et discussions Reddit.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>Actif · Aucune clé requise</span>
          </span>
        </div>
      </section>

      {/* .env snippet */}
      <section className="glass-panel rounded-xl p-5">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Variables à définir dans votre fichier .env
          </h2>
          <button
            type="button"
            onClick={handleCopySnippet}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
          >
            {copiedEnv ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Copié</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copier</span>
              </>
            )}
          </button>
        </div>
        <pre className="p-3.5 rounded-lg bg-slate-900 text-slate-100 text-xs font-mono overflow-x-auto">
          {ENV_SNIPPET}
        </pre>
      </section>

      {/* Dust filter & Custom Base ERC-20 tokens */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <section className="glass-panel rounded-xl p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Filtre poussière & soldes nuls
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Les tokens vendus (solde 0) ou valorisés sous le seuil disparaissent automatiquement à l&apos;actualisation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {[0.01, 0.1, 1.0].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() =>
                  onUpdatePreferences({ ...preferences, dustThresholdUsd: val })
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors cursor-pointer ${
                  preferences.dustThresholdUsd === val
                    ? 'border-blue-500 bg-blue-600 text-white'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                &lt; ${val.toFixed(2)}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <Database className="w-4 h-4 text-slate-400" />
              <span>{snapshotCount} instantanés IndexedDB</span>
            </div>
            <button
              type="button"
              onClick={handleClearDb}
              className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              {cleared ? 'Historique effacé' : 'Purger l’historique'}
            </button>
          </div>
        </section>

        <section className="glass-panel rounded-xl p-5 space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Contrats ERC-20 suivis (Base &amp; Robinhood)
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Permet d&apos;interroger directement des contrats ERC-20 spécifiques sur Base (<span className="font-mono">mainnet.base.org</span>) ou Robinhood Chain.
            </p>
          </div>

          <form onSubmit={handleAddCustomToken} className="flex gap-2">
            <input
              type="text"
              value={customTokenInput}
              onChange={(e) => {
                setCustomTokenInput(e.target.value);
                setTokenError(null);
              }}
              placeholder="Adresse contrat 0x..."
              className="flex-1 min-w-0 px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </form>

          {tokenError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{tokenError}</p>
          )}

          {preferences.customBaseTokens.length > 0 && (
            <div className="space-y-1.5 max-h-28 overflow-y-auto">
              {preferences.customBaseTokens.map((addr) => (
                <div
                  key={addr}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-900/70 text-xs font-mono text-slate-700 dark:text-slate-300"
                >
                  <span className="truncate">{addr}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomToken(addr)}
                    aria-label="Retirer ce contrat"
                    className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
