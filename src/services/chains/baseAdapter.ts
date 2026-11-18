import type { ChainAdapter, ChainFetchResult, ChainMeta } from '../../types/chain';
import { isValidBaseAddress } from '../../utils/validators';

export const BASE_CHAIN_META: ChainMeta = {
  id: 'base',
  name: 'Base',
  shortName: 'BASE',
  family: 'evm',
  nativeSymbol: 'ETH',
  accentColor: '#0052FF',
  explorerAddressUrl: 'https://basescan.org/address/',
  explorerTokenUrl: 'https://basescan.org/token/',
  status: 'active',
  rpcLabel: 'https://mainnet.base.org',
  freeApiEnvKey: 'NEXT_PUBLIC_ALCHEMY_API_KEY',
};

export const baseAdapter: ChainAdapter = {
  meta: BASE_CHAIN_META,

  validateAddress(address: string): boolean {
    return isValidBaseAddress(address);
  },

  async fetchBalances(
    address: string,
    options?: { customTokens?: string[] }
  ): Promise<ChainFetchResult> {
    if (!this.validateAddress(address)) {
      return {
        chain: 'base',
        address,
        source: 'unavailable',
        apiKeyMissing: false,
        apiKeyName: null,
        error: 'Adresse EVM Base invalide (format 0x... attendu).',
        tokens: [],
      };
    }

    const res = await fetch('/api/chains/base/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address.trim(),
        customTokens: options?.customTokens || [],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        chain: 'base',
        address,
        source: 'unavailable',
        apiKeyMissing: Boolean(data?.apiKeyMissing),
        apiKeyName: data?.apiKeyName ?? null,
        error: data?.error || 'Erreur de lecture RPC Base.',
        tokens: [],
      };
    }

    return data as ChainFetchResult;
  },
};
