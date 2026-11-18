import { ArrowRight, KeyRound } from 'lucide-react';

interface ApiKeyRequiredCardProps {
  title?: string;
  description: string;
  envKeyNames: string[];
  onGoToConfig: () => void;
  compact?: boolean;
}

export function ApiKeyRequiredCard({
  title = 'Clé API requise',
  description,
  envKeyNames,
  onGoToConfig,
  compact = false,
}: ApiKeyRequiredCardProps) {
  return (
    <div
      className={`rounded-xl border border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 ${
        compact ? 'p-3.5' : 'p-4 sm:p-5'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 p-2 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
            <KeyRound className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              {envKeyNames.length > 0 && (
                <span className="text-xs font-mono text-amber-700 dark:text-amber-300">
                  {envKeyNames.join(' · ')}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {description}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onGoToConfig}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Configurer</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
