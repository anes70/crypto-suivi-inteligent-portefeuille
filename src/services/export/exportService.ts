import type { AiTokenAnalysis } from '../../types/ai';
import type { ActiveChainId } from '../../types/chain';
import type { TokenCustomMetadata } from '../../types/metadata';
import type { CostBasisEntry } from '../../types/pnl';
import type { TokenHolding } from '../../types/portfolio';
import { computeTokenPnl } from '../pnl/pnlEngine';

const AI_HISTORY_KEY = 'meridian.ai_analysis_history.v1';

interface AiExportRecord {
  tokenKey: string;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decision: string;
  horizon: string;
  confidence: number;
  risk: number;
  potential: number;
  reinforcementStrength: number;
  priceAtAnalysisUsd: number;
  targetPriceUsd: number;
  takeProfitUsd: number;
  stopLossUsd: number;
  idealBuyMinUsd: number;
  idealBuyMaxUsd: number;
  dangerMinUsd: number;
  dangerMaxUsd: number;
  provider: string;
  model: string;
  summary: string;
  reasoning: string[];
  generatedAtIso: string;
}

interface TradeCostBasisExportRecord {
  tokenKey: string;
  chain: ActiveChainId;
  address: string;
  symbol: string;
  name: string;
  balance: number;
  currentPriceUsd: number | null;
  currentValueUsd: number;
  avgBuyPriceUsd: number;
  costBasisUsd: number | null;
  unrealizedPnlUsd: number | null;
  roiPercent: number | null;
  source: string;
  transactionsAnalyzed: number | null;
  tags: string[];
  isFavorite: boolean;
  note: string;
  updatedAtIso: string;
}

function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(','));
  // UTF-8 BOM for proper French character decoding in Excel
  return `\uFEFF${[headerLine, ...dataLines].join('\r\n')}`;
}

function loadRawAiHistoryMap(): Record<string, AiTokenAnalysis[]> {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function buildAiExportRecords(params: {
  holdings: TokenHolding[];
  filterToken?: { chain: ActiveChainId; address: string; symbol?: string; name?: string };
}): AiExportRecord[] {
  const historyMap = loadRawAiHistoryMap();
  const holdingLookup = new Map<string, TokenHolding>();
  for (const h of params.holdings) {
    const norm = h.chain !== 'solana' ? h.address.toLowerCase() : h.address.trim();
    holdingLookup.set(`${h.chain}:${norm}`, h);
  }

  const filterKey = params.filterToken
    ? `${params.filterToken.chain}:${
        params.filterToken.chain !== 'solana'
          ? params.filterToken.address.toLowerCase()
          : params.filterToken.address.trim()
      }`
    : null;

  const records: AiExportRecord[] = [];
  for (const [tokenKey, analyses] of Object.entries(historyMap)) {
    if (filterKey && tokenKey !== filterKey) continue;
    if (!Array.isArray(analyses)) continue;
    const [chain = '', ...addrParts] = tokenKey.split(':');
    const address = addrParts.join(':');
    const h = holdingLookup.get(tokenKey);

    for (const item of analyses) {
      records.push({
        tokenKey,
        chain,
        address,
        symbol: h?.symbol || params.filterToken?.symbol || '—',
        name: h?.name || params.filterToken?.name || '—',
        decision: item.decision,
        horizon: item.scores.horizon,
        confidence: item.scores.confidence,
        risk: item.scores.risk,
        potential: item.scores.potential,
        reinforcementStrength: item.scores.reinforcementStrength,
        priceAtAnalysisUsd: item.priceAtAnalysisUsd,
        targetPriceUsd: item.priceLevels.targetPriceUsd,
        takeProfitUsd: item.priceLevels.takeProfitUsd,
        stopLossUsd: item.priceLevels.stopLossUsd,
        idealBuyMinUsd: item.priceLevels.idealBuyZone.minUsd,
        idealBuyMaxUsd: item.priceLevels.idealBuyZone.maxUsd,
        dangerMinUsd: item.priceLevels.dangerZone.minUsd,
        dangerMaxUsd: item.priceLevels.dangerZone.maxUsd,
        provider: item.provider,
        model: item.model,
        summary: item.summary,
        reasoning: item.reasoning,
        generatedAtIso: new Date(item.generatedAt).toISOString(),
      });
    }
  }

  return records.sort((a, b) => b.generatedAtIso.localeCompare(a.generatedAtIso));
}

export function buildTradesExportRecords(params: {
  holdings: TokenHolding[];
  costBasisMap: Record<string, CostBasisEntry>;
  metadataMap: Record<string, TokenCustomMetadata>;
  filterToken?: { chain: ActiveChainId; address: string };
}): TradeCostBasisExportRecord[] {
  const holdingLookup = new Map<string, TokenHolding>();
  for (const h of params.holdings) {
    const norm = h.chain !== 'solana' ? h.address.toLowerCase() : h.address.trim();
    holdingLookup.set(`${h.chain}:${norm}`, h);
  }

  const filterKey = params.filterToken
    ? `${params.filterToken.chain}:${
        params.filterToken.chain !== 'solana'
          ? params.filterToken.address.toLowerCase()
          : params.filterToken.address.trim()
      }`
    : null;

  const records: TradeCostBasisExportRecord[] = [];
  for (const [tokenKey, entry] of Object.entries(params.costBasisMap)) {
    if (filterKey && tokenKey !== filterKey) continue;
    const h = holdingLookup.get(tokenKey);
    const meta = params.metadataMap[tokenKey];
    const pnl = h ? computeTokenPnl(h, params.costBasisMap) : null;

    records.push({
      tokenKey,
      chain: entry.chain,
      address: entry.tokenAddress,
      symbol: h?.symbol || '—',
      name: h?.name || '—',
      balance: h?.balance ?? 0,
      currentPriceUsd: h?.priceUsd ?? null,
      currentValueUsd: h?.valueUsd ?? 0,
      avgBuyPriceUsd: entry.avgBuyPriceUsd,
      costBasisUsd: pnl?.costBasisUsd ?? null,
      unrealizedPnlUsd: pnl?.unrealizedPnlUsd ?? null,
      roiPercent: pnl?.roiPercent ?? null,
      source: entry.source,
      transactionsAnalyzed: entry.txCount ?? null,
      tags: meta?.tags ?? [],
      isFavorite: meta?.isFavorite ?? false,
      note: meta?.note ?? '',
      updatedAtIso: new Date(entry.updatedAt).toISOString(),
    });
  }

  return records.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
}

export function exportAiDecisions(params: {
  format: 'csv' | 'json';
  holdings: TokenHolding[];
  filterToken?: { chain: ActiveChainId; address: string; symbol?: string; name?: string };
}): number {
  const records = buildAiExportRecords({
    holdings: params.holdings,
    filterToken: params.filterToken,
  });
  const suffix = params.filterToken?.symbol
    ? params.filterToken.symbol.toLowerCase()
    : 'portefeuille';
  const dateTag = new Date().toISOString().slice(0, 10);

  if (params.format === 'json') {
    downloadBlob(
      `meridian-decisions-ia-${suffix}-${dateTag}.json`,
      JSON.stringify(records, null, 2),
      'application/json;charset=utf-8'
    );
    return records.length;
  }

  const headers = [
    'Date ISO',
    'Blockchain',
    'Symbole',
    'Nom',
    'Adresse',
    'Décision',
    'Horizon',
    'Confiance (/100)',
    'Risque (/100)',
    'Potentiel (/100)',
    'Renforcement (/100)',
    'Prix Analyse (USD)',
    'Objectif (USD)',
    'Take Profit (USD)',
    'Stop Loss (USD)',
    'Zone Achat Min (USD)',
    'Zone Achat Max (USD)',
    'Zone Danger Min (USD)',
    'Zone Danger Max (USD)',
    'Fournisseur',
    'Modèle',
    'Synthèse',
    'Raisonnement',
  ];

  const rows = records.map((r) => [
    r.generatedAtIso,
    r.chain,
    r.symbol,
    r.name,
    r.address,
    r.decision,
    r.horizon,
    r.confidence,
    r.risk,
    r.potential,
    r.reinforcementStrength,
    r.priceAtAnalysisUsd,
    r.targetPriceUsd,
    r.takeProfitUsd,
    r.stopLossUsd,
    r.idealBuyMinUsd,
    r.idealBuyMaxUsd,
    r.dangerMinUsd,
    r.dangerMaxUsd,
    r.provider,
    r.model,
    r.summary,
    r.reasoning.join(' | '),
  ]);

  downloadBlob(
    `meridian-decisions-ia-${suffix}-${dateTag}.csv`,
    toCsv(headers, rows),
    'text/csv;charset=utf-8'
  );
  return records.length;
}

export function exportTradesAndPnl(params: {
  format: 'csv' | 'json';
  holdings: TokenHolding[];
  costBasisMap: Record<string, CostBasisEntry>;
  metadataMap: Record<string, TokenCustomMetadata>;
  filterToken?: { chain: ActiveChainId; address: string; symbol?: string };
}): number {
  const records = buildTradesExportRecords({
    holdings: params.holdings,
    costBasisMap: params.costBasisMap,
    metadataMap: params.metadataMap,
    filterToken: params.filterToken,
  });
  const suffix = params.filterToken?.symbol
    ? params.filterToken.symbol.toLowerCase()
    : 'portefeuille';
  const dateTag = new Date().toISOString().slice(0, 10);

  if (params.format === 'json') {
    downloadBlob(
      `meridian-trades-pnl-${suffix}-${dateTag}.json`,
      JSON.stringify(records, null, 2),
      'application/json;charset=utf-8'
    );
    return records.length;
  }

  const headers = [
    'Dernière MAJ ISO',
    'Blockchain',
    'Symbole',
    'Nom',
    'Adresse',
    'Solde',
    'Prix Actuel (USD)',
    'Valeur Actuelle (USD)',
    'PMA (USD)',
    'Coût Total (USD)',
    'PnL Latent (USD)',
    'ROI (%)',
    'Source PMA',
    'Transactions Analysées',
    'Favori',
    'Tags',
    'Note Privée',
  ];

  const rows = records.map((r) => [
    r.updatedAtIso,
    r.chain,
    r.symbol,
    r.name,
    r.address,
    r.balance,
    r.currentPriceUsd ?? '',
    r.currentValueUsd,
    r.avgBuyPriceUsd,
    r.costBasisUsd ?? '',
    r.unrealizedPnlUsd ?? '',
    r.roiPercent !== null ? r.roiPercent.toFixed(2) : '',
    r.source,
    r.transactionsAnalyzed ?? '',
    r.isFavorite ? 'Oui' : 'Non',
    r.tags.join(' | '),
    r.note,
  ]);

  downloadBlob(
    `meridian-trades-pnl-${suffix}-${dateTag}.csv`,
    toCsv(headers, rows),
    'text/csv;charset=utf-8'
  );
  return records.length;
}
