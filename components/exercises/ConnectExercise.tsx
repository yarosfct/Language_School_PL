'use client';

import { useState } from 'react';
import { ConnectData } from '@/types/curriculum';

interface ConnectExerciseProps {
  data: ConnectData;
  onSubmit: (answer: Array<{leftId: string, rightId: string}>) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function ConnectExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation 
}: ConnectExerciseProps) {
  const [connections, setConnections] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const handleConnect = (leftId: string, rightId: string) => {
    if (submitted) return;
    
    setConnections(prev => ({
      ...prev,
      [leftId]: rightId
    }));
  };

  const handleSubmit = () => {
    const answer = Object.entries(connections).map(([leftId, rightId]) => ({
      leftId,
      rightId
    }));
    
    setSubmitted(true);
    onSubmit(answer);
  };

  const isComplete = Object.keys(connections).length === data.leftItems.length;

  return (
    <div className="space-y-4">
      {/* Connection UI */}
      <div className="space-y-3">
        {data.leftItems.map((leftItem) => {
          const selectedRight = connections[leftItem.id];
          
          return (
            <div key={leftItem.id} className="flex items-center gap-4">
              <div className="flex-1 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-gray-900 dark:text-white font-medium">
                  {leftItem.text}
                </span>
              </div>
              
              <div className="w-8 h-0.5 bg-gray-300 dark:bg-gray-600"></div>
              
              <select
                value={selectedRight || ''}
                onChange={(e) => handleConnect(leftItem.id, e.target.value)}
                disabled={submitted}
                className="flex-1 p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              >
                <option value="">Select...</option>
                {data.rightItems.map((rightItem) => (
                  <option key={rightItem.id} value={rightItem.id}>
                    {rightItem.text}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
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
