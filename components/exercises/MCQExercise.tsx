'use client';

import { useState } from 'react';
import { MCQData } from '@/types/curriculum';
import { Check, X } from 'lucide-react';

interface MCQExerciseProps {
  data: MCQData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  explanation?: string;
  hints?: string[];
}

export function MCQExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation 
}: MCQExerciseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (selectedOption) {
      setSubmitted(true);
      onSubmit(selectedOption);
    }
  };

  return (
    <div className="space-y-4">
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
          className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          Submit Answer
        </button>
      )}

      {/* Feedback */}
      {submitted && showFeedback && explanation && (
        <div className={`p-4 rounded-lg ${
          isCorrect
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
        }`}>
          <p className="font-semibold mb-2">
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          <p>{explanation}</p>
        </div>
      )}
    </div>
  );
}
