'use client';

import { useState, useEffect } from 'react';
import { FlashcardData } from '@/types/curriculum';
import { speakPolish, isTTSSupported, isSpeaking, stopSpeaking } from '@/lib/tts';
import { Volume2, VolumeX, RotateCcw, Check, X } from 'lucide-react';

interface FlashcardExerciseProps {
  data: FlashcardData;
  onSubmit: (answer: boolean) => void; // true = "I know this", false = "I don't know"
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
  autoPlayTTS?: boolean;
}

export function FlashcardExercise({
  data,
  onSubmit,
  showFeedback,
  explanation,
  autoPlayTTS = false,
}: FlashcardExerciseProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  // Auto-play TTS when card loads
  useEffect(() => {
    if (autoPlayTTS && isTTSSupported()) {
      handleSpeak();
    }
    return () => {
      stopSpeaking();
    };
  }, [data.word, autoPlayTTS]);

  const handleSpeak = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    speakPolish(data.word, () => {
      setIsPlaying(false);
    });
  };

  const handleFlip = () => {
    if (!hasAnswered) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleAnswer = (knowIt: boolean) => {
    setHasAnswered(true);
    onSubmit(knowIt);
  };

  return (
    <div className="space-y-6">
      {/* Flashcard */}
      <div
        className="relative w-full h-64 sm:h-80 perspective-1000 cursor-pointer"
        onClick={handleFlip}
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front of card (Polish word) */}
          <div
            className={`absolute inset-0 backface-hidden rounded-2xl shadow-lg border-2 
              ${hasAnswered ? 'border-gray-300 dark:border-gray-600' : 'border-primary-300 dark:border-primary-700'}
              bg-gradient-to-br from-primary-50 to-white dark:from-gray-800 dark:to-gray-900
              flex flex-col items-center justify-center p-6`}
          >
            {/* Image if available */}
            {data.imageAsset && (
              <div className="mb-4 w-20 h-20 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                <img
                  src={data.imageAsset}
                  alt={data.word}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Polish word */}
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-2">
              {data.word}
            </h2>

            {/* Pronunciation */}
            {data.pronunciation && (
              <p className="text-lg text-gray-500 dark:text-gray-400 italic mb-4">
                [{data.pronunciation}]
              </p>
            )}

            {/* TTS button */}
            {isTTSSupported() && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleSpeak();
                }}
                className={`p-3 rounded-full transition-colors ${
                  isPlaying
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
                title={isPlaying ? 'Stop' : 'Listen'}
              >
                {isPlaying ? (
                  <VolumeX className="w-6 h-6" />
                ) : (
                  <Volume2 className="w-6 h-6" />
                )}
              </button>
            )}

            {/* Gender/Part of speech */}
            <div className="mt-4 flex gap-2">
              {data.partOfSpeech && (
                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm text-gray-600 dark:text-gray-400">
                  {data.partOfSpeech}
                </span>
              )}
              {data.gender && (
                <span className={`px-2 py-1 rounded text-sm ${
                  data.gender === 'masculine' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  data.gender === 'feminine' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                }`}>
                  {data.gender}
                </span>
              )}
            </div>

            {/* Tap to flip hint */}
            <p className="absolute bottom-4 text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              Tap to flip
            </p>
          </div>

          {/* Back of card (Translation) */}
          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl shadow-lg border-2 
              ${hasAnswered ? 'border-gray-300 dark:border-gray-600' : 'border-green-300 dark:border-green-700'}
              bg-gradient-to-br from-green-50 to-white dark:from-gray-800 dark:to-gray-900
              flex flex-col items-center justify-center p-6`}
          >
            {/* Translation */}
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-4">
              {data.translation}
            </h2>

            {/* Example sentence */}
            {data.example && (
              <div className="mt-4 text-center max-w-sm">
                <p className="text-lg text-primary-700 dark:text-primary-300 mb-1">
                  "{data.example.polish}"
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  "{data.example.english}"
                </p>
              </div>
            )}

            {/* Tap to flip hint */}
            <p className="absolute bottom-4 text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <RotateCcw className="w-4 h-4" />
              Tap to flip back
            </p>
          </div>
        </div>
      </div>

      {/* Answer buttons */}
      {!hasAnswered && (
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => handleAnswer(false)}
            className="flex-1 max-w-[200px] py-4 px-6 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
          >
            <X className="w-5 h-5" />
            Don't know
          </button>
          <button
            onClick={() => handleAnswer(true)}
            className="flex-1 max-w-[200px] py-4 px-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center justify-center gap-2"
          >
            <Check className="w-5 h-5" />
            I know this
          </button>
        </div>
      )}

      {/* Feedback after answer */}
      {showFeedback && hasAnswered && explanation && (
        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
}
