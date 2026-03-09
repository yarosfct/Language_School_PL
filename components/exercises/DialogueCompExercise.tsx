'use client';

import { useState } from 'react';
import { DialogueCompData } from '@/types/curriculum';
import { speakPolish, speakSlow, isTTSSupported, isSpeaking, stopSpeaking } from '@/lib/tts';
import { Volume2, VolumeX, MessageCircle, Check, X, ChevronRight, Turtle, Zap } from 'lucide-react';
import { SpeakerIconAnimated } from '@/components/ui/TTSVisualFeedback';

interface DialogueCompExerciseProps {
  data: DialogueCompData;
  onSubmit: (answers: Record<string, string>) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function DialogueCompExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  explanation,
}: DialogueCompExerciseProps) {
  const [showTranslations, setShowTranslations] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [playingLine, setPlayingLine] = useState<number | null>(null);
  const [slowMode, setSlowMode] = useState(false);

  const currentQuestion = data.questions[currentQuestionIndex];
  const allQuestionsAnswered = Object.keys(answers).length === data.questions.length;
  const isLastQuestion = currentQuestionIndex === data.questions.length - 1;

  const handlePlayLine = (index: number, text: string) => {
    if (isSpeaking()) {
      stopSpeaking();
      setPlayingLine(null);
      return;
    }

    setPlayingLine(index);
    const speakFn = slowMode ? speakSlow : speakPolish;
    speakFn(text, () => {
      setPlayingLine(null);
    });
  };

  const handlePlayAll = () => {
    if (isSpeaking()) {
      stopSpeaking();
      setPlayingLine(null);
      return;
    }

    let index = 0;
    const speakFn = slowMode ? speakSlow : speakPolish;
    const playNext = () => {
      if (index < data.dialogue.length) {
        setPlayingLine(index);
        speakFn(data.dialogue[index].text, () => {
          index++;
          setTimeout(playNext, 500);
        });
      } else {
        setPlayingLine(null);
      }
    };
    playNext();
  };

  const handleSelectAnswer = (optionId: string) => {
    if (submitted) return;
    
    setAnswers(prev => ({
      ...prev,
      [currentQuestionIndex]: optionId,
    }));
  };

  const handleNextQuestion = () => {
    if (currentQuestionIndex < data.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const handleSubmit = () => {
    if (allQuestionsAnswered) {
      setSubmitted(true);
      // Convert to Record<string, string> with question index as key
      const answerRecord: Record<string, string> = {};
      Object.entries(answers).forEach(([index, value]) => {
        answerRecord[`q${parseInt(index) + 1}`] = value;
      });
      onSubmit(answerRecord);
    }
  };

  const getQuestionResult = (qIndex: number): boolean | null => {
    if (!submitted) return null;
    const userAnswer = answers[qIndex];
    const correctAnswer = data.questions[qIndex].correctId;
    return userAnswer === correctAnswer;
  };

  const correctCount = submitted
    ? data.questions.filter((_, i) => getQuestionResult(i)).length
    : 0;

  return (
    <div className="space-y-6">
      {/* Dialogue section */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Dialogue
          </h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowTranslations(!showTranslations)}
              className="text-sm px-3 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              {showTranslations ? 'Hide' : 'Show'} translation
            </button>
            
            {isTTSSupported() && (
              <>
                <button
                  onClick={() => setSlowMode(!slowMode)}
                  className={`px-3 py-1 rounded-lg transition-colors ${
                    slowMode
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                  title={slowMode ? 'Normal speed' : 'Slow speed'}
                >
                  {slowMode ? <Turtle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
                </button>
                
                <button
                  onClick={handlePlayAll}
                  className={`px-3 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                    playingLine !== null
                      ? 'bg-primary-500 text-white'
                      : 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                  }`}
                >
                  <SpeakerIconAnimated isPlaying={playingLine !== null} size="sm" />
                  <span className="text-sm">Play All</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Dialogue lines */}
        <div className="space-y-3">
          {data.dialogue.map((line, index) => {
            const isEvenSpeaker = index % 2 === 0;
            const isPlaying = playingLine === index;

            return (
              <div
                key={index}
                className={`flex ${isEvenSpeaker ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                    isEvenSpeaker
                      ? 'bg-white dark:bg-gray-700 rounded-tl-none'
                      : 'bg-primary-100 dark:bg-primary-900/30 rounded-tr-none'
                  } ${isPlaying ? 'ring-2 ring-primary-500' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        {line.speaker}
                      </p>
                      <p className="text-gray-900 dark:text-white">
                        {line.text}
                      </p>
                      {showTranslations && line.translation && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">
                          {line.translation}
                        </p>
                      )}
                    </div>
                    
                    {isTTSSupported() && (
                      <button
                        onClick={() => handlePlayLine(index, line.text)}
                        className={`p-1 rounded transition-colors ${
                          isPlaying
                            ? 'text-primary-600'
                            : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {isPlaying ? (
                          <VolumeX className="w-4 h-4" />
                        ) : (
                          <Volume2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Questions section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
        {/* Question progress */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Question {currentQuestionIndex + 1} of {data.questions.length}
          </span>
          
          {/* Progress dots */}
          <div className="flex gap-1">
            {data.questions.map((_, i) => {
              const result = getQuestionResult(i);
              return (
                <button
                  key={i}
                  onClick={() => setCurrentQuestionIndex(i)}
                  className={`w-3 h-3 rounded-full transition-colors ${
                    result === true
                      ? 'bg-green-500'
                      : result === false
                      ? 'bg-red-500'
                      : answers[i]
                      ? 'bg-primary-500'
                      : i === currentQuestionIndex
                      ? 'bg-gray-400'
                      : 'bg-gray-200 dark:bg-gray-600'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Current question */}
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {currentQuestion.question}
        </h4>

        {/* Options */}
        <div className="space-y-2 mb-4">
          {currentQuestion.options.map((option) => {
            const isSelected = answers[currentQuestionIndex] === option.id;
            const isCorrectAnswer = option.id === currentQuestion.correctId;
            const showCorrect = submitted && isCorrectAnswer;
            const showIncorrect = submitted && isSelected && !isCorrectAnswer;

            return (
              <button
                key={option.id}
                onClick={() => handleSelectAnswer(option.id)}
                disabled={submitted}
                className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                  showCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : showIncorrect
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-primary-300'
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

        {/* Navigation */}
        {!submitted && (
          <div className="flex justify-between">
            <button
              onClick={handlePrevQuestion}
              disabled={currentQuestionIndex === 0}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {isLastQuestion ? (
              <button
                onClick={handleSubmit}
                disabled={!allQuestionsAnswered}
                className="px-6 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                Submit All
                <Check className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNextQuestion}
                disabled={!answers[currentQuestionIndex]}
                className="px-4 py-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Final feedback */}
      {submitted && showFeedback && (
        <div
          className={`p-4 rounded-lg ${
            isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300'
          }`}
        >
          <p className="font-semibold mb-2">
            {correctCount === data.questions.length
              ? '✓ Perfect! All answers correct!'
              : `${correctCount} of ${data.questions.length} correct`}
          </p>
          {explanation && <p>{explanation}</p>}
        </div>
      )}
    </div>
  );
}
