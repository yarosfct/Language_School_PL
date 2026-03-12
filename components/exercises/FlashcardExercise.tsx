'use client';

import { useState, useEffect, useRef } from 'react';
import { FlashcardData } from '@/types/curriculum';
import { speakPolish, isTTSSupported, isSpeaking, stopSpeaking, speakSlow } from '@/lib/tts';
import { RotateCcw, Check, X, Turtle, Zap, Repeat, AlertCircle } from 'lucide-react';
import { SpeakerIconAnimated } from '@/components/ui/TTSVisualFeedback';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';
import { convertAsteriskPolish } from '@/lib/utils/string';

interface FlashcardExerciseProps {
  data: FlashcardData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  partialCorrect?: boolean;
  explanation?: string;
  autoPlayTTS?: boolean;
}

export function FlashcardExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  partialCorrect,
  explanation,
  autoPlayTTS = false,
}: FlashcardExerciseProps) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [loopMode, setLoopMode] = useState(false);
  const [userAnswer, setUserAnswer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const handleSpeak = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    const speakFn = slowMode ? speakSlow : speakPolish;
    speakFn(data.word, () => {
      if (loopMode && hasAnswered) {
        setTimeout(() => {
          handleSpeak();
        }, 1000);
      } else {
        setIsPlaying(false);
      }
    });
  };

  const toggleSpeed = () => {
    setSlowMode(!slowMode);
    if (isPlaying) {
      stopSpeaking();
      setIsPlaying(false);
    }
  };

  const handleFlip = () => {
    if (hasAnswered) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleSubmit = () => {
    if (userAnswer.trim()) {
      setHasAnswered(true);
      onSubmit(userAnswer.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && userAnswer.trim() && !hasAnswered) {
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

  // Determine feedback state
  const getFeedbackState = () => {
    if (!hasAnswered || !showFeedback) return null;
    if (isCorrect && !partialCorrect) return 'correct';
    if (isCorrect && partialCorrect) return 'partial';
    return 'wrong';
  };

  const feedbackState = getFeedbackState();

  return (
    <div className="space-y-6">
      {/* Flashcard */}
      <div
        className={`relative w-full h-64 sm:h-80 perspective-1000 ${hasAnswered ? 'cursor-pointer' : ''}`}
        onClick={handleFlip}
      >
        <div
          className={`absolute inset-0 transition-transform duration-500 transform-style-3d ${
            isFlipped ? 'rotate-y-180' : ''
          }`}
        >
          {/* Front of card (English word - what to translate) */}
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
                  alt={data.translation}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* English word (what to translate) */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              Translate to Polish:
            </p>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-2">
              {data.translation}
            </h2>

            {/* Gender/Part of speech hint */}
            <div className="mt-2 flex gap-2">
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

            {/* Flip hint (only after answering) */}
            {hasAnswered && (
              <p className="absolute bottom-4 text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <RotateCcw className="w-4 h-4" />
                Tap to see answer
              </p>
            )}
          </div>

          {/* Back of card (Polish word - the answer) */}
          <div
            className={`absolute inset-0 backface-hidden rotate-y-180 rounded-2xl shadow-lg border-2 
              ${feedbackState === 'correct' ? 'border-green-400 dark:border-green-600' :
                feedbackState === 'partial' ? 'border-amber-400 dark:border-amber-600' :
                feedbackState === 'wrong' ? 'border-red-400 dark:border-red-600' :
                'border-green-300 dark:border-green-700'}
              bg-gradient-to-br from-green-50 to-white dark:from-gray-800 dark:to-gray-900
              flex flex-col items-center justify-center p-6`}
          >
            {/* Polish word (the answer) */}
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white text-center mb-2">
              {data.word}
            </h2>

            {/* Pronunciation */}
            {data.pronunciation && (
              <p className="text-lg text-gray-500 dark:text-gray-400 italic mb-4">
                [{data.pronunciation}]
              </p>
            )}

            {/* TTS controls */}
            {isTTSSupported() && (
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSpeak();
                  }}
                  className={`p-3 rounded-full transition-all ${
                    isPlaying
                      ? 'bg-primary-500 text-white animate-pulse'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={isPlaying ? 'Stop' : 'Listen'}
                >
                  <SpeakerIconAnimated isPlaying={isPlaying} size="md" />
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSpeed();
                  }}
                  className={`p-2 rounded-full transition-colors ${
                    slowMode
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={slowMode ? 'Normal speed' : 'Slow speed'}
                >
                  {slowMode ? <Turtle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setLoopMode(!loopMode);
                  }}
                  className={`p-2 rounded-full transition-colors ${
                    loopMode
                      ? 'bg-purple-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  title={loopMode ? 'Disable loop' : 'Enable loop'}
                >
                  <Repeat className="w-5 h-5" />
                </button>
              </div>
            )}

            {/* Example sentence */}
            {data.example && (
              <div className="mt-2 text-center max-w-sm">
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

      {/* Input section */}
      {!hasAnswered && (
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={userAnswer}
            onChange={(e) => setUserAnswer(convertAsteriskPolish(e.target.value))}
            onKeyDown={handleKeyDown}
            placeholder="Type the Polish word..."
            className="w-full px-4 py-3 text-lg border-2 rounded-xl transition-colors
              border-gray-300 dark:border-gray-600 focus:border-primary-500 dark:focus:border-primary-500
              bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />

          {/* Polish diacritics keyboard */}
          <div className="flex justify-center">
            <DiacriticsKeyboard 
              onCharacter={insertDiacritic}
              compact={true}
              className="diacritics-keyboard"
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim()}
            className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold 
              hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 
              disabled:cursor-not-allowed transition-colors"
          >
            Check Answer
          </button>
        </div>
      )}

      {/* Feedback after answer */}
      {hasAnswered && showFeedback && (
        <div
          className={`p-4 rounded-lg ${
            feedbackState === 'correct'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : feedbackState === 'partial'
              ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}
        >
          <div className="flex items-center gap-2 mb-2">
            {feedbackState === 'correct' ? (
              <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
            ) : feedbackState === 'partial' ? (
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <X className="w-5 h-5 text-red-600 dark:text-red-400" />
            )}
            <p className="font-semibold">
              {feedbackState === 'correct'
                ? 'Correct!'
                : feedbackState === 'partial'
                ? 'Almost there!'
                : 'Not quite right'}
            </p>
          </div>
          
          <p className="text-sm mb-2">
            Your answer: <span className="font-medium">{userAnswer}</span>
          </p>
          
          {feedbackState !== 'correct' && (
            <p className="text-sm">
              Correct answer: <span className="font-medium">{data.word}</span>
            </p>
          )}
          
          {explanation && (
            <p className="mt-2 text-sm">{explanation}</p>
          )}

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Tap the card above to see the full answer with example sentence.
          </p>
        </div>
      )}
    </div>
  );
}
