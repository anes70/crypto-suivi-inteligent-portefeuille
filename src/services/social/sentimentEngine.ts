import type {
  NarrativeAffinity,
  NarrativeCategory,
  SentimentLabel,
  SocialFeedEntry,
  SocialPulseAnalysis,
  SocialPulsePayload,
} from '../../types/social';

const POSITIVE_TERMS = [
  'bull',
  'bullish',
  'rally',
  'breakout',
  'surge',
  'soar',
  'ath',
  'partnership',
  'partner',
  'launch',
  'launched',
  'mainnet',
  'upgrade',
  'adoption',
  'growth',
  'accumulate',
  'buy',
  'listing',
  'listed',
  'approved',
  'milestone',
  'haussier',
  'croissance',
  'partenariat',
  'lancement',
  'record',
  'adoption',
];

const NEGATIVE_TERMS = [
  'bear',
  'bearish',
  'dump',
  'crash',
  'plunge',
  'drop',
  'rug',
  'scam',
  'fraud',
  'hack',
  'hacked',
  'exploit',
  'drain',
  'vulnerability',
  'lawsuit',
  'sec',
  'ban',
  'delist',
  'insolvency',
  'bankrupt',
  'warning',
  'baissier',
  'chute',
  'arnaque',
  'piratage',
  'faille',
];

const NARRATIVE_KEYWORDS: Record<NarrativeCategory, string[]> = {
  AI: [
    'ai',
    'artificial intelligence',
    'agent',
    'agents',
    'llm',
    'neural',
    'compute',
    'gpu',
    'inference',
    'virtuals',
    'autonomous',
    'machine learning',
    'bittensor',
    'depin',
  ],
  DeFi: [
    'defi',
    'dex',
    'amm',
    'swap',
    'liquidity',
    'yield',
    'staking',
    'lending',
    'borrow',
    'vault',
    'perp',
    'perpetual',
    'tvl',
    'restaking',
    'lrt',
    'stablecoin',
    'aerodrome',
    'uniswap',
    'raydium',
    'jupiter',
  ],
  Memecoin: [
    'meme',
    'memes',
    'memecoin',
    'dog',
    'cat',
    'frog',
    'pepe',
    'doge',
    'shib',
    'bonk',
    'wif',
    'brett',
    'degen',
    'toshi',
    'pump',
    'community coin',
    'humor',
  ],
  Gaming: [
    'gaming',
    'gamefi',
    'game',
    'metaverse',
    'play-to-earn',
    'p2e',
    'esports',
    'rpg',
    'guild',
    'nft game',
    'avatar',
    'arcade',
    'studio',
  ],
};

function classifyTextSentiment(
  text: string,
  extraPositive = 0,
  extraNegative = 0
): SentimentLabel {
  const lower = text.toLowerCase();
  let score = extraPositive - extraNegative;

  for (const term of POSITIVE_TERMS) {
    if (lower.includes(term)) score += 1;
  }
  for (const term of NEGATIVE_TERMS) {
    if (lower.includes(term)) score -= 1;
  }

  if (score > 0) return 'Positif';
  if (score < 0) return 'Négatif';
  return 'Neutre';
}

export function analyzeSocialPulse(payload: SocialPulsePayload): SocialPulseAnalysis {
  const feed: SocialFeedEntry[] = [];
  let posCount = 0;
  let neuCount = 0;
  let negCount = 0;

  for (const news of payload.news) {
    const sentiment = classifyTextSentiment(`${news.title} ${news.body}`);
    if (sentiment === 'Positif') posCount += 1;
    else if (sentiment === 'Négatif') negCount += 1;
    else neuCount += 1;

    feed.push({
      id: `cc:${news.id}`,
      source: 'CryptoCompare',
      channel: news.source,
      title: news.title,
      body: news.body,
      imageUrl: news.imageUrl,
      url: news.url,
      publishedAt: news.publishedAt,
      sentiment,
      engagementText: news.categories
        ? news.categories.split('|').slice(0, 2).join(' · ')
        : 'Actualité vérifiée',
    });
  }

  for (const post of payload.redditPosts) {
    // Factor in upvote_ratio when analyzing Reddit sentiment
    const ratioPos =
      post.upvoteRatio !== null && post.upvoteRatio >= 0.72 ? 1 : 0;
    const ratioNeg =
      post.upvoteRatio !== null && post.upvoteRatio <= 0.45 ? 1 : 0;

    const sentiment = classifyTextSentiment(post.title, ratioPos, ratioNeg);
    if (sentiment === 'Positif') posCount += 1;
    else if (sentiment === 'Négatif') negCount += 1;
    else neuCount += 1;

    const ratioLabel =
      post.upvoteRatio !== null
        ? ` · ${Math.round(post.upvoteRatio * 100)}% upvotes`
        : '';

    feed.push({
      id: `rd:${post.id}`,
      source: 'Reddit',
      channel: post.subreddit,
      title: post.title,
      url: post.url,
      publishedAt: post.createdAt,
      sentiment,
      engagementText: `${post.score} pts · ${post.numComments} comm.${ratioLabel}`,
      upvoteRatio: post.upvoteRatio,
    });
  }

  feed.sort((a, b) => b.publishedAt - a.publishedAt);

  // Combine feed sentiment with CoinGecko community votes when available
  let positivePct = 0;
  let neutralPct = 0;
  let negativePct = 0;

  const totalFeed = posCount + neuCount + negCount;
  const cgUp = payload.coingeckoSentiment.votesUpPercent;
  const cgDown = payload.coingeckoSentiment.votesDownPercent;

  if (totalFeed > 0 && cgUp !== null && cgDown !== null) {
    const feedPos = (posCount / totalFeed) * 100;
    const feedNeu = (neuCount / totalFeed) * 100;
    const feedNeg = (negCount / totalFeed) * 100;
    const cgNeu = Math.max(0, 100 - cgUp - cgDown);

    // 70% discussions/news + 30% CoinGecko community votes
    positivePct = feedPos * 0.7 + cgUp * 0.3;
    neutralPct = feedNeu * 0.7 + cgNeu * 0.3;
    negativePct = feedNeg * 0.7 + cgDown * 0.3;
  } else if (totalFeed > 0) {
    positivePct = (posCount / totalFeed) * 100;
    neutralPct = (neuCount / totalFeed) * 100;
    negativePct = (negCount / totalFeed) * 100;
  } else if (cgUp !== null && cgDown !== null) {
    positivePct = cgUp;
    negativePct = cgDown;
    neutralPct = Math.max(0, 100 - cgUp - cgDown);
  }

  let sentimentLabel: SentimentLabel = 'Neutre';
  if (totalFeed > 0 || cgUp !== null) {
    if (positivePct > negativePct + 10) sentimentLabel = 'Positif';
    else if (negativePct > positivePct + 10) sentimentLabel = 'Négatif';
  }

  // Transparent Buzz Index (0-100) from real observed activity
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const recentReddit = payload.redditPosts.filter(
    (p) => now - p.createdAt <= sevenDaysMs
  );
  const redditEngagement = recentReddit.reduce(
    (acc, p) => acc + Math.max(0, p.score) + p.numComments * 2,
    0
  );
  const watchlistUsers = payload.coingeckoSentiment.watchlistUsers ?? 0;
  const newsCount = payload.news.length;
  const commits4w = payload.developerActivity.commits4Weeks ?? 0;

  let buzzRaw = 0;
  buzzRaw += Math.min(35, recentReddit.length * 3 + Math.log10(1 + redditEngagement) * 8);
  buzzRaw += Math.min(30, watchlistUsers > 0 ? Math.log10(1 + watchlistUsers) * 6 : 0);
  buzzRaw += Math.min(20, newsCount * 2.5);
  buzzRaw += Math.min(15, commits4w > 0 ? Math.log10(1 + commits4w) * 7 : 0);

  const buzzIndex = Math.round(Math.min(100, buzzRaw));
  const buzzLabel =
    buzzIndex >= 75
      ? 'Élevé'
      : buzzIndex >= 45
        ? 'Soutenu'
        : buzzIndex >= 20
          ? 'Modéré'
          : 'Calme';

  // Narrative index (AI, DeFi, Memecoin, Gaming)
  const corpus = [
    payload.symbol,
    payload.name,
    ...payload.categories,
    ...feed.slice(0, 12).map((f) => `${f.title} ${f.body || ''}`),
  ]
    .join(' ')
    .toLowerCase();

  const narratives: NarrativeAffinity[] = (
    ['AI', 'DeFi', 'Memecoin', 'Gaming'] as NarrativeCategory[]
  ).map((narrative) => {
    const keywords = NARRATIVE_KEYWORDS[narrative];
    const matchedKeywords: string[] = [];
    let hits = 0;

    for (const kw of keywords) {
      if (corpus.includes(kw)) {
        matchedKeywords.push(kw);
        // Stronger weight if matched inside CoinGecko official categories or token name
        const inCategories = payload.categories.some((c) =>
          c.toLowerCase().includes(kw)
        );
        hits += inCategories ? 35 : 15;
      }
    }

    return {
      narrative,
      score: Math.min(100, hits),
      matchedKeywords: matchedKeywords.slice(0, 4),
    };
  });

  const sortedNarratives = [...narratives].sort((a, b) => b.score - a.score);
  const dominantNarrative =
    sortedNarratives[0] && sortedNarratives[0].score >= 25
      ? sortedNarratives[0].narrative
      : 'Infrastructure / Autre';

  return {
    sentimentLabel,
    positivePct,
    neutralPct,
    negativePct,
    buzzIndex,
    buzzLabel,
    dominantNarrative,
    narratives,
    feed,
  };
}
