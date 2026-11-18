import { useEffect, useRef } from 'react';
import { BellRing, Menu, Plus, RefreshCw, Search, X } from 'lucide-react';
import { formatRelativeTime } from '../utils/format';
import type { NavSection } from './Sidebar';

interface TopBarProps {
  activeSection: NavSection;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdatedAt: number | null;
  unreadAlertCount: number;
  onOpenAlerts: () => void;
  onOpenAddWallet: () => void;
  onOpenMobileMenu: () => void;
}

const SECTION_LABELS: Record<NavSection, string> = {
  dashboard: 'Vue globale',
  wallets: 'Portefeuilles suivis',
  alerts: 'Alertes & Exports',
  chains: 'Architecture Blockchains',
  config: 'Configuration & Clés API',
};

export function TopBar({
  activeSection,
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing,
  lastUpdatedAt,
  unreadAlertCount,
  onOpenAlerts,
  onOpenAddWallet,
  onOpenMobileMenu,
}: TopBarProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 glass-panel border-t-0 border-x-0 px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
      {/* Left: Mobile trigger + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Ouvrir le menu"
          className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">Terminal</span>
            <span className="text-slate-300 dark:text-slate-700 hidden sm:inline">/</span>
            <span className="truncate">{SECTION_LABELS[activeSection]}</span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono truncate">
            {formatRelativeTime(lastUpdatedAt)}
          </p>
        </div>
      </div>

      {/* Center: Instant Search */}
      <div className="flex-1 max-w-md hidden md:block">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Rechercher un token, ticker ou contrat…"
            className="w-full pl-9 pr-14 py-2 text-xs rounded-lg bg-slate-100/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Effacer la recherche"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-400 dark:text-slate-500 pointer-events-none">
              ⌘K
            </span>
          )}
        </div>
      </div>

      {/* Right: Primary Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        {unreadAlertCount > 0 && (
          <button
            type="button"
            onClick={onOpenAlerts}
            title="Alertes déclenchées"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-semibold border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition-colors cursor-pointer"
          >
            <BellRing className="w-3.5 h-3.5" />
            <span>{unreadAlertCount}</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenAddWallet}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Ajouter un wallet</span>
          <span className="sm:hidden">Wallet</span>
        </button>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>{isRefreshing ? 'Actualisation…' : 'Actualiser'}</span>
        </button>
      </div>
    </header>
  );
}
