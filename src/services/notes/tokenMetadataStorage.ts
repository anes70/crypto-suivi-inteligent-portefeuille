import type { ActiveChainId } from '../../types/chain';
import type { TokenCustomMetadata } from '../../types/metadata';

const METADATA_STORAGE_KEY = 'meridian.token_metadata.v1';

export function makeTokenMetadataKey(
  chain: ActiveChainId,
  tokenAddress: string
): string {
  const normalized =
    chain !== 'solana' ? tokenAddress.toLowerCase() : tokenAddress.trim();
  return `${chain}:${normalized}`;
}

export function loadTokenMetadataMap(): Record<string, TokenCustomMetadata> {
  try {
    const raw = localStorage.getItem(METADATA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveTokenMetadataMap(
  map: Record<string, TokenCustomMetadata>
): void {
  try {
    localStorage.setItem(METADATA_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function getOrCreateEntry(
  map: Record<string, TokenCustomMetadata>,
  chain: ActiveChainId,
  tokenAddress: string
): TokenCustomMetadata {
  const key = makeTokenMetadataKey(chain, tokenAddress);
  return (
    map[key] || {
      key,
      chain,
      tokenAddress:
        chain !== 'solana' ? tokenAddress.toLowerCase() : tokenAddress.trim(),
      isFavorite: false,
      tags: [],
      note: '',
      updatedAt: Date.now(),
    }
  );
}

export function toggleTokenFavorite(
  chain: ActiveChainId,
  tokenAddress: string
): Record<string, TokenCustomMetadata> {
  const map = loadTokenMetadataMap();
  const entry = getOrCreateEntry(map, chain, tokenAddress);
  map[entry.key] = {
    ...entry,
    isFavorite: !entry.isFavorite,
    updatedAt: Date.now(),
  };
  saveTokenMetadataMap(map);
  return map;
}

export function saveTokenTags(
  chain: ActiveChainId,
  tokenAddress: string,
  tags: string[]
): Record<string, TokenCustomMetadata> {
  const map = loadTokenMetadataMap();
  const entry = getOrCreateEntry(map, chain, tokenAddress);
  const cleaned = Array.from(
    new Set(tags.map((t) => t.trim()).filter((t) => t.length > 0))
  ).slice(0, 10);
  map[entry.key] = {
    ...entry,
    tags: cleaned,
    updatedAt: Date.now(),
  };
  saveTokenMetadataMap(map);
  return map;
}

export function saveTokenNote(
  chain: ActiveChainId,
  tokenAddress: string,
  note: string
): Record<string, TokenCustomMetadata> {
  const map = loadTokenMetadataMap();
  const entry = getOrCreateEntry(map, chain, tokenAddress);
  map[entry.key] = {
    ...entry,
    note,
    updatedAt: Date.now(),
  };
  saveTokenMetadataMap(map);
  return map;
}
