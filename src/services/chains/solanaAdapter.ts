import type { ChainAdapter, ChainFetchResult, ChainMeta } from '../../types/chain';
import { isValidSolanaAddress } from '../../utils/validators';

export const SOLANA_CHAIN_META: ChainMeta = {
  id: 'solana',
  name: 'Solana',
  shortName: 'SOL',
  family: 'solana',
  nativeSymbol: 'SOL',
  accentColor: '#14F195',
  explorerAddressUrl: 'https://solscan.io/account/',
  explorerTokenUrl: 'https://solscan.io/token/',
  status: 'active',
  rpcLabel: 'Helius RPC / Public Mainnet',
  freeApiEnvKey: 'NEXT_PUBLIC_HELIUS_API_KEY',
};

export const solanaAdapter: ChainAdapter = {
  meta: SOLANA_CHAIN_META,

  validateAddress(address: string): boolean {
    return isValidSolanaAddress(address);
  },

  async fetchBalances(address: string): Promise<ChainFetchResult> {
    if (!this.validateAddress(address)) {
      return {
        chain: 'solana',
        address,
        source: 'unavailable',
        apiKeyMissing: false,
        apiKeyName: null,
        error: 'Adresse Solana Base58 invalide.',
        tokens: [],
      };
    }

    const res = await fetch('/api/chains/solana/balances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: address.trim() }),
    });

    const data = await res.json();
    if (!res.ok && !data?.apiKeyMissing) {
      return {
        chain: 'solana',
        address,
        source: 'unavailable',
        apiKeyMissing: Boolean(data?.apiKeyMissing),
        apiKeyName: data?.apiKeyName ?? null,
        error: data?.error || 'Erreur de lecture RPC Solana.',
        tokens: [],
      };
    }

    return data as ChainFetchResult;
  },
};
