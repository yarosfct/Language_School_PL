import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface PiperOptions {
  rate?: number; // 0.5 to 2.0
  voice?: string; // Voice model name
}

export interface PiperVoice {
  name: string;
  lang: string;
  modelPath: string;
}

/**
 * Get the path to the voice model directory
 */
export function getVoiceModelPath(): string {
  return path.join(process.cwd(), 'public', 'voices');
}

/**
 * Get available Piper voice models
 */
export async function getAvailablePiperVoices(): Promise<PiperVoice[]> {
  const voicesDir = getVoiceModelPath();
  
  try {
    const files = await fs.readdir(voicesDir);
    const onnxFiles = files.filter(f => f.endsWith('.onnx'));
    
    return onnxFiles.map(file => ({
      name: file.replace('.onnx', ''),
      lang: file.startsWith('pl_PL') ? 'pl-PL' : 'unknown',
      modelPath: path.join(voicesDir, file),
    }));
  } catch (error) {
    console.error('Error reading voice models:', error);
    return [];
  }
}

/**
 * Generate a unique hash for caching audio files
 */
export function generateAudioHash(text: string, options: PiperOptions = {}): string {
  const cacheKey = JSON.stringify({
    text: text.trim().toLowerCase(),
    rate: options.rate || 1.0,
    voice: options.voice || 'default',
  });
  
  return createHash('md5').update(cacheKey).digest('hex');
}

/**
 * Convert rate (0.5-2.0) to Piper speed parameter
 * Piper uses length_scale where lower = faster
 */
export function adjustSpeed(rate: number = 1.0): number {
  // Inverse relationship: rate 2.0 (fast) = length_scale 0.5
  // rate 0.5 (slow) = length_scale 2.0
  return 1.0 / rate;
}

/**
 * Execute Piper TTS to generate audio file
 */
export async function executePiper(
  text: string,
  outputPath: string,
  options: PiperOptions = {}
): Promise<void> {
  const voices = await getAvailablePiperVoices();
  
  if (voices.length === 0) {
    throw new Error('No Piper voice models found. Please download a voice model first.');
  }
  
  // Use specified voice or first available Polish voice
  const voiceModel = options.voice 
    ? voices.find(v => v.name === options.voice)?.modelPath
    : voices[0].modelPath;
  
  if (!voiceModel) {
    throw new Error(`Voice model not found: ${options.voice}`);
  }
  
  const lengthScale = adjustSpeed(options.rate || 1.0);
  
  return new Promise((resolve, reject) => {
    // Piper command: echo "text" | piper --model voice.onnx --output_file output.wav --length_scale 1.0
    const piper = spawn('piper-tts', [
      '--model', voiceModel,
      '--output_file', outputPath,
      '--length_scale', lengthScale.toFixed(2),
    ]);
    
    // Send text to stdin
    piper.stdin.write(text);
    piper.stdin.end();
    
    let stderr = '';
    
    piper.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    piper.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Piper TTS failed with code ${code}: ${stderr}`));
      }
    });
    
    piper.on('error', (err) => {
      reject(new Error(`Failed to spawn Piper TTS: ${err.message}. Is piper-tts installed?`));
    });
  });
}

/**
 * Check if Piper TTS is installed and working
 */
export async function isPiperAvailable(): Promise<boolean> {
  try {
    const voices = await getAvailablePiperVoices();
    if (voices.length === 0) {
      return false;
    }
    
    // Try to execute piper --version
    return new Promise((resolve) => {
      const piper = spawn('piper-tts', ['--version']);
      
      piper.on('close', (code) => {
        resolve(code === 0);
      });
      
      piper.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * Get the cache directory path
 */
export function getCachePath(): string {
  return path.join(process.cwd(), 'public', 'audio-cache');
}

/**
 * Ensure cache directory exists
 */
export async function ensureCacheDir(): Promise<void> {
  const cachePath = getCachePath();
  try {
    await fs.mkdir(cachePath, { recursive: true });
  } catch (error) {
    console.error('Error creating cache directory:', error);
  }
}

/**
 * Get cached audio file path
 */
export function getCachedAudioPath(hash: string): string {
  return path.join(getCachePath(), `${hash}.wav`);
}

/**
 * Check if audio file is cached
 */
export async function isCached(hash: string): Promise<boolean> {
  const filePath = getCachedAudioPath(hash);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; sizeBytes: number }> {
  const cachePath = getCachePath();
  
  try {
    const files = await fs.readdir(cachePath);
    const wavFiles = files.filter(f => f.endsWith('.wav'));
    
    let totalSize = 0;
    for (const file of wavFiles) {
      const stats = await fs.stat(path.join(cachePath, file));
      totalSize += stats.size;
    }
    
    return {
      count: wavFiles.length,
      sizeBytes: totalSize,
    };
  } catch {
    return { count: 0, sizeBytes: 0 };
  }
}

/**
 * Clear all cached audio files
 */
export async function clearCache(): Promise<void> {
  const cachePath = getCachePath();
  
  try {
    const files = await fs.readdir(cachePath);
    const wavFiles = files.filter(f => f.endsWith('.wav'));
    
    await Promise.all(
      wavFiles.map(file => fs.unlink(path.join(cachePath, file)))
    );
  } catch (error) {
    console.error('Error clearing cache:', error);
    throw error;
  }
}
