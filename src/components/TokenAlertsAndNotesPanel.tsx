import { useEffect, useState, type FormEvent } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  ShieldAlert,
  Star,
  StickyNote,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import {
  getBrowserNotificationStatus,
  requestBrowserNotificationPermission,
  type BrowserNotificationStatus,
} from '../services/alerts/alertEvaluator';
import { exportAiDecisions, exportTradesAndPnl } from '../services/export/exportService';
import { makeTokenMetadataKey } from '../services/notes/tokenMetadataStorage';
import {
  ALERT_TYPE_LABELS,
  type AlertConditionDirection,
  type AlertType,
  type CreateAlertInput,
  type TokenAlert,
} from '../types/alerts';
import type { TokenCustomMetadata } from '../types/metadata';
import type { OnChainTokenMetrics } from '../types/onchain';
import type { CostBasisEntry } from '../types/pnl';
import type { TokenHolding } from '../types/portfolio';
import { formatRelativeTime, formatTokenPrice, formatUsd } from '../utils/format';

interface TokenAlertsAndNotesPanelProps {
  holding: TokenHolding;
  allHoldings: TokenHolding[];
  livePriceUsd: number;
  metrics: OnChainTokenMetrics | null;
  latestRsi14: number | null;
  alerts: TokenAlert[];
  metadataMap: Record<string, TokenCustomMetadata>;
  costBasisMap: Record<string, CostBasisEntry>;
  onCreateAlert: (input: CreateAlertInput) => void;
  onToggleAlert: (id: string) => void;
  onRearmAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onAcknowledgeAlert: (id: string) => void;
  onToggleFavorite: () => void;
  onSaveTags: (tags: string[]) => void;
  onSaveNote: (note: string) => void;
}

const SUGGESTED_TAGS = ['Core', 'DeFi', 'Momentum', 'Long Terme', 'Spéculatif', 'Take Profit'];

export function TokenAlertsAndNotesPanel({
  holding,
  allHoldings,
  livePriceUsd,
  metrics,
  latestRsi14,
  alerts,
  metadataMap,
  costBasisMap,
  onCreateAlert,
  onToggleAlert,
  onRearmAlert,
  onDeleteAlert,
  onAcknowledgeAlert,
  onToggleFavorite,
  onSaveTags,
  onSaveNote,
}: TokenAlertsAndNotesPanelProps) {
  const metaKey = makeTokenMetadataKey(holding.chain, holding.address);
  const meta = metadataMap[metaKey];
  const isFavorite = meta?.isFavorite ?? false;
  const tags = meta?.tags ?? [];

  const [tagInput, setTagInput] = useState('');
  const [noteDraft, setNoteDraft] = useState(meta?.note ?? '');
  const [noteSavedFeedback, setNoteSavedFeedback] = useState(false);

  const [alertType, setAlertType] = useState<AlertType>('price_target');
  const [direction, setDirection] = useState<AlertConditionDirection>('above');
  const [thresholdInput, setThresholdInput] = useState(() =>
    livePriceUsd > 0 ? (livePriceUsd * 1.15).toPrecision(5) : ''
  );
  const [alertFormError, setAlertFormError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<BrowserNotificationStatus>(() =>
    getBrowserNotificationStatus()
  );
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    setNoteDraft(meta?.note ?? '');
  }, [metaKey, meta?.note]);

  const tokenAlerts = alerts.filter(
    (a) =>
      a.chain === holding.chain &&
      (holding.chain !== 'solana'
        ? a.tokenAddress.toLowerCase() === holding.address.toLowerCase()
        : a.tokenAddress === holding.address)
  );

  const currentLiquidity = metrics?.liquidityUsd ?? holding.liquidityUsd ?? null;
  const currentVolume = metrics?.volume24h ?? null;

  const handleAlertTypeChange = (nextType: AlertType) => {
    setAlertType(nextType);
    setAlertFormError(null);
    if (nextType === 'price_target') {
      setDirection('above');
      setThresholdInput(livePriceUsd > 0 ? (livePriceUsd * 1.15).toPrecision(5) : '');
    } else if (nextType === 'take_profit') {
      setDirection('above');
      setThresholdInput(livePriceUsd > 0 ? (livePriceUsd * 1.25).toPrecision(5) : '');
    } else if (nextType === 'stop_loss') {
      setDirection('below');
      setThresholdInput(livePriceUsd > 0 ? (livePriceUsd * 0.85).toPrecision(5) : '');
    } else if (nextType === 'rsi_threshold') {
      setDirection('below');
      setThresholdInput('30');
    } else if (nextType === 'volume_spike') {
      setDirection(currentVolume ? 'spike_pct' : 'above');
      setThresholdInput(currentVolume ? '100' : '1000000');
    } else if (nextType === 'liquidity_drop') {
      setDirection(currentLiquidity ? 'drop_pct' : 'below');
      setThresholdInput(currentLiquidity ? '30' : '50000');
    }
  };

  const handleRequestNotifications = async () => {
    const next = await requestBrowserNotificationPermission();
    setNotifStatus(next);
  };

  const handleCreateAlert = (e: FormEvent) => {
    e.preventDefault();
    const val = Number(thresholdInput.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      setAlertFormError('Veuillez saisir un seuil numérique strictement positif.');
      return;
    }
    if (alertType === 'rsi_threshold' && (val < 1 || val > 99)) {
      setAlertFormError('Le seuil RSI doit être compris entre 1 et 99.');
      return;
    }
    if (
      (alertType === 'liquidity_drop' && direction === 'drop_pct' && !currentLiquidity) ||
      (alertType === 'volume_spike' && direction === 'spike_pct' && !currentVolume)
    ) {
      setAlertFormError(
        'Métrique de référence indisponible. Utilisez un seuil en USD absolu.'
      );
      return;
    }

    const baselineValue =
      alertType === 'liquidity_drop'
        ? currentLiquidity
        : alertType === 'volume_spike'
          ? currentVolume
          : livePriceUsd > 0
            ? livePriceUsd
            : null;

    onCreateAlert({
      chain: holding.chain,
      tokenAddress: holding.address,
      symbol: holding.symbol,
      name: holding.name,
      type: alertType,
      direction,
      thresholdValue: val,
      baselineValue,
    });
    setAlertFormError(null);
  };

  const handleQuickPreset = (preset: {
    type: AlertType;
    direction: AlertConditionDirection;
    thresholdValue: number;
    baselineValue: number | null;
  }) => {
    onCreateAlert({
      chain: holding.chain,
      tokenAddress: holding.address,
      symbol: holding.symbol,
      name: holding.name,
      ...preset,
    });
  };

  const handleAddTag = (e: FormEvent) => {
    e.preventDefault();
    const clean = tagInput.trim();
    if (!clean) return;
    if (!tags.includes(clean)) {
      onSaveTags([...tags, clean]);
    }
    setTagInput('');
  };

  const handleToggleSuggestedTag = (tag: string) => {
    if (tags.includes(tag)) {
      onSaveTags(tags.filter((t) => t !== tag));
    } else {
      onSaveTags([...tags, tag]);
    }
  };

  const handleSaveNote = () => {
    onSaveNote(noteDraft);
    setNoteSavedFeedback(true);
    setTimeout(() => setNoteSavedFeedback(false), 1800);
  };

  const handleExport = (kind: 'ai' | 'trades', format: 'csv' | 'json') => {
    const count =
      kind === 'ai'
        ? exportAiDecisions({
            format,
            holdings: allHoldings,
            filterToken: {
              chain: holding.chain,
              address: holding.address,
              symbol: holding.symbol,
              name: holding.name,
            },
          })
        : exportTradesAndPnl({
            format,
            holdings: allHoldings,
            costBasisMap,
            metadataMap,
            filterToken: {
              chain: holding.chain,
              address: holding.address,
              symbol: holding.symbol,
            },
          });

    setExportMessage(
      count > 0
        ? `Export ${format.toUpperCase()} généré (${count} entrée${count > 1 ? 's' : ''}).`
        : `Fichier ${format.toUpperCase()} téléchargé (0 entrée enregistrée pour ${holding.symbol}).`
    );
    setTimeout(() => setExportMessage(null), 3000);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
      {/* Left 7 cols: Smart Alerts */}
      <div className="xl:col-span-7 space-y-5">
        <section className="glass-panel rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4 h-4 text-blue-500 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Alertes Intelligentes ({holding.symbol})
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Évaluées en local à chaque actualisation avec notifications navigateur.
                </p>
              </div>
            </div>

            {notifStatus === 'default' ? (
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shrink-0"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>Activer notifications</span>
              </button>
            ) : notifStatus === 'granted' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                <Check className="w-3.5 h-3.5" />
                <span>Notifications actives</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                <BellOff className="w-3.5 h-3.5" />
                <span>Bannière in-app active</span>
              </span>
            )}
          </div>

          {/* Quick 1-click presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Raccourcis :
            </span>
            <button
              type="button"
              onClick={() =>
                handleQuickPreset({
                  type: 'rsi_threshold',
                  direction: 'below',
                  thresholdValue: 30,
                  baselineValue: latestRsi14,
                })
              }
              className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              + RSI &lt; 30
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickPreset({
                  type: 'rsi_threshold',
                  direction: 'above',
                  thresholdValue: 70,
                  baselineValue: latestRsi14,
                })
              }
              className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              + RSI &gt; 70
            </button>
            {currentLiquidity !== null && currentLiquidity > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleQuickPreset({
                    type: 'liquidity_drop',
                    direction: 'drop_pct',
                    thresholdValue: 30,
                    baselineValue: currentLiquidity,
                  })
                }
                className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300 hover:border-rose-500/60 cursor-pointer"
              >
                + Rug Pull -30% liq.
              </button>
            )}
            {currentVolume !== null && currentVolume > 0 && (
              <button
                type="button"
                onClick={() =>
                  handleQuickPreset({
                    type: 'volume_spike',
                    direction: 'spike_pct',
                    thresholdValue: 100,
                    baselineValue: currentVolume,
                  })
                }
                className="px-2.5 py-1 rounded-md text-[11px] font-mono border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
              >
                + Volume +100%
              </button>
            )}
          </div>

          {/* Alert Creation Form */}
          <form
            onSubmit={handleCreateAlert}
            className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80 space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Type d&apos;alerte
                </label>
                <select
                  value={alertType}
                  onChange={(e) => handleAlertTypeChange(e.target.value as AlertType)}
                  className="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="price_target">Prix cible</option>
                  <option value="take_profit">Take Profit</option>
                  <option value="stop_loss">Stop Loss</option>
                  <option value="rsi_threshold">Seuil RSI (&lt;30 / &gt;70)</option>
                  <option value="volume_spike">Variation brutale de volume</option>
                  <option value="liquidity_drop">Chute liquidité (Rug Pull)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Condition
                </label>
                <select
                  value={direction}
                  onChange={(e) =>
                    setDirection(e.target.value as AlertConditionDirection)
                  }
                  className="w-full px-2.5 py-2 rounded-lg text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                >
                  {alertType === 'price_target' && (
                    <>
                      <option value="above">Prix ≥ Cible (USD)</option>
                      <option value="below">Prix ≤ Cible (USD)</option>
                    </>
                  )}
                  {alertType === 'take_profit' && (
                    <option value="above">Prix ≥ Take Profit (USD)</option>
                  )}
                  {alertType === 'stop_loss' && (
                    <option value="below">Prix ≤ Stop Loss (USD)</option>
                  )}
                  {alertType === 'rsi_threshold' && (
                    <>
                      <option value="below">RSI ≤ Seuil (Survendu)</option>
                      <option value="above">RSI ≥ Seuil (Suracheté)</option>
                    </>
                  )}
                  {alertType === 'volume_spike' && (
                    <>
                      {currentVolume !== null && (
                        <option value="spike_pct">Hausse volume ≥ (%)</option>
                      )}
                      <option value="above">Volume 24h ≥ (USD)</option>
                    </>
                  )}
                  {alertType === 'liquidity_drop' && (
                    <>
                      {currentLiquidity !== null && (
                        <option value="drop_pct">Chute liquidité ≥ (%)</option>
                      )}
                      <option value="below">Liquidité ≤ (USD)</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                  {direction === 'drop_pct' || direction === 'spike_pct'
                    ? 'Seuil (%)'
                    : alertType === 'rsi_threshold'
                      ? 'Seuil RSI (1–99)'
                      : 'Seuil (USD)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={thresholdInput}
                    onChange={(e) => {
                      setThresholdInput(e.target.value);
                      setAlertFormError(null);
                    }}
                    placeholder="Ex: 150"
                    className="flex-1 min-w-0 px-2.5 py-2 rounded-lg text-xs font-mono bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white cursor-pointer shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer</span>
                  </button>
                </div>
              </div>
            </div>

            {alertFormError && (
              <p className="text-xs text-rose-600 dark:text-rose-400">{alertFormError}</p>
            )}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              <span>Prix : {formatTokenPrice(livePriceUsd)}</span>
              <span>
                RSI(14) : {latestRsi14 !== null ? latestRsi14.toFixed(1) : '—'}
              </span>
              <span>
                Liq. : {currentLiquidity !== null ? formatUsd(currentLiquidity, true) : '—'}
              </span>
              <span>
                Vol 24h : {currentVolume !== null ? formatUsd(currentVolume, true) : '—'}
              </span>
            </div>
          </form>

          {/* Active & Triggered Alerts List */}
          {tokenAlerts.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Aucune alerte configurée pour {holding.symbol}.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 border border-slate-200/80 dark:border-slate-800/80 rounded-lg overflow-hidden">
              {tokenAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    alert.triggered
                      ? 'bg-amber-50/70 dark:bg-amber-950/20'
                      : 'bg-white/50 dark:bg-slate-900/30'
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {alert.type === 'liquidity_drop' && (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {ALERT_TYPE_LABELS[alert.type]}
                      </span>
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        {alert.direction === 'drop_pct'
                          ? `-${alert.thresholdValue}%`
                          : alert.direction === 'spike_pct'
                            ? `+${alert.thresholdValue}%`
                            : alert.type === 'rsi_threshold'
                              ? `${alert.direction === 'below' ? '≤' : '≥'} ${alert.thresholdValue}`
                              : `${alert.direction === 'above' ? '≥' : '≤'} ${formatTokenPrice(alert.thresholdValue)}`}
                      </span>
                      {alert.triggered ? (
                        <span className="font-mono text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                          Déclenchée {formatRelativeTime(alert.triggeredAt)}
                        </span>
                      ) : !alert.enabled ? (
                        <span className="text-[11px] text-slate-400">En pause</span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          Surveillance active
                        </span>
                      )}
                    </div>
                    {alert.triggeredMessage && (
                      <p className="text-xs text-slate-700 dark:text-slate-200">
                        {alert.triggeredMessage}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {alert.triggered ? (
                      <>
                        {!alert.acknowledged && (
                          <button
                            type="button"
                            onClick={() => onAcknowledgeAlert(alert.id)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer"
                          >
                            Marquer lu
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRearmAlert(alert.id)}
                          title="Réactiver l'alerte"
                          className="p-1.5 rounded-md text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onToggleAlert(alert.id)}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        {alert.enabled ? 'Pause' : 'Activer'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alert.id)}
                      aria-label="Supprimer l'alerte"
                      className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Right 5 cols: Favorites, Tags, Private Notes & Export */}
      <div className="xl:col-span-5 space-y-5">
        {/* Favorites & Custom Tags */}
        <section className="glass-panel rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Favori &amp; Tags personnalisés
              </h2>
            </div>

            <button
              type="button"
              onClick={onToggleFavorite}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                isFavorite
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-amber-500/40'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
              <span>{isFavorite ? 'Favori actif' : 'Ajouter aux favoris'}</span>
            </button>
          </div>

          <form onSubmit={handleAddTag} className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              placeholder="Ajouter un tag (ex: Conviction, Airdrop)…"
              maxLength={24}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </form>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20"
                >
                  <span>{t}</span>
                  <button
                    type="button"
                    onClick={() => onSaveTags(tags.filter((x) => x !== t))}
                    aria-label={`Retirer le tag ${t}`}
                    className="hover:text-rose-500 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
            <span className="block text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              Suggestions rapides :
            </span>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_TAGS.map((st) => {
                const active = tags.includes(st);
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleToggleSuggestedTag(st)}
                    className={`px-2 py-1 rounded-md text-[11px] border transition-colors cursor-pointer ${
                      active
                        ? 'border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                        : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                    }`}
                  >
                    {st}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Private Notes */}
        <section className="glass-panel rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Notes privées ({holding.symbol})
              </h2>
            </div>
            {meta?.updatedAt && (
              <span className="text-[11px] text-slate-400">
                MAJ {formatRelativeTime(meta.updatedAt)}
              </span>
            )}
          </div>

          <textarea
            rows={4}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Thèse d'investissement, paliers de sortie, catalyseurs attendus… (stocké uniquement dans votre navigateur)"
            className="w-full p-3 rounded-lg text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Sauvegarde locale privée (LocalStorage)
            </span>
            <button
              type="button"
              onClick={handleSaveNote}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
            >
              {noteSavedFeedback && <Check className="w-3.5 h-3.5 text-emerald-500" />}
              <span>{noteSavedFeedback ? 'Note enregistrée' : 'Enregistrer la note'}</span>
            </button>
          </div>
        </section>

        {/* Token CSV / JSON Export */}
        <section className="glass-panel rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Export CSV / JSON ({holding.symbol})
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Téléchargez l&apos;historique des décisions IA et le journal PMA/PnL pour cet actif.
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleExport('ai', 'csv')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Décisions IA (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('ai', 'json')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-500" />
              <span>Décisions IA (JSON)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('trades', 'csv')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
              <span>Trades &amp; PMA (CSV)</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('trades', 'json')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
            >
              <FileJson className="w-3.5 h-3.5 text-blue-500" />
              <span>Trades &amp; PMA (JSON)</span>
            </button>
          </div>

          {exportMessage && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400">{exportMessage}</p>
          )}
        </section>
      </div>
    </div>
  );
}
