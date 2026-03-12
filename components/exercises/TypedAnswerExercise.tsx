'use client';

import { useState, useRef } from 'react';
import { TypedAnswerData } from '@/types/curriculum';
import { Lightbulb } from 'lucide-react';
import { InteractiveAnswerText } from '@/components/exercises/InteractiveAnswerText';
import { TTSControls } from '@/components/ui/TTSControls';
import { DiacriticsKeyboard } from '@/components/ui/DiacriticsKeyboard';
import { convertAsteriskPolish } from '@/lib/utils/string';

interface TypedAnswerExerciseProps {
  data: TypedAnswerData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  partialCorrect?: boolean;
  explanation?: string;
  hints?: string[];
  autoPlayTTS?: boolean;
  referenceAnswerText?: string;
  referenceSectionId?: string;
}

export function TypedAnswerExercise({
  data,
  onSubmit,
  showFeedback,
  feedbackMessage,
  isCorrect,
  partialCorrect,
  hints,
  autoPlayTTS = false,
  referenceAnswerText,
  referenceSectionId,
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
    const newValue = convertAsteriskPolish(answer.slice(0, start) + char + answer.slice(end));
    setAnswer(newValue);

    setTimeout(() => {
      input.setSelectionRange(start + 1, start + 1);
      input.focus();
    }, 0);
  };

  return (
    <div className="space-y-4">
      {data.question && (
        <div className="mb-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <p className="mb-3 text-lg font-medium text-gray-900 dark:text-white">{data.question}</p>
          <TTSControls text={data.question} autoPlay={autoPlayTTS} showSlowToggle={true} showReplayButton={true} />
        </div>
      )}

      <div className="space-y-2">
        <input
          ref={inputRef}
          type="text"
          value={answer}
          onChange={(e) => setAnswer(convertAsteriskPolish(e.target.value))}
          disabled={submitted}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && answer.trim() && !submitted) {
              handleSubmit();
            }
          }}
          className={`w-full rounded-lg border-2 bg-white p-4 text-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white ${
            submitted && showFeedback
              ? partialCorrect
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20'
                : isCorrect
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-red-500 bg-red-50 dark:bg-red-900/20'
              : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder="Type your answer in Polish..."
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <p className="text-sm text-gray-600 dark:text-gray-400">Press Enter or click Submit when ready</p>
      </div>

      {!submitted && (
        <div className="flex justify-center">
          <DiacriticsKeyboard onCharacter={insertDiacritic} compact={true} className="diacritics-keyboard" />
        </div>
      )}

      {hints && hints.length > 0 && !submitted && (
        <div className="space-y-2">
          <button
            onClick={() => setShowHints(!showHints)}
            className="flex items-center gap-2 text-primary-600 hover:underline dark:text-primary-400"
          >
            <Lightbulb className="h-4 w-4" />
            {showHints ? 'Hide hints' : 'Show hints'}
          </button>

          {showHints && (
            <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
              <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {hints.map((hint, idx) => (
                  <li key={idx}>{hint}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!answer.trim()}
          className="w-full rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Submit Answer
        </button>
      )}

      {submitted && showFeedback && (
        <div
          className={`rounded-lg p-4 ${
            partialCorrect
              ? 'bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300'
              : isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          <p className="mb-2 font-semibold">
            {partialCorrect ? 'Almost correct (accepted)' : isCorrect ? 'Correct!' : 'Incorrect'}
          </p>
          {feedbackMessage && <p className="mb-2">{feedbackMessage}</p>}
          {referenceAnswerText && referenceSectionId ? (
            <div className="text-sm">
              <p className="font-semibold">{partialCorrect || !isCorrect ? 'Accepted answer:' : 'Answer:'}</p>
              <div className="mt-1">
                <InteractiveAnswerText text={referenceAnswerText} sectionId={referenceSectionId} />
              </div>
              {data.acceptedAnswers.length > 1 && (
                <p className="mt-2 text-xs opacity-80">
                  Also accepted: {data.acceptedAnswers.slice(1).join(', ')}
                </p>
              )}
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Accepted answers:</p>
              <p>{data.acceptedAnswers.join(', ')}</p>
            </div>
          )}
        </div>
      )}

      {submitted && showFeedback && (
        <div className="flex justify-center">
          <TTSControls text={data.acceptedAnswers[0]} showSlowToggle={true} showReplayButton={true} />
        </div>
      )}
    </div>
  );
}
