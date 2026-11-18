import { CheckCircle2, Clock, Layers } from 'lucide-react';
import { ALL_CHAINS } from '../services/chains/registry';
import type { ApiConfigStatus } from '../types/config';

interface ChainsPageProps {
  apiConfig: ApiConfigStatus | null;
  onGoToConfig: () => void;
}

export function ChainsPage({ apiConfig, onGoToConfig }: ChainsPageProps) {
  const chains = Object.values(ALL_CHAINS);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
          Architecture modulaire multi-chaînes
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Chaque réseau implémente l&apos;interface unifiée <span className="font-mono">ChainAdapter</span> dans <span className="font-mono">services/chains/</span>.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {chains.map((chain) => {
          const isActive = chain.status === 'active';
          const needsOptionalKey =
            (chain.id === 'base' && apiConfig && !apiConfig.alchemyConfigured) ||
            (chain.id === 'robinhood' &&
              apiConfig &&
              !apiConfig.robinhoodAlchemyConfigured) ||
            (chain.id === 'solana' && apiConfig && !apiConfig.heliusConfigured);

          return (
            <div
              key={chain.id}
              className="glass-panel rounded-xl p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: chain.accentColor }}
                    />
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {chain.name}
                    </h2>
                  </div>

                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Actif</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Étape suivante</span>
                    </span>
                  )}
                </div>

                <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Architecture</span>
                    <span className="font-mono uppercase">{chain.family}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Actif natif</span>
                    <span className="font-mono">{chain.nativeSymbol}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400 shrink-0">Endpoint</span>
                    <span className="font-mono text-[11px] truncate">{chain.rpcLabel}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs">
                {isActive ? (
                  needsOptionalKey ? (
                    <>
                      <span className="text-amber-600 dark:text-amber-400">
                        Clé API gratuite recommandée
                      </span>
                      <button
                        type="button"
                        onClick={onGoToConfig}
                        className="font-medium text-slate-900 dark:text-white hover:underline cursor-pointer"
                      >
                        Configurer
                      </button>
                    </>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Synchronisation complète prête
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <Layers className="w-3.5 h-3.5" />
                    <span>Adaptateur enregistré dans registry.ts</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
