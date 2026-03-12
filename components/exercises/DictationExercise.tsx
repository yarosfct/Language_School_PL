'use client';

import { useState, useEffect, useRef } from 'react';
import { DictationData } from '@/types/curriculum';
import { speakPolish, isTTSSupported, isSpeaking, stopSpeaking, setRate } from '@/lib/tts';
import { Volume2, VolumeX, RefreshCw, Lightbulb, Check, X } from 'lucide-react';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';
import { convertAsteriskPolish } from '@/lib/utils/string';

interface DictationExerciseProps {
  data: DictationData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  explanation?: string;
  hints?: string[];
}

export function DictationExercise({
  data,
  onSubmit,
  showFeedback,
  feedbackMessage,
  isCorrect,
  explanation,
  hints = [],
}: DictationExerciseProps) {
  const [userAnswer, setUserAnswer] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [currentHintIndex, setCurrentHintIndex] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Combine data hints with prop hints
  const allHints = [...hints, ...(data.hints || [])];

  useEffect(() => {
    if (data.playbackSpeed) {
      setRate(data.playbackSpeed);
    }
    return () => {
      stopSpeaking();
      setRate(1.0);
    };
  }, [data.playbackSpeed]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePlay = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setPlayCount(prev => prev + 1);
    
    speakPolish(data.audioText, () => {
      setIsPlaying(false);
      inputRef.current?.focus();
    });
  };

  const handlePlaySlow = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    setPlayCount(prev => prev + 1);
    
    const originalRate = data.playbackSpeed ?? 1.0;
    setRate(0.6);
    
    speakPolish(data.audioText, () => {
      setIsPlaying(false);
      setRate(originalRate);
      inputRef.current?.focus();
    });
  };

  const handleShowHint = () => {
    if (!showHint) {
      setShowHint(true);
    } else if (currentHintIndex < allHints.length - 1) {
      setCurrentHintIndex(prev => prev + 1);
    }
  };

  const handleSubmit = () => {
    if (userAnswer.trim()) {
      setSubmitted(true);
      onSubmit(userAnswer.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userAnswer.trim() && !submitted) {
      handleSubmit();
    }
  };

  const insertDiacritic = (char: string) => {
    if (inputRef.current) {
      const start = inputRef.current.selectionStart || 0;
      const end = inputRef.current.selectionEnd || 0;
      const newValue = convertAsteriskPolish(userAnswer.slice(0, start) + char + userAnswer.slice(end));
      setUserAnswer(newValue);
      
      // Set cursor position after inserted character
      setTimeout(() => {
        inputRef.current?.setSelectionRange(start + 1, start + 1);
        inputRef.current?.focus();
      }, 0);
    }
  };

  return (
    <div className="space-y-6">
      {/* Audio player section */}
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Listen and type what you hear
        </p>
        
        <div className="flex gap-3">
          <button
            onClick={handlePlay}
            disabled={!isTTSSupported()}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              isPlaying
                ? 'bg-primary-500 text-white'
                : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50'
            }`}
          >
            {isPlaying ? (
              <>
                <VolumeX className="w-5 h-5" />
                Stop
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5" />
                Play
              </>
            )}
          </button>

          <button
            onClick={handlePlaySlow}
            disabled={!isTTSSupported() || isPlaying}
            className="flex items-center gap-2 px-4 py-3 rounded-xl font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-all"
            title="Play slowly"
          >
            <RefreshCw className="w-4 h-4" />
            Slow
          </button>
        </div>

        {playCount > 0 && (
          <p className="text-xs text-gray-400">
            Played {playCount} time{playCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Input section */}
      <div className="space-y-3">
        <input
          ref={inputRef}
          type="text"
          value={userAnswer}
          onChange={(e) => setUserAnswer(convertAsteriskPolish(e.target.value))}
          onKeyDown={handleKeyDown}
          disabled={submitted}
          placeholder="Type what you heard..."
          className={`w-full px-4 py-3 text-lg border-2 rounded-xl transition-colors ${
            submitted
              ? isCorrect
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-gray-600 focus:border-primary-500 dark:focus:border-primary-500'
          } bg-white dark:bg-gray-800 text-gray-900 dark:text-white`}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Polish diacritics keyboard */}
        {!submitted && (
          <div className="flex justify-center">
            <DiacriticsKeyboard 
              onCharacter={insertDiacritic}
              compact={true}
              className="diacritics-keyboard"
            />
          </div>
        )}
      </div>

      {/* Hint section */}
      {allHints.length > 0 && !submitted && (
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={handleShowHint}
            className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
          >
            <Lightbulb className="w-4 h-4" />
            {showHint && currentHintIndex < allHints.length - 1
              ? 'Next hint'
              : 'Show hint'}
          </button>
          
          {showHint && (
            <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-lg">
              {allHints[currentHintIndex]}
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!userAnswer.trim()}
          className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          Check Answer
        </button>
      )}

      {/* Feedback */}
      {submitted && showFeedback && (
        <div
          className={`p-4 rounded-lg ${
            isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {isCorrect ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <X className="w-5 h-5 text-red-600" />
            )}
            <p className="font-semibold">
              {isCorrect ? 'Correct!' : 'Not quite right'}
            </p>
          </div>
          
          {feedbackMessage && (
            <p className="mb-2 text-sm">{feedbackMessage}</p>
          )}
          
          {!isCorrect && (
            <div className="mt-2">
              <p className="text-sm font-medium">Correct answer:</p>
              <p className="text-lg font-semibold">{data.audioText}</p>
            </div>
          )}
          
          {explanation && (
            <p className="mt-2 text-sm">{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
