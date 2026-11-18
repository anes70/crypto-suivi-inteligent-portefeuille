import type {
  ChainAdapter,
  ChainFetchResult,
  ChainMeta,
  ChainTransactionsResult,
} from '../../types/chain';
import { isValidEvmAddress } from '../../utils/validators';

export const ROBINHOOD_CHAIN_META: ChainMeta = {
  id: 'robinhood',
  name: 'Robinhood',
  shortName: 'RH',
  family: 'evm',
  nativeSymbol: 'ETH',
  accentColor: '#00C805',
  explorerAddressUrl: 'https://robinhoodchain.blockscout.com/address/',
  explorerTokenUrl: 'https://robinhoodchain.blockscout.com/token/',
  status: 'active',
  rpcLabel: 'robinhood-mainnet.g.alchemy.com/v2',
  freeApiEnvKey: 'ROBINHOOD_ALCHEMY_API_KEY',
};

export const robinhoodAdapter: ChainAdapter = {
  meta: ROBINHOOD_CHAIN_META,

  validateAddress(address: string): boolean {
    return isValidEvmAddress(address);
  },

  async fetchBalances(
    address: string,
    options?: { customTokens?: string[] }
  ): Promise<ChainFetchResult> {
    if (!this.validateAddress(address)) {
      return {
        chain: 'robinhood',
        address,
        source: 'unavailable',
        apiKeyMissing: false,
        apiKeyName: null,
        error: 'Adresse EVM Robinhood invalide (format 0x... attendu).',
        tokens: [],
      };
    }

    const res = await fetch('/api/chains/robinhood/balances', {
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
        chain: 'robinhood',
        address,
        source: 'unavailable',
        apiKeyMissing: Boolean(data?.apiKeyMissing),
        apiKeyName: data?.apiKeyName ?? null,
        error: data?.error || 'Erreur de lecture RPC Robinhood.',
        tokens: [],
      };
    }

    return data as ChainFetchResult;
  },
};

export async function fetchRobinhoodTransactions(
  address: string
): Promise<ChainTransactionsResult> {
  if (!isValidEvmAddress(address)) {
    return {
      chain: 'robinhood',
      address,
      source: 'unavailable',
      apiKeyMissing: false,
      apiKeyName: null,
      error: 'Adresse EVM Robinhood invalide (format 0x... attendu).',
      transactions: [],
    };
  }

  const res = await fetch('/api/chains/robinhood/transactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: address.trim() }),
  });

  const data = await res.json();
  if (!res.ok) {
    return {
      chain: 'robinhood',
      address,
      source: 'unavailable',
      apiKeyMissing: Boolean(data?.apiKeyMissing),
      apiKeyName: data?.apiKeyName ?? null,
      error: data?.error || 'Erreur lors de la lecture des transactions Robinhood.',
      transactions: [],
    };
  }

  return data as ChainTransactionsResult;
}
