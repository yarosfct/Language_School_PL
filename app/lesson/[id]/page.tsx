'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { getLesson, getNextLesson } from '@/lib/curriculum/loader';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';
import { evaluateAnswer, EvaluationResult } from '@/lib/exercises/evaluators';
import { saveAttempt, markLessonComplete, saveMistake, updateStreak } from '@/lib/db';
import { scheduleReview } from '@/lib/review/sm2';
import { generateId } from '@/lib/utils/string';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function LessonPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  const [lesson] = useState(() => getLesson(resolvedParams.id));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [startTime, setStartTime] = useState(Date.now());

  useEffect(() => {
    // Reset timer when exercise changes
    setStartTime(Date.now());
    setShowFeedback(false);
    setEvaluationResult(null);
  }, [currentIndex]);

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Lesson not found
        </h1>
        <Link href="/learn" className="text-primary-600 hover:underline">
          Return to lessons
        </Link>
      </div>
    );
  }

  const currentExercise = lesson.exercises[currentIndex];
  const isLastExercise = currentIndex === lesson.exercises.length - 1;

  const handleSubmit = async (answer: unknown) => {
    const timeSpent = Date.now() - startTime;
    const result = evaluateAnswer(currentExercise, answer);
    
    setEvaluationResult(result);
    setShowFeedback(true);

    // Save attempt to database
    await saveAttempt(currentExercise.id, {
      timestamp: Date.now(),
      correct: result.correct,
      answer,
      timeSpent,
      hintsUsed: 0, // TODO: Track hints usage
    });

    // Log mistake if incorrect
    if (!result.correct) {
      await saveMistake({
        id: generateId(),
        exerciseId: currentExercise.id,
        timestamp: Date.now(),
        userAnswer: answer,
        correctAnswer: currentExercise.solution,
        tags: currentExercise.tags,
        reviewed: false,
      });
    }

    // Update review schedule
    await scheduleReview(currentExercise.id, result.correct);

    // Auto-advance after delay
    setTimeout(async () => {
      if (isLastExercise) {
        // Mark lesson complete
        await markLessonComplete(lesson.id);
        await updateStreak();
        
        // Check for next lesson
        const nextLesson = getNextLesson(lesson.id);
        if (nextLesson) {
          router.push(`/lesson/${nextLesson.id}`);
        } else {
          router.push('/learn?completed=' + lesson.id);
        }
      } else {
        setCurrentIndex(currentIndex + 1);
      }
    }, 2500);
  };

  const progress = ((currentIndex + 1) / lesson.exercises.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/learn"
          className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to lessons
        </Link>
        
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {lesson.title}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {lesson.description}
        </p>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Progress</span>
            <span>{currentIndex + 1} / {lesson.exercises.length}</span>
          </div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Exercise */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 mb-6">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-semibold mb-4">
            {currentExercise.type.replace('-', ' ').toUpperCase()}
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            {currentExercise.question}
          </h2>
        </div>

        <ExerciseRenderer
          key={currentExercise.id}
          exercise={currentExercise}
          onSubmit={handleSubmit}
          showFeedback={showFeedback}
          feedbackMessage={evaluationResult?.feedback}
          isCorrect={evaluationResult?.correct}
        />
      </div>

      {/* Navigation buttons (optional manual navigation) */}
      <div className="flex justify-between">
        <button
          onClick={() => currentIndex > 0 && setCurrentIndex(currentIndex - 1)}
          disabled={currentIndex === 0 || showFeedback}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Previous
        </button>
        
        {showFeedback && (
          <button
            onClick={() => {
              if (isLastExercise) {
                router.push('/learn');
              } else {
                setCurrentIndex(currentIndex + 1);
              }
            }}
            className="px-6 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 flex items-center gap-2"
          >
            {isLastExercise ? 'Complete Lesson' : 'Next'}
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
