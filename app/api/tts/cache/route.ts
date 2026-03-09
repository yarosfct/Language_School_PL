import { NextResponse } from 'next/server';
import { getCacheStats, clearCache } from '@/lib/tts/piper';

/**
 * Get cache statistics
 * GET /api/tts/cache
 */
export async function GET() {
  try {
    const stats = await getCacheStats();
    
    // Convert bytes to human-readable format
    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };
    
    return NextResponse.json({
      count: stats.count,
      sizeBytes: stats.sizeBytes,
      sizeFormatted: formatBytes(stats.sizeBytes),
    });
  } catch (error) {
    console.error('Cache stats error:', error);
    
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}

/**
 * Clear all cached audio files
 * DELETE /api/tts/cache
 */
export async function DELETE() {
  try {
    await clearCache();
    
    return NextResponse.json({
      success: true,
      message: 'Cache cleared successfully',
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
