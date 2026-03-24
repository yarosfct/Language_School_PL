import { NextResponse } from 'next/server';
import {
  getAvailableAzureVoices,
  isAzureAvailable,
  isAzureConfigured,
} from '@/lib/tts/azure';

/**
 * Health check endpoint for Azure Speech TTS backend
 * GET /api/tts/health
 */
export async function GET() {
  try {
    const configured = isAzureConfigured();
    const voices = configured ? await getAvailableAzureVoices() : [];
    const isAvailable = configured ? await isAzureAvailable() : false;
    
    return NextResponse.json({
      status: isAvailable ? 'ok' : 'unavailable',
      backend: 'azure',
      configured,
      available: isAvailable,
      voices: voices.map(v => ({
        name: v.name,
        lang: v.lang,
        displayName: v.displayName,
        localName: v.localName,
        gender: v.gender,
        voiceType: v.voiceType,
      })),
      voiceCount: voices.length,
      setupRequired: !configured,
    });
  } catch (error) {
    console.error('Azure health check error:', error);
    
    return NextResponse.json({
      status: 'error',
      backend: 'azure',
      configured: isAzureConfigured(),
      available: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      voices: [],
      voiceCount: 0,
    }, { status: 500 });
  }
}
