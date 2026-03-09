'use client';

import { useState, useRef } from 'react';
import { FillBlankData } from '@/types/curriculum';
import { TTSControls } from '@/components/ui/TTSControls';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';

interface FillBlankExerciseProps {
  data: FillBlankData;
  onSubmit: (answer: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
  autoPlayTTS?: boolean;
}

export function FillBlankExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation,
  autoPlayTTS = false,
}: FillBlankExerciseProps) {
  const [answers, setAnswers] = useState<string[]>(
    new Array(data.blanks.length).fill('')
  );
  const [submitted, setSubmitted] = useState(false);
  const [activeInputIndex, setActiveInputIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleAnswerChange = (index: number, value: string) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(answers);
  };

  const insertDiacritic = (char: string) => {
    if (activeInputIndex === null) return;
    
    const input = inputRefs.current[activeInputIndex];
    if (!input) return;

    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const currentValue = answers[activeInputIndex];
    const newValue = currentValue.slice(0, start) + char + currentValue.slice(end);
    
    handleAnswerChange(activeInputIndex, newValue);
    
    // Set cursor position after inserted character
    setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    }, 0);
  };

  // Split template by ___ to create parts
  const parts = data.template.split('___');
  const isComplete = answers.every(a => a.trim().length > 0);
  
  // Create full sentence for TTS (replace ___ with blanks or answers)
  const getTTSText = () => {
    let text = data.template;
    data.blanks.forEach((blank, idx) => {
      const replacement = submitted && answers[idx] 
        ? answers[idx] 
        : blank.acceptedAnswers[0];
      text = text.replace('___', replacement);
    });
    return text;
  };

  return (
    <div className="space-y-4">
      {/* TTS Controls */}
      <div className="flex justify-center">
        <TTSControls 
          text={getTTSText()}
          autoPlay={autoPlayTTS}
          showSlowToggle={true}
          showReplayButton={true}
        />
      </div>

      {/* Template with blanks */}
      <div className="p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-lg text-gray-900 dark:text-white flex flex-wrap items-center gap-2">
          {parts.map((part, index) => (
            <span key={index} className="inline-flex items-center gap-2">
              <span>{part}</span>
              {index < data.blanks.length && (
                <input
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  value={answers[index]}
                  onChange={(e) => handleAnswerChange(index, e.target.value)}
                  onFocus={() => setActiveInputIndex(index)}
                  disabled={submitted}
                  className={`inline-block px-3 py-1 border-2 rounded min-w-[120px] ${
                    submitted && showFeedback
                      ? isCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-300 dark:border-gray-600'
                  } bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500`}
                  placeholder="..."
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              )}
            </span>
          ))}
        </div>
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
