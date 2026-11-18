import type { ActiveChainId } from '../types/chain';

const EVM_REGEX = /^0x[a-fA-F0-9]{40}$/;
const SOLANA_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidBaseAddress(address: string): boolean {
  return EVM_REGEX.test(address.trim());
}

export function isValidEvmAddress(address: string): boolean {
  return EVM_REGEX.test(address.trim());
}

export function isValidSolanaAddress(address: string): boolean {
  return SOLANA_REGEX.test(address.trim());
}

export function isEvmChain(chain: ActiveChainId): boolean {
  return chain === 'base' || chain === 'robinhood';
}

export function getChainLabel(chain: ActiveChainId): string {
  if (chain === 'base') return 'Base';
  if (chain === 'robinhood') return 'Robinhood';
  return 'Solana';
}

export function getExplorerName(chain: ActiveChainId): string {
  if (chain === 'base') return 'BaseScan';
  if (chain === 'robinhood') return 'Robinhood Explorer';
  return 'Solscan';
}

export function detectAddressChain(address: string): ActiveChainId | null {
  const trimmed = address.trim();
  if (isValidEvmAddress(trimmed)) return 'base';
  if (isValidSolanaAddress(trimmed)) return 'solana';
  return null;
}

export function shortenAddress(address: string, head = 6, tail = 4): string {
  if (!address) return '';
  if (address.length <= head + tail + 2) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}

export function getExplorerAddressUrl(chain: ActiveChainId, address: string): string {
  if (chain === 'base') {
    return `https://basescan.org/address/${address}`;
  }
  if (chain === 'robinhood') {
    return `https://robinhoodchain.blockscout.com/address/${address}`;
  }
  return `https://solscan.io/account/${address}`;
}

export function getExplorerTokenUrl(chain: ActiveChainId, tokenAddress: string): string {
  if (chain === 'base') {
    return `https://basescan.org/token/${tokenAddress}`;
  }
  if (chain === 'robinhood') {
    return `https://robinhoodchain.blockscout.com/token/${tokenAddress}`;
  }
  return `https://solscan.io/token/${tokenAddress}`;
}

export function getExplorerTxUrl(chain: ActiveChainId, hashOrSig: string): string {
  if (chain === 'base') {
    return `https://basescan.org/tx/${hashOrSig}`;
  }
  if (chain === 'robinhood') {
    return `https://robinhoodchain.blockscout.com/tx/${hashOrSig}`;
  }
  return `https://solscan.io/tx/${hashOrSig}`;
}
