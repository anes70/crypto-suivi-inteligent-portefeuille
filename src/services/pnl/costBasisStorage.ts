import type { ActiveChainId } from '../../types/chain';
import type { CostBasisEntry, CostBasisSource } from '../../types/pnl';

const COST_BASIS_KEY = 'meridian.cost_basis.v1';

export function makeCostBasisKey(chain: ActiveChainId, tokenAddress: string): string {
  const normalized = chain !== 'solana' ? tokenAddress.toLowerCase() : tokenAddress.trim();
  return `${chain}:${normalized}`;
}

export function loadCostBasisMap(): Record<string, CostBasisEntry> {
  try {
    const raw = localStorage.getItem(COST_BASIS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCostBasisEntry(
  chain: ActiveChainId,
  tokenAddress: string,
  avgBuyPriceUsd: number,
  source: CostBasisSource,
  txCount?: number
): Record<string, CostBasisEntry> {
  const map = loadCostBasisMap();
  const key = makeCostBasisKey(chain, tokenAddress);
  map[key] = {
    key,
    chain,
    tokenAddress,
    avgBuyPriceUsd,
    source,
    updatedAt: Date.now(),
    txCount,
  };
  try {
    localStorage.setItem(COST_BASIS_KEY, JSON.stringify(map));
  } catch {
    // ignore storage errors
  }
  return map;
}

export function deleteCostBasisEntry(
  chain: ActiveChainId,
  tokenAddress: string
): Record<string, CostBasisEntry> {
  const map = loadCostBasisMap();
  const key = makeCostBasisKey(chain, tokenAddress);
  delete map[key];
  try {
    localStorage.setItem(COST_BASIS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
  return map;
}
