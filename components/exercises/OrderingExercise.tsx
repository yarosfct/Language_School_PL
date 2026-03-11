'use client';

import { useState, useEffect } from 'react';
import { OrderingData } from '@/types/curriculum';
import { shuffle } from '@/lib/utils/string';
import { RefreshCcw, X } from 'lucide-react';
import { InteractiveAnswerText } from '@/components/exercises/InteractiveAnswerText';
import { TTSButton } from '@/components/ui/TTSButton';
import { TTSControls } from '@/components/ui/TTSControls';

interface OrderingExerciseProps {
  data: OrderingData;
  onSubmit: (answer: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
  autoPlayTTS?: boolean;
  referenceAnswerText?: string;
  referenceSectionId?: string;
}

export function OrderingExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  referenceAnswerText,
  referenceSectionId,
}: OrderingExerciseProps) {
  const [wordBank, setWordBank] = useState<string[]>([]);
  const [answerTokens, setAnswerTokens] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setWordBank(data.scrambled ? [...data.scrambled] : shuffle(data.items));
    setAnswerTokens([]);
    setSubmitted(false);
  }, [data]);

  const selectToken = (index: number) => {
    if (submitted) {
      return;
    }

    const token = wordBank[index];
    if (!token) {
      return;
    }

    const nextWordBank = [...wordBank];
    nextWordBank.splice(index, 1);

    setWordBank(nextWordBank);
    setAnswerTokens((previous) => [...previous, token]);
  };

  const removeToken = (index: number) => {
    if (submitted) {
      return;
    }

    const token = answerTokens[index];
    if (!token) {
      return;
    }

    const nextAnswerTokens = [...answerTokens];
    nextAnswerTokens.splice(index, 1);

    setAnswerTokens(nextAnswerTokens);
    setWordBank((previous) => [...previous, token]);
  };

  const resetAnswer = () => {
    if (submitted) {
      return;
    }

    setWordBank(data.scrambled ? [...data.scrambled] : shuffle(data.items));
    setAnswerTokens([]);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(answerTokens);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm italic text-gray-600 dark:text-gray-400">
          Tap words to build the sentence. Extra words are included.
        </p>
        {!submitted && (
          <button
            onClick={resetAnswer}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Your sentence</p>
        {answerTokens.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Select words from the bank below.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {answerTokens.map((token, index) => (
              <button
                key={`answer-${index}-${token}`}
                onClick={() => removeToken(index)}
                disabled={submitted}
                className="inline-flex items-center gap-1 rounded-lg border border-cyan-300 bg-cyan-100 px-3 py-2 text-sm font-medium text-cyan-900 hover:bg-cyan-200 disabled:cursor-not-allowed dark:border-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-100"
              >
                {token}
                {!submitted && <X className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/40">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Word bank</p>
        <div className="flex flex-wrap gap-2">
          {wordBank.map((token, index) => (
            <button
              key={`bank-${index}-${token}`}
              onClick={() => selectToken(index)}
              disabled={submitted}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:border-primary-400 hover:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-primary-900/20"
            >
              {token}
            </button>
          ))}
        </div>
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={answerTokens.length !== data.items.length}
          className="w-full rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Submit Answer
        </button>
      )}

      {submitted && showFeedback && (
        <div
          className={`rounded-lg p-4 ${
            isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          <p className="mb-2 font-semibold">{isCorrect ? 'Correct!' : 'Incorrect'}</p>
          {referenceAnswerText && referenceSectionId ? (
            <div className="text-sm">
              <p className="font-semibold">{isCorrect ? 'Completed sentence:' : 'Correct sentence:'}</p>
              <div className="mt-1">
                <InteractiveAnswerText text={referenceAnswerText} sectionId={referenceSectionId} />
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Correct sentence:</p>
              <p>{data.items.join(' ')}</p>
            </div>
          )}
          {isCorrect && (
            <div className="mt-3">
              <TTSControls text={data.items.join(' ')} showSlowToggle={true} showReplayButton={false} />
            </div>
          )}
        </div>
      )}

      <div className="flex justify-center">
        <TTSButton text={data.items.join(' ')} size="sm" variant="minimal" />
      </div>
    </div>
  );
}
