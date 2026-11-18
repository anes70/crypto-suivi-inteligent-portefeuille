import type { ActiveChainId, ChainFetchResult } from '../../types/chain';
import type {
  ChainAllocation,
  PortfolioSnapshot,
  PortfolioSummary,
  TokenHolding,
} from '../../types/portfolio';
import type { TrackedWallet } from '../../types/wallet';
import { savePortfolioSnapshot } from '../../utils/storage';
import { isEvmChain } from '../../utils/validators';
import { ACTIVE_ADAPTERS, ALL_CHAINS } from '../chains/registry';
import { fetchDexScreenerPrices } from './dexscreener';
import { filterZeroAndDustTokens } from './dustFilter';

const ACTIVE_CHAIN_ORDER: ActiveChainId[] = ['base', 'solana', 'robinhood'];

export function buildWalletSignature(wallets: TrackedWallet[]): string {
  return wallets
    .filter((w) => w.enabled)
    .map((w) => `${w.chain}:${w.address.toLowerCase()}`)
    .sort()
    .join('|');
}

export async function aggregatePortfolio(
  wallets: TrackedWallet[],
  options?: {
    customBaseTokens?: string[];
    dustThresholdUsd?: number;
    forceRefresh?: boolean;
  }
): Promise<PortfolioSummary> {
  const activeWallets = wallets.filter((w) => w.enabled);

  if (activeWallets.length === 0) {
    return {
      totalValueUsd: 0,
      change24hUsd: 0,
      change24hPercent: 0,
      holdings: [],
      allocations: ACTIVE_CHAIN_ORDER.map((chain) => ({
        chain,
        name: ALL_CHAINS[chain].name,
        valueUsd: 0,
        percentage: 0,
        tokenCount: 0,
        source: 'idle',
        apiKeyMissing: false,
        apiKeyName: null,
      })),
      dustStats: {
        totalRawCount: 0,
        filteredZeroOrDustCount: 0,
        thresholdUsd: options?.dustThresholdUsd ?? 0.01,
      },
      lastUpdatedAt: Date.now(),
    };
  }

  // 1. Fetch on-chain balances in parallel across all active wallets
  const fetchJobs = activeWallets.map(async (wallet) => {
    const adapter = ACTIVE_ADAPTERS[wallet.chain];
    const result = await adapter.fetchBalances(wallet.address, {
      customTokens: isEvmChain(wallet.chain) ? options?.customBaseTokens : undefined,
    });
    return { wallet, result };
  });

  const chainResults = await Promise.all(fetchJobs);

  // 2. Collect unique token contract addresses per chain for DexScreener pricing
  const addressesByChain: Record<ActiveChainId, Set<string>> = {
    base: new Set<string>(),
    solana: new Set<string>(),
    robinhood: new Set<string>(),
  };

  for (const { result } of chainResults) {
    for (const token of result.tokens) {
      if (token.balance > 0) {
        addressesByChain[result.chain].add(token.address);
      }
    }
  }

  const [basePrices, solanaPrices, robinhoodPrices] = await Promise.all([
    fetchDexScreenerPrices('base', Array.from(addressesByChain.base), options?.forceRefresh),
    fetchDexScreenerPrices('solana', Array.from(addressesByChain.solana), options?.forceRefresh),
    fetchDexScreenerPrices('robinhood', Array.from(addressesByChain.robinhood), options?.forceRefresh),
  ]);

  const pricesByChain = {
    base: basePrices,
    solana: solanaPrices,
    robinhood: robinhoodPrices,
  };

  // 3. Build raw holdings enriched with DexScreener data
  const rawHoldings: TokenHolding[] = [];
  const chainStatusTracker: Record<
    ActiveChainId,
    {
      hasWallet: boolean;
      source: ChainFetchResult['source'] | 'idle';
      apiKeyMissing: boolean;
      apiKeyName: string | null;
      error?: string;
    }
  > = {
    base: { hasWallet: false, source: 'idle', apiKeyMissing: false, apiKeyName: null },
    solana: { hasWallet: false, source: 'idle', apiKeyMissing: false, apiKeyName: null },
    robinhood: { hasWallet: false, source: 'idle', apiKeyMissing: false, apiKeyName: null },
  };

  for (const { wallet, result } of chainResults) {
    const chain = result.chain;
    const tracker = chainStatusTracker[chain];
    tracker.hasWallet = true;
    tracker.source = result.source;
    tracker.apiKeyMissing = tracker.apiKeyMissing || result.apiKeyMissing;
    tracker.apiKeyName = tracker.apiKeyName || result.apiKeyName;
    if (result.error && !tracker.error) {
      tracker.error = result.error;
    }

    const chainPriceMap = pricesByChain[chain];

    for (const token of result.tokens) {
      const lookupKey = isEvmChain(chain) ? token.address.toLowerCase() : token.address;
      const dex = chainPriceMap[lookupKey];
      const priceUsd = dex?.priceUsd ?? null;
      const priceChange24h = dex?.priceChange24h ?? null;
      const valueUsd = priceUsd !== null ? token.balance * priceUsd : 0;

      const resolvedSymbol = token.isNative
        ? token.symbol
        : dex?.symbol && (!token.symbol || token.symbol.includes('…'))
          ? dex.symbol
          : token.symbol;

      const resolvedName = token.isNative
        ? token.name
        : dex?.name && (!token.name || token.name.startsWith('SPL '))
          ? dex.name
          : token.name;

      rawHoldings.push({
        id: `${chain}:${lookupKey}:${wallet.address.toLowerCase()}`,
        chain,
        address: token.address,
        symbol: resolvedSymbol,
        name: resolvedName,
        decimals: token.decimals,
        balance: token.balance,
        priceUsd,
        priceChange24h,
        valueUsd,
        liquidityUsd: dex?.liquidityUsd ?? null,
        fdv: dex?.fdv ?? null,
        isNative: token.isNative,
        logoUrl: token.logoUrl || dex?.imageUrl,
        pairUrl: dex?.pairUrl,
        dexId: dex?.dexId,
        walletAddress: wallet.address,
        walletLabel: wallet.label,
      });
    }
  }

  // 4. Strictly filter zero-balance and < $0.01 dust tokens
  const { visible: holdings, stats: dustStats } = filterZeroAndDustTokens(
    rawHoldings,
    options?.dustThresholdUsd
  );

  // 5. Compute totals & chain allocations
  let totalValueUsd = 0;
  let weightedPrevValueUsd = 0;
  const valueByChain: Record<ActiveChainId, number> = {
    base: 0,
    solana: 0,
    robinhood: 0,
  };
  const countByChain: Record<ActiveChainId, number> = {
    base: 0,
    solana: 0,
    robinhood: 0,
  };

  for (const h of holdings) {
    totalValueUsd += h.valueUsd;
    valueByChain[h.chain] += h.valueUsd;
    countByChain[h.chain] += 1;

    if (h.priceChange24h !== null && h.priceChange24h > -99.9) {
      weightedPrevValueUsd += h.valueUsd / (1 + h.priceChange24h / 100);
    } else {
      weightedPrevValueUsd += h.valueUsd;
    }
  }

  const change24hUsd = totalValueUsd - weightedPrevValueUsd;
  const change24hPercent =
    weightedPrevValueUsd > 0 ? (change24hUsd / weightedPrevValueUsd) * 100 : 0;

  const allocations: ChainAllocation[] = ACTIVE_CHAIN_ORDER.map((chain) => {
    const val = valueByChain[chain];
    const tracker = chainStatusTracker[chain];
    return {
      chain,
      name: ALL_CHAINS[chain].name,
      valueUsd: val,
      percentage: totalValueUsd > 0 ? (val / totalValueUsd) * 100 : 0,
      tokenCount: countByChain[chain],
      source: tracker.source,
      apiKeyMissing: tracker.apiKeyMissing,
      apiKeyName: tracker.apiKeyName,
      error: tracker.error,
    };
  });

  const now = Date.now();
  const signature = buildWalletSignature(activeWallets);
  if (signature && totalValueUsd > 0) {
    const snapshot: PortfolioSnapshot = {
      timestamp: now,
      totalValueUsd,
      baseValueUsd: valueByChain.base,
      solanaValueUsd: valueByChain.solana,
      robinhoodValueUsd: valueByChain.robinhood,
      walletSignature: signature,
    };
    await savePortfolioSnapshot(snapshot);
  }

  return {
    totalValueUsd,
    change24hUsd,
    change24hPercent,
    holdings,
    allocations,
    dustStats,
    lastUpdatedAt: now,
  };
}
