import type { ActiveChainId } from '../../types/chain';
import type { AiTokenAnalysis } from '../../types/ai';

const AI_HISTORY_KEY = 'meridian.ai_analysis_history.v1';
const MAX_HISTORY_PER_TOKEN = 15;

export function makeAiHistoryKey(
  chain: ActiveChainId,
  tokenAddress: string
): string {
  const normalized =
    chain !== 'solana' ? tokenAddress.toLowerCase() : tokenAddress.trim();
  return `${chain}:${normalized}`;
}

function loadAllHistory(): Record<string, AiTokenAnalysis[]> {
  try {
    const raw = localStorage.getItem(AI_HISTORY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function loadTokenAiHistory(
  chain: ActiveChainId,
  tokenAddress: string
): AiTokenAnalysis[] {
  const all = loadAllHistory();
  const key = makeAiHistoryKey(chain, tokenAddress);
  const list = all[key];
  return Array.isArray(list) ? list : [];
}

export function saveTokenAiAnalysis(
  chain: ActiveChainId,
  tokenAddress: string,
  analysis: AiTokenAnalysis
): AiTokenAnalysis[] {
  const all = loadAllHistory();
  const key = makeAiHistoryKey(chain, tokenAddress);
  const existing = Array.isArray(all[key]) ? all[key] : [];
  const next = [analysis, ...existing.filter((item) => item.id !== analysis.id)].slice(
    0,
    MAX_HISTORY_PER_TOKEN
  );
  all[key] = next;
  try {
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(all));
  } catch {
    // ignore storage quota errors
  }
  return next;
}

export function clearTokenAiHistory(
  chain: ActiveChainId,
  tokenAddress: string
): AiTokenAnalysis[] {
  const all = loadAllHistory();
  const key = makeAiHistoryKey(chain, tokenAddress);
  delete all[key];
  try {
    localStorage.setItem(AI_HISTORY_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
  return [];
}
