import type {
  CuratedSourceExercise,
  CurationExplanation,
  CurationToken,
  HandpickedExercise,
} from '@/types/curation';
import { cleanCurationText, tokenizeCurationSentence } from '@/lib/curation/tokenize';

export interface CurationGenerationResult {
  polishTokenInsights: Array<Partial<CurationToken> & { id: string }>;
  englishTokenInsights: Array<Partial<CurationToken> & { id: string }>;
  explanation: CurationExplanation;
  llm: HandpickedExercise['llm'];
}

interface OpenAICurationPayload {
  polishTokens?: Array<{
    id?: unknown;
    translation?: unknown;
    lemma?: unknown;
    partOfSpeech?: unknown;
  }>;
  englishTokens?: Array<{
    id?: unknown;
    translation?: unknown;
  }>;
  explanation?: {
    summary?: unknown;
    usage?: unknown;
    grammarNotes?: unknown;
    nuanceNotes?: unknown;
    examples?: unknown;
    variations?: unknown;
  };
}

export async function generateCurationExplanation(input: {
  sourceItem: CuratedSourceExercise;
  selectedPolishTokenIds: string[];
}): Promise<CurationGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required to generate curation explanations.');
  }

  const model =
    process.env.OPENAI_CURATION_MODEL?.trim() ||
    process.env.OPENAI_TRANSLATION_MODEL?.trim() ||
    'gpt-4.1-mini';
  const polishTokens = tokenizeCurationSentence(input.sourceItem.pl, 'pl');
  const englishTokens = tokenizeCurationSentence(input.sourceItem.en, 'en');
  const selectedSet = new Set(input.selectedPolishTokenIds);

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_output_tokens: 2600,
      input: [
        {
          role: 'system',
          content: [
            'You are a precise Polish language tutor creating metadata for a fill-the-blank exercise curation tool.',
            'Return only data that helps an English-speaking learner understand the exact Polish sentence.',
            'For each Polish token, provide a short English gloss for the token in this sentence context.',
            'For each English token, provide a short Polish gloss.',
            'Keep explanations concise but complete enough for app use.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            polishSentence: input.sourceItem.pl,
            englishSentence: input.sourceItem.en,
            category: input.sourceItem.category,
            difficulty: input.sourceItem.difficulty,
            selectedBlankTokens: polishTokens
              .filter((token) => selectedSet.has(token.id))
              .map(({ id, text, normalized }) => ({ id, text, normalized })),
            polishTokens: polishTokens.map(({ id, text, normalized }) => ({ id, text, normalized })),
            englishTokens: englishTokens.map(({ id, text, normalized }) => ({ id, text, normalized })),
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'curation_explanation',
          strict: true,
          schema: curationResponseSchema,
        },
      },
    }),
    signal: AbortSignal.timeout(45000),
  });

  if (!response.ok) {
    const details = await safeReadText(response);
    throw new Error(`OpenAI curation generation failed: ${response.status} ${details}`);
  }

  const data = await response.json();
  const outputText = extractOutputText(data);
  if (!outputText) {
    throw new Error('OpenAI returned an empty curation payload.');
  }

  const parsed = JSON.parse(outputText) as OpenAICurationPayload;
  const validated = validateCurationPayload(parsed, polishTokens, englishTokens);

  return {
    ...validated,
    llm: {
      provider: 'openai',
      model,
      promptVersion: 'curation-explanation-v1',
      generatedAt: new Date().toISOString(),
      status: 'complete',
    },
  };
}

const curationResponseSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['polishTokens', 'englishTokens', 'explanation'],
  properties: {
    polishTokens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'translation', 'lemma', 'partOfSpeech'],
        properties: {
          id: { type: 'string' },
          translation: { type: 'string' },
          lemma: { type: 'string' },
          partOfSpeech: { type: 'string' },
        },
      },
    },
    englishTokens: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'translation'],
        properties: {
          id: { type: 'string' },
          translation: { type: 'string' },
        },
      },
    },
    explanation: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'usage', 'grammarNotes', 'nuanceNotes', 'examples', 'variations'],
      properties: {
        summary: { type: 'string' },
        usage: { type: 'string' },
        grammarNotes: { type: 'array', items: { type: 'string' } },
        nuanceNotes: { type: 'array', items: { type: 'string' } },
        examples: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['pl', 'en', 'note'],
            properties: {
              pl: { type: 'string' },
              en: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
        variations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['pl', 'en', 'note'],
            properties: {
              pl: { type: 'string' },
              en: { type: 'string' },
              note: { type: 'string' },
            },
          },
        },
      },
    },
  },
};

function validateCurationPayload(
  payload: OpenAICurationPayload,
  polishTokens: CurationToken[],
  englishTokens: CurationToken[]
): Pick<CurationGenerationResult, 'polishTokenInsights' | 'englishTokenInsights' | 'explanation'> {
  if (!Array.isArray(payload.polishTokens) || !Array.isArray(payload.englishTokens)) {
    throw new Error('OpenAI payload is missing token translations.');
  }

  const polishTokenIds = new Set(polishTokens.map((token) => token.id));
  const englishTokenIds = new Set(englishTokens.map((token) => token.id));
  const polishInsights = payload.polishTokens
    .map((token) => ({
      id: cleanCurationText(token.id),
      translation: cleanCurationText(token.translation),
      lemma: cleanCurationText(token.lemma),
      partOfSpeech: cleanCurationText(token.partOfSpeech),
    }))
    .filter((token) => polishTokenIds.has(token.id) && token.translation);
  const englishInsights = payload.englishTokens
    .map((token) => ({
      id: cleanCurationText(token.id),
      translation: cleanCurationText(token.translation),
    }))
    .filter((token) => englishTokenIds.has(token.id) && token.translation);

  const missingPolish = polishTokens.filter((token) => !polishInsights.some((insight) => insight.id === token.id));
  const missingEnglish = englishTokens.filter((token) => !englishInsights.some((insight) => insight.id === token.id));
  if (missingPolish.length > 0 || missingEnglish.length > 0) {
    throw new Error(
      `OpenAI payload did not include translations for all tokens. Missing Polish: ${missingPolish
        .map((token) => token.id)
        .join(', ') || 'none'}; missing English: ${missingEnglish.map((token) => token.id).join(', ') || 'none'}.`
    );
  }

  const explanation = payload.explanation;
  if (!explanation) {
    throw new Error('OpenAI payload is missing an explanation.');
  }

  return {
    polishTokenInsights: polishInsights,
    englishTokenInsights: englishInsights,
    explanation: {
      summary: cleanCurationText(explanation.summary),
      usage: cleanCurationText(explanation.usage),
      grammarNotes: parseStringArray(explanation.grammarNotes),
      nuanceNotes: parseStringArray(explanation.nuanceNotes),
      examples: parseExamples(explanation.examples),
      variations: parseExamples(explanation.variations),
    },
  };
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => cleanCurationText(entry)).filter(Boolean);
}

function parseExamples(value: unknown): Array<{ pl: string; en: string; note?: string }> {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
    .map((entry) => ({
      pl: cleanCurationText(entry.pl),
      en: cleanCurationText(entry.en),
      note: cleanCurationText(entry.note) || undefined,
    }))
    .filter((entry) => entry.pl && entry.en);
}

function extractOutputText(data: unknown): string {
  if (typeof data === 'object' && data !== null && 'output_text' in data && typeof data.output_text === 'string') {
    return data.output_text.trim();
  }

  if (typeof data !== 'object' || data === null || !('output' in data) || !Array.isArray(data.output)) {
    return '';
  }

  for (const item of data.output) {
    if (typeof item !== 'object' || item === null || !('content' in item) || !Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (typeof content === 'object' && content !== null && 'text' in content && typeof content.text === 'string') {
        return content.text.trim();
      }
    }
  }

  return '';
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
