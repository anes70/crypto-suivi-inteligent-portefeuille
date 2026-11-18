import type {
  AiTokenAnalysis,
  AnalyzeTokenPayload,
} from '../../types/ai';

export class MissingAiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MissingAiKeyError';
  }
}

export async function runQuantitativeAiAnalysis(
  payload: AnalyzeTokenPayload
): Promise<AiTokenAnalysis> {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (data?.apiKeyMissing) {
    throw new MissingAiKeyError(
      data?.error ||
        'Aucune clé API IA (GROQ_API_KEY ou GEMINI_API_KEY) configurée.'
    );
  }

  if (!res.ok || !data?.analysis) {
    throw new Error(
      data?.error || "Impossible d'exécuter l'analyse quantitative IA."
    );
  }

  return data.analysis as AiTokenAnalysis;
}
