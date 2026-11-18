import type { ActiveChainId } from './chain';

export type WalletConnectionMode = 'watch' | 'browser-wallet';

export interface TrackedWallet {
  id: string;
  chain: ActiveChainId;
  address: string;
  label: string;
  mode: WalletConnectionMode;
  providerName?: string;
  addedAt: number;
  enabled: boolean;
}
