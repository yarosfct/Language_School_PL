'use client';

import { useState, useRef } from 'react';
import { TypedAnswerData } from '@/types/curriculum';
import { Lightbulb } from 'lucide-react';
import { TTSControls } from '@/components/ui/TTSControls';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';

interface TypedAnswerExerciseProps {
  data: TypedAnswerData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  explanation?: string;
  hints?: string[];
  autoPlayTTS?: boolean;
}

export function TypedAnswerExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  feedbackMessage,
  isCorrect,
  explanation,
  hints,
  autoPlayTTS = false,
}: TypedAnswerExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(answer);
  };

  const insertDiacritic = (char: string) => {
    const input = inputRef.current;
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newValue = answer.slice(0, start) + char + answer.slice(end);
    setAnswer(newValue);
    
    // Set cursor position after inserted character
    setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    }, 0);
  };

  return (
    <div className="space-y-4">
      {/* Question with TTS */}
      {data.question && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            {data.question}
          </p>
          <TTSControls 
            text={data.question}
            autoPlay={autoPlayTTS}
            showSlowToggle={true}
            showReplayButton={true}
          />
        </div>
      )}

      {/* Input field */}
      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={submitted}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim() && !submitted) {
              handleSubmit();
            }
          }}
          className={`w-full p-4 text-lg border-2 rounded-lg ${
            submitted && showFeedback
              ? isCorrect
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-gray-600'
          } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500`}
          placeholder="Type your answer in Polish..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Press Enter or click Submit when ready
        </p>
      </div>

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

      {/* Hints */}
      {hints && hints.length > 0 && !submitted && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:underline"
          >
            <Lightbulb className="w-4 h-4" />
            {showHints ? 'Hide hints' : 'Show hints'}
          </button>
          
          {showHints && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Submit Answer
        </button>
      )}

      {/* Feedback */}
      {submitted && showFeedback && (
        <div className={`p-4 rounded-lg ${
          isCorrect
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
        }`}>
          <p className="font-semibold mb-2">
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          {feedbackMessage && <p className="mb-2">{feedbackMessage}</p>}
          {explanation && <p>{explanation}</p>}
          {!isCorrect && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Accepted answers:</p>
              <p>{data.acceptedAnswers.join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {/* Play correct answer after submission */}
      {submitted && showFeedback && (
        <div className="flex justify-center">
          <TTSControls 
            text={data.acceptedAnswers[0]}
            showSlowToggle={true}
            showReplayButton={true}
          />
        </div>
      )}
    </div>
  );
}
