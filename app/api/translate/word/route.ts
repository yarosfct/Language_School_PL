import { NextRequest, NextResponse } from 'next/server';
import type {
  TranslationConfidence,
  TranslationInsightHint,
  TranslationLookupRequest,
  TranslationLookupResponse,
  TranslationLookupType,
} from '@/types/translations';

const CONTEXT_TRANSLATIONS_PL_EN: Record<string, Array<{ when: (context: string) => boolean; translation: string }>> = {
  lata: [
    {
      when: (context) => /\b(?:mam|masz|ma|mamy|macie|maja)\s+\d+\s+lat(?:a)?\b/u.test(context),
      translation: 'years',
    },
  ],
  lat: [
    {
      when: (context) => /\b(?:mam|masz|ma|mamy|macie|maja)\s+\d+\s+lat\b/u.test(context),
      translation: 'years',
    },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const body = parseTranslationRequest(await request.json());
    const { text, sourceLang, targetLang, contextText } = body;

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const contextualTranslation = lookupContextualTranslation(body);
    if (contextualTranslation) {
      return NextResponse.json({
        translation: contextualTranslation,
        provider: 'context-heuristic',
        confidence: 'high',
      } satisfies TranslationLookupResponse);
    }

    const openAiTranslation = await lookupOpenAITranslation(body);
    if (openAiTranslation) {
      return NextResponse.json(openAiTranslation satisfies TranslationLookupResponse);
    }

    const libreTranslateUrl = process.env.LIBRETRANSLATE_URL?.trim();
    if (libreTranslateUrl) {
      try {
        const response = await fetch(new URL('/translate', libreTranslateUrl), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            q: text,
            source: sourceLang,
            target: targetLang,
            format: 'text',
            api_key: process.env.LIBRETRANSLATE_API_KEY || undefined,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!response.ok) {
          const details = await safeReadText(response);
          throw new Error(`LibreTranslate lookup failed: ${response.status} ${details}`);
        }

        const data = (await response.json()) as { translatedText?: string };
        const translation = data.translatedText?.trim();
        if (!isUsableTranslation(translation)) {
          throw new Error('LibreTranslate returned an invalid translation.');
        }

        return NextResponse.json({
          translation,
          provider: 'libretranslate',
          confidence: 'medium',
        } satisfies TranslationLookupResponse);
      } catch (error) {
        console.warn('LibreTranslate lookup failed, falling back.', error);
      }
    }

    const url = new URL('https://api.mymemory.translated.net/get');
    url.searchParams.set('q', text);
    url.searchParams.set('langpair', `${sourceLang}|${targetLang}`);

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(`MyMemory lookup failed: ${response.status} ${details}`);
    }

    const data = (await response.json()) as {
      responseData?: { translatedText?: string };
    };
    const translation = data.responseData?.translatedText?.trim();

    if (!isUsableTranslation(translation)) {
      throw new Error('Translation provider returned an invalid translation.');
    }

    return NextResponse.json({
      translation,
      provider: 'mymemory',
      confidence: 'low',
    } satisfies TranslationLookupResponse);
  } catch (error) {
    console.error('Translation lookup error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to fetch translation right now.',
      },
      { status: 500 }
    );
  }
}

function parseTranslationRequest(value: unknown): Required<TranslationLookupRequest> {
  const body = isRecord(value) ? value : {};

  return {
    text: typeof body.text === 'string' ? body.text.trim() : '',
    sourceLang: typeof body.sourceLang === 'string' ? body.sourceLang : 'pl',
    targetLang: typeof body.targetLang === 'string' ? body.targetLang : 'en',
    contextText: typeof body.contextText === 'string' ? body.contextText.trim() : '',
    sectionId: typeof body.sectionId === 'string' ? body.sectionId : '',
    lookupType: body.lookupType === 'phrase' ? 'phrase' : 'word',
    insight: parseInsightHint(body.insight),
  };
}

function parseInsightHint(value: unknown): TranslationInsightHint {
  const raw = isRecord(value) ? value : {};

  return {
    polish: typeof raw.polish === 'string' ? raw.polish.trim() : undefined,
    normalizedToken: typeof raw.normalizedToken === 'string' ? raw.normalizedToken.trim() : undefined,
    englishCandidates: Array.isArray(raw.englishCandidates)
      ? raw.englishCandidates.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean)
      : undefined,
    partOfSpeech: typeof raw.partOfSpeech === 'string' ? raw.partOfSpeech.trim() : undefined,
    source: typeof raw.source === 'string' ? raw.source.trim() : undefined,
  };
}

function isUsableTranslation(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return /[\p{L}\p{N}]/u.test(trimmed);
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

async function lookupOpenAITranslation(
  input: Required<TranslationLookupRequest>
): Promise<TranslationLookupResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TRANSLATION_MODEL?.trim() || 'gpt-4.1-mini',
        temperature: 0.1,
        response_format: {
          type: 'json_object',
        },
        messages: buildOpenAIMessages(input),
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      const details = await safeReadText(response);
      throw new Error(`OpenAI lookup failed: ${response.status} ${details}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string | null;
        };
      }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error('OpenAI returned an empty translation payload.');
    }

    const parsed = parseOpenAITranslationPayload(content, input.lookupType);
    if (!parsed) {
      throw new Error('OpenAI returned an invalid translation payload.');
    }

    return parsed;
  } catch (error) {
    console.warn('OpenAI contextual translation failed, falling back.', error);
    return null;
  }
}

function buildOpenAIMessages(input: Required<TranslationLookupRequest>) {
  const hintCandidates = (input.insight.englishCandidates ?? []).slice(0, 5);
  const lookupInstructions =
    input.lookupType === 'word'
      ? [
          'The user selected a single word token, not a whole phrase.',
          'Use the sentence only to disambiguate the word meaning.',
          'Return the English gloss of the selected word or its lemma only, not a translation of the whole sentence.',
          'Prefer a dictionary-style gloss for the selected word, even when the Polish form is inflected.',
          'Prefer short lemma-like outputs such as order, fine, okay, proper, watch, or busy instead of sentence paraphrases.',
          'For word lookups, the primary translation should usually be 1 or 2 words.',
          'If the word appears inside a fixed expression, keep the primary translation word-level and put the expression meaning in note or alternatives.',
          'If note explains phrase-level meaning, start the note with PHRASE: followed by the concise phrase meaning.',
        ]
      : [
          'The user selected a phrase.',
          'Translate the phrase naturally rather than word-by-word.',
        ];

  const system = [
    'You are a precise Polish to English translation assistant for a language-learning app.',
    'Your job is to choose the English meaning that best fits the sentence context, not the most common dictionary gloss.',
    'Return JSON only with the keys translation, alternatives, confidence, and note.',
    'translation must be concise and natural for an English-speaking learner.',
    'alternatives must contain only meaningfully distinct options and at most 3 items.',
    'confidence must be one of high, medium, or low.',
    'note must be short and only present when a brief disambiguation is genuinely useful.',
    'Do not explain your reasoning.',
  ].join(' ');

  const user = {
    task: 'Translate Polish into English using context.',
    sourceText: input.text,
    lookupType: input.lookupType,
    sourceLanguage: input.sourceLang,
    targetLanguage: input.targetLang,
    sentenceContext: input.contextText || null,
    sectionId: input.sectionId || null,
    glossaryHint: {
      polish: input.insight.polish ?? null,
      normalizedToken: input.insight.normalizedToken ?? null,
      partOfSpeech: input.insight.partOfSpeech ?? null,
      source: input.insight.source ?? null,
      englishCandidates: hintCandidates,
    },
    instructions: [
      'Prefer the meaning that best fits the supplied sentence context.',
      'If glossary candidates are present, use them only when they fit the sentence.',
      'Keep the primary translation short.',
      ...lookupInstructions,
    ],
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(user) },
  ];
}

function parseOpenAITranslationPayload(
  content: string,
  lookupType: TranslationLookupType
): TranslationLookupResponse | null {
  try {
    const payload = JSON.parse(content) as Record<string, unknown>;
    const translation = typeof payload.translation === 'string' ? payload.translation.trim() : '';
    if (!isUsableTranslation(translation)) {
      return null;
    }

    if (lookupType === 'word' && countWords(translation) > 2) {
      return null;
    }

    const alternatives = Array.isArray(payload.alternatives)
      ? payload.alternatives
          .filter((entry): entry is string => typeof entry === 'string')
          .map((entry) => entry.trim())
          .filter((entry) => isUsableTranslation(entry) && normalize(entry) !== normalize(translation))
          .slice(0, 3)
      : undefined;

    return {
      translation,
      provider: 'openai-context',
      confidence: normalizeConfidence(payload.confidence),
      note: typeof payload.note === 'string' && payload.note.trim() ? payload.note.trim() : undefined,
      alternatives: alternatives && alternatives.length > 0 ? alternatives : undefined,
    };
  } catch {
    return null;
  }
}

function normalizeConfidence(value: unknown): TranslationConfidence {
  if (value === 'high' || value === 'medium' || value === 'low') {
    return value;
  }

  return 'medium';
}

function countWords(value: string): number {
  return value.split(/\s+/).filter(Boolean).length;
}

function lookupContextualTranslation(input: {
  text: string;
  sourceLang: string;
  targetLang: string;
  contextText: string;
}): string | null {
  if (input.sourceLang !== 'pl' || input.targetLang !== 'en') {
    return null;
  }

  const normalizedToken = normalize(input.text);
  const normalizedContext = normalize(input.contextText);
  if (!normalizedToken || !normalizedContext) {
    return null;
  }

  const rules = CONTEXT_TRANSLATIONS_PL_EN[normalizedToken];
  if (!rules) {
    return null;
  }

  for (const rule of rules) {
    if (rule.when(normalizedContext)) {
      return rule.translation;
    }
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .replace(/[!?.,;:()"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
