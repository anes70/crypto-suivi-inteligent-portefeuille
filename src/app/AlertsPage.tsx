import { useState, type FormEvent } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Check,
  CheckCheck,
  Download,
  FileJson,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  getBrowserNotificationStatus,
  requestBrowserNotificationPermission,
  type BrowserNotificationStatus,
} from '../services/alerts/alertEvaluator';
import { exportAiDecisions, exportTradesAndPnl } from '../services/export/exportService';
import {
  ALERT_TYPE_LABELS,
  type AlertConditionDirection,
  type AlertType,
  type CreateAlertInput,
  type TokenAlert,
} from '../types/alerts';
import type { TokenCustomMetadata } from '../types/metadata';
import type { CostBasisEntry } from '../types/pnl';
import type { TokenHolding } from '../types/portfolio';
import { formatRelativeTime, formatTokenPrice } from '../utils/format';
import { getChainLabel } from '../utils/validators';

interface AlertsPageProps {
  holdings: TokenHolding[];
  alerts: TokenAlert[];
  metadataMap: Record<string, TokenCustomMetadata>;
  costBasisMap: Record<string, CostBasisEntry>;
  onCreateAlert: (input: CreateAlertInput) => void;
  onToggleAlert: (id: string) => void;
  onRearmAlert: (id: string) => void;
  onDeleteAlert: (id: string) => void;
  onAcknowledgeAlert: (id: string) => void;
  onAcknowledgeAll: () => void;
  onSelectToken: (token: TokenHolding) => void;
}

export function AlertsPage({
  holdings,
  alerts,
  metadataMap,
  costBasisMap,
  onCreateAlert,
  onToggleAlert,
  onRearmAlert,
  onDeleteAlert,
  onAcknowledgeAlert,
  onAcknowledgeAll,
  onSelectToken,
}: AlertsPageProps) {
  const [selectedHoldingId, setSelectedHoldingId] = useState<string>(
    () => holdings[0]?.id || ''
  );
  const [alertType, setAlertType] = useState<AlertType>('price_target');
  const [direction, setDirection] = useState<AlertConditionDirection>('above');
  const [thresholdInput, setThresholdInput] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<BrowserNotificationStatus>(() =>
    getBrowserNotificationStatus()
  );
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const selectedHolding =
    holdings.find((h) => h.id === selectedHoldingId) || holdings[0] || null;

  const triggeredAlerts = alerts.filter((a) => a.triggered);
  const activeAlerts = alerts.filter((a) => !a.triggered);
  const unreadCount = triggeredAlerts.filter((a) => !a.acknowledged).length;

  const handleRequestNotif = async () => {
    const res = await requestBrowserNotificationPermission();
    setNotifStatus(res);
  };

  const handleTypeChange = (nextType: AlertType) => {
    setAlertType(nextType);
    setFormError(null);
    if (nextType === 'price_target' || nextType === 'take_profit') {
      setDirection('above');
      const p = selectedHolding?.priceUsd ?? 0;
      setThresholdInput(p > 0 ? (p * 1.2).toPrecision(5) : '');
    } else if (nextType === 'stop_loss') {
      setDirection('below');
      const p = selectedHolding?.priceUsd ?? 0;
      setThresholdInput(p > 0 ? (p * 0.85).toPrecision(5) : '');
    } else if (nextType === 'rsi_threshold') {
      setDirection('below');
      setThresholdInput('30');
    } else if (nextType === 'liquidity_drop') {
      setDirection(selectedHolding?.liquidityUsd ? 'drop_pct' : 'below');
      setThresholdInput(selectedHolding?.liquidityUsd ? '30' : '50000');
    } else if (nextType === 'volume_spike') {
      setDirection('above');
      setThresholdInput('1000000');
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedHolding) {
      setFormError('Ajoutez d’abord un portefeuille contenant des actifs.');
      return;
    }
    const val = Number(thresholdInput.replace(',', '.'));
    if (!Number.isFinite(val) || val <= 0) {
      setFormError('Saisissez un seuil numérique positif.');
      return;
    }
    if (alertType === 'rsi_threshold' && (val < 1 || val > 99)) {
      setFormError('Le seuil RSI doit être compris entre 1 et 99.');
      return;
    }

    onCreateAlert({
      chain: selectedHolding.chain,
      tokenAddress: selectedHolding.address,
      symbol: selectedHolding.symbol,
      name: selectedHolding.name,
      type: alertType,
      direction,
      thresholdValue: val,
      baselineValue:
        alertType === 'liquidity_drop'
          ? selectedHolding.liquidityUsd ?? null
          : selectedHolding.priceUsd ?? null,
    });
    setFormError(null);
  };

  const handleGlobalExport = (kind: 'ai' | 'trades', format: 'csv' | 'json') => {
    const count =
      kind === 'ai'
        ? exportAiDecisions({ format, holdings })
        : exportTradesAndPnl({ format, holdings, costBasisMap, metadataMap });
    setExportStatus(
      `Export global ${format.toUpperCase()} téléchargé (${count} entrée${count > 1 ? 's' : ''}).`
    );
    setTimeout(() => setExportStatus(null), 3500);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
            Alertes Intelligentes &amp; Exports
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Surveillance locale (Prix, RSI, Volume, Rug Pull, TP/SL) et export CSV/JSON des décisions IA &amp; trades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {notifStatus === 'default' ? (
            <button
              type="button"
              onClick={handleRequestNotif}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Autoriser notifications navigateur</span>
            </button>
          ) : notifStatus === 'granted' ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
              <Check className="w-3.5 h-3.5" />
              <span>Notifications navigateur activées</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
              <BellOff className="w-3.5 h-3.5" />
              <span>Alertes in-app actives</span>
            </span>
          )}
        </div>
      </div>

      {/* Global Export Strip */}
      <section className="glass-panel rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Export global du portefeuille (CSV / JSON)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Exportez tout l&apos;historique des décisions IA quantitatives ainsi que vos PMA, PnL, tags et notes privées.
            </p>
            {exportStatus && (
              <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                {exportStatus}
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handleGlobalExport('ai', 'csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Décisions IA · CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleGlobalExport('ai', 'json')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-500" />
            <span>Décisions IA · JSON</span>
          </button>
          <button
            type="button"
            onClick={() => handleGlobalExport('trades', 'csv')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-500" />
            <span>Trades &amp; PMA · CSV</span>
          </button>
          <button
            type="button"
            onClick={() => handleGlobalExport('trades', 'json')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 cursor-pointer"
          >
            <FileJson className="w-3.5 h-3.5 text-blue-500" />
            <span>Trades &amp; PMA · JSON</span>
          </button>
        </div>
      </section>

      {/* Quick Create Alert across any holding */}
      <section className="glass-panel rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
          Créer une nouvelle alerte
        </h2>

        {holdings.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ajoutez un portefeuille avec des actifs actifs pour configurer des alertes depuis cette vue.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Actif
              </label>
              <select
                value={selectedHolding?.id || ''}
                onChange={(e) => setSelectedHoldingId(e.target.value)}
                className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                {holdings.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.symbol} ({getChainLabel(h.chain)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Type
              </label>
              <select
                value={alertType}
                onChange={(e) => handleTypeChange(e.target.value as AlertType)}
                className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                <option value="price_target">Prix cible</option>
                <option value="take_profit">Take Profit</option>
                <option value="stop_loss">Stop Loss</option>
                <option value="rsi_threshold">Seuil RSI (14)</option>
                <option value="volume_spike">Variation de volume</option>
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
                className="w-full px-2.5 py-2 rounded-lg text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              >
                {(alertType === 'price_target' || alertType === 'take_profit') && (
                  <option value="above">Prix ≥ (USD)</option>
                )}
                {(alertType === 'price_target' || alertType === 'stop_loss') && (
                  <option value="below">Prix ≤ (USD)</option>
                )}
                {alertType === 'rsi_threshold' && (
                  <>
                    <option value="below">RSI ≤ (Survendu)</option>
                    <option value="above">RSI ≥ (Suracheté)</option>
                  </>
                )}
                {alertType === 'liquidity_drop' && (
                  <>
                    {selectedHolding?.liquidityUsd && (
                      <option value="drop_pct">Chute ≥ (%)</option>
                    )}
                    <option value="below">Liquidité ≤ (USD)</option>
                  </>
                )}
                {alertType === 'volume_spike' && (
                  <option value="above">Volume 24h ≥ (USD)</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Seuil
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={thresholdInput}
                onChange={(e) => {
                  setThresholdInput(e.target.value);
                  setFormError(null);
                }}
                placeholder="Ex: 200"
                className="w-full px-2.5 py-2 rounded-lg text-xs font-mono bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-white cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter l&apos;alerte</span>
              </button>
            </div>
          </form>
        )}

        {formError && (
          <p className="text-xs text-rose-600 dark:text-rose-400">{formError}</p>
        )}
      </section>

      {/* Triggered & Active Alerts Columns */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Triggered Alerts */}
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Alertes déclenchées ({triggeredAlerts.length})
              </h2>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onAcknowledgeAll}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Tout marquer lu</span>
              </button>
            )}
          </div>

          {triggeredAlerts.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucune alerte déclenchée pour le moment.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {triggeredAlerts.map((alert) => {
                const match = holdings.find(
                  (h) =>
                    h.chain === alert.chain &&
                    (h.chain !== 'solana'
                      ? h.address.toLowerCase() === alert.tokenAddress.toLowerCase()
                      : h.address === alert.tokenAddress)
                );
                return (
                  <div
                    key={alert.id}
                    className={`p-4 flex items-start justify-between gap-3 ${
                      !alert.acknowledged ? 'bg-amber-50/70 dark:bg-amber-950/20' : ''
                    }`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {alert.symbol}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          {ALERT_TYPE_LABELS[alert.type]}
                        </span>
                        <span className="font-mono text-[11px] text-amber-700 dark:text-amber-300">
                          {formatRelativeTime(alert.triggeredAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-200">
                        {alert.triggeredMessage}
                      </p>
                      {match && (
                        <button
                          type="button"
                          onClick={() => onSelectToken(match)}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          Ouvrir la fiche {match.symbol} →
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => onAcknowledgeAlert(alert.id)}
                          className="px-2 py-1 rounded-md text-[11px] font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer"
                        >
                          Lu
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRearmAlert(alert.id)}
                        title="Réarmer"
                        className="p-1.5 rounded-md text-slate-400 hover:text-blue-500 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteAlert(alert.id)}
                        aria-label="Supprimer"
                        className="p-1.5 rounded-md text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Watchlist Alerts */}
        <section className="glass-panel rounded-xl overflow-hidden">
          <div className="p-4 sm:px-5 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center gap-2">
            <Bell className="w-4 h-4 text-blue-500" />
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Alertes actives ({activeAlerts.length})
            </h2>
          </div>

          {activeAlerts.length === 0 ? (
            <p className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucune alerte en attente.
            </p>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-4 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {alert.type === 'liquidity_drop' && (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      )}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {alert.symbol}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {ALERT_TYPE_LABELS[alert.type]}
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-200 tabular-nums">
                        {alert.direction === 'drop_pct'
                          ? `-${alert.thresholdValue}%`
                          : alert.direction === 'spike_pct'
                            ? `+${alert.thresholdValue}%`
                            : alert.type === 'rsi_threshold'
                              ? `${alert.direction === 'below' ? '≤' : '≥'} ${alert.thresholdValue}`
                              : `${alert.direction === 'above' ? '≥' : '≤'} ${formatTokenPrice(alert.thresholdValue)}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onToggleAlert(alert.id)}
                      className="px-2.5 py-1 rounded-md text-[11px] font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                      {alert.enabled ? 'Pause' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAlert(alert.id)}
                      aria-label="Supprimer"
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
    </div>
  );
}
