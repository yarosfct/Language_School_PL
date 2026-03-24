import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

const POLISH_LOCALE = 'pl-PL';
const DEFAULT_OUTPUT_FORMAT = 'riff-24khz-16bit-mono-pcm';
const VOICE_CACHE_TTL_MS = 60 * 60 * 1000;
const LEADING_SILENCE_MS = 320;

export interface AzureTTSOptions {
  rate?: number;
  voice?: string;
}

export interface AzureVoice {
  name: string;
  displayName: string;
  localName: string;
  lang: string;
  localeName: string;
  gender: string;
  voiceType: string;
  status: string;
  styleList: string[];
}

interface AzureConfig {
  key: string;
  region: string;
  defaultVoice?: string;
}

let cachedVoices: AzureVoice[] | null = null;
let cachedVoicesExpiresAt = 0;

function getAzureConfig(): AzureConfig | null {
  const key = process.env.AZURE_SPEECH_KEY?.trim();
  const region = process.env.AZURE_SPEECH_REGION?.trim();
  const defaultVoice = process.env.AZURE_SPEECH_VOICE?.trim();

  if (!key || !region) {
    return null;
  }

  return {
    key,
    region,
    defaultVoice,
  };
}

function getVoicesEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/voices/list`;
}

function getSynthesisEndpoint(region: string): string {
  return `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
}

function clampRate(rate: number = 1): number {
  return Math.max(0.5, Math.min(2, rate));
}

function rateToSsml(rate: number = 1): string {
  const clampedRate = clampRate(rate);
  const percent = Math.round((clampedRate - 1) * 100);

  if (percent === 0) {
    return '0%';
  }

  return `${percent > 0 ? '+' : ''}${percent}%`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSsml(text: string, voiceName: string, rate: number = 1): string {
  return [
    "<speak version='1.0' xml:lang='pl-PL' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='http://www.w3.org/2001/mstts'>",
    `<voice name='${escapeXml(voiceName)}'>`,
    `<mstts:silence type='Leading-exact' value='${LEADING_SILENCE_MS}ms'/>`,
    `<prosody rate='${rateToSsml(rate)}'>${escapeXml(text)}</prosody>`,
    '</voice>',
    '</speak>',
  ].join('');
}

function toAzureVoice(rawVoice: Record<string, unknown>): AzureVoice {
  return {
    name: String(rawVoice.ShortName ?? ''),
    displayName: String(rawVoice.DisplayName ?? rawVoice.ShortName ?? ''),
    localName: String(rawVoice.LocalName ?? rawVoice.DisplayName ?? rawVoice.ShortName ?? ''),
    lang: String(rawVoice.Locale ?? ''),
    localeName: String(rawVoice.LocaleName ?? rawVoice.Locale ?? ''),
    gender: String(rawVoice.Gender ?? ''),
    voiceType: String(rawVoice.VoiceType ?? ''),
    status: String(rawVoice.Status ?? ''),
    styleList: Array.isArray(rawVoice.StyleList)
      ? rawVoice.StyleList.map((style) => String(style))
      : [],
  };
}

function compareVoices(a: AzureVoice, b: AzureVoice): number {
  const aIsPolish = a.lang === POLISH_LOCALE ? 1 : 0;
  const bIsPolish = b.lang === POLISH_LOCALE ? 1 : 0;

  if (aIsPolish !== bIsPolish) {
    return bIsPolish - aIsPolish;
  }

  const aIsGa = a.status === 'GA' ? 1 : 0;
  const bIsGa = b.status === 'GA' ? 1 : 0;
  if (aIsGa !== bIsGa) {
    return bIsGa - aIsGa;
  }

  const aIsNeural = a.voiceType === 'Neural' ? 1 : 0;
  const bIsNeural = b.voiceType === 'Neural' ? 1 : 0;
  if (aIsNeural !== bIsNeural) {
    return bIsNeural - aIsNeural;
  }

  return a.displayName.localeCompare(b.displayName, 'pl');
}

async function fetchAzureVoices(): Promise<AzureVoice[]> {
  const config = getAzureConfig();

  if (!config) {
    return [];
  }

  const response = await fetch(getVoicesEndpoint(config.region), {
    headers: {
      'Ocp-Apim-Subscription-Key': config.key,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Azure voice list request failed (${response.status}): ${details.slice(0, 300)}`);
  }

  const data = (await response.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Azure voice list response was not an array');
  }

  return data
    .filter((voice): voice is Record<string, unknown> => typeof voice === 'object' && voice !== null)
    .filter((voice) => {
      const locale = String(voice.Locale ?? '');
      const secondaryLocales = Array.isArray(voice.SecondaryLocaleList)
        ? voice.SecondaryLocaleList.map((entry) => String(entry))
        : [];

      return locale === POLISH_LOCALE || secondaryLocales.includes(POLISH_LOCALE);
    })
    .map(toAzureVoice)
    .sort(compareVoices);
}

export function isAzureConfigured(): boolean {
  return getAzureConfig() !== null;
}

export async function getAvailableAzureVoices(forceRefresh = false): Promise<AzureVoice[]> {
  if (!forceRefresh && cachedVoices && Date.now() < cachedVoicesExpiresAt) {
    return cachedVoices;
  }

  const voices = await fetchAzureVoices();
  cachedVoices = voices;
  cachedVoicesExpiresAt = Date.now() + VOICE_CACHE_TTL_MS;
  return voices;
}

export async function isAzureAvailable(): Promise<boolean> {
  if (!isAzureConfigured()) {
    return false;
  }

  const voices = await getAvailableAzureVoices();
  return voices.length > 0;
}

async function resolveAzureVoice(voiceName?: string): Promise<AzureVoice> {
  const config = getAzureConfig();
  if (!config) {
    throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
  }

  const voices = await getAvailableAzureVoices();
  if (voices.length === 0) {
    throw new Error('No Azure Speech voices for Polish were found in this region.');
  }

  const requestedVoice = voiceName || config.defaultVoice;
  if (requestedVoice) {
    const matchedVoice = voices.find((voice) => voice.name === requestedVoice);
    if (matchedVoice) {
      return matchedVoice;
    }
  }

  return voices[0];
}

export function generateAudioHash(text: string, options: AzureTTSOptions = {}): string {
  const cacheKey = JSON.stringify({
    text: text.trim().toLowerCase(),
    rate: clampRate(options.rate),
    voice: options.voice || 'default',
    provider: 'azure-speech',
    leadingSilenceMs: LEADING_SILENCE_MS,
  });

  return createHash('md5').update(cacheKey).digest('hex');
}

export async function executeAzureTTS(
  text: string,
  outputPath: string,
  options: AzureTTSOptions = {}
): Promise<{ voice: string }> {
  const config = getAzureConfig();
  if (!config) {
    throw new Error('Azure Speech is not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION.');
  }

  const selectedVoice = await resolveAzureVoice(options.voice);
  const response = await fetch(getSynthesisEndpoint(config.region), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/ssml+xml',
      'Ocp-Apim-Subscription-Key': config.key,
      'User-Agent': 'polski-od-zera',
      'X-Microsoft-OutputFormat': DEFAULT_OUTPUT_FORMAT,
    },
    body: buildSsml(text, selectedVoice.name, options.rate),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Azure Speech synthesis failed (${response.status}): ${details.slice(0, 500)}`);
  }

  const audioBuffer = Buffer.from(await response.arrayBuffer());
  if (audioBuffer.length === 0) {
    throw new Error('Azure Speech returned an empty audio file.');
  }

  await fs.writeFile(outputPath, audioBuffer);

  return { voice: selectedVoice.name };
}

export function getCachePath(): string {
  return path.join(process.cwd(), 'public', 'audio-cache');
}

export async function ensureCacheDir(): Promise<void> {
  const cachePath = getCachePath();
  await fs.mkdir(cachePath, { recursive: true });
}

export function getCachedAudioPath(hash: string): string {
  return path.join(getCachePath(), `${hash}.wav`);
}

export async function isCached(hash: string): Promise<boolean> {
  const filePath = getCachedAudioPath(hash);
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function getCacheStats(): Promise<{ count: number; sizeBytes: number }> {
  const cachePath = getCachePath();

  try {
    const files = await fs.readdir(cachePath);
    const wavFiles = files.filter((file) => file.endsWith('.wav'));

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
    return {
      count: 0,
      sizeBytes: 0,
    };
  }
}

export async function clearCache(): Promise<void> {
  const cachePath = getCachePath();

  try {
    const files = await fs.readdir(cachePath);
    const wavFiles = files.filter((file) => file.endsWith('.wav'));

    await Promise.all(
      wavFiles.map((file) => fs.unlink(path.join(cachePath, file)))
    );
  } catch (error) {
    console.error('Error clearing TTS cache:', error);
    throw error;
  }
}
