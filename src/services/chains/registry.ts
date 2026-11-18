import type { ActiveChainId, ChainAdapter, ChainId, ChainMeta } from '../../types/chain';
import { baseAdapter, BASE_CHAIN_META } from './baseAdapter';
import { robinhoodAdapter, ROBINHOOD_CHAIN_META } from './robinhoodAdapter';
import { solanaAdapter, SOLANA_CHAIN_META } from './solanaAdapter';

export const ACTIVE_ADAPTERS: Record<ActiveChainId, ChainAdapter> = {
  base: baseAdapter,
  solana: solanaAdapter,
  robinhood: robinhoodAdapter,
};

export const PLANNED_CHAINS: ChainMeta[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'ETH',
    family: 'evm',
    nativeSymbol: 'ETH',
    accentColor: '#627EEA',
    explorerAddressUrl: 'https://etherscan.io/address/',
    explorerTokenUrl: 'https://etherscan.io/token/',
    status: 'planned',
    rpcLabel: 'Adapter EVM modulaire prêt',
    freeApiEnvKey: 'NEXT_PUBLIC_ALCHEMY_API_KEY',
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    shortName: 'ARB',
    family: 'evm',
    nativeSymbol: 'ETH',
    accentColor: '#28A0F0',
    explorerAddressUrl: 'https://arbiscan.io/address/',
    explorerTokenUrl: 'https://arbiscan.io/token/',
    status: 'planned',
    rpcLabel: 'Adapter EVM L2 modulaire prêt',
    freeApiEnvKey: 'NEXT_PUBLIC_ALCHEMY_API_KEY',
  },
  {
    id: 'sui',
    name: 'Sui',
    shortName: 'SUI',
    family: 'move',
    nativeSymbol: 'SUI',
    accentColor: '#4DA2FF',
    explorerAddressUrl: 'https://suiscan.xyz/mainnet/account/',
    explorerTokenUrl: 'https://suiscan.xyz/mainnet/coin/',
    status: 'planned',
    rpcLabel: 'Adapter Move JSON-RPC prêt',
  },
];

export const ALL_CHAINS: Record<ChainId, ChainMeta> = {
  base: BASE_CHAIN_META,
  solana: SOLANA_CHAIN_META,
  robinhood: ROBINHOOD_CHAIN_META,
  ethereum: PLANNED_CHAINS[0],
  arbitrum: PLANNED_CHAINS[1],
  sui: PLANNED_CHAINS[2],
};

export function getChainAdapter(chain: ActiveChainId): ChainAdapter {
  return ACTIVE_ADAPTERS[chain];
}
