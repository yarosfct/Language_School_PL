'use client';

import { useEffect, useState, useRef } from 'react';
import { useStore } from '@/lib/store/useStore';
import { Settings as SettingsIcon, Volume2, Mic, AlertTriangle, Server, Database, Trash2 } from 'lucide-react';
import { speak, getAvailableVoices, setVoice, setRate, setPiperVoice, applyTTSPreferences } from '@/lib/tts';
import { clearAllData } from '@/lib/db';

interface PiperVoice {
  name: string;
  lang: string;
}

export default function SettingsPage() {
  const { soundEnabled, toggleSound, resetStore, ttsPreferences, updateTTSPreferences } = useStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [piperVoices, setPiperVoices] = useState<PiperVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [selectedPiperVoice, setSelectedPiperVoice] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(ttsPreferences.rate ?? 1.0);
  const [testText, setTestText] = useState<string>('Dzień dobry! Jak się masz?');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  
  // TTS Backend state
  const [backendStatus, setBackendStatus] = useState<'checking' | 'piper' | 'webspeech'>('checking');
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeFormatted: string } | null>(null);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isTestingTTS, setIsTestingTTS] = useState(false);
  const testTextInputRef = useRef<HTMLInputElement>(null);

  // Load saved preferences on mount
  useEffect(() => {
    // Load saved rate
    if (ttsPreferences.rate !== undefined) {
      setSpeechRate(ttsPreferences.rate);
      setRate(ttsPreferences.rate);
    }
    
    // Apply all saved preferences to TTS module
    applyTTSPreferences({
      voiceURI: ttsPreferences.voiceURI,
      piperVoice: ttsPreferences.piperVoice,
      rate: ttsPreferences.rate,
    });
  }, []); // Only run once on mount

  // Check backend status and load Piper voices
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const response = await fetch('/api/tts/health');
        const data = await response.json();
        const isPiper = data.available && data.voiceCount > 0;
        setBackendStatus(isPiper ? 'piper' : 'webspeech');
        
        if (isPiper && data.voices) {
          // Load Piper voices
          const voices = data.voices as PiperVoice[];
          setPiperVoices(voices);
          
          // Only set voice if not already set (initial load)
          if (!selectedPiperVoice) {
            // Load saved Piper voice from preferences, or set default
            if (ttsPreferences.piperVoice && voices.find(v => v.name === ttsPreferences.piperVoice)) {
              setSelectedPiperVoice(ttsPreferences.piperVoice);
              setPiperVoice(ttsPreferences.piperVoice);
            } else if (voices.length > 0) {
              // Set default Piper voice (prefer darkman-medium, then first available)
              const preferredVoice = voices.find(v => v.name.includes('darkman-medium')) 
                || voices.find(v => v.name.includes('darkman'))
                || voices[0];
              setSelectedPiperVoice(preferredVoice.name);
              setPiperVoice(preferredVoice.name);
              // Save to preferences
              updateTTSPreferences({ piperVoice: preferredVoice.name });
            }
          }
        }
      } catch {
        setBackendStatus('webspeech');
      }
    };

    const loadCacheStats = async () => {
      try {
        const response = await fetch('/api/tts/cache');
        if (response.ok) {
          const data = await response.json();
          setCacheStats({
            count: data.count,
            sizeFormatted: data.sizeFormatted || '0 B',
          });
        }
      } catch (error) {
        console.error('Failed to load cache stats:', error);
      }
    };

    checkBackend();
    loadCacheStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Load Web Speech API voices only when not using Piper
  useEffect(() => {
    if (backendStatus === 'webspeech') {
      const loadVoices = () => {
        const availableVoices = getAvailableVoices();
        
        // Filter to only show Polish voices (lang starts with 'pl')
        const polishVoices = availableVoices.filter(voice => 
          voice.lang.toLowerCase().startsWith('pl')
        );
        
        // If no Polish voices, fall back to all voices
        const voicesToUse = polishVoices.length > 0 ? polishVoices : availableVoices;
        
        setVoices(voicesToUse);
        
        // Only set voice if not already set (initial load)
        if (!selectedVoice) {
          // Load saved voice from preferences, or set default
          if (ttsPreferences.voiceURI && voicesToUse.find(v => v.voiceURI === ttsPreferences.voiceURI)) {
            setSelectedVoice(ttsPreferences.voiceURI);
            setVoice(ttsPreferences.voiceURI);
          } else if (voicesToUse.length > 0) {
            const firstVoice = voicesToUse[0];
            setSelectedVoice(firstVoice.voiceURI);
            setVoice(firstVoice.voiceURI);
            // Save to preferences
            updateTTSPreferences({ voiceURI: firstVoice.voiceURI });
          }
        }
      };

      loadVoices();
      // Chrome loads voices asynchronously
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }

      return () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendStatus]); // Only depend on backendStatus

  const handleVoiceChange = (voiceURI: string) => {
    setSelectedVoice(voiceURI);
    setVoice(voiceURI);
    // Save to preferences
    updateTTSPreferences({ voiceURI });
  };

  const handlePiperVoiceChange = (voiceName: string) => {
    setSelectedPiperVoice(voiceName);
    setPiperVoice(voiceName);
    // Save to preferences
    updateTTSPreferences({ piperVoice: voiceName });
  };

  const handleRateChange = (rate: number) => {
    setSpeechRate(rate);
    setRate(rate);
    // Save to preferences
    updateTTSPreferences({ rate });
  };

  const handleTestTTS = async () => {
    // Get current text from input ref (handles default value issue)
    const currentText = testTextInputRef.current?.value || testText;
    const textToSpeak = currentText.trim();
    
    if (!textToSpeak) {
      alert('Please enter some text to test');
      return;
    }

    setIsTestingTTS(true);
    
    try {
      if (backendStatus === 'piper') {
        // Use Piper TTS API
        const response = await fetch('/api/tts/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: textToSpeak,
            rate: speechRate,
            voice: selectedPiperVoice || undefined,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to generate audio');
        }

        // Get audio blob and play it
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsTestingTTS(false);
        };
        
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsTestingTTS(false);
          alert('Error playing audio');
        };
        
        await audio.play();
      } else {
        // Use Web Speech API
        await speak(textToSpeak);
        setIsTestingTTS(false);
      }
    } catch (error) {
      console.error('TTS test error:', error);
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsTestingTTS(false);
    }
  };

  const handleResetProgress = async () => {
    setIsResetting(true);
    try {
      // Clear all IndexedDB data
      await clearAllData();
      // Reset Zustand store
      resetStore();
      // Close confirmation dialog
      setShowResetConfirm(false);
      // Show success feedback
      alert('All progress has been reset successfully!');
      // Reload the page to ensure clean state
      window.location.reload();
    } catch (error) {
      console.error('Error resetting progress:', error);
      alert('Failed to reset progress. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the TTS audio cache? This will free up disk space but audio will need to be regenerated.')) {
      return;
    }

    setIsLoadingCache(true);
    try {
      const response = await fetch('/api/tts/cache', { method: 'DELETE' });
      if (response.ok) {
        alert('Cache cleared successfully!');
        // Reload cache stats
        const statsResponse = await fetch('/api/tts/cache');
        if (statsResponse.ok) {
          const data = await statsResponse.json();
          setCacheStats(data);
        }
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache. Please try again.');
    } finally {
      setIsLoadingCache(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Settings
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Customize your learning experience
        </p>
      </div>

      {/* Settings sections */}
      <div className="space-y-6">
        {/* Audio Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Volume2 className="w-5 h-5" />
            Audio Settings
          </h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Sound Effects
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Enable sound effects for correct/incorrect answers
                </p>
              </div>
              <button
                onClick={toggleSound}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  soundEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Text-to-Speech Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Text-to-Speech (TTS)
          </h2>
          
          <div className="space-y-4">
            {/* Voice Selection - Show Piper voices when Piper is active, Web Speech API voices otherwise */}
            {backendStatus === 'piper' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Piper Voice
                </label>
                {piperVoices.length > 0 ? (
                  <select
                    value={selectedPiperVoice}
                    onChange={(e) => handlePiperVoiceChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {piperVoices.map((voice) => {
                      // Format voice name for display (remove pl_PL- prefix, make readable)
                      const displayName = voice.name
                        .replace(/^pl_PL-/, '')
                        .replace(/-/g, ' ')
                        .replace(/\b\w/g, l => l.toUpperCase());
                      return (
                        <option key={voice.name} value={voice.name}>
                          {displayName}
                        </option>
                      );
                    })}
                  </select>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                      ⚠️ No Piper voices found
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Download voice models to public/voices/ directory.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Voice (Web Speech API)
                </label>
                {voices.length > 0 ? (
                  <select
                    value={selectedVoice}
                    onChange={(e) => handleVoiceChange(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {voices.map((voice) => (
                      <option key={voice.voiceURI} value={voice.voiceURI}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                      ⚠️ No Polish voices found
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300">
                      Install Polish TTS voices on your system for better pronunciation.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Speed Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Speed: {speechRate.toFixed(1)}x
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={speechRate}
                onChange={(e) => handleRateChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-1">
                <span>0.5x (Slow)</span>
                <span>1x (Normal)</span>
                <span>2x (Fast)</span>
              </div>
            </div>

            {/* Test TTS */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Test TTS
              </label>
              <div className="flex gap-3">
                <input
                  ref={testTextInputRef}
                  type="text"
                  defaultValue="Dzień dobry! Jak się masz?"
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Enter text to test..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleTestTTS}
                  disabled={isTestingTTS}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Volume2 className="w-4 h-4" />
                  {isTestingTTS ? 'Playing...' : 'Play'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* TTS Backend Status */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5" />
            TTS Backend
          </h2>
          
          <div className="space-y-4">
            {/* Backend Status */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Current Backend
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {backendStatus === 'checking' && 'Checking backend status...'}
                  {backendStatus === 'piper' && 'Using Piper TTS (High-quality neural voices)'}
                  {backendStatus === 'webspeech' && 'Using Web Speech API (Browser voices)'}
                </p>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                backendStatus === 'piper' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : backendStatus === 'webspeech'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
              }`}>
                {backendStatus === 'checking' && '⏳ Checking'}
                {backendStatus === 'piper' && '✅ Piper'}
                {backendStatus === 'webspeech' && '⚠️ Web Speech'}
              </div>
            </div>

            {/* Cache Stats (only show for Piper backend) */}
            {backendStatus === 'piper' && cacheStats && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      Audio Cache
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {cacheStats.count} files • {cacheStats.sizeFormatted}
                    </p>
                  </div>
                  <button
                    onClick={handleClearCache}
                    disabled={isLoadingCache || cacheStats.count === 0}
                    className="px-3 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Clear Cache
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cached audio files are reused for faster playback. Clearing the cache will free up disk space.
                </p>
              </div>
            )}

            {/* Installation instructions for Web Speech API users */}
            {backendStatus === 'webspeech' && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                    💡 Want better voice quality?
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-300 mb-3">
                    Install Piper TTS for natural-sounding Polish voices. Run these commands:
                  </p>
                  <div className="bg-blue-100 dark:bg-blue-950 rounded p-3 font-mono text-xs text-blue-900 dark:text-blue-100 space-y-1">
                    <div>yay -S piper-tts-bin</div>
                    <div>mkdir -p public/voices && cd public/voices</div>
                    <div className="text-[10px] break-all">wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/medium/pl_PL-mls_6892-medium.onnx</div>
                    <div className="text-[10px] break-all">wget https://huggingface.co/rhasspy/piper-voices/resolve/main/pl/pl_PL/mls_6892/medium/pl_PL-mls_6892-medium.onnx.json</div>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-2">
                    After installation, restart the development server.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* TTS Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Text-to-Speech Preferences
          </h2>
          
          <div className="space-y-4">
            {/* Auto-play */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Auto-play Audio
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically play audio when exercises load
                </p>
              </div>
              <button
                onClick={() => updateTTSPreferences({ autoPlay: !ttsPreferences.autoPlay })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ttsPreferences.autoPlay ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ttsPreferences.autoPlay ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Default Speed */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Speed
              </label>
              <select 
                value={ttsPreferences.defaultSpeed}
                onChange={(e) => updateTTSPreferences({ defaultSpeed: e.target.value as 'normal' | 'slow' })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="normal">Normal Speed</option>
                <option value="slow">Slow Speed (for learning)</option>
              </select>
            </div>

            {/* Visual Feedback */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Visual Feedback
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Show animations and highlights during audio playback
                </p>
              </div>
              <button
                onClick={() => updateTTSPreferences({ showVisualFeedback: !ttsPreferences.showVisualFeedback })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  ttsPreferences.showVisualFeedback ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    ttsPreferences.showVisualFeedback ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Learning Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            Learning Preferences
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Daily Goal
              </label>
              <select 
                defaultValue="15"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="5">5 exercises per day</option>
                <option value="10">10 exercises per day</option>
                <option value="15">15 exercises per day</option>
                <option value="20">20 exercises per day</option>
                <option value="30">30 exercises per day</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Review Frequency
              </label>
              <select 
                defaultValue="relaxed"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="strict">Strict (follow SM-2 exactly)</option>
                <option value="relaxed">Relaxed (allow early reviews)</option>
                <option value="aggressive">Aggressive (more frequent reviews)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Data Management
          </h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Progress Data
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                All your progress is stored locally in your browser. Your data never leaves your device.
              </p>
              <div className="flex gap-3">
                <button className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors">
                  Export Data
                </button>
                <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                  Import Data
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-red-600 dark:text-red-400 mb-2">
                Danger Zone
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                This action cannot be undone. All your progress will be permanently deleted.
              </p>
              <button 
                onClick={() => setShowResetConfirm(true)}
                className="px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors"
              >
                Reset All Progress
              </button>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            About
          </h2>
          
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p><strong>Version:</strong> 0.1.0 (MVP)</p>
            <p><strong>Content:</strong> 1 unit, 3 lessons, 15 exercises</p>
            <p><strong>CEFR Level:</strong> A1</p>
            <p className="pt-4">
              PolskiOdZera is an open-source Polish learning app built with Next.js, TypeScript, and modern web technologies.
            </p>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Reset All Progress?
              </h3>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete all your progress, including:
            </p>
            
            <ul className="list-disc list-inside text-sm text-gray-600 dark:text-gray-400 mb-6 space-y-1">
              <li>All completed lessons and exercises</li>
              <li>Vocabulary progress and review cards</li>
              <li>Mistake history and analytics</li>
              <li>Streaks and statistics</li>
              <li>All saved data</li>
            </ul>
            
            <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-6">
              This action cannot be undone!
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetProgress}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
