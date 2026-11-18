import type { DustFilterStats, TokenHolding } from '../../types/portfolio';

export const DEFAULT_DUST_THRESHOLD_USD = 0.01;

/**
 * Règle critique : Filtrer automatiquement les tokens à solde nul ou poussière (< 0.01$)
 * pour qu'un token vendu disparaisse immédiatement à l'actualisation.
 */
export function filterZeroAndDustTokens(
  holdings: TokenHolding[],
  thresholdUsd = DEFAULT_DUST_THRESHOLD_USD
): {
  visible: TokenHolding[];
  stats: DustFilterStats;
} {
  const effectiveThreshold = Math.max(0.01, thresholdUsd);
  const visible: TokenHolding[] = [];

  for (const token of holdings) {
    if (!Number.isFinite(token.balance) || token.balance <= 0) {
      continue;
    }

    if (token.priceUsd === null || !Number.isFinite(token.valueUsd) || token.valueUsd < effectiveThreshold) {
      continue;
    }

    visible.push(token);
  }

  visible.sort((a, b) => b.valueUsd - a.valueUsd);

  return {
    visible,
    stats: {
      totalRawCount: holdings.length,
      filteredZeroOrDustCount: holdings.length - visible.length,
      thresholdUsd: effectiveThreshold,
    },
  };
}
