import type { ActiveChainId } from '../../types/chain';
import type {
  SocialPulseAnalysis,
  SocialPulsePayload,
} from '../../types/social';
import { analyzeSocialPulse } from './sentimentEngine';

export interface TokenSocialPulseResult {
  payload: SocialPulsePayload;
  analysis: SocialPulseAnalysis;
}

export async function fetchTokenSocialPulse(params: {
  chain: ActiveChainId;
  address: string;
  symbol: string;
  name: string;
  isNative: boolean;
  force?: boolean;
}): Promise<TokenSocialPulseResult> {
  const res = await fetch('/api/social/token-pulse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || 'Impossible de charger les données sociales.');
  }

  const payload = data as SocialPulsePayload;
  const analysis = analyzeSocialPulse(payload);
  return { payload, analysis };
}
