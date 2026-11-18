import {
  Bell,
  Layers,
  LayoutDashboard,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Wallet,
  X,
} from 'lucide-react';
import type { ThemeMode } from '../types/config';

export type NavSection = 'dashboard' | 'wallets' | 'alerts' | 'chains' | 'config';

interface SidebarProps {
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
  walletCount: number;
  unreadAlertCount: number;
  missingKeyCount: number;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Vue globale', icon: LayoutDashboard },
  { id: 'wallets', label: 'Portefeuilles', icon: Wallet },
  { id: 'alerts', label: 'Alertes & Exports', icon: Bell },
  { id: 'chains', label: 'Blockchains', icon: Layers },
  { id: 'config', label: 'Configuration', icon: Settings },
];

export function Sidebar({
  activeSection,
  onSelectSection,
  theme,
  onToggleTheme,
  walletCount,
  unreadAlertCount,
  missingKeyCount,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col h-full justify-between px-4 py-5 bg-white dark:bg-[#0E121A] border-r border-slate-200 dark:border-slate-800/90">
      <div>
        <div className="flex items-center justify-between px-2 mb-8">
          <button
            type="button"
            onClick={() => {
              onSelectSection('dashboard');
              onCloseMobile();
            }}
            className="flex items-center gap-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 28 28"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
              className="shrink-0"
            >
              <rect
                width="28"
                height="28"
                rx="7"
                className="fill-slate-900 dark:fill-blue-600"
              />
              <path
                d="M7 19.5V8.5L14 14.5L21 8.5V19.5"
                stroke="white"
                strokeWidth="2.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              Meridian
            </span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fermer le menu"
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Navigation principale">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectSection(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-100 text-slate-900 dark:bg-slate-800/80 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800/40'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'wallets' && walletCount > 0 && (
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                    {walletCount}
                  </span>
                )}
                {item.id === 'alerts' && unreadAlertCount > 0 && (
                  <span className="text-xs font-mono font-semibold text-amber-600 dark:text-amber-400">
                    {unreadAlertCount}
                  </span>
                )}
                {item.id === 'config' && missingKeyCount > 0 && (
                  <span className="text-xs font-mono text-amber-600 dark:text-amber-400">
                    {missingKeyCount} req.
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800/80">
        <div className="px-3 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Lecture seule stricte</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Adresses publiques uniquement. Aucune clé privée requise ni stockée.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2.5">
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
            <span>{theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}</span>
          </span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">{navContent}</div>
        </div>
      )}
    </>
  );
}
