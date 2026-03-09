'use client';

import { useState } from 'react';
import { MatchData } from '@/types/curriculum';
import { shuffle } from '@/lib/utils/string';
import { TTSIconButton } from '@/components/ui/TTSButton';

interface MatchExerciseProps {
  data: MatchData;
  onSubmit: (answer: Record<string, string>) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function MatchExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation 
}: MatchExerciseProps) {
  const [leftItems] = useState(data.pairs.map(p => p.left));
  const [rightItems] = useState(
    data.shuffleRight 
      ? shuffle(data.pairs.map(p => p.right))
      : data.pairs.map(p => p.right)
  );
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleMatch = (left: string, right: string) => {
    if (submitted) return;
    
    setMatches(prev => ({
      ...prev,
      [left]: right
    }));
  };

  const handleSubmit = () => {
    if (Object.keys(matches).length === leftItems.length) {
      setSubmitted(true);
      onSubmit(matches);
    }
  };

  const isComplete = Object.keys(matches).length === leftItems.length;

  return (
    <div className="space-y-4">
      {/* Matching grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-2">
          {leftItems.map((left) => (
            <div key={left} className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center justify-between">
                <span>{left}</span>
                <TTSIconButton text={left} />
              </div>
              <select
                value={matches[left] || ''}
                onChange={(e) => handleMatch(left, e.target.value)}
                disabled={submitted}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select match...</option>
                {rightItems.map((right) => (
                  <option key={right} value={right}>
                    {right}
                  </option>
                ))}
              </select>
              {matches[left] && (
                <div className="mt-2 flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span>Matched: {matches[left]}</span>
                  <TTSIconButton text={matches[left]} />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Right column (for reference) */}
        <div className="space-y-2">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Available options:
          </div>
          {rightItems.map((right) => (
            <div key={right} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              {right}
            </div>
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
        </div>
      )}
    </div>
  );
}
