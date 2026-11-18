import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { AlertsPage } from './app/AlertsPage';
import { ChainsPage } from './app/ChainsPage';
import { DashboardPage } from './app/DashboardPage';
import { SettingsPage } from './app/SettingsPage';
import { TokenDetailPage } from './app/TokenDetailPage';
import { WalletsPage } from './app/WalletsPage';
import { AddWalletModal } from './components/AddWalletModal';
import { Sidebar, type NavSection } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import {
  dispatchBrowserNotification,
  evaluateAlerts,
  makeTokenAlertKey,
} from './services/alerts/alertEvaluator';
import {
  acknowledgeAlert,
  acknowledgeAllAlerts,
  createAlert,
  deleteAlert,
  loadAlerts,
  rearmAlert,
  saveAlerts,
  toggleAlertEnabled,
} from './services/alerts/alertsStorage';
import {
  loadTokenMetadataMap,
  saveTokenNote,
  saveTokenTags,
  toggleTokenFavorite,
} from './services/notes/tokenMetadataStorage';
import {
  deleteCostBasisEntry,
  loadCostBasisMap,
  saveCostBasisEntry,
} from './services/pnl/costBasisStorage';
import {
  aggregatePortfolio,
  buildWalletSignature,
} from './services/portfolio/aggregator';
import type { CreateAlertInput, TokenAlert } from './types/alerts';
import type { ActiveChainId } from './types/chain';
import type { ApiConfigStatus, AppPreferences } from './types/config';
import type { TokenCustomMetadata } from './types/metadata';
import type { OnChainTokenMetrics } from './types/onchain';
import type { CostBasisEntry } from './types/pnl';
import type {
  PortfolioSnapshot,
  PortfolioSummary,
  TokenHolding,
} from './types/portfolio';
import type { TrackedWallet } from './types/wallet';
import {
  clearPortfolioSnapshots,
  loadPortfolioSnapshots,
  loadPreferences,
  loadTrackedWallets,
  savePreferences,
  saveTrackedWallets,
} from './utils/storage';

const EMPTY_PORTFOLIO: PortfolioSummary = {
  totalValueUsd: 0,
  change24hUsd: 0,
  change24hPercent: 0,
  holdings: [],
  allocations: [
    {
      chain: 'base',
      name: 'Base',
      valueUsd: 0,
      percentage: 0,
      tokenCount: 0,
      source: 'idle',
      apiKeyMissing: false,
      apiKeyName: null,
    },
    {
      chain: 'robinhood',
      name: 'Robinhood',
      valueUsd: 0,
      percentage: 0,
      tokenCount: 0,
      source: 'idle',
      apiKeyMissing: false,
      apiKeyName: null,
    },
    {
      chain: 'solana',
      name: 'Solana',
      valueUsd: 0,
      percentage: 0,
      tokenCount: 0,
      source: 'idle',
      apiKeyMissing: false,
      apiKeyName: null,
    },
  ],
  dustStats: {
    totalRawCount: 0,
    filteredZeroOrDustCount: 0,
    thresholdUsd: 0.01,
  },
  lastUpdatedAt: null,
};

export default function App() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard');
  const [wallets, setWallets] = useState<TrackedWallet[]>(() => loadTrackedWallets());
  const [preferences, setPreferences] = useState<AppPreferences>(() => loadPreferences());
  const [costBasisMap, setCostBasisMap] = useState<Record<string, CostBasisEntry>>(() =>
    loadCostBasisMap()
  );
  const [alerts, setAlerts] = useState<TokenAlert[]>(() => loadAlerts());
  const [metadataMap, setMetadataMap] = useState<Record<string, TokenCustomMetadata>>(() =>
    loadTokenMetadataMap()
  );
  const [bannerAlerts, setBannerAlerts] = useState<TokenAlert[]>([]);
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null);
  const [apiConfig, setApiConfig] = useState<ApiConfigStatus | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioSummary>(EMPTY_PORTFOLIO);
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const [selectedChain, setSelectedChain] = useState<'all' | ActiveChainId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const alertsRef = useRef<TokenAlert[]>(alerts);
  alertsRef.current = alerts;

  const holdingsRef = useRef<TokenHolding[]>(portfolio.holdings);
  holdingsRef.current = portfolio.holdings;

  // Sync Tailwind v4 dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (preferences.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    savePreferences(preferences);
  }, [preferences]);

  // Persist wallets in LocalStorage
  useEffect(() => {
    saveTrackedWallets(wallets);
  }, [wallets]);

  // Fetch server .env key configuration status (boolean flags only, never secrets)
  useEffect(() => {
    let mounted = true;
    fetch('/api/config/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (mounted && data) {
          setApiConfig(data as ApiConfigStatus);
        }
      })
      .catch(() => {
        // ignore network errors
      });
    return () => {
      mounted = false;
    };
  }, []);

  const applyAlertEvaluation = useCallback(
    (
      holdings: TokenHolding[],
      metricsByToken?: Record<string, OnChainTokenMetrics | null>,
      rsiByToken?: Record<string, number | null>
    ) => {
      const result = evaluateAlerts({
        alerts: alertsRef.current,
        holdings,
        metricsByToken,
        rsiByToken,
      });

      if (result.changed) {
        saveAlerts(result.updatedAlerts);
        alertsRef.current = result.updatedAlerts;
        setAlerts(result.updatedAlerts);

        if (result.newlyTriggered.length > 0) {
          setBannerAlerts((prev) => [...result.newlyTriggered, ...prev].slice(0, 4));
          for (const triggered of result.newlyTriggered) {
            dispatchBrowserNotification(
              `Meridian · Alerte ${triggered.symbol}`,
              triggered.triggeredMessage || `${triggered.symbol} a franchi un seuil.`
            );
          }
        }
      }
    },
    []
  );

  const refreshPortfolio = useCallback(
    async (forceRefresh = false) => {
      setIsRefreshing(true);
      try {
        const nextSummary = await aggregatePortfolio(wallets, {
          customBaseTokens: preferences.customBaseTokens,
          dustThresholdUsd: preferences.dustThresholdUsd,
          forceRefresh,
        });
        setPortfolio(nextSummary);
        applyAlertEvaluation(nextSummary.holdings);

        const sig = buildWalletSignature(wallets);
        if (sig) {
          const hist = await loadPortfolioSnapshots(sig);
          setSnapshots(hist);
        } else {
          setSnapshots([]);
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [wallets, preferences.customBaseTokens, preferences.dustThresholdUsd, applyAlertEvaluation]
  );

  // Refresh whenever active wallets or filter preferences change
  useEffect(() => {
    refreshPortfolio(false);
  }, [refreshPortfolio]);

  const handleEvaluateTokenAlerts = useCallback(
    (
      chain: ActiveChainId,
      tokenAddress: string,
      metrics: OnChainTokenMetrics | null,
      rsi14: number | null
    ) => {
      const key = makeTokenAlertKey(chain, tokenAddress);
      applyAlertEvaluation(
        holdingsRef.current,
        metrics ? { [key]: metrics } : undefined,
        rsi14 !== null ? { [key]: rsi14 } : undefined
      );
    },
    [applyAlertEvaluation]
  );

  const handleToggleTheme = () => {
    setPreferences((prev) => ({
      ...prev,
      theme: prev.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleAddWallet = (wallet: TrackedWallet) => {
    setWallets((prev) => [wallet, ...prev]);
  };

  const handleToggleWallet = (id: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const handleRemoveWallet = (id: string) => {
    setWallets((prev) => prev.filter((w) => w.id !== id));
  };

  const handleClearHistory = async () => {
    await clearPortfolioSnapshots();
    setSnapshots([]);
  };

  const missingKeyCount = useMemo(() => {
    if (!apiConfig) return 0;
    return (apiConfig.alchemyConfigured ? 0 : 1) + (apiConfig.heliusConfigured ? 0 : 1);
  }, [apiConfig]);

  const unreadAlertCount = useMemo(
    () => alerts.filter((a) => a.triggered && !a.acknowledged).length,
    [alerts]
  );

  const selectedHolding = useMemo(
    () => portfolio.holdings.find((h) => h.id === selectedTokenId) || null,
    [portfolio.holdings, selectedTokenId]
  );

  const handleSaveCostBasis = (
    chain: ActiveChainId,
    tokenAddress: string,
    avgPriceUsd: number,
    source: 'manual' | 'onchain-import',
    txCount?: number
  ) => {
    setCostBasisMap(saveCostBasisEntry(chain, tokenAddress, avgPriceUsd, source, txCount));
  };

  const handleDeleteCostBasis = (chain: ActiveChainId, tokenAddress: string) => {
    setCostBasisMap(deleteCostBasisEntry(chain, tokenAddress));
  };

  const handleCreateAlert = (input: CreateAlertInput) => {
    const next = createAlert(input);
    setAlerts(next);
  };

  const handleToggleAlert = (id: string) => {
    setAlerts(toggleAlertEnabled(id));
  };

  const handleRearmAlert = (id: string) => {
    setAlerts(rearmAlert(id));
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(deleteAlert(id));
    setBannerAlerts((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAcknowledgeAlert = (id: string) => {
    setAlerts(acknowledgeAlert(id));
    setBannerAlerts((prev) => prev.filter((b) => b.id !== id));
  };

  const handleAcknowledgeAllAlerts = () => {
    setAlerts(acknowledgeAllAlerts());
    setBannerAlerts([]);
  };

  const handleToggleFavorite = (chain: ActiveChainId, tokenAddress: string) => {
    setMetadataMap(toggleTokenFavorite(chain, tokenAddress));
  };

  const handleSaveTags = (
    chain: ActiveChainId,
    tokenAddress: string,
    tags: string[]
  ) => {
    setMetadataMap(saveTokenTags(chain, tokenAddress, tags));
  };

  const handleSaveNote = (
    chain: ActiveChainId,
    tokenAddress: string,
    note: string
  ) => {
    setMetadataMap(saveTokenNote(chain, tokenAddress, note));
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0E14] text-slate-900 dark:text-slate-100">
      <Sidebar
        activeSection={activeSection}
        onSelectSection={(sec) => {
          setActiveSection(sec);
          setSelectedTokenId(null);
        }}
        theme={preferences.theme}
        onToggleTheme={handleToggleTheme}
        walletCount={wallets.length}
        unreadAlertCount={unreadAlertCount}
        missingKeyCount={missingKeyCount}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={() => refreshPortfolio(true)}
          isRefreshing={isRefreshing}
          lastUpdatedAt={portfolio.lastUpdatedAt}
          unreadAlertCount={unreadAlertCount}
          onOpenAlerts={() => {
            setSelectedTokenId(null);
            setActiveSection('alerts');
          }}
          onOpenAddWallet={() => setIsAddWalletOpen(true)}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto space-y-5">
          {/* In-app live alert notification banner */}
          {bannerAlerts.length > 0 && (
            <div className="space-y-2">
              {bannerAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-500/40 bg-amber-50/90 dark:bg-amber-950/35 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <BellRing className="w-4 h-4 text-amber-500 shrink-0" />
                    <p className="text-slate-800 dark:text-amber-100 truncate">
                      {alert.triggeredMessage || `Alerte déclenchée sur ${alert.symbol}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedTokenId(null);
                        setActiveSection('alerts');
                      }}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      Voir
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      aria-label="Fermer l'alerte"
                      className="p-1 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeSection === 'dashboard' && selectedHolding && (
            <TokenDetailPage
              holding={selectedHolding}
              allHoldings={portfolio.holdings}
              portfolio={portfolio}
              snapshots={snapshots}
              apiConfig={apiConfig}
              totalPortfolioUsd={portfolio.totalValueUsd}
              theme={preferences.theme}
              costBasisMap={costBasisMap}
              alerts={alerts}
              metadataMap={metadataMap}
              onSaveCostBasis={handleSaveCostBasis}
              onDeleteCostBasis={handleDeleteCostBasis}
              onCreateAlert={handleCreateAlert}
              onToggleAlert={handleToggleAlert}
              onRearmAlert={handleRearmAlert}
              onDeleteAlert={handleDeleteAlert}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onToggleFavorite={handleToggleFavorite}
              onSaveTags={handleSaveTags}
              onSaveNote={handleSaveNote}
              onEvaluateTokenAlerts={handleEvaluateTokenAlerts}
              onBack={() => setSelectedTokenId(null)}
              onGoToConfig={() => {
                setSelectedTokenId(null);
                setActiveSection('config');
              }}
            />
          )}

          {activeSection === 'dashboard' && !selectedHolding && (
            <DashboardPage
              portfolio={portfolio}
              snapshots={snapshots}
              wallets={wallets}
              costBasisMap={costBasisMap}
              metadataMap={metadataMap}
              alerts={alerts}
              apiConfig={apiConfig}
              theme={preferences.theme}
              selectedChain={selectedChain}
              onSelectChain={setSelectedChain}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isLoading={isRefreshing}
              onOpenAddWallet={() => setIsAddWalletOpen(true)}
              onGoToConfig={() => setActiveSection('config')}
              onSelectToken={(token: TokenHolding) => setSelectedTokenId(token.id)}
              onToggleFavorite={handleToggleFavorite}
            />
          )}

          {activeSection === 'wallets' && (
            <WalletsPage
              wallets={wallets}
              onToggleWallet={handleToggleWallet}
              onRemoveWallet={handleRemoveWallet}
              onOpenAddWallet={() => setIsAddWalletOpen(true)}
              onGoToConfig={() => setActiveSection('config')}
            />
          )}

          {activeSection === 'alerts' && (
            <AlertsPage
              holdings={portfolio.holdings}
              alerts={alerts}
              metadataMap={metadataMap}
              costBasisMap={costBasisMap}
              onCreateAlert={handleCreateAlert}
              onToggleAlert={handleToggleAlert}
              onRearmAlert={handleRearmAlert}
              onDeleteAlert={handleDeleteAlert}
              onAcknowledgeAlert={handleAcknowledgeAlert}
              onAcknowledgeAll={handleAcknowledgeAllAlerts}
              onSelectToken={(token: TokenHolding) => {
                setActiveSection('dashboard');
                setSelectedTokenId(token.id);
              }}
            />
          )}

          {activeSection === 'chains' && (
            <ChainsPage
              apiConfig={apiConfig}
              onGoToConfig={() => setActiveSection('config')}
            />
          )}

          {activeSection === 'config' && (
            <SettingsPage
              apiConfig={apiConfig}
              preferences={preferences}
              onUpdatePreferences={setPreferences}
              onClearHistory={handleClearHistory}
              snapshotCount={snapshots.length}
            />
          )}
        </main>
      </div>

      <AddWalletModal
        isOpen={isAddWalletOpen}
        onClose={() => setIsAddWalletOpen(false)}
        onAddWallet={handleAddWallet}
        existingWallets={wallets}
      />
    </div>
  );
}
