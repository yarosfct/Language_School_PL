'use client';

import { useState, useEffect } from 'react';
import { ListeningChoiceData } from '@/types/curriculum';
import { speakPolish, isTTSSupported, isSpeaking, stopSpeaking, setRate } from '@/lib/tts';
import { Volume2, VolumeX, Check, X, RefreshCw } from 'lucide-react';

interface ListeningChoiceExerciseProps {
  data: ListeningChoiceData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function ListeningChoiceExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  explanation,
}: ListeningChoiceExerciseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    // Apply playback speed if specified
    if (data.playbackSpeed) {
      setRate(data.playbackSpeed);
    }
    return () => {
      stopSpeaking();
      setRate(1.0);
    };
  }, [data.playbackSpeed]);

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
    
    // Temporarily set slower rate
    const originalRate = data.playbackSpeed ?? 1.0;
    setRate(0.7);
    
    speakPolish(data.audioText, () => {
      setIsPlaying(false);
      setRate(originalRate);
    });
  };

  const handleSubmit = () => {
    if (selectedOption) {
      setSubmitted(true);
      onSubmit(selectedOption);
    }
  };

  return (
    <div className="space-y-6">
      {/* Audio player section */}
      <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 dark:bg-gray-800 rounded-xl">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Listen and select what you hear
        </p>
        
        <div className="flex gap-3">
          {/* Normal speed play button */}
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

          {/* Slow play button */}
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

        {!isTTSSupported() && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Text-to-speech is not available in your browser
          </p>
        )}
      </div>

      {/* Options */}
      <div className="space-y-2">
        {data.options.map((option) => {
          const isSelected = selectedOption === option.id;
          const showCorrect = submitted && showFeedback && option.id === data.correctOptionId;
          const showIncorrect = submitted && showFeedback && isSelected && !isCorrect;

          return (
            <button
              key={option.id}
              onClick={() => !submitted && setSelectedOption(option.id)}
              disabled={submitted}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                showCorrect
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : showIncorrect
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-300'
              } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-gray-900 dark:text-white">{option.text}</span>
                {showCorrect && <Check className="w-5 h-5 text-green-600" />}
                {showIncorrect && <X className="w-5 h-5 text-red-600" />}
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption}
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
          <p className="font-semibold mb-2">
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          {!isCorrect && (
            <p className="mb-2">
              The audio said: <strong>"{data.audioText}"</strong>
            </p>
          )}
          {explanation && <p>{explanation}</p>}
        </div>
      )}
    </div>
  );
}
