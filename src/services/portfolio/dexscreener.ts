import type { ActiveChainId } from '../../types/chain';
import type { DexPriceData } from '../../types/portfolio';

export async function fetchDexScreenerPrices(
  chain: ActiveChainId,
  addresses: string[],
  force = false
): Promise<Record<string, DexPriceData>> {
  const unique = Array.from(new Set(addresses.filter(Boolean)));
  if (unique.length === 0) return {};

  const res = await fetch('/api/prices/dexscreener', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chain, addresses: unique, force }),
  });

  if (!res.ok) {
    return {};
  }

  const data = await res.json();
  return (data?.prices || {}) as Record<string, DexPriceData>;
}
