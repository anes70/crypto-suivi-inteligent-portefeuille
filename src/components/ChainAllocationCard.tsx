import { ArrowRight, KeyRound, AlertTriangle } from 'lucide-react';
import type { ActiveChainId } from '../types/chain';
import type { ChainAllocation } from '../types/portfolio';
import { formatUsd } from '../utils/format';

interface ChainAllocationCardProps {
  allocations: ChainAllocation[];
  selectedChain: 'all' | ActiveChainId;
  onSelectChain: (chain: 'all' | ActiveChainId) => void;
  onGoToConfig: () => void;
  isLoading: boolean;
}

const CHAIN_COLORS: Record<ActiveChainId, string> = {
  base: '#0052FF',
  robinhood: '#00C805',
  solana: '#14F195',
};

const SOURCE_LABELS: Record<ChainAllocation['source'], string> = {
  alchemy: 'Alchemy Free API',
  helius: 'Helius Free API',
  'public-rpc': 'RPC Public',
  unavailable: 'Indisponible',
  idle: 'En attente',
};

export function ChainAllocationCard({
  allocations,
  selectedChain,
  onSelectChain,
  onGoToConfig,
  isLoading,
}: ChainAllocationCardProps) {
  const total = allocations.reduce((acc, item) => acc + item.valueUsd, 0);

  return (
    <section className="glass-panel rounded-xl p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Répartition par blockchain
          </h2>
          {selectedChain !== 'all' && (
            <button
              type="button"
              onClick={() => onSelectChain('all')}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
            >
              Tout afficher
            </button>
          )}
        </div>

        {/* Proportional segmented allocation bar */}
        <div className="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/90 overflow-hidden flex mb-5">
          {total > 0 ? (
            allocations.map((alloc) => {
              if (alloc.percentage <= 0) return null;
              return (
                <div
                  key={alloc.chain}
                  style={{
                    width: `${Math.max(alloc.percentage, 2)}%`,
                    backgroundColor: CHAIN_COLORS[alloc.chain],
                  }}
                  className="h-full transition-all duration-300"
                  title={`${alloc.name}: ${alloc.percentage.toFixed(1)}%`}
                />
              );
            })
          ) : (
            <div className="h-full w-full bg-slate-200 dark:bg-slate-800" />
          )}
        </div>

        {/* Chain rows */}
        <div className="space-y-2.5">
          {allocations.map((alloc) => {
            const isSelected = selectedChain === alloc.chain;
            return (
              <div
                key={alloc.chain}
                className={`rounded-lg border transition-colors ${
                  isSelected
                    ? 'border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/20'
                    : 'border-slate-200/80 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/40'
                }`}
              >
                <button
                  type="button"
                  onClick={() =>
                    onSelectChain(isSelected ? 'all' : alloc.chain)
                  }
                  className="w-full p-3 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: CHAIN_COLORS[alloc.chain] }}
                        aria-hidden="true"
                      />
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                        {alloc.name}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {alloc.tokenCount} {alloc.tokenCount > 1 ? 'actifs' : 'actif'}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      {isLoading ? (
                        <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
                      ) : (
                        <div className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                          {formatUsd(alloc.valueUsd)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Source : {SOURCE_LABELS[alloc.source]}</span>
                    <span className="font-mono tabular-nums">
                      {alloc.percentage.toFixed(1)}%
                    </span>
                  </div>
                </button>

                {/* Real error or missing API key inline prompt */}
                {alloc.error && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 min-w-0">
                      {alloc.apiKeyMissing ? (
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span className="truncate">{alloc.error}</span>
                    </div>
                    {alloc.apiKeyMissing && (
                      <button
                        type="button"
                        onClick={onGoToConfig}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-900 dark:text-slate-100 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <span>Config</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
        <span>Modules prêts à activer</span>
        <span className="font-mono">ETH · ARB · SUI</span>
      </div>
    </section>
  );
}
