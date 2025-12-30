'use client';

import { useState } from 'react';
import { FillBlankData } from '@/types/curriculum';

interface FillBlankExerciseProps {
  data: FillBlankData;
  onSubmit: (answer: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function FillBlankExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation 
}: FillBlankExerciseProps) {
  const [answers, setAnswers] = useState<string[]>(
    new Array(data.blanks.length).fill('')
  );
  const [submitted, setSubmitted] = useState(false);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(answers);
  };

  // Split template by ___ to create parts
  const parts = data.template.split('___');
  const isComplete = answers.every(a => a.trim().length > 0);

  return (
    <div className="space-y-4">
      {/* Template with blanks */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-lg text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
          {parts.map((part, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              <span>{part}</span>
              {index < data.blanks.length && (
                <input
                  type="text"
                  value={answers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  disabled={submitted}
                  className={`inline-block px-3 py-1 border-2 rounded min-w-[120px] ${
                    submitted && showFeedback
                      ? isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  placeholder="..."
                />
              )}
            </span>
          ))}
        </div>
      </div>

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!isComplete}
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
          {explanation && <p>{explanation}</p>}
          {!isCorrect && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Correct answers:</p>
              <ul className="list-disc list-inside">
                {data.blanks.map((blank, idx) => (
                  <li key={idx}>{blank.acceptedAnswers.join(' or ')}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
