import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  getGeminiApiKey,
  getGroqApiKey,
  handleAnalyzeRequest,
} from './server/analyzeRoute';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const BASE_PUBLIC_RPC = 'https://mainnet.base.org';
const SOLANA_PUBLIC_RPC = 'https://api.mainnet-beta.solana.com';
const ROBINHOOD_ALCHEMY_BASE_URL = (
  process.env.ROBINHOOD_RPC_URL || 'https://robinhood-mainnet.g.alchemy.com/v2'
).replace(/\/+$/, '');
const ROBINHOOD_EXPLORER_API = 'https://robinhoodchain.blockscout.com/api/v2';
const WETH_BASE = '0x4200000000000000000000000000000000000006';
const WSOL_MINT = 'So11111111111111111111111111111111111111112';

interface KnownErc20Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

const CORE_BASE_TOKENS: KnownErc20Token[] = [
  { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', name: 'USD Base Coin', decimals: 6 },
  { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  { address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', symbol: 'cbBTC', name: 'Coinbase Wrapped BTC', decimals: 8 },
  { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', symbol: 'cbETH', name: 'Coinbase Wrapped Staked ETH', decimals: 18 },
  { address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', symbol: 'AERO', name: 'Aerodrome Finance', decimals: 18 },
  { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  { address: '0x60a3E35Cc302bFA44Cb288Bc5a4F316Fdb1adb42', symbol: 'EURC', name: 'Euro Coin', decimals: 6 },
  { address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', symbol: 'BRETT', name: 'Brett', decimals: 18 },
  { address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', symbol: 'DEGEN', name: 'Degen', decimals: 18 },
  { address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', symbol: 'TOSHI', name: 'Toshi', decimals: 18 },
  { address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', symbol: 'VIRTUAL', name: 'Virtual Protocol', decimals: 18 },
  { address: '0xA88594D404727625A9437C3f886C7643872296AE', symbol: 'WELL', name: 'Moonwell', decimals: 18 },
  { address: '0xB1a03EdA10342529bBF8EB700a06C60441fEf25d', symbol: 'MIGGLES', name: 'Mister Miggles', decimals: 18 },
];

interface CachedPriceEntry {
  timestamp: number;
  data: Record<string, DexPriceResult>;
}

interface DexPriceResult {
  address: string;
  priceUsd: number | null;
  priceChange24h: number | null;
  liquidityUsd: number | null;
  fdv: number | null;
  symbol?: string;
  name?: string;
  imageUrl?: string;
  pairUrl?: string;
  dexId?: string;
}

const priceCache = new Map<string, CachedPriceEntry>();
const PRICE_CACHE_TTL_MS = 25_000;

function getAlchemyKey(): string {
  return (
    process.env.ALCHEMY_API_KEY ||
    process.env.NEXT_PUBLIC_ALCHEMY_API_KEY ||
    process.env.VITE_ALCHEMY_API_KEY ||
    ''
  ).trim();
}

function getRobinhoodAlchemyKey(): string {
  return (
    process.env.ROBINHOOD_ALCHEMY_API_KEY ||
    process.env.NEXT_PUBLIC_ROBINHOOD_ALCHEMY_API_KEY ||
    process.env.VITE_ROBINHOOD_ALCHEMY_API_KEY ||
    ''
  ).trim();
}

function getHeliusKey(): string {
  return (
    process.env.HELIUS_API_KEY ||
    process.env.NEXT_PUBLIC_HELIUS_API_KEY ||
    process.env.VITE_HELIUS_API_KEY ||
    ''
  ).trim();
}

function normalizeActiveChain(raw: unknown): 'base' | 'solana' | 'robinhood' {
  if (raw === 'solana') return 'solana';
  if (raw === 'robinhood') return 'robinhood';
  return 'base';
}

const socialCache = new Map<string, { timestamp: number; data: any }>();
const newsCache = new Map<string, { timestamp: number; data: any[] }>();
const SOCIAL_CACHE_TTL_MS = 180_000; // 3 minutes

interface CryptoCompareArticle {
  id: string;
  title: string;
  body: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  categories: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => {
      const code = Number(dec);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function summarizeBody(raw: string, maxLen = 220): string {
  const decoded = decodeHtmlEntities(raw);
  const cleaned = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, maxLen - 1).trimEnd()}…`;
}

function extractXmlTag(block: string, tag: string): string {
  const regex = new RegExp(`<${tag}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = block.match(regex);
  return match ? decodeHtmlEntities(match[1]).trim() : '';
}

function extractRssImage(block: string, rawDescription: string): string | null {
  const mediaMatch = block.match(/<media:content[^>]+url=["']([^"']+)["']/i);
  if (mediaMatch?.[1] && mediaMatch[1].startsWith('http')) {
    return decodeHtmlEntities(mediaMatch[1]);
  }
  const enclosureMatch = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
  if (enclosureMatch?.[1] && enclosureMatch[1].startsWith('http')) {
    return decodeHtmlEntities(enclosureMatch[1]);
  }
  const imgMatch = rawDescription.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch?.[1] && imgMatch[1].startsWith('http')) {
    return decodeHtmlEntities(imgMatch[1]);
  }
  return null;
}

function parseRssFeed(xml: string, sourceName: string): CryptoCompareArticle[] {
  const articles: CryptoCompareArticle[] = [];
  const itemMatches = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];

  for (const itemXml of itemMatches) {
    const title = extractXmlTag(itemXml, 'title');
    const rawLink = extractXmlTag(itemXml, 'link');
    const guid = extractXmlTag(itemXml, 'guid');
    const url = rawLink.startsWith('http')
      ? rawLink
      : guid.startsWith('http')
        ? guid
        : '';
    if (!title || !url) continue;

    const descMatch = itemXml.match(/<description(?:\s+[^>]*)?>([\s\S]*?)<\/description>/i);
    const rawDesc = descMatch ? descMatch[1] : '';
    const pubDateStr = extractXmlTag(itemXml, 'pubDate');
    const parsedDate = pubDateStr ? Date.parse(pubDateStr) : NaN;

    const catMatches = [...itemXml.matchAll(/<category(?:\s+[^>]*)?>([\s\S]*?)<\/category>/gi)]
      .map((m) => decodeHtmlEntities(m[1]).trim())
      .filter(Boolean);

    articles.push({
      id: guid || url,
      title: title.replace(/\s+/g, ' ').trim(),
      body: summarizeBody(rawDesc),
      source: sourceName,
      url: url.replace(/\?utm_source=rss_feed[\s\S]*$/, ''),
      imageUrl: extractRssImage(itemXml, rawDesc),
      publishedAt: Number.isFinite(parsedDate) ? parsedDate : Date.now(),
      categories: catMatches.slice(0, 4).join('|'),
    });
  }

  return articles;
}

function normalizeCryptoCompareItem(item: any): CryptoCompareArticle | null {
  if (!item?.title || !item?.url) return null;
  const sourceName =
    item.source_info?.name ||
    (typeof item.source === 'string' && item.source.length > 0
      ? item.source
      : 'CryptoCompare');
  const rawImg = typeof item.imageurl === 'string' ? item.imageurl.trim() : '';
  const imageUrl =
    rawImg && rawImg.startsWith('http') && !rawImg.endsWith('/no-image.png')
      ? rawImg
      : null;

  return {
    id: String(item.id || item.guid || item.url),
    title: String(item.title).trim(),
    body: summarizeBody(String(item.body || '')),
    source: String(sourceName).trim(),
    url: String(item.url),
    imageUrl,
    publishedAt: Number(item.published_on || 0) * 1000 || Date.now(),
    categories: String(item.categories || ''),
  };
}

function matchesTokenKeyword(
  article: CryptoCompareArticle,
  symbol: string,
  name: string
): boolean {
  const cleanTicker = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const cleanName = name
    .replace(/\([^)]*\)/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase();

  const haystack = `${article.title} ${article.body} ${article.categories}`.toLowerCase();
  const catTokens = article.categories
    .toUpperCase()
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);

  if (cleanTicker) {
    if (catTokens.includes(cleanTicker)) return true;
    const escapedTicker = cleanTicker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const tickerRegex = new RegExp(`(?:^|[^a-z0-9])${escapedTicker}(?:$|[^a-z0-9])`, 'i');
    if (tickerRegex.test(`${article.title} ${article.body}`)) return true;
  }

  if (cleanName && cleanName.length >= 3) {
    const genericWords = new Set(['token', 'coin', 'protocol', 'network', 'finance', 'wrapped']);
    if (!genericWords.has(cleanName) && haystack.includes(cleanName)) {
      return true;
    }
  }

  return false;
}

const PUBLIC_RSS_FEEDS: Array<{ source: string; url: string }> = [
  { source: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { source: 'CoinTelegraph', url: 'https://cointelegraph.com/rss' },
  { source: 'Decrypt', url: 'https://decrypt.co/feed' },
];

async function fetchCryptoCompareNews(params: {
  symbol?: string;
  name?: string;
  categories?: string;
  limit?: number;
  force?: boolean;
}): Promise<CryptoCompareArticle[]> {
  const symbol = (params.symbol || '').trim();
  const name = (params.name || '').trim();
  const cleanTicker = symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const requestedCategories = (params.categories || '').trim();
  const limit = Math.min(30, Math.max(1, params.limit ?? 15));
  const cacheKey = `news:${cleanTicker}:${name.toLowerCase()}:${requestedCategories.toUpperCase()}:${limit}`;

  if (!params.force) {
    const cached = newsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SOCIAL_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const ccUrls: string[] = ['https://min-api.cryptocompare.com/data/v2/news/?lang=EN'];
  const catParam = requestedCategories || cleanTicker;
  if (catParam) {
    ccUrls.push(
      `https://min-api.cryptocompare.com/data/v2/news/?lang=EN&categories=${encodeURIComponent(catParam)}`
    );
  }

  const ccResults = await Promise.allSettled(
    ccUrls.map((u) =>
      fetch(u, { headers: { Accept: 'application/json' } }).then((r) =>
        r.ok ? r.json() : null
      )
    )
  );

  const byId = new Map<string, CryptoCompareArticle>();
  const categoryMatchedIds = new Set<string>();

  ccResults.forEach((res, idx) => {
    if (res.status !== 'fulfilled' || !res.value) return;
    const rawList: any[] = Array.isArray(res.value?.Data) ? res.value.Data : [];
    for (const raw of rawList) {
      const normalized = normalizeCryptoCompareItem(raw);
      if (!normalized) continue;
      if (!byId.has(normalized.id)) {
        byId.set(normalized.id, normalized);
      }
      if (idx === 1) {
        categoryMatchedIds.add(normalized.id);
      }
    }
  });

  // If CryptoCompare public endpoint is gated or returned empty, fetch zero-key public RSS feeds (CoinDesk, CoinTelegraph, Decrypt)
  if (byId.size === 0) {
    const rssResults = await Promise.allSettled(
      PUBLIC_RSS_FEEDS.map(async (feed) => {
        const res = await fetch(feed.url, {
          headers: {
            Accept: 'application/rss+xml, application/xml, text/xml',
            'User-Agent': 'MeridianWeb3Portfolio/1.0 (read-only news reader)',
          },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRssFeed(xml, feed.source);
      })
    );

    for (const res of rssResults) {
      if (res.status !== 'fulfilled') continue;
      for (const article of res.value) {
        if (!byId.has(article.id)) {
          byId.set(article.id, article);
        }
      }
    }
  }

  const allArticles = Array.from(byId.values()).sort(
    (a, b) => b.publishedAt - a.publishedAt
  );

  let filtered: CryptoCompareArticle[];
  if (symbol || name) {
    filtered = allArticles.filter(
      (a) => categoryMatchedIds.has(a.id) || matchesTokenKeyword(a, symbol, name)
    );
  } else {
    filtered = allArticles;
  }

  const finalArticles = filtered.slice(0, limit);
  newsCache.set(cacheKey, { timestamp: Date.now(), data: finalArticles });
  return finalArticles;
}

function isValidEvmAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address.trim());
}

function isValidSolanaAddress(address: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address.trim());
}

function encodeErc20BalanceOf(address: string): string {
  const cleanAddr = address.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  return `0x70a08231${cleanAddr}`;
}

function decodeUint256Hex(hex: string | undefined | null): bigint {
  if (!hex || hex === '0x' || hex === '0x0') return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function decodeAbiString(hex: string | undefined | null): string {
  if (!hex || hex === '0x' || hex.length < 66) return '';
  try {
    const raw = hex.slice(2);
    // Dynamic string (offset + length + data)
    if (raw.length >= 128) {
      const lengthHex = raw.slice(64, 128);
      const byteLength = Number(BigInt('0x' + lengthHex));
      if (byteLength > 0 && byteLength < 256) {
        const strHex = raw.slice(128, 128 + byteLength * 2);
        return Buffer.from(strHex, 'hex').toString('utf8').replace(/\0/g, '').trim();
      }
    }
    // Fixed bytes32 fallback (e.g. MKR-style)
    return Buffer.from(raw.slice(0, 64), 'hex').toString('utf8').replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

function formatUnits(raw: bigint, decimals: number): number {
  if (raw === 0n) return 0;
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').slice(0, 12);
  return Number(`${whole.toString()}.${fracStr}`);
}

async function rpcFetch(url: string, payload: unknown, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`RPC HTTP ${response.status}: ${errText.slice(0, 180)}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchDexScreenerPrices(
  chain: 'base' | 'solana' | 'robinhood',
  addresses: string[],
  force = false
): Promise<Record<string, DexPriceResult>> {
  const isEvm = chain !== 'solana';
  const uniqueAddresses = Array.from(
    new Set(
      addresses
        .map((a) => (isEvm ? a.toLowerCase() : a.trim()))
        .filter(Boolean)
    )
  );

  if (uniqueAddresses.length === 0) return {};

  const cacheKey = `${chain}:${uniqueAddresses.slice().sort().join(',')}`;
  if (!force) {
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  const results: Record<string, DexPriceResult> = {};
  const chunkSize = 30;

  for (let i = 0; i < uniqueAddresses.length; i += chunkSize) {
    const chunk = uniqueAddresses.slice(i, i + chunkSize);
    const joined = chunk.join(',');

    let pairs: any[] = [];
    try {
      const v1Res = await fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${joined}`, {
        headers: { Accept: 'application/json' },
      });
      if (v1Res.ok) {
        const data = await v1Res.json();
        if (Array.isArray(data)) {
          pairs = data;
        } else if (Array.isArray(data?.pairs)) {
          pairs = data.pairs;
        }
      }
    } catch {
      // fallback below
    }

    if (pairs.length === 0) {
      try {
        const legacyRes = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${joined}`, {
          headers: { Accept: 'application/json' },
        });
        if (legacyRes.ok) {
          const legacyData = await legacyRes.json();
          if (Array.isArray(legacyData?.pairs)) {
            pairs = legacyData.pairs;
          }
        }
      } catch {
        // leave empty for this chunk
      }
    }

    // Group pairs by baseToken address matching requested chain
    const bestPairByAddress = new Map<string, any>();
    for (const pair of pairs) {
      if (!pair || pair.chainId !== chain || !pair.baseToken?.address) continue;
      const addrKey = isEvm ? pair.baseToken.address.toLowerCase() : pair.baseToken.address;
      const liq = Number(pair.liquidity?.usd ?? 0);
      const existing = bestPairByAddress.get(addrKey);
      const existingLiq = existing ? Number(existing.liquidity?.usd ?? 0) : -1;
      if (!existing || liq > existingLiq) {
        bestPairByAddress.set(addrKey, pair);
      }
    }

    for (const addr of chunk) {
      const pair = bestPairByAddress.get(addr);
      if (pair) {
        const parsedPrice = pair.priceUsd !== undefined ? Number(pair.priceUsd) : null;
        results[addr] = {
          address: addr,
          priceUsd: parsedPrice !== null && Number.isFinite(parsedPrice) ? parsedPrice : null,
          priceChange24h:
            pair.priceChange?.h24 !== undefined && Number.isFinite(Number(pair.priceChange.h24))
              ? Number(pair.priceChange.h24)
              : null,
          liquidityUsd:
            pair.liquidity?.usd !== undefined && Number.isFinite(Number(pair.liquidity.usd))
              ? Number(pair.liquidity.usd)
              : null,
          fdv:
            pair.fdv !== undefined && Number.isFinite(Number(pair.fdv))
              ? Number(pair.fdv)
              : null,
          symbol: pair.baseToken?.symbol || undefined,
          name: pair.baseToken?.name || undefined,
          imageUrl: pair.info?.imageUrl || undefined,
          pairUrl: pair.url || undefined,
          dexId: pair.dexId || undefined,
        };
      } else {
        results[addr] = {
          address: addr,
          priceUsd: null,
          priceChange24h: null,
          liquidityUsd: null,
          fdv: null,
        };
      }
    }
  }

  // Native ETH on Robinhood Chain uses live ETH market price if DexScreener has no Robinhood-specific WETH pool yet
  const wethLower = WETH_BASE.toLowerCase();
  if (
    chain === 'robinhood' &&
    results[wethLower] &&
    results[wethLower].priceUsd === null
  ) {
    try {
      const ethRef = await fetchDexScreenerPrices('base', [wethLower], force);
      if (ethRef[wethLower]?.priceUsd !== null) {
        results[wethLower] = {
          ...ethRef[wethLower],
          address: wethLower,
          symbol: 'ETH',
          name: 'Ether (Robinhood)',
        };
      }
    } catch {
      // ignore if reference lookup fails
    }
  }

  priceCache.set(cacheKey, { timestamp: Date.now(), data: results });
  return results;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/config/status', (_req, res) => {
    const alchemyKey = getAlchemyKey();
    const robinhoodAlchemyKey = getRobinhoodAlchemyKey();
    const heliusKey = getHeliusKey();
    const groqKey = getGroqApiKey();
    const geminiKey = getGeminiApiKey();
    res.json({
      alchemyConfigured: alchemyKey.length > 0,
      robinhoodAlchemyConfigured: robinhoodAlchemyKey.length > 0,
      heliusConfigured: heliusKey.length > 0,
      groqConfigured: groqKey.length > 0,
      geminiConfigured: geminiKey.length > 0,
      basePublicRpc: BASE_PUBLIC_RPC,
      solanaPublicRpc: SOLANA_PUBLIC_RPC,
      robinhoodRpcEndpoint: ROBINHOOD_ALCHEMY_BASE_URL,
      dexscreenerEnabled: true,
    });
  });

  app.post('/api/analyze', handleAnalyzeRequest);

  app.post('/api/chains/base/balances', async (req, res) => {
    try {
      const address = String(req.body?.address || '').trim();
      const customTokens: string[] = Array.isArray(req.body?.customTokens)
        ? req.body.customTokens.filter((t: unknown) => typeof t === 'string' && isValidEvmAddress(t))
        : [];

      if (!isValidEvmAddress(address)) {
        res.status(400).json({ error: 'Adresse Base EVM invalide (format 0x... attendu).' });
        return;
      }

      const alchemyKey = getAlchemyKey();
      const usingAlchemy = alchemyKey.length > 0;
      const rpcUrl = usingAlchemy
        ? `https://base-mainnet.g.alchemy.com/v2/${alchemyKey}`
        : BASE_PUBLIC_RPC;

      // 1. Fetch Native ETH Balance
      const ethBalanceRes = await rpcFetch(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });

      const nativeRaw = decodeUint256Hex(ethBalanceRes?.result);
      const nativeBalance = formatUnits(nativeRaw, 18);

      const tokens: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        balance: number;
        rawBalance: string;
        isNative: boolean;
        logoUrl?: string;
      }> = [];

      if (nativeBalance > 0) {
        tokens.push({
          address: WETH_BASE.toLowerCase(),
          symbol: 'ETH',
          name: 'Ether (Base)',
          decimals: 18,
          balance: nativeBalance,
          rawBalance: nativeRaw.toString(),
          isNative: true,
        });
      }

      if (usingAlchemy) {
        // Complete ERC-20 discovery via Alchemy Free API
        const tokenBalancesRes = await rpcFetch(rpcUrl, {
          jsonrpc: '2.0',
          id: 2,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20'],
        });

        const rawList: Array<{ contractAddress: string; tokenBalance: string }> =
          tokenBalancesRes?.result?.tokenBalances || [];

        const nonZeroContracts = rawList
          .filter((item) => decodeUint256Hex(item.tokenBalance) > 0n)
          .slice(0, 80);

        if (nonZeroContracts.length > 0) {
          const metadataBatch = nonZeroContracts.map((item, idx) => ({
            jsonrpc: '2.0',
            id: 100 + idx,
            method: 'alchemy_getTokenMetadata',
            params: [item.contractAddress],
          }));

          const metaResults = await rpcFetch(rpcUrl, metadataBatch);
          const metaArray = Array.isArray(metaResults) ? metaResults : [];

          for (let i = 0; i < nonZeroContracts.length; i++) {
            const item = nonZeroContracts[i];
            const meta = metaArray[i]?.result || {};
            const decimals = typeof meta.decimals === 'number' ? meta.decimals : 18;
            const raw = decodeUint256Hex(item.tokenBalance);
            const balance = formatUnits(raw, decimals);
            if (balance > 0) {
              tokens.push({
                address: item.contractAddress.toLowerCase(),
                symbol: meta.symbol || 'ERC20',
                name: meta.name || 'Unknown Token',
                decimals,
                balance,
                rawBalance: raw.toString(),
                isNative: false,
                logoUrl: meta.logo || undefined,
              });
            }
          }
        }
      } else {
        // Fallback: Public Base RPC (https://mainnet.base.org) for core Base tokens + user custom tokens
        const knownMap = new Map<string, KnownErc20Token>();
        for (const t of CORE_BASE_TOKENS) {
          knownMap.set(t.address.toLowerCase(), t);
        }
        for (const ct of customTokens) {
          const lower = ct.toLowerCase();
          if (!knownMap.has(lower)) {
            knownMap.set(lower, { address: ct, symbol: '', name: '', decimals: 18 });
          }
        }

        const candidateList = Array.from(knownMap.values());
        const callData = encodeErc20BalanceOf(address);
        const batch = candidateList.map((token, idx) => ({
          jsonrpc: '2.0',
          id: 10 + idx,
          method: 'eth_call',
          params: [{ to: token.address, data: callData }, 'latest'],
        }));

        const batchRes = await rpcFetch(rpcUrl, batch);
        const resArray = Array.isArray(batchRes) ? batchRes : [];

        const customNeedingMeta: KnownErc20Token[] = [];
        const customRawBalances = new Map<string, bigint>();

        for (let i = 0; i < candidateList.length; i++) {
          const token = candidateList[i];
          const itemRes = resArray.find((r: any) => r.id === 10 + i) ?? resArray[i];
          const raw = decodeUint256Hex(itemRes?.result);
          if (raw <= 0n) continue;

          if (!token.symbol) {
            customNeedingMeta.push(token);
            customRawBalances.set(token.address.toLowerCase(), raw);
          } else {
            const balance = formatUnits(raw, token.decimals);
            if (balance > 0) {
              tokens.push({
                address: token.address.toLowerCase(),
                symbol: token.symbol,
                name: token.name,
                decimals: token.decimals,
                balance,
                rawBalance: raw.toString(),
                isNative: false,
              });
            }
          }
        }

        // Fetch on-chain decimals/symbol/name for any custom contracts with >0 balance
        if (customNeedingMeta.length > 0) {
          const metaBatch: any[] = [];
          customNeedingMeta.forEach((t, idx) => {
            const baseId = 500 + idx * 3;
            metaBatch.push(
              { jsonrpc: '2.0', id: baseId, method: 'eth_call', params: [{ to: t.address, data: '0x313ce567' }, 'latest'] }, // decimals()
              { jsonrpc: '2.0', id: baseId + 1, method: 'eth_call', params: [{ to: t.address, data: '0x95d89b41' }, 'latest'] }, // symbol()
              { jsonrpc: '2.0', id: baseId + 2, method: 'eth_call', params: [{ to: t.address, data: '0x06fdde03' }, 'latest'] } // name()
            );
          });
          const metaRes = await rpcFetch(rpcUrl, metaBatch);
          const metaArr = Array.isArray(metaRes) ? metaRes : [];

          customNeedingMeta.forEach((t, idx) => {
            const baseId = 500 + idx * 3;
            const decHex = metaArr.find((r: any) => r.id === baseId)?.result;
            const symHex = metaArr.find((r: any) => r.id === baseId + 1)?.result;
            const nameHex = metaArr.find((r: any) => r.id === baseId + 2)?.result;
            const decimalsNum = Number(decodeUint256Hex(decHex));
            const decimals = decimalsNum > 0 && decimalsNum <= 36 ? decimalsNum : 18;
            const raw = customRawBalances.get(t.address.toLowerCase()) || 0n;
            const balance = formatUnits(raw, decimals);
            if (balance > 0) {
              tokens.push({
                address: t.address.toLowerCase(),
                symbol: decodeAbiString(symHex) || 'TOKEN',
                name: decodeAbiString(nameHex) || t.address,
                decimals,
                balance,
                rawBalance: raw.toString(),
                isNative: false,
              });
            }
          });
        }
      }

      res.json({
        chain: 'base',
        address,
        source: usingAlchemy ? 'alchemy' : 'public-rpc',
        apiKeyMissing: !usingAlchemy,
        apiKeyName: !usingAlchemy ? 'NEXT_PUBLIC_ALCHEMY_API_KEY' : null,
        tokens,
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la lecture du portefeuille Base.',
      });
    }
  });

  app.post('/api/chains/robinhood/balances', async (req, res) => {
    try {
      const address = String(req.body?.address || '').trim();
      const customTokens: string[] = Array.isArray(req.body?.customTokens)
        ? req.body.customTokens.filter((t: unknown) => typeof t === 'string' && isValidEvmAddress(t))
        : [];

      if (!isValidEvmAddress(address)) {
        res.status(400).json({ error: 'Adresse Robinhood EVM invalide (format 0x... attendu).' });
        return;
      }

      const robinhoodKey = getRobinhoodAlchemyKey();
      if (!robinhoodKey) {
        res.json({
          chain: 'robinhood',
          address,
          source: 'unavailable',
          apiKeyMissing: true,
          apiKeyName: 'ROBINHOOD_ALCHEMY_API_KEY',
          error:
            'Clé API Alchemy Robinhood requise dans .env (ROBINHOOD_ALCHEMY_API_KEY) pour interroger le réseau Robinhood.',
          tokens: [],
        });
        return;
      }

      const rpcUrl = `${ROBINHOOD_ALCHEMY_BASE_URL}/${robinhoodKey}`;

      // 1. Fetch Native ETH Balance on Robinhood Chain
      const ethBalanceRes = await rpcFetch(rpcUrl, {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [address, 'latest'],
      });

      if (ethBalanceRes?.error) {
        throw new Error(ethBalanceRes.error.message || 'Erreur RPC Alchemy Robinhood.');
      }

      const nativeRaw = decodeUint256Hex(ethBalanceRes?.result);
      const nativeBalance = formatUnits(nativeRaw, 18);

      const tokens: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        balance: number;
        rawBalance: string;
        isNative: boolean;
        logoUrl?: string;
      }> = [];

      if (nativeBalance > 0) {
        tokens.push({
          address: WETH_BASE.toLowerCase(),
          symbol: 'ETH',
          name: 'Ether (Robinhood)',
          decimals: 18,
          balance: nativeBalance,
          rawBalance: nativeRaw.toString(),
          isNative: true,
        });
      }

      // 2. Discover ERC-20 tokens via Alchemy Token API
      let alchemyTokenSuccess = false;
      try {
        const tokenBalancesRes = await rpcFetch(rpcUrl, {
          jsonrpc: '2.0',
          id: 2,
          method: 'alchemy_getTokenBalances',
          params: [address, 'erc20'],
        });

        if (tokenBalancesRes?.result && Array.isArray(tokenBalancesRes.result.tokenBalances)) {
          alchemyTokenSuccess = true;
          const rawList: Array<{ contractAddress: string; tokenBalance: string }> =
            tokenBalancesRes.result.tokenBalances;

          const nonZeroContracts = rawList
            .filter((item) => decodeUint256Hex(item.tokenBalance) > 0n)
            .slice(0, 80);

          if (nonZeroContracts.length > 0) {
            const metadataBatch = nonZeroContracts.map((item, idx) => ({
              jsonrpc: '2.0',
              id: 100 + idx,
              method: 'alchemy_getTokenMetadata',
              params: [item.contractAddress],
            }));

            const metaResults = await rpcFetch(rpcUrl, metadataBatch).catch(() => []);
            const metaArray = Array.isArray(metaResults) ? metaResults : [];

            for (let i = 0; i < nonZeroContracts.length; i++) {
              const item = nonZeroContracts[i];
              const meta = metaArray[i]?.result || {};
              const decimals = typeof meta.decimals === 'number' ? meta.decimals : 18;
              const raw = decodeUint256Hex(item.tokenBalance);
              const balance = formatUnits(raw, decimals);
              if (balance > 0) {
                tokens.push({
                  address: item.contractAddress.toLowerCase(),
                  symbol: meta.symbol || 'ERC20',
                  name: meta.name || 'Robinhood Token',
                  decimals,
                  balance,
                  rawBalance: raw.toString(),
                  isNative: false,
                  logoUrl: meta.logo || undefined,
                });
              }
            }
          }
        }
      } catch {
        // Fall through to custom token eth_call / Blockscout token check if Alchemy token endpoint is unavailable
      }

      // Fallback check via Blockscout Robinhood or customTokens if alchemy_getTokenBalances returned unavailable
      if (!alchemyTokenSuccess && customTokens.length > 0) {
        const callData = encodeErc20BalanceOf(address);
        const batch = customTokens.map((addr, idx) => ({
          jsonrpc: '2.0',
          id: 200 + idx,
          method: 'eth_call',
          params: [{ to: addr, data: callData }, 'latest'],
        }));
        const batchRes = await rpcFetch(rpcUrl, batch).catch(() => []);
        const resArray = Array.isArray(batchRes) ? batchRes : [];
        const activeContracts = customTokens
          .map((addr, idx) => ({
            addr,
            raw: decodeUint256Hex((resArray.find((r: any) => r.id === 200 + idx) ?? resArray[idx])?.result),
          }))
          .filter((x) => x.raw > 0n);

        if (activeContracts.length > 0) {
          const metaBatch: any[] = [];
          activeContracts.forEach((t, idx) => {
            const baseId = 600 + idx * 3;
            metaBatch.push(
              { jsonrpc: '2.0', id: baseId, method: 'eth_call', params: [{ to: t.addr, data: '0x313ce567' }, 'latest'] },
              { jsonrpc: '2.0', id: baseId + 1, method: 'eth_call', params: [{ to: t.addr, data: '0x95d89b41' }, 'latest'] },
              { jsonrpc: '2.0', id: baseId + 2, method: 'eth_call', params: [{ to: t.addr, data: '0x06fdde03' }, 'latest'] }
            );
          });
          const metaRes = await rpcFetch(rpcUrl, metaBatch).catch(() => []);
          const metaArr = Array.isArray(metaRes) ? metaRes : [];

          activeContracts.forEach((t, idx) => {
            const baseId = 600 + idx * 3;
            const decHex = metaArr.find((r: any) => r.id === baseId)?.result;
            const symHex = metaArr.find((r: any) => r.id === baseId + 1)?.result;
            const nameHex = metaArr.find((r: any) => r.id === baseId + 2)?.result;
            const decNum = Number(decodeUint256Hex(decHex));
            const decimals = decNum > 0 && decNum <= 36 ? decNum : 18;
            const balance = formatUnits(t.raw, decimals);
            if (balance > 0) {
              tokens.push({
                address: t.addr.toLowerCase(),
                symbol: decodeAbiString(symHex) || 'ERC20',
                name: decodeAbiString(nameHex) || t.addr,
                decimals,
                balance,
                rawBalance: t.raw.toString(),
                isNative: false,
              });
            }
          });
        }
      }

      res.json({
        chain: 'robinhood',
        address,
        source: 'alchemy',
        apiKeyMissing: false,
        apiKeyName: null,
        tokens,
      });
    } catch (error: any) {
      res.status(502).json({
        chain: 'robinhood',
        source: 'unavailable',
        apiKeyMissing: false,
        apiKeyName: null,
        error:
          error?.message || 'Erreur lors de la lecture du portefeuille Robinhood.',
        tokens: [],
      });
    }
  });

  app.post('/api/chains/robinhood/transactions', async (req, res) => {
    try {
      const address = String(req.body?.address || '').trim();
      if (!isValidEvmAddress(address)) {
        res.status(400).json({ error: 'Adresse Robinhood EVM invalide (format 0x... attendu).' });
        return;
      }

      const robinhoodKey = getRobinhoodAlchemyKey();
      if (!robinhoodKey) {
        res.json({
          chain: 'robinhood',
          address,
          source: 'unavailable',
          apiKeyMissing: true,
          apiKeyName: 'ROBINHOOD_ALCHEMY_API_KEY',
          error:
            'Clé API Alchemy Robinhood requise dans .env (ROBINHOOD_ALCHEMY_API_KEY) pour lire l’historique des transactions.',
          transactions: [],
        });
        return;
      }

      const rpcUrl = `${ROBINHOOD_ALCHEMY_BASE_URL}/${robinhoodKey}`;
      const lowerAddr = address.toLowerCase();

      const txMap = new Map<
        string,
        {
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
      >();

      let usedAlchemy = false;
      try {
        const [inboundRes, outboundRes] = await Promise.all([
          rpcFetch(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                fromBlock: '0x0',
                toBlock: 'latest',
                toAddress: address,
                category: ['external', 'erc20'],
                withMetadata: true,
                excludeZeroValue: false,
                maxCount: '0x19',
                order: 'desc',
              },
            ],
          }),
          rpcFetch(rpcUrl, {
            jsonrpc: '2.0',
            id: 2,
            method: 'alchemy_getAssetTransfers',
            params: [
              {
                fromBlock: '0x0',
                toBlock: 'latest',
                fromAddress: address,
                category: ['external', 'erc20'],
                withMetadata: true,
                excludeZeroValue: false,
                maxCount: '0x19',
                order: 'desc',
              },
            ],
          }),
        ]);

        const allTransfers: any[] = [
          ...(Array.isArray(inboundRes?.result?.transfers) ? inboundRes.result.transfers : []),
          ...(Array.isArray(outboundRes?.result?.transfers) ? outboundRes.result.transfers : []),
        ];

        if (!inboundRes?.error || !outboundRes?.error) {
          usedAlchemy = true;
        }

        for (const tr of allTransfers) {
          const hash = String(tr?.hash || '');
          if (!hash) continue;
          const from = String(tr?.from || '');
          const to = String(tr?.to || '');
          const isFromSelf = from.toLowerCase() === lowerAddr;
          const isToSelf = to.toLowerCase() === lowerAddr;
          const direction: 'in' | 'out' | 'self' =
            isFromSelf && isToSelf ? 'self' : isToSelf ? 'in' : 'out';
          const asset = String(tr?.asset || 'ETH');
          const category = String(tr?.category || 'external');
          const valNum = Number(tr?.value);
          const tsIso = tr?.metadata?.blockTimestamp;
          const parsedTs = tsIso ? Date.parse(tsIso) : NaN;
          const key = `${hash}:${category}:${asset}:${direction}`;

          if (!txMap.has(key)) {
            txMap.set(key, {
              hash,
              timestamp: Number.isFinite(parsedTs) ? parsedTs : null,
              from,
              to,
              value: Number.isFinite(valNum) ? valNum : null,
              asset,
              category,
              direction,
              explorerUrl: `https://robinhoodchain.blockscout.com/tx/${hash}`,
            });
          }
        }
      } catch {
        // Fallback to Robinhood Blockscout explorer API if Alchemy transfers endpoint unavailable
      }

      if (!usedAlchemy || txMap.size === 0) {
        try {
          const blkRes = await fetch(
            `${ROBINHOOD_EXPLORER_API}/addresses/${address}/transactions`,
            { headers: { Accept: 'application/json' } }
          );
          if (blkRes.ok) {
            const blkJson = await blkRes.json();
            const items: any[] = Array.isArray(blkJson?.items) ? blkJson.items : [];
            for (const tx of items.slice(0, 25)) {
              const hash = String(tx?.hash || '');
              if (!hash) continue;
              const from = String(tx?.from?.hash || '');
              const to = String(tx?.to?.hash || '');
              const isFromSelf = from.toLowerCase() === lowerAddr;
              const isToSelf = to.toLowerCase() === lowerAddr;
              const direction: 'in' | 'out' | 'self' =
                isFromSelf && isToSelf ? 'self' : isToSelf ? 'in' : 'out';
              const valEth = Number(tx?.value || 0) / 1e18;
              const tsMs = tx?.timestamp ? Date.parse(tx.timestamp) : NaN;
              const key = `${hash}:external:ETH:${direction}`;
              if (!txMap.has(key)) {
                txMap.set(key, {
                  hash,
                  timestamp: Number.isFinite(tsMs) ? tsMs : null,
                  from,
                  to,
                  value: Number.isFinite(valEth) ? valEth : null,
                  asset: 'ETH',
                  category: 'external',
                  direction,
                  explorerUrl: `https://robinhoodchain.blockscout.com/tx/${hash}`,
                });
              }
            }
          }
        } catch {
          // ignore fallback error
        }
      }

      const transactions = Array.from(txMap.values())
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
        .slice(0, 30);

      res.json({
        chain: 'robinhood',
        address,
        source: usedAlchemy ? 'alchemy' : 'public-rpc',
        apiKeyMissing: false,
        apiKeyName: null,
        transactions,
      });
    } catch (error: any) {
      res.status(502).json({
        chain: 'robinhood',
        source: 'unavailable',
        apiKeyMissing: false,
        apiKeyName: null,
        error:
          error?.message ||
          'Erreur lors de la récupération des transactions Robinhood.',
        transactions: [],
      });
    }
  });

  app.post('/api/chains/solana/balances', async (req, res) => {
    try {
      const address = String(req.body?.address || '').trim();
      if (!isValidSolanaAddress(address)) {
        res.status(400).json({ error: 'Adresse Solana invalide (format Base58 attendu).' });
        return;
      }

      const heliusKey = getHeliusKey();
      const usingHelius = heliusKey.length > 0;
      const rpcUrl = usingHelius
        ? `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`
        : SOLANA_PUBLIC_RPC;

      const tokens: Array<{
        address: string;
        symbol: string;
        name: string;
        decimals: number;
        balance: number;
        rawBalance: string;
        isNative: boolean;
        logoUrl?: string;
      }> = [];

      if (usingHelius) {
        try {
          const dasRes = await rpcFetch(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'getAssetsByOwner',
            params: {
              ownerAddress: address,
              page: 1,
              limit: 200,
              displayOptions: {
                showFungible: true,
                showNativeBalance: true,
              },
            },
          });

          const result = dasRes?.result;
          const lamports = BigInt(result?.nativeBalance?.lamports ?? 0);
          const solBalance = formatUnits(lamports, 9);
          if (solBalance > 0) {
            tokens.push({
              address: WSOL_MINT,
              symbol: 'SOL',
              name: 'Solana',
              decimals: 9,
              balance: solBalance,
              rawBalance: lamports.toString(),
              isNative: true,
            });
          }

          const items: any[] = Array.isArray(result?.items) ? result.items : [];
          for (const item of items) {
            if (item.interface !== 'FungibleToken' && item.interface !== 'FungibleAsset') continue;
            const tokenInfo = item.token_info;
            if (!tokenInfo || !tokenInfo.balance) continue;
            const decimals = typeof tokenInfo.decimals === 'number' ? tokenInfo.decimals : 0;
            const raw = BigInt(tokenInfo.balance);
            const balance = formatUnits(raw, decimals);
            if (balance <= 0) continue;

            tokens.push({
              address: item.id,
              symbol: tokenInfo.symbol || item.content?.metadata?.symbol || 'SPL',
              name: item.content?.metadata?.name || tokenInfo.symbol || item.id,
              decimals,
              balance,
              rawBalance: raw.toString(),
              isNative: false,
              logoUrl: item.content?.links?.image || item.content?.files?.[0]?.uri || undefined,
            });
          }

          res.json({
            chain: 'solana',
            address,
            source: 'helius',
            apiKeyMissing: false,
            apiKeyName: null,
            tokens,
          });
          return;
        } catch {
          // Fall through to standard JSON-RPC on Helius URL
        }
      }

      // Standard Solana JSON-RPC (Helius standard or Solana Public RPC)
      const [balRes, splRes, token2022Res] = await Promise.all([
        rpcFetch(rpcUrl, {
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: [address],
        }),
        rpcFetch(rpcUrl, {
          jsonrpc: '2.0',
          id: 2,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
            { encoding: 'jsonParsed' },
          ],
        }),
        rpcFetch(rpcUrl, {
          jsonrpc: '2.0',
          id: 3,
          method: 'getTokenAccountsByOwner',
          params: [
            address,
            { programId: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' },
            { encoding: 'jsonParsed' },
          ],
        }).catch(() => ({ result: { value: [] } })),
      ]);

      if (balRes?.error) {
        throw new Error(balRes.error.message || 'Erreur RPC Solana');
      }

      const lamports = BigInt(balRes?.result?.value ?? 0);
      const solBalance = formatUnits(lamports, 9);
      if (solBalance > 0) {
        tokens.push({
          address: WSOL_MINT,
          symbol: 'SOL',
          name: 'Solana',
          decimals: 9,
          balance: solBalance,
          rawBalance: lamports.toString(),
          isNative: true,
        });
      }

      const allAccounts = [
        ...(splRes?.result?.value || []),
        ...(token2022Res?.result?.value || []),
      ];

      // Aggregate by mint in case multiple token accounts exist for the same mint
      const mintAgg = new Map<string, { raw: bigint; decimals: number }>();
      for (const acc of allAccounts) {
        const parsed = acc?.account?.data?.parsed?.info;
        const mint = parsed?.mint;
        const tokenAmount = parsed?.tokenAmount;
        if (!mint || !tokenAmount) continue;
        const raw = BigInt(tokenAmount.amount || '0');
        const decimals = Number(tokenAmount.decimals ?? 0);
        if (raw <= 0n) continue;

        const existing = mintAgg.get(mint);
        if (existing) {
          existing.raw += raw;
        } else {
          mintAgg.set(mint, { raw, decimals });
        }
      }

      for (const [mint, info] of mintAgg.entries()) {
        const balance = formatUnits(info.raw, info.decimals);
        if (balance > 0) {
          tokens.push({
            address: mint,
            symbol: `${mint.slice(0, 4)}…${mint.slice(-3)}`,
            name: `SPL ${mint.slice(0, 6)}`,
            decimals: info.decimals,
            balance,
            rawBalance: info.raw.toString(),
            isNative: false,
          });
        }
      }

      res.json({
        chain: 'solana',
        address,
        source: usingHelius ? 'helius' : 'public-rpc',
        apiKeyMissing: !usingHelius,
        apiKeyName: !usingHelius ? 'NEXT_PUBLIC_HELIUS_API_KEY' : null,
        tokens,
      });
    } catch (error: any) {
      const heliusKey = getHeliusKey();
      const missingKey = heliusKey.length === 0;
      res.status(missingKey ? 200 : 502).json({
        chain: 'solana',
        source: 'unavailable',
        apiKeyMissing: missingKey,
        apiKeyName: missingKey ? 'NEXT_PUBLIC_HELIUS_API_KEY' : null,
        error: missingKey
          ? 'Clé API Helius requise pour interroger Solana de manière fiable (le RPC public a limité la requête).'
          : error?.message || 'Erreur lors de la lecture du portefeuille Solana.',
        tokens: [],
      });
    }
  });

  app.post('/api/prices/dexscreener', async (req, res) => {
    try {
      const chain = normalizeActiveChain(req.body?.chain);
      const addresses: string[] = Array.isArray(req.body?.addresses) ? req.body.addresses : [];
      const force = Boolean(req.body?.force);

      const prices = await fetchDexScreenerPrices(chain, addresses, force);
      res.json({ chain, prices, fetchedAt: Date.now() });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Impossible de joindre DexScreener.',
      });
    }
  });

  app.post('/api/onchain/token-metrics', async (req, res) => {
    try {
      const chain = normalizeActiveChain(req.body?.chain);
      const rawAddress = String(req.body?.address || '').trim();
      const address = chain !== 'solana' ? rawAddress.toLowerCase() : rawAddress;

      if (!address) {
        res.status(400).json({ error: 'Adresse du contrat manquante.' });
        return;
      }

      const geckoNetwork = chain;

      const [dexResult, geckoResult] = await Promise.allSettled([
        fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${address}`, {
          headers: { Accept: 'application/json' },
        }).then(async (r) => (r.ok ? r.json() : null)),
        fetch(
          `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/tokens/${address}/pools?page=1`,
          { headers: { Accept: 'application/json' } }
        ).then(async (r) => (r.ok ? r.json() : null)),
      ]);

      // Parse DexScreener pairs
      let dexPairs: any[] = [];
      if (dexResult.status === 'fulfilled' && dexResult.value) {
        const val = dexResult.value;
        dexPairs = Array.isArray(val) ? val : Array.isArray(val?.pairs) ? val.pairs : [];
      }
      dexPairs = dexPairs
        .filter((p) => p && p.chainId === chain)
        .sort((a, b) => Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0));
      const topDexPair = dexPairs[0] || null;

      // Parse GeckoTerminal pools
      let geckoPools: any[] = [];
      if (geckoResult.status === 'fulfilled' && geckoResult.value?.data) {
        geckoPools = Array.isArray(geckoResult.value.data) ? geckoResult.value.data : [];
      }
      const topGeckoPool =
        geckoPools.find(
          (p) =>
            topDexPair?.pairAddress &&
            p?.attributes?.address?.toLowerCase() === topDexPair.pairAddress.toLowerCase()
        ) ||
        geckoPools[0] ||
        null;

      const gAttr = topGeckoPool?.attributes || null;

      const parseNum = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const poolAddress =
        topGeckoPool?.attributes?.address || topDexPair?.pairAddress || null;

      const buys24h =
        parseNum(topDexPair?.txns?.h24?.buys) ??
        parseNum(gAttr?.transactions?.h24?.buys);
      const sells24h =
        parseNum(topDexPair?.txns?.h24?.sells) ??
        parseNum(gAttr?.transactions?.h24?.sells);

      const buys6h =
        parseNum(topDexPair?.txns?.h6?.buys) ??
        parseNum(gAttr?.transactions?.h6?.buys);
      const sells6h =
        parseNum(topDexPair?.txns?.h6?.sells) ??
        parseNum(gAttr?.transactions?.h6?.sells);

      const buys1h =
        parseNum(topDexPair?.txns?.h1?.buys) ??
        parseNum(gAttr?.transactions?.h1?.buys);
      const sells1h =
        parseNum(topDexPair?.txns?.h1?.sells) ??
        parseNum(gAttr?.transactions?.h1?.sells);

      const pairCreatedAtMs =
        parseNum(topDexPair?.pairCreatedAt) ??
        (gAttr?.pool_created_at ? Date.parse(gAttr.pool_created_at) : null);

      const liquidityUsd =
        parseNum(topDexPair?.liquidity?.usd) ?? parseNum(gAttr?.reserve_in_usd);
      const fdv = parseNum(topDexPair?.fdv) ?? parseNum(gAttr?.fdv_usd);
      const marketCap =
        parseNum(topDexPair?.marketCap) ?? parseNum(gAttr?.market_cap_usd);
      const volume24h =
        parseNum(topDexPair?.volume?.h24) ?? parseNum(gAttr?.volume_usd?.h24);
      const volume6h =
        parseNum(topDexPair?.volume?.h6) ?? parseNum(gAttr?.volume_usd?.h6);
      const volume1h =
        parseNum(topDexPair?.volume?.h1) ?? parseNum(gAttr?.volume_usd?.h1);

      res.json({
        chain,
        address,
        poolAddress,
        dexId: topDexPair?.dexId || null,
        dexScreenerUrl: topDexPair?.url || null,
        geckoTerminalUrl: poolAddress
          ? `https://www.geckoterminal.com/${geckoNetwork}/pools/${poolAddress}`
          : `https://www.geckoterminal.com/${geckoNetwork}/tokens/${address}`,
        priceUsd:
          parseNum(topDexPair?.priceUsd) ?? parseNum(gAttr?.base_token_price_usd),
        priceChange1h:
          parseNum(topDexPair?.priceChange?.h1) ??
          parseNum(gAttr?.price_change_percentage?.h1),
        priceChange6h:
          parseNum(topDexPair?.priceChange?.h6) ??
          parseNum(gAttr?.price_change_percentage?.h6),
        priceChange24h:
          parseNum(topDexPair?.priceChange?.h24) ??
          parseNum(gAttr?.price_change_percentage?.h24),
        liquidityUsd,
        volume24h,
        volume6h,
        volume1h,
        fdv,
        marketCap,
        txns24h:
          buys24h !== null && sells24h !== null
            ? { buys: buys24h, sells: sells24h }
            : null,
        txns6h:
          buys6h !== null && sells6h !== null
            ? { buys: buys6h, sells: sells6h }
            : null,
        txns1h:
          buys1h !== null && sells1h !== null
            ? { buys: buys1h, sells: sells1h }
            : null,
        poolCreatedAt: pairCreatedAtMs,
        poolCount: Math.max(dexPairs.length, geckoPools.length),
        fetchedAt: Date.now(),
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la récupération des métriques on-chain.',
      });
    }
  });

  app.post('/api/onchain/ohlcv', async (req, res) => {
    try {
      const chain = normalizeActiveChain(req.body?.chain);
      const poolAddress = String(req.body?.poolAddress || '').trim();
      const timeframe =
        req.body?.timeframe === 'day' || req.body?.timeframe === 'minute'
          ? req.body.timeframe
          : 'hour';
      const aggregate = Number(req.body?.aggregate || 1);
      const limit = Math.min(300, Math.max(30, Number(req.body?.limit || 220)));

      if (!poolAddress) {
        res.status(400).json({ error: 'Adresse de pool requise pour les bougies OHLCV.' });
        return;
      }

      const network = chain;
      const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}&currency=usd`;

      const gtRes = await fetch(url, {
        headers: { Accept: 'application/json' },
      });

      if (!gtRes.ok) {
        res.status(502).json({
          error: `GeckoTerminal OHLCV indisponible (HTTP ${gtRes.status}).`,
        });
        return;
      }

      const payload = await gtRes.json();
      const rawList: any[] = payload?.data?.attributes?.ohlcv_list || [];

      // GeckoTerminal returns newest-first [timestampSec, open, high, low, close, volume]
      const candles = rawList
        .map((row) => ({
          time: Number(row[0]),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5]),
        }))
        .filter(
          (c) =>
            Number.isFinite(c.time) &&
            Number.isFinite(c.open) &&
            Number.isFinite(c.high) &&
            Number.isFinite(c.low) &&
            Number.isFinite(c.close)
        )
        .sort((a, b) => a.time - b.time);

      res.json({
        chain,
        poolAddress,
        timeframe,
        aggregate,
        candles,
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la récupération OHLCV GeckoTerminal.',
      });
    }
  });

  app.post('/api/pnl/cost-basis', async (req, res) => {
    try {
      const chain = normalizeActiveChain(req.body?.chain);
      const walletAddress = String(req.body?.walletAddress || '').trim();
      const tokenAddress = String(req.body?.tokenAddress || '').trim();
      const poolAddress = String(req.body?.poolAddress || '').trim();
      const isNative = Boolean(req.body?.isNative);

      if (!walletAddress || !tokenAddress) {
        res.status(400).json({ error: 'Adresse wallet et contrat token requis.' });
        return;
      }

      // Fetch daily OHLCV candles to map real historical transaction timestamps to real historical USD prices
      const historicalCandles: Array<{ time: number; close: number }> = [];
      if (poolAddress) {
        try {
          const gtNetwork = chain;
          const gtRes = await fetch(
            `https://api.geckoterminal.com/api/v2/networks/${gtNetwork}/pools/${poolAddress}/ohlcv/day?aggregate=1&limit=365&currency=usd`,
            { headers: { Accept: 'application/json' } }
          );
          if (gtRes.ok) {
            const gtData = await gtRes.json();
            const list: any[] = gtData?.data?.attributes?.ohlcv_list || [];
            for (const row of list) {
              const t = Number(row[0]);
              const c = Number(row[4]);
              if (Number.isFinite(t) && Number.isFinite(c) && c > 0) {
                historicalCandles.push({ time: t, close: c });
              }
            }
            historicalCandles.sort((a, b) => a.time - b.time);
          }
        } catch {
          // ignore if historical OHLCV unavailable
        }
      }

      const findHistoricalPrice = (timestampSec: number): number | null => {
        if (historicalCandles.length === 0) return null;
        let closest = historicalCandles[0];
        let minDiff = Math.abs(timestampSec - closest.time);
        for (const c of historicalCandles) {
          const diff = Math.abs(timestampSec - c.time);
          if (diff < minDiff) {
            minDiff = diff;
            closest = c;
          }
        }
        return closest.close;
      };

      const inboundEvents: Array<{
        hash: string;
        timestamp: number;
        amount: number;
        estimatedPriceUsd: number | null;
      }> = [];

      if (chain === 'base') {
        if (!isValidEvmAddress(walletAddress)) {
          res.status(400).json({ error: 'Adresse Base invalide.' });
          return;
        }

        const basescanKey = (process.env.BASESCAN_API_KEY || '').trim();
        let fetchedViaBasescan = false;

        if (basescanKey && !isNative) {
          try {
            const bsUrl = `https://api.etherscan.io/v2/api?chainid=8453&module=account&action=tokentx&contractaddress=${tokenAddress}&address=${walletAddress}&page=1&offset=50&sort=desc&apikey=${basescanKey}`;
            const bsRes = await fetch(bsUrl);
            if (bsRes.ok) {
              const bsJson = await bsRes.json();
              if (Array.isArray(bsJson?.result)) {
                fetchedViaBasescan = true;
                for (const tx of bsJson.result) {
                  if (String(tx.to || '').toLowerCase() !== walletAddress.toLowerCase()) continue;
                  const dec = Number(tx.tokenDecimal || 18);
                  const amount = Number(tx.value || 0) / 10 ** dec;
                  const ts = Number(tx.timeStamp || 0);
                  if (amount > 0 && ts > 0) {
                    inboundEvents.push({
                      hash: tx.hash,
                      timestamp: ts,
                      amount,
                      estimatedPriceUsd: findHistoricalPrice(ts),
                    });
                  }
                }
              }
            }
          } catch {
            // fall back to free Blockscout Base API
          }
        }

        if (!fetchedViaBasescan) {
          // 100% Free Base Blockscout API (no key required)
          if (isNative) {
            const blkUrl = `https://base.blockscout.com/api/v2/addresses/${walletAddress}/transactions`;
            const blkRes = await fetch(blkUrl, { headers: { Accept: 'application/json' } });
            if (blkRes.ok) {
              const blkJson = await blkRes.json();
              const items: any[] = Array.isArray(blkJson?.items) ? blkJson.items : [];
              for (const tx of items) {
                if (String(tx?.to?.hash || '').toLowerCase() !== walletAddress.toLowerCase()) continue;
                const valWei = Number(tx?.value || 0);
                const amount = valWei / 1e18;
                const ts = tx?.timestamp ? Math.floor(Date.parse(tx.timestamp) / 1000) : 0;
                if (amount > 0 && ts > 0) {
                  inboundEvents.push({
                    hash: tx.hash,
                    timestamp: ts,
                    amount,
                    estimatedPriceUsd: findHistoricalPrice(ts),
                  });
                }
              }
            }
          } else {
            const blkUrl = `https://base.blockscout.com/api/v2/addresses/${walletAddress}/token-transfers?type=ERC-20&token=${tokenAddress}`;
            const blkRes = await fetch(blkUrl, { headers: { Accept: 'application/json' } });
            if (blkRes.ok) {
              const blkJson = await blkRes.json();
              const items: any[] = Array.isArray(blkJson?.items) ? blkJson.items : [];
              for (const item of items) {
                if (String(item?.to?.hash || '').toLowerCase() !== walletAddress.toLowerCase()) continue;
                const dec = Number(item?.total?.decimals ?? item?.token?.decimals ?? 18);
                const rawVal = Number(item?.total?.value ?? 0);
                const amount = rawVal / 10 ** dec;
                const ts = item?.timestamp ? Math.floor(Date.parse(item.timestamp) / 1000) : 0;
                if (amount > 0 && ts > 0) {
                  inboundEvents.push({
                    hash: item.transaction_hash,
                    timestamp: ts,
                    amount,
                    estimatedPriceUsd: findHistoricalPrice(ts),
                  });
                }
              }
            }
          }
        }
      } else if (chain === 'robinhood') {
        if (!isValidEvmAddress(walletAddress)) {
          res.status(400).json({ error: 'Adresse Robinhood invalide.' });
          return;
        }

        const robinhoodKey = getRobinhoodAlchemyKey();
        if (!robinhoodKey) {
          res.json({
            chain: 'robinhood',
            source: 'unavailable',
            apiKeyMissing: true,
            apiKeyName: 'ROBINHOOD_ALCHEMY_API_KEY',
            error:
              'Clé API Alchemy Robinhood requise pour analyser l’historique des transactions Robinhood.',
            avgBuyPriceUsd: null,
            transactions: [],
          });
          return;
        }

        const rpcUrl = `${ROBINHOOD_ALCHEMY_BASE_URL}/${robinhoodKey}`;
        const transferParams: Record<string, any> = {
          fromBlock: '0x0',
          toBlock: 'latest',
          toAddress: walletAddress,
          category: isNative ? ['external'] : ['erc20'],
          withMetadata: true,
          excludeZeroValue: true,
          maxCount: '0x32',
          order: 'desc',
        };
        if (!isNative) {
          transferParams.contractAddresses = [tokenAddress];
        }

        try {
          const trRes = await rpcFetch(rpcUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getAssetTransfers',
            params: [transferParams],
          });
          const transfers: any[] = Array.isArray(trRes?.result?.transfers)
            ? trRes.result.transfers
            : [];
          for (const tr of transfers) {
            const amount = Number(tr?.value || 0);
            const tsMs = tr?.metadata?.blockTimestamp
              ? Date.parse(tr.metadata.blockTimestamp)
              : NaN;
            const ts = Number.isFinite(tsMs) ? Math.floor(tsMs / 1000) : 0;
            if (amount > 0 && ts > 0 && tr?.hash) {
              inboundEvents.push({
                hash: String(tr.hash),
                timestamp: ts,
                amount,
                estimatedPriceUsd: findHistoricalPrice(ts),
              });
            }
          }
        } catch {
          // ignore Alchemy transfers failure
        }
      } else {
        // Solana historical scan via Helius Enhanced Transactions API
        const heliusKey = getHeliusKey();
        if (!heliusKey) {
          res.json({
            chain: 'solana',
            source: 'unavailable',
            apiKeyMissing: true,
            apiKeyName: 'NEXT_PUBLIC_HELIUS_API_KEY',
            error: 'Clé API Helius requise pour analyser l’historique des transactions Solana.',
            avgBuyPriceUsd: null,
            transactions: [],
          });
          return;
        }

        const heliusTxUrl = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${heliusKey}&limit=40`;
        const hRes = await fetch(heliusTxUrl);
        if (hRes.ok) {
          const txList: any[] = await hRes.json();
          if (Array.isArray(txList)) {
            for (const tx of txList) {
              const ts = Number(tx?.timestamp || 0);
              if (isNative) {
                const nativeTransfers: any[] = Array.isArray(tx?.nativeTransfers)
                  ? tx.nativeTransfers
                  : [];
                for (const nt of nativeTransfers) {
                  if (nt.toUserAccount === walletAddress && Number(nt.amount) > 0) {
                    const solAmt = Number(nt.amount) / 1e9;
                    inboundEvents.push({
                      hash: tx.signature,
                      timestamp: ts,
                      amount: solAmt,
                      estimatedPriceUsd: findHistoricalPrice(ts),
                    });
                  }
                }
              } else {
                const tokenTransfers: any[] = Array.isArray(tx?.tokenTransfers)
                  ? tx.tokenTransfers
                  : [];
                for (const tt of tokenTransfers) {
                  if (
                    tt.mint === tokenAddress &&
                    tt.toUserAccount === walletAddress &&
                    Number(tt.tokenAmount) > 0
                  ) {
                    inboundEvents.push({
                      hash: tx.signature,
                      timestamp: ts,
                      amount: Number(tt.tokenAmount),
                      estimatedPriceUsd: findHistoricalPrice(ts),
                    });
                  }
                }
              }
            }
          }
        }
      }

      // Compute weighted average entry price across transactions that have historical price coverage
      let totalAmtWithPrice = 0;
      let totalCostUsd = 0;
      for (const ev of inboundEvents) {
        if (ev.estimatedPriceUsd !== null && ev.estimatedPriceUsd > 0) {
          totalAmtWithPrice += ev.amount;
          totalCostUsd += ev.amount * ev.estimatedPriceUsd;
        }
      }

      const avgBuyPriceUsd =
        totalAmtWithPrice > 0 ? totalCostUsd / totalAmtWithPrice : null;

      res.json({
        chain,
        source:
          chain === 'base'
            ? 'blockscout-basescan'
            : chain === 'robinhood'
              ? 'alchemy-robinhood'
              : 'helius',
        apiKeyMissing: false,
        apiKeyName: null,
        avgBuyPriceUsd,
        transactionsAnalyzed: inboundEvents.length,
        transactions: inboundEvents.slice(0, 15),
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors du calcul du prix moyen d’achat on-chain.',
      });
    }
  });

  app.get('/api/news', async (req, res) => {
    try {
      const symbol = typeof req.query.symbol === 'string' ? req.query.symbol : '';
      const name = typeof req.query.name === 'string' ? req.query.name : '';
      const categories =
        typeof req.query.categories === 'string' ? req.query.categories : '';
      const limit = Number(req.query.limit || 15);
      const force = req.query.force === 'true';

      const articles = await fetchCryptoCompareNews({
        symbol,
        name,
        categories,
        limit: Number.isFinite(limit) ? limit : 15,
        force,
      });

      res.json({
        source: 'cryptocompare',
        articles,
        fetchedAt: Date.now(),
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la récupération des actualités crypto.',
      });
    }
  });

  app.post('/api/news', async (req, res) => {
    try {
      const symbol = String(req.body?.symbol || '').trim();
      const name = String(req.body?.name || '').trim();
      const categories = String(req.body?.categories || '').trim();
      const limit = Number(req.body?.limit || 15);
      const force = Boolean(req.body?.force);

      const articles = await fetchCryptoCompareNews({
        symbol,
        name,
        categories,
        limit: Number.isFinite(limit) ? limit : 15,
        force,
      });

      res.json({
        source: 'cryptocompare',
        articles,
        fetchedAt: Date.now(),
      });
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la récupération des actualités crypto.',
      });
    }
  });

  app.post('/api/social/token-pulse', async (req, res) => {
    try {
      const chain = normalizeActiveChain(req.body?.chain);
      const rawAddress = String(req.body?.address || '').trim();
      const address = chain !== 'solana' ? rawAddress.toLowerCase() : rawAddress;
      const symbol = String(req.body?.symbol || '').trim();
      const name = String(req.body?.name || '').trim();
      const isNative = Boolean(req.body?.isNative);
      const force = Boolean(req.body?.force);

      if (!address && !symbol) {
        res.status(400).json({ error: 'Adresse ou symbole requis.' });
        return;
      }

      const cacheKey = `${chain}:${address}:${symbol.toUpperCase()}`;
      if (!force) {
        const cached = socialCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < SOCIAL_CACHE_TTL_MS) {
          res.json(cached.data);
          return;
        }
      }

      const geckoNetwork = chain;

      // 1. Fetch DexScreener token info (official socials/websites) + GeckoTerminal coin ID hint
      const [dexRes, gtTokenRes] = await Promise.allSettled([
        fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${address}`, {
          headers: { Accept: 'application/json' },
        }).then((r) => (r.ok ? r.json() : null)),
        fetch(
          `https://api.geckoterminal.com/api/v2/networks/${geckoNetwork}/tokens/${address}`,
          { headers: { Accept: 'application/json' } }
        ).then((r) => (r.ok ? r.json() : null)),
      ]);

      let topDexPair: any = null;
      if (dexRes.status === 'fulfilled' && dexRes.value) {
        const pairs = Array.isArray(dexRes.value)
          ? dexRes.value
          : Array.isArray(dexRes.value?.pairs)
            ? dexRes.value.pairs
            : [];
        topDexPair =
          pairs
            .filter((p: any) => p && p.chainId === chain)
            .sort(
              (a: any, b: any) =>
                Number(b?.liquidity?.usd ?? 0) - Number(a?.liquidity?.usd ?? 0)
            )[0] || null;
      }

      const gtCoinId: string | null =
        gtTokenRes.status === 'fulfilled'
          ? gtTokenRes.value?.data?.attributes?.coingecko_coin_id || null
          : null;

      // 2. Fetch CoinGecko Public API (/coins/{id} or /coins/{platform}/contract/{address})
      const cgParams =
        'localization=false&tickers=false&market_data=false&community_data=true&developer_data=true&sparkline=false';
      let cgData: any = null;

      const tryCoinGecko = async (url: string) => {
        try {
          const r = await fetch(url, { headers: { Accept: 'application/json' } });
          if (r.ok) return await r.json();
        } catch {
          // ignore
        }
        return null;
      };

      if (isNative) {
        const nativeId = chain === 'solana' ? 'solana' : 'ethereum';
        cgData = await tryCoinGecko(
          `https://api.coingecko.com/api/v3/coins/${nativeId}?${cgParams}`
        );
      } else {
        if (gtCoinId) {
          cgData = await tryCoinGecko(
            `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(gtCoinId)}?${cgParams}`
          );
        }
        if (!cgData && address) {
          const platform = chain;
          cgData = await tryCoinGecko(
            `https://api.coingecko.com/api/v3/coins/${platform}/contract/${address}?${cgParams}`
          );
        }
      }

      // Merge official verified links from CoinGecko & DexScreener
      const websiteSet = new Set<string>();
      const dexWebsites: Array<{ label: string; url: string }> = Array.isArray(
        topDexPair?.info?.websites
      )
        ? topDexPair.info.websites
        : [];
      for (const w of dexWebsites) {
        if (w?.url) websiteSet.add(w.url);
      }
      const cgHomepages: string[] = Array.isArray(cgData?.links?.homepage)
        ? cgData.links.homepage
        : [];
      for (const hp of cgHomepages) {
        if (hp && typeof hp === 'string' && hp.startsWith('http')) websiteSet.add(hp);
      }

      const dexSocials: Array<{ type: string; url: string }> = Array.isArray(
        topDexPair?.info?.socials
      )
        ? topDexPair.info.socials
        : [];

      const findDexSocial = (type: string): string | null =>
        dexSocials.find((s) => s?.type?.toLowerCase() === type)?.url || null;

      const cgTwitter = cgData?.links?.twitter_screen_name
        ? `https://x.com/${cgData.links.twitter_screen_name}`
        : null;
      const cgTelegram = cgData?.links?.telegram_channel_identifier
        ? `https://t.me/${cgData.links.telegram_channel_identifier}`
        : null;
      const cgDiscord = Array.isArray(cgData?.links?.chat_url)
        ? cgData.links.chat_url.find((u: string) => u && u.includes('discord')) || null
        : null;
      const cgGithub = Array.isArray(cgData?.links?.repos_url?.github)
        ? cgData.links.repos_url.github.find((u: string) => Boolean(u)) || null
        : null;
      const cgReddit =
        typeof cgData?.links?.subreddit_url === 'string' && cgData.links.subreddit_url
          ? cgData.links.subreddit_url
          : null;

      const officialLinks = {
        website: Array.from(websiteSet)[0] || null,
        twitter: cgTwitter || findDexSocial('twitter'),
        telegram: cgTelegram || findDexSocial('telegram'),
        discord: cgDiscord || findDexSocial('discord'),
        github: cgGithub || findDexSocial('github'),
        reddit: cgReddit,
        coingeckoUrl: cgData?.id
          ? `https://www.coingecko.com/en/coins/${cgData.id}`
          : null,
      };

      // 3 & 4. Fetch Reddit Public JSON + CryptoCompare Public News in parallel (zero API keys)
      const searchTerm = (symbol || name).replace(/[^a-zA-Z0-9\s]/g, '').trim();
      const redditQuery = encodeURIComponent(
        name && name.toLowerCase() !== searchTerm.toLowerCase()
          ? `${searchTerm} crypto OR ${name}`
          : `${searchTerm} crypto`
      );

      const fetchRedditPosts = async () => {
        const posts: Array<{
          id: string;
          title: string;
          subreddit: string;
          url: string;
          createdAt: number;
          score: number;
          upvoteRatio: number | null;
          numComments: number;
        }> = [];
        if (!searchTerm) return posts;
        try {
          const redditRes = await fetch(
            `https://www.reddit.com/search.json?q=${redditQuery}&sort=new&limit=15&t=month`,
            {
              headers: {
                Accept: 'application/json',
                'User-Agent': 'MeridianWeb3Portfolio/1.0 (read-only market research)',
              },
            }
          );
          if (redditRes.ok) {
            const rJson = await redditRes.json();
            const children: any[] = rJson?.data?.children || [];
            for (const child of children) {
              const p = child?.data;
              if (!p?.title) continue;
              const rawRatio = Number(p.upvote_ratio);
              posts.push({
                id: String(p.id || p.permalink),
                title: String(p.title),
                subreddit: String(p.subreddit_name_prefixed || `r/${p.subreddit || 'crypto'}`),
                url: `https://www.reddit.com${p.permalink || ''}`,
                createdAt: Number(p.created_utc || 0) * 1000,
                score: Number(p.score ?? 0),
                upvoteRatio: Number.isFinite(rawRatio) ? rawRatio : null,
                numComments: Number(p.num_comments ?? 0),
              });
            }
          }
        } catch {
          // ignore reddit transient errors
        }
        return posts;
      };

      const [redditRes, newsRes] = await Promise.allSettled([
        fetchRedditPosts(),
        fetchCryptoCompareNews({ symbol, name, limit: 15, force }),
      ]);

      const redditPosts = redditRes.status === 'fulfilled' ? redditRes.value : [];
      const news = newsRes.status === 'fulfilled' ? newsRes.value : [];

      const numOrNull = (v: unknown): number | null => {
        if (v === null || v === undefined || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        chain,
        address,
        symbol,
        name,
        coingeckoId: cgData?.id || gtCoinId || null,
        categories: Array.isArray(cgData?.categories)
          ? cgData.categories.filter((c: unknown) => typeof c === 'string' && c.length > 0)
          : [],
        officialLinks,
        coingeckoSentiment: {
          votesUpPercent: numOrNull(cgData?.sentiment_votes_up_percentage),
          votesDownPercent: numOrNull(cgData?.sentiment_votes_down_percentage),
          watchlistUsers: numOrNull(cgData?.watchlist_portfolio_users),
        },
        communityMetrics: {
          twitterFollowers: numOrNull(cgData?.community_data?.twitter_followers),
          redditSubscribers: numOrNull(cgData?.community_data?.reddit_subscribers),
          redditAvgPosts48h: numOrNull(cgData?.community_data?.reddit_average_posts_48h),
          redditAvgComments48h: numOrNull(cgData?.community_data?.reddit_average_comments_48h),
          telegramUsers: numOrNull(cgData?.community_data?.telegram_channel_user_count),
        },
        developerActivity: {
          githubStars: numOrNull(cgData?.developer_data?.stars),
          githubForks: numOrNull(cgData?.developer_data?.forks),
          commits4Weeks: numOrNull(cgData?.developer_data?.commit_count_4_weeks),
          pullRequestsMerged: numOrNull(cgData?.developer_data?.pull_requests_merged),
          closedIssues: numOrNull(cgData?.developer_data?.closed_issues),
        },
        redditPosts,
        news,
        fetchedAt: Date.now(),
      };

      socialCache.set(cacheKey, { timestamp: Date.now(), data: payload });
      res.json(payload);
    } catch (error: any) {
      res.status(502).json({
        error: error?.message || 'Erreur lors de la récupération des données sociales.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
