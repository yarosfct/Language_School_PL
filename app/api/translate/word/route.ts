import { NextRequest, NextResponse } from 'next/server';

interface TranslationRequestBody {
  text?: unknown;
  sourceLang?: unknown;
  targetLang?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TranslationRequestBody;
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : 'pl';
    const targetLang = typeof body.targetLang === 'string' ? body.targetLang : 'en';

    if (!text) {
      return NextResponse.json({ error: 'Text is required.' }, { status: 400 });
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
      if (!translation) {
        throw new Error('LibreTranslate returned an empty translation.');
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

    if (!translation) {
      throw new Error('Translation provider returned an empty translation.');
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

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
