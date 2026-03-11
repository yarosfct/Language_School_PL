'use client';

import { useState } from 'react';
import { Check, X } from 'lucide-react';
import { InteractiveAnswerText } from '@/components/exercises/InteractiveAnswerText';
import { TTSButton } from '@/components/ui/TTSButton';
import { TTSVisualFeedback } from '@/components/ui/TTSVisualFeedback';
import { MCQData } from '@/types/curriculum';

interface MCQExerciseProps {
  data: MCQData;
  onSubmit: (answer: string) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  explanation?: string;
  hints?: string[];
  autoPlayTTS?: boolean;
  referenceAnswerText?: string;
  referenceSectionId?: string;
}

export function MCQExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  explanation,
  autoPlayTTS = false,
  referenceAnswerText,
  referenceSectionId,
}: MCQExerciseProps) {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [playingOption, setPlayingOption] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selectedOption) {
      setSubmitted(true);
      onSubmit(selectedOption);
    }
  };

  return (
    <div className="space-y-4">
      {data.question && (
        <div className="mb-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="text-lg font-medium text-gray-900 dark:text-white">{data.question}</p>
            </div>
            <TTSButton text={data.question} autoPlay={autoPlayTTS} size="md" variant="ghost" />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {data.options.map((option) => {
          const isSelected = selectedOption === option.id;
          const showCorrect = submitted && showFeedback && option.id === data.correctOptionId;
          const showIncorrect = submitted && showFeedback && isSelected && !isCorrect;
          const isPlaying = playingOption === option.id;

          return (
            <TTSVisualFeedback key={option.id} isPlaying={isPlaying} variant="glow">
              <div
                role="button"
                tabIndex={submitted ? -1 : 0}
                aria-disabled={submitted}
                onClick={() => !submitted && setSelectedOption(option.id)}
                onKeyDown={(event) => {
                  if (submitted) {
                    return;
                  }

                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedOption(option.id);
                  }
                }}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all focus:outline-none focus:ring-2 focus:ring-primary-400 ${
                  showCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : showIncorrect
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-300 hover:border-primary-300 dark:border-gray-600'
                } ${submitted ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-1 items-center gap-2">
                    <span className="text-gray-900 dark:text-white">{option.text}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TTSButton
                      text={option.text}
                      size="sm"
                      variant="minimal"
                      onStart={() => setPlayingOption(option.id)}
                      onEnd={() => setPlayingOption(null)}
                    />
                    {showCorrect && <Check className="h-5 w-5 text-green-600" />}
                    {showIncorrect && <X className="h-5 w-5 text-red-600" />}
                  </div>
                </div>
              </div>
            </TTSVisualFeedback>
          );
        })}
      </div>

      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!selectedOption}
          className="w-full rounded-lg bg-primary-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          Submit Answer
        </button>
      )}

      {submitted && showFeedback && explanation && (
        <div
          className={`rounded-lg p-4 ${
            isCorrect
              ? 'bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          <p className="mb-2 font-semibold">{isCorrect ? 'Correct!' : 'Incorrect'}</p>
          {referenceAnswerText && referenceSectionId ? (
            <div>
              <span className="font-medium">Correct answer: </span>
              <InteractiveAnswerText text={referenceAnswerText} sectionId={referenceSectionId} />
            </div>
          ) : (
            <p>{explanation}</p>
          )}
        </div>
      )}
    </div>
  );
}
