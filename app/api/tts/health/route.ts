import { NextResponse } from 'next/server';
import { isPiperAvailable, getAvailablePiperVoices } from '@/lib/tts/piper';

/**
 * Health check endpoint for Piper TTS backend
 * GET /api/tts/health
 */
export async function GET() {
  try {
    const isAvailable = await isPiperAvailable();
    const voices = await getAvailablePiperVoices();
    
    return NextResponse.json({
      status: isAvailable ? 'ok' : 'unavailable',
      backend: 'piper',
      available: isAvailable,
      voices: voices.map(v => ({
        name: v.name,
        lang: v.lang,
      })),
      voiceCount: voices.length,
    });
  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      backend: 'piper',
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voices: [],
      voiceCount: 0,
    }, { status: 500 });
  }
}
