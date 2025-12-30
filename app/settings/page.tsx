'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/lib/store/useStore';
import { Settings as SettingsIcon, Volume2, Mic, AlertTriangle } from 'lucide-react';
import { speak, getAvailableVoices, setVoice, setRate } from '@/lib/tts';
import { clearAllData } from '@/lib/db';

export default function SettingsPage() {
  const { soundEnabled, toggleSound, resetStore } = useStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speechRate, setSpeechRate] = useState<number>(1);
  const [testText, setTestText] = useState<string>('Dzień dobry! Jak się masz?');
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [isResetting, setIsResetting] = useState<boolean>(false);

  useEffect(() => {
    // Load voices when available
    const loadVoices = () => {
      const availableVoices = getAvailableVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(availableVoices[0].name);
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
  }, []);

  const handleVoiceChange = (voiceName: string) => {
    setSelectedVoice(voiceName);
    setVoice(voiceName);
  };

  const handleRateChange = (rate: number) => {
    setSpeechRate(rate);
    setRate(rate);
  };

  const handleTestTTS = () => {
    speak(testText);
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
            {/* Voice Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Voice
              </label>
              {voices.length > 0 ? (
                <select
                  value={selectedVoice}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {voices.map((voice) => (
                    <option key={voice.name} value={voice.name}>
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  No Polish voices available. TTS will use default browser voice.
                </p>
              )}
            </div>

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
                  type="text"
                  value={testText}
                  onChange={(e) => setTestText(e.target.value)}
                  placeholder="Enter text to test..."
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <button
                  onClick={handleTestTTS}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center gap-2"
                >
                  <Volume2 className="w-4 h-4" />
                  Play
                </button>
              </div>
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
