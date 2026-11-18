export interface BrowserWalletResult {
  address: string;
  providerName: string;
}

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isRabby?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: () => Promise<{ publicKey: { toString: () => string } }>;
      };
    };
    solana?: {
      isPhantom?: boolean;
      isSolflare?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
    };
  }
}

export function detectBrowserWallets() {
  if (typeof window === 'undefined') {
    return { hasEvm: false, evmLabel: 'Wallet EVM', hasSolana: false, solanaLabel: 'Wallet Solana' };
  }

  const eth = window.ethereum;
  let evmLabel = 'Wallet EVM (MetaMask / Coinbase)';
  if (eth?.isRabby) evmLabel = 'Rabby Wallet';
  else if (eth?.isCoinbaseWallet) evmLabel = 'Coinbase Wallet';
  else if (eth?.isMetaMask) evmLabel = 'MetaMask';

  const sol = window.phantom?.solana || window.solana;
  let solanaLabel = 'Wallet Solana (Phantom / Solflare)';
  if (window.phantom?.solana?.isPhantom || window.solana?.isPhantom) solanaLabel = 'Phantom';
  else if (window.solana?.isSolflare) solanaLabel = 'Solflare';

  return {
    hasEvm: Boolean(eth),
    evmLabel,
    hasSolana: Boolean(sol),
    solanaLabel,
  };
}

/**
 * Lecture seule : demande uniquement l'adresse publique du wallet EVM,
 * jamais de signature ni d'accès aux clés privées.
 */
export async function connectReadOnlyEvmWallet(): Promise<BrowserWalletResult> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error(
      'Aucun wallet EVM détecté dans le navigateur (MetaMask, Coinbase Wallet, Rabby). Utilisez la saisie d’adresse publique.'
    );
  }

  const accounts = (await window.ethereum.request({
    method: 'eth_requestAccounts',
  })) as string[];

  const address = Array.isArray(accounts) && accounts[0] ? accounts[0] : '';
  if (!address) {
    throw new Error('Aucune adresse retournée par le wallet EVM.');
  }

  const { evmLabel } = detectBrowserWallets();
  return { address, providerName: evmLabel };
}

/**
 * Lecture seule : demande uniquement la clé publique du wallet Solana,
 * jamais de signature ni d'accès aux clés privées.
 */
export async function connectReadOnlySolanaWallet(): Promise<BrowserWalletResult> {
  if (typeof window === 'undefined') {
    throw new Error('Environnement navigateur indisponible.');
  }

  const provider = window.phantom?.solana || window.solana;
  if (!provider) {
    throw new Error(
      'Aucun wallet Solana détecté dans le navigateur (Phantom, Solflare). Utilisez la saisie d’adresse publique.'
    );
  }

  const res = await provider.connect();
  const address = res?.publicKey?.toString();
  if (!address) {
    throw new Error('Aucune clé publique retournée par le wallet Solana.');
  }

  const { solanaLabel } = detectBrowserWallets();
  return { address, providerName: solanaLabel };
}
