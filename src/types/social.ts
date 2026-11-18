import type { ActiveChainId } from './chain';

export interface OfficialLinks {
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  discord: string | null;
  github: string | null;
  reddit: string | null;
  coingeckoUrl: string | null;
}

export interface CoinGeckoSentiment {
  votesUpPercent: number | null;
  votesDownPercent: number | null;
  watchlistUsers: number | null;
}

export interface CommunityMetrics {
  twitterFollowers: number | null;
  redditSubscribers: number | null;
  redditAvgPosts48h: number | null;
  redditAvgComments48h: number | null;
  telegramUsers: number | null;
}

export interface DeveloperActivity {
  githubStars: number | null;
  githubForks: number | null;
  commits4Weeks: number | null;
  pullRequestsMerged: number | null;
  closedIssues: number | null;
}

export interface RedditPostItem {
  id: string;
  title: string;
  subreddit: string;
  url: string;
  createdAt: number;
  score: number;
  upvoteRatio: number | null;
  numComments: number;
}

export interface CryptoCompareNewsItem {
  id: string;
  title: string;
  body: string;
  source: string;
  url: string;
  imageUrl: string | null;
  publishedAt: number;
  categories: string;
}

export interface SocialPulsePayload {
  chain: ActiveChainId;
  address: string;
  symbol: string;
  name: string;
  coingeckoId: string | null;
  categories: string[];
  officialLinks: OfficialLinks;
  coingeckoSentiment: CoinGeckoSentiment;
  communityMetrics: CommunityMetrics;
  developerActivity: DeveloperActivity;
  redditPosts: RedditPostItem[];
  news: CryptoCompareNewsItem[];
  fetchedAt: number;
}

export type SentimentLabel = 'Positif' | 'Neutre' | 'Négatif';
export type NarrativeCategory = 'AI' | 'DeFi' | 'Memecoin' | 'Gaming';

export interface NarrativeAffinity {
  narrative: NarrativeCategory;
  score: number; // 0-100
  matchedKeywords: string[];
}

export interface SocialFeedEntry {
  id: string;
  source: 'Reddit' | 'CryptoCompare';
  channel: string;
  title: string;
  body?: string;
  imageUrl?: string | null;
  url: string;
  publishedAt: number;
  sentiment: SentimentLabel;
  engagementText: string;
  upvoteRatio?: number | null;
}

export interface SocialPulseAnalysis {
  sentimentLabel: SentimentLabel;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  buzzIndex: number; // 0-100
  buzzLabel: 'Calme' | 'Modéré' | 'Soutenu' | 'Élevé';
  dominantNarrative: NarrativeCategory | 'Infrastructure / Autre';
  narratives: NarrativeAffinity[];
  feed: SocialFeedEntry[];
}
