import { NextRequest, NextResponse } from 'next/server';

interface TranslationRequestBody {
  text?: unknown;
  sourceLang?: unknown;
  targetLang?: unknown;
  contextText?: unknown;
}

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
    const body = (await request.json()) as TranslationRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : 'pl';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'en';
    const contextText = typeof body.contextText === 'string' ? body.contextText.trim() : '';

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
    }

    const contextualTranslation = lookupContextualTranslation({ text, sourceLang, targetLang, contextText });
    if (contextualTranslation) {
      return NextResponse.json({
        translation: contextualTranslation,
        provider: 'context-heuristic',
      });
    }

    const libreTranslateUrl = process.env.LIBRETRANSLATE_URL?.trim();
    if (libreTranslateUrl) {
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
      });
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
    });
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
