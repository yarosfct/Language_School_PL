import { NextRequest, NextResponse } from 'next/server';
import {
  generateAudioHash,
  executePiper,
  ensureCacheDir,
  getCachedAudioPath,
  isCached,
} from '@/lib/tts/piper';
import { promises as fs } from 'fs';

export interface TTSRequest {
  text: string;
  rate?: number;
  voice?: string;
}

/**
 * Main TTS endpoint - generates or retrieves cached audio
 * POST /api/tts/speak
 */
export async function POST(request: NextRequest) {
  try {
    const body: TTSRequest = await request.json();
    const { text, rate = 1.0, voice } = body;
    
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }
    
    // Generate hash for caching
    const hash = generateAudioHash(text, { rate, voice });
    const audioPath = getCachedAudioPath(hash);
    
    // Ensure cache directory exists
    await ensureCacheDir();
    
    // Check if already cached
    const cached = await isCached(hash);
    
    if (!cached) {
      // Generate new audio file
      console.log(`🎤 Generating TTS for: "${text.substring(0, 50)}..." (hash: ${hash})`);
      
      try {
        await executePiper(text, audioPath, { rate, voice });
        
        // Verify the file was created and has content
        try {
          const stats = await fs.stat(audioPath);
          if (stats.size === 0) {
            throw new Error('Generated audio file is empty');
          }
          console.log(`✅ TTS generated successfully: ${hash}.wav (${stats.size} bytes)`);
        } catch (statError) {
          console.error('❌ Audio file verification failed:', statError);
          throw new Error(`Audio file verification failed: ${statError instanceof Error ? statError.message : 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Piper TTS error:', error);
        return NextResponse.json(
          { 
            error: 'Failed to generate audio',
            details: error instanceof Error ? error.message : 'Unknown error',
            fallback: true, // Signal frontend to use Web Speech API
          },
          { status: 500 }
        );
      }
    } else {
      console.log(`📦 Using cached audio: ${hash}.wav`);
    }
    
    // Read the audio file
    let audioBuffer: Buffer;
    try {
      audioBuffer = await fs.readFile(audioPath);
      
      // Verify the buffer has content
      if (!audioBuffer || audioBuffer.length === 0) {
        console.error('❌ Audio file is empty:', audioPath);
        return NextResponse.json(
          { 
            error: 'Audio file is empty',
            fallback: true,
          },
          { status: 500 }
        );
      }
    } catch (readError) {
      console.error('❌ Failed to read audio file:', readError);
      return NextResponse.json(
        { 
          error: 'Failed to read audio file',
          details: readError instanceof Error ? readError.message : 'Unknown error',
          fallback: true,
        },
        { status: 500 }
      );
    }
    
    // Return audio file as response
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000', // Cache for 1 year
        'X-Audio-Hash': hash,
        'X-Cached': cached ? 'true' : 'false',
      },
    });
  } catch (error) {
    console.error('TTS API error:', error);
    
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
        fallback: true,
      },
      { status: 500 }
    );
  }
}

/**
 * Get audio URL for a given text (without generating)
 * GET /api/tts/speak?text=...&rate=...&voice=...
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const text = searchParams.get('text');
    const rate = parseFloat(searchParams.get('rate') || '1.0');
    const voice = searchParams.get('voice') || undefined;
    
    if (!text) {
      return NextResponse.json(
        { error: 'Text parameter is required' },
        { status: 400 }
      );
    }
    
    const hash = generateAudioHash(text, { rate, voice });
    const cached = await isCached(hash);
    
    return NextResponse.json({
      hash,
      cached,
      url: `/audio-cache/${hash}.wav`,
    });
  } catch (error) {
    console.error('TTS GET error:', error);
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
