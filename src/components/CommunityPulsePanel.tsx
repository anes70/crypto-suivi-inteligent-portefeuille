import { useState } from 'react';
import {
  ExternalLink,
  Flame,
  GitBranch,
  Globe,
  MessageSquare,
  RefreshCw,
  Star,
  Users,
} from 'lucide-react';
import type {
  SocialPulseAnalysis,
  SocialPulsePayload,
} from '../types/social';
import { formatRelativeTime } from '../utils/format';

interface CommunityPulsePanelProps {
  payload: SocialPulsePayload | null;
  analysis: SocialPulseAnalysis | null;
  isLoading: boolean;
  error: string | null;
  onRefresh: () => void;
}

type FeedFilter = 'all' | 'news' | 'reddit';

function formatCompactCount(val: number | null): string {
  if (val === null || !Number.isFinite(val)) return '—';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}k`;
  return val.toLocaleString('fr-FR');
}

export function CommunityPulsePanel({
  payload,
  analysis,
  isLoading,
  error,
  onRefresh,
}: CommunityPulsePanelProps) {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all');

  if (isLoading && !payload) {
    return (
      <div className="space-y-4">
        <div className="h-32 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <div className="xl:col-span-5 h-64 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
          <div className="xl:col-span-7 h-64 rounded-xl bg-slate-100/70 dark:bg-slate-800/40 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="glass-panel rounded-xl p-6 text-center space-y-3">
        <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Réessayer</span>
        </button>
      </div>
    );
  }

  if (!payload || !analysis) return null;

  const links = [
    { key: 'website', label: 'Site officiel', url: payload.officialLinks.website },
    { key: 'twitter', label: 'X / Twitter', url: payload.officialLinks.twitter },
    { key: 'telegram', label: 'Telegram', url: payload.officialLinks.telegram },
    { key: 'discord', label: 'Discord', url: payload.officialLinks.discord },
    { key: 'github', label: 'GitHub', url: payload.officialLinks.github },
    { key: 'reddit', label: 'Reddit', url: payload.officialLinks.reddit },
    { key: 'coingecko', label: 'CoinGecko', url: payload.officialLinks.coingeckoUrl },
  ].filter((item): item is { key: string; label: string; url: string } => Boolean(item.url));

  const cgVotesUp = payload.coingeckoSentiment.votesUpPercent;
  const cgVotesDown = payload.coingeckoSentiment.votesDownPercent;

  const newsCount = analysis.feed.filter((item) => item.source === 'CryptoCompare').length;
  const redditCount = analysis.feed.filter((item) => item.source === 'Reddit').length;

  const visibleFeed = analysis.feed.filter((item) => {
    if (feedFilter === 'news') return item.source === 'CryptoCompare';
    if (feedFilter === 'reddit') return item.source === 'Reddit';
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Top Grid: Sentiment, Buzz, Narrative, Official Links */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Left 5 cols: Sentiment + Buzz + Narrative */}
        <div className="xl:col-span-5 space-y-5">
          {/* Sentiment & Buzz Card */}
          <section className="glass-panel rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Pouls Communautaire &amp; Sentiment
              </h2>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Actualiser</span>
              </button>
            </div>

            {/* Discussions & News Sentiment Bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-slate-600 dark:text-slate-300 font-medium">
                  Sentiment discussions &amp; news
                </span>
                <span
                  className={`font-mono font-semibold ${
                    analysis.sentimentLabel === 'Positif'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : analysis.sentimentLabel === 'Négatif'
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {analysis.sentimentLabel}
                </span>
              </div>

              <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                {analysis.positivePct + analysis.neutralPct + analysis.negativePct > 0 && (
                  <>
                    <div
                      className="h-full bg-emerald-500"
                      style={{ width: `${analysis.positivePct}%` }}
                      title={`Positif: ${analysis.positivePct.toFixed(0)}%`}
                    />
                    <div
                      className="h-full bg-slate-400 dark:bg-slate-500"
                      style={{ width: `${analysis.neutralPct}%` }}
                      title={`Neutre: ${analysis.neutralPct.toFixed(0)}%`}
                    />
                    <div
                      className="h-full bg-rose-500"
                      style={{ width: `${analysis.negativePct}%` }}
                      title={`Négatif: ${analysis.negativePct.toFixed(0)}%`}
                    />
                  </>
                )}
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <span className="text-emerald-600 dark:text-emerald-400">
                  Positif {analysis.positivePct.toFixed(0)}%
                </span>
                <span>Neutre {analysis.neutralPct.toFixed(0)}%</span>
                <span className="text-rose-600 dark:text-rose-400">
                  Négatif {analysis.negativePct.toFixed(0)}%
                </span>
              </div>
            </div>

            {/* CoinGecko Community Votes (Bullish vs Bearish) */}
            {cgVotesUp !== null && cgVotesDown !== null && (
              <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-slate-600 dark:text-slate-300 font-medium">
                    Votes CoinGecko (Haussier vs Baissier)
                  </span>
                  <span className="font-mono text-slate-800 dark:text-slate-200 tabular-nums">
                    {cgVotesUp.toFixed(0)}% / {cgVotesDown.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${cgVotesUp}%` }}
                  />
                  <div
                    className="h-full bg-rose-500"
                    style={{ width: `${cgVotesDown}%` }}
                  />
                </div>
              </div>
            )}

            {/* Buzz Index */}
            <div className="pt-4 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
                  <Flame className="w-3.5 h-3.5 text-amber-500" />
                  <span>Indice de Buzz social</span>
                </span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
                  {analysis.buzzIndex} / 100 · {analysis.buzzLabel}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all"
                  style={{ width: `${analysis.buzzIndex}%` }}
                />
              </div>
            </div>
          </section>

          {/* Indice de Narration (AI, DeFi, Memecoin, Gaming) */}
          <section className="glass-panel rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Indice de Narration
              </h2>
              <span className="text-xs font-mono text-blue-600 dark:text-blue-400">
                {analysis.dominantNarrative}
              </span>
            </div>

            <div className="space-y-3">
              {analysis.narratives.map((item) => (
                <div key={item.narrative}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {item.narrative}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {item.score}%
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Official Links & Community / GitHub Stats */}
          <section className="glass-panel rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Liens vérifiés, Communauté &amp; GitHub
            </h2>

            {links.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <a
                    key={l.key}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-900/70 text-slate-700 dark:text-slate-200 hover:border-blue-500/50 transition-colors"
                  >
                    <Globe className="w-3 h-3 text-slate-400" />
                    <span>{l.label}</span>
                    <ExternalLink className="w-3 h-3 text-slate-400" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Aucun lien officiel indexé sur CoinGecko ou DexScreener pour ce contrat.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>Watchlists CoinGecko</span>
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCompactCount(payload.coingeckoSentiment.watchlistUsers)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <MessageSquare className="w-3 h-3" />
                  <span>Abonnés Reddit / TG</span>
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCompactCount(
                    payload.communityMetrics.redditSubscribers ??
                      payload.communityMetrics.telegramUsers
                  )}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <GitBranch className="w-3 h-3" />
                  <span>Commits GitHub (4 sem.)</span>
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCompactCount(payload.developerActivity.commits4Weeks)}
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  <Star className="w-3 h-3" />
                  <span>Étoiles GitHub</span>
                </div>
                <div className="mt-1 font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCompactCount(payload.developerActivity.githubStars)}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right 7 cols: Real-time Discussions & News Feed */}
        <section className="xl:col-span-7 glass-panel rounded-xl overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Flux d&apos;actualités &amp; discussions en temps réel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Sources publiques : CryptoCompare News &amp; Reddit JSON (sans clé API)
              </p>
            </div>

            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60">
              <button
                type="button"
                onClick={() => setFeedFilter('all')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  feedFilter === 'all'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Tout ({analysis.feed.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('news')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  feedFilter === 'news'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Actualités ({newsCount})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter('reddit')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  feedFilter === 'reddit'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Reddit ({redditCount})
              </button>
            </div>
          </div>

          {visibleFeed.length === 0 ? (
            <div className="p-10 text-center flex-1 flex flex-col items-center justify-center">
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Aucun élément récent trouvé pour {payload.symbol}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md">
                Les actualités CryptoCompare ou discussions Reddit publiques mentionnant cet actif apparaîtront ici dès qu&apos;elles seront publiées.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800/70 max-h-[680px] overflow-y-auto">
              {visibleFeed.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-4 sm:px-5 hover:bg-slate-50/80 dark:hover:bg-slate-800/35 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3.5">
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                        className="w-16 h-12 rounded-lg object-cover shrink-0 border border-slate-200/70 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-900"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {item.source === 'CryptoCompare' ? 'Actualités' : 'Reddit'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.channel}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatRelativeTime(item.publishedAt)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{item.engagementText}</span>
                      </div>

                      <h3 className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100 leading-snug">
                        {item.title}
                      </h3>

                      {item.body && (
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {item.body}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono text-[11px] font-medium ${
                          item.sentiment === 'Positif'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.sentiment === 'Négatif'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {item.sentiment}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
