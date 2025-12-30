'use client';

import { useState } from 'react';
import { TypedAnswerData } from '@/types/curriculum';
import { Lightbulb } from 'lucide-react';

interface TypedAnswerExerciseProps {
  data: TypedAnswerData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  explanation?: string;
  hints?: string[];
}

export function TypedAnswerExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  feedbackMessage,
  isCorrect,
  explanation,
  hints 
}: TypedAnswerExerciseProps) {
  const [answer, setAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [showHints, setShowHints] = useState(false);

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(answer);
  };

  return (
    <div className="space-y-4">
      {/* Input field */}
      <div className="space-y-2">
        <input
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
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Press Enter or click Submit when ready
        </p>
      </div>

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
    </div>
  );
}
