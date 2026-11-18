import type { ActiveChainId } from './chain';

export interface TokenCustomMetadata {
  key: string;
  chain: ActiveChainId;
  tokenAddress: string;
  isFavorite: boolean;
  tags: string[];
  note: string;
  updatedAt: number;
}
