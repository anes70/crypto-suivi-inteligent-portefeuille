export type ActiveChainId = 'base' | 'solana' | 'robinhood';
export type ChainId = ActiveChainId | 'ethereum' | 'arbitrum' | 'sui';

export type ChainStatus = 'active' | 'planned';

export interface ChainMeta {
  id: ChainId;
  name: string;
  shortName: string;
  family: 'evm' | 'solana' | 'move';
  nativeSymbol: string;
  accentColor: string;
  explorerAddressUrl: string;
  explorerTokenUrl: string;
  status: ChainStatus;
  rpcLabel: string;
  freeApiEnvKey?: string;
}

export interface RawChainToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  rawBalance: string;
  isNative: boolean;
  logoUrl?: string;
}

export interface ChainFetchResult {
  chain: ActiveChainId;
  address: string;
  source: 'alchemy' | 'helius' | 'public-rpc' | 'unavailable';
  apiKeyMissing: boolean;
  apiKeyName: string | null;
  error?: string;
  tokens: RawChainToken[];
}

export interface ChainTransactionItem {
  hash: string;
  timestamp: number | null;
  from: string;
  to: string;
  value: number | null;
  asset: string;
  category: string;
  direction: 'in' | 'out' | 'self';
  explorerUrl: string;
}

export interface ChainTransactionsResult {
  chain: ActiveChainId;
  address: string;
  source: 'alchemy' | 'helius' | 'public-rpc' | 'unavailable';
  apiKeyMissing: boolean;
  apiKeyName: string | null;
  error?: string;
  transactions: ChainTransactionItem[];
}

export interface ChainAdapter {
  readonly meta: ChainMeta;
  validateAddress(address: string): boolean;
  fetchBalances(
    address: string,
    options?: { customTokens?: string[] }
  ): Promise<ChainFetchResult>;
}
