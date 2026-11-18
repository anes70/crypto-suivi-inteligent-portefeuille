import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AiDecision,
  AiHorizon,
  AiProvider,
  AiTokenAnalysis,
  AnalyzeTokenPayload,
} from '../src/types/ai';

const VALID_DECISIONS: AiDecision[] = [
  'CONSERVER',
  'RENFORCER',
  'VENDRE',
  'PRENDRE PROFITS',
  'ATTENDRE',
  'ÉVITER',
];

const VALID_HORIZONS: AiHorizon[] = [
  'Court terme',
  'Moyen terme',
  'Long terme',
];

const GROQ_MODEL = 'llama-3.3-70b-versatile';
const GEMINI_MODEL = 'gemini-2.5-flash';

export function getGroqApiKey(): string {
  return (process.env.GROQ_API_KEY || '').trim();
}

export function getGeminiApiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function clampScore(value: unknown, fallback = 50): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function toPositivePrice(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return num;
}

function normalizeDecision(raw: unknown): AiDecision {
  const upper = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/_/g, ' ');
  if (upper === 'EVITER') return 'ÉVITER';
  const match = VALID_DECISIONS.find((d) => d === upper);
  return match ?? 'ATTENDRE';
}

function normalizeHorizon(raw: unknown): AiHorizon {
  const lower = String(raw || '').trim().toLowerCase();
  if (lower.includes('court')) return 'Court terme';
  if (lower.includes('long')) return 'Long terme';
  if (lower.includes('moyen')) return 'Moyen terme';
  const exact = VALID_HORIZONS.find((h) => h.toLowerCase() === lower);
  return exact ?? 'Moyen terme';
}

function extractJsonObject(rawText: string): any {
  const trimmed = rawText.trim();
  const unfenced = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    const firstBrace = unfenced.indexOf('{');
    const lastBrace = unfenced.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(unfenced.slice(firstBrace, lastBrace + 1));
    }
    throw new Error('Réponse IA non conforme au format JSON strict.');
  }
}

function normalizeAiOutput(
  parsed: any,
  currentPriceUsd: number,
  provider: AiProvider,
  model: string
): AiTokenAnalysis {
  const safePrice = currentPriceUsd > 0 ? currentPriceUsd : 1;

  const rawBuyMin = toPositivePrice(
    parsed?.priceLevels?.idealBuyZone?.minUsd,
    safePrice * 0.9
  );
  const rawBuyMax = toPositivePrice(
    parsed?.priceLevels?.idealBuyZone?.maxUsd,
    safePrice * 0.96
  );

  const rawDangerMin = toPositivePrice(
    parsed?.priceLevels?.dangerZone?.minUsd,
    safePrice * 0.78
  );
  const rawDangerMax = toPositivePrice(
    parsed?.priceLevels?.dangerZone?.maxUsd,
    safePrice * 0.85
  );

  const reasoningRaw: unknown[] = Array.isArray(parsed?.reasoning)
    ? parsed.reasoning
    : [];
  const reasoning = reasoningRaw
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);

  if (reasoning.length < 3) {
    throw new Error(
      'Le moteur IA a renvoyé moins de 3 points de raisonnement factuels.'
    );
  }

  return {
    id: randomUUID(),
    decision: normalizeDecision(parsed?.decision),
    summary: String(parsed?.summary || '').trim(),
    scores: {
      confidence: clampScore(parsed?.scores?.confidence, 50),
      risk: clampScore(parsed?.scores?.risk, 50),
      potential: clampScore(parsed?.scores?.potential, 50),
      reinforcementStrength: clampScore(
        parsed?.scores?.reinforcementStrength,
        40
      ),
      horizon: normalizeHorizon(parsed?.scores?.horizon),
    },
    priceLevels: {
      targetPriceUsd: toPositivePrice(
        parsed?.priceLevels?.targetPriceUsd,
        safePrice * 1.15
      ),
      takeProfitUsd: toPositivePrice(
        parsed?.priceLevels?.takeProfitUsd,
        safePrice * 1.2
      ),
      stopLossUsd: toPositivePrice(
        parsed?.priceLevels?.stopLossUsd,
        safePrice * 0.88
      ),
      idealBuyZone: {
        minUsd: Math.min(rawBuyMin, rawBuyMax),
        maxUsd: Math.max(rawBuyMin, rawBuyMax),
      },
      dangerZone: {
        minUsd: Math.min(rawDangerMin, rawDangerMax),
        maxUsd: Math.max(rawDangerMin, rawDangerMax),
      },
    },
    reasoning,
    provider,
    model,
    generatedAt: Date.now(),
    priceAtAnalysisUsd: currentPriceUsd,
  };
}

function buildSystemInstruction(): string {
  return [
    'Tu es un analyste quantitatif crypto senior (institutionnel DeFi & On-Chain) travaillant sur des données réelles de marché.',
    'Tu dois analyser objectivement les métriques fournies (On-Chain, Technique, PnL de la position, Social & Sentiment) sans jamais inventer de chiffres absents du payload.',
    'Si une donnée vaut null, indique simplement que la métrique est indisponible plutôt que de fabriquer une valeur.',
    'Tu dois répondre EXCLUSIVEMENT en français et EXCLUSIVEMENT par un objet JSON valide respectant strictement le schéma demandé.',
    'Règles pour les décisions :',
    '- CONSERVER : position saine avec tendance neutre/haussière modérée ou PnL positif sans excès.',
    '- RENFORCER : forte confluence technique + pression acheteuse on-chain + liquidité solide.',
    '- PRENDRE PROFITS : ROI fortement positif et RSI en surachat ou approche de résistance majeure.',
    '- VENDRE : dégradation technique nette + pression vendeuse + perte de support clé.',
    '- ATTENDRE : signaux mixtes ou manque de catalyseur avant d’engager davantage de capital.',
    '- ÉVITER : liquidité critique, déséquilibre vendeur sévère ou profil de risque extrême.',
    'Règles pour les niveaux de prix : tous les prix doivent être des nombres positifs réalistes exprimés en USD et cohérents avec currentPriceUsd, les supports/résistances, les bandes de Bollinger et l’ATR fournis.',
    'Règles pour le raisonnement : fournis entre 3 et 5 points factuels précis citant explicitement les chiffres réels reçus (ex: liquidité en $, RSI(14), volume 24h, pression acheteuse %, ROI %, score de sentiment ou buzz).',
  ].join('\n');
}

function buildUserPrompt(payload: AnalyzeTokenPayload): string {
  return [
    `Analyse quantitative complète pour l'actif ${payload.token.name} (${payload.token.symbol}) sur ${payload.token.chain.toUpperCase()}.`,
    'Données réelles collectées :',
    JSON.stringify(payload, null, 2),
    '',
    'Retourne exactement un objet JSON avec la structure suivante :',
    JSON.stringify(
      {
        decision:
          'CONSERVER | RENFORCER | VENDRE | PRENDRE PROFITS | ATTENDRE | ÉVITER',
        summary: 'Synthèse exécutive en 1 à 2 phrases factuelles en français.',
        scores: {
          confidence: 'entier 0-100',
          risk: 'entier 0-100',
          potential: 'entier 0-100',
          reinforcementStrength: 'entier 0-100',
          horizon: 'Court terme | Moyen terme | Long terme',
        },
        priceLevels: {
          targetPriceUsd: 'nombre USD > 0',
          takeProfitUsd: 'nombre USD > 0',
          stopLossUsd: 'nombre USD > 0',
          idealBuyZone: { minUsd: 'nombre USD > 0', maxUsd: 'nombre USD > 0' },
          dangerZone: { minUsd: 'nombre USD > 0', maxUsd: 'nombre USD > 0' },
        },
        reasoning: [
          'Point factuel 1 citant les chiffres réels',
          'Point factuel 2 citant les chiffres réels',
          'Point factuel 3 citant les chiffres réels',
        ],
      },
      null,
      2
    ),
  ].join('\n');
}

async function callGroqAnalyze(
  apiKey: string,
  payload: AnalyzeTokenPayload
): Promise<AiTokenAnalysis> {
  const response = await fetch(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemInstruction() },
          { role: 'user', content: buildUserPrompt(payload) },
        ],
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(
      `Groq API HTTP ${response.status}: ${errText.slice(0, 220)}`
    );
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Réponse vide reçue depuis Groq API.');
  }

  const parsed = extractJsonObject(content);
  return normalizeAiOutput(
    parsed,
    payload.token.currentPriceUsd,
    'groq',
    GROQ_MODEL
  );
}

async function callGeminiAnalyze(
  apiKey: string,
  payload: AnalyzeTokenPayload
): Promise<AiTokenAnalysis> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const runWithModel = async (modelName: string) => {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: buildUserPrompt(payload),
      config: {
        systemInstruction: buildSystemInstruction(),
        ...(modelName === 'gemini-4-hydrogen'
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          required: ['decision', 'summary', 'scores', 'priceLevels', 'reasoning'],
          properties: {
            decision: {
              type: Type.STRING,
              enum: [
                'CONSERVER',
                'RENFORCER',
                'VENDRE',
                'PRENDRE PROFITS',
                'ATTENDRE',
                'ÉVITER',
              ],
            },
            summary: { type: Type.STRING },
            scores: {
              type: Type.OBJECT,
              required: [
                'confidence',
                'risk',
                'potential',
                'reinforcementStrength',
                'horizon',
              ],
              properties: {
                confidence: { type: Type.INTEGER },
                risk: { type: Type.INTEGER },
                potential: { type: Type.INTEGER },
                reinforcementStrength: { type: Type.INTEGER },
                horizon: {
                  type: Type.STRING,
                  enum: ['Court terme', 'Moyen terme', 'Long terme'],
                },
              },
            },
            priceLevels: {
              type: Type.OBJECT,
              required: [
                'targetPriceUsd',
                'takeProfitUsd',
                'stopLossUsd',
                'idealBuyZone',
                'dangerZone',
              ],
              properties: {
                targetPriceUsd: { type: Type.NUMBER },
                takeProfitUsd: { type: Type.NUMBER },
                stopLossUsd: { type: Type.NUMBER },
                idealBuyZone: {
                  type: Type.OBJECT,
                  required: ['minUsd', 'maxUsd'],
                  properties: {
                    minUsd: { type: Type.NUMBER },
                    maxUsd: { type: Type.NUMBER },
                  },
                },
                dangerZone: {
                  type: Type.OBJECT,
                  required: ['minUsd', 'maxUsd'],
                  properties: {
                    minUsd: { type: Type.NUMBER },
                    maxUsd: { type: Type.NUMBER },
                  },
                },
              },
            },
            reasoning: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Réponse vide reçue depuis Gemini API.');
    }

    const parsed = extractJsonObject(text);
    return normalizeAiOutput(
      parsed,
      payload.token.currentPriceUsd,
      'gemini',
      modelName
    );
  };

  try {
    return await runWithModel(GEMINI_MODEL);
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isTransientOrMissing =
      msg.includes('404') ||
      msg.includes('NOT_FOUND') ||
      msg.includes('503') ||
      msg.includes('UNAVAILABLE') ||
      msg.includes('high demand');
    if (isTransientOrMissing) {
      await new Promise((r) => setTimeout(r, 600));
      try {
        return await runWithModel('gemini-4-hydrogen');
      } catch (fallbackErr: any) {
        const fbMsg = String(fallbackErr?.message || '');
        if (fbMsg.includes('503') || fbMsg.includes('UNAVAILABLE')) {
          throw new Error(
            'Le modèle Gemini est temporairement saturé (503). Veuillez réessayer dans quelques secondes ou configurer GROQ_API_KEY.'
          );
        }
        throw fallbackErr;
      }
    }
    throw err;
  }
}

export async function handleAnalyzeRequest(req: Request, res: Response) {
  try {
    const payload = req.body as AnalyzeTokenPayload;
    if (!payload?.token?.symbol || !Number.isFinite(payload?.token?.currentPriceUsd)) {
      res.status(400).json({
        apiKeyMissing: false,
        error: 'Données token incomplètes pour lancer l’analyse quantitative.',
      });
      return;
    }

    const groqKey = getGroqApiKey();
    const geminiKey = getGeminiApiKey();

    if (!groqKey && !geminiKey) {
      res.status(503).json({
        apiKeyMissing: true,
        error:
          'Aucune clé API IA détectée. Définissez GROQ_API_KEY ou GEMINI_API_KEY dans votre environnement serveur.',
      });
      return;
    }

    const preferred = payload.preferredProvider || 'auto';
    let analysis: AiTokenAnalysis;

    if (preferred === 'groq') {
      if (!groqKey) {
        res.status(503).json({
          apiKeyMissing: true,
          error: 'GROQ_API_KEY est absente de l’environnement serveur.',
        });
        return;
      }
      analysis = await callGroqAnalyze(groqKey, payload);
    } else if (preferred === 'gemini') {
      if (!geminiKey) {
        res.status(503).json({
          apiKeyMissing: true,
          error: 'GEMINI_API_KEY est absente de l’environnement serveur.',
        });
        return;
      }
      analysis = await callGeminiAnalyze(geminiKey, payload);
    } else {
      // Auto: prefer Groq (Llama 3.3 70B) when configured, else Gemini 2.5 Flash
      if (groqKey) {
        try {
          analysis = await callGroqAnalyze(groqKey, payload);
        } catch (groqErr) {
          if (geminiKey) {
            analysis = await callGeminiAnalyze(geminiKey, payload);
          } else {
            throw groqErr;
          }
        }
      } else {
        analysis = await callGeminiAnalyze(geminiKey, payload);
      }
    }

    res.json({
      apiKeyMissing: false,
      analysis,
    });
  } catch (error: any) {
    res.status(502).json({
      apiKeyMissing: false,
      error:
        error?.message ||
        'Erreur lors de l’analyse quantitative par le moteur IA.',
    });
  }
}
