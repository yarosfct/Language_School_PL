'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getDueReviewCards, saveAttempt } from '@/lib/db';
import { getExercise } from '@/lib/curriculum/loader';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';
import { evaluateAnswer, EvaluationResult } from '@/lib/exercises/evaluators';
import { scheduleReview } from '@/lib/review/sm2';
import { ReviewCard } from '@/types/progress';
import { Exercise } from '@/types/curriculum';
import { RotateCcw, Filter, X } from 'lucide-react';
import { getAllTopics } from '@/lib/curriculum/topicLoader';

interface TopicMeta {
  id: string;
  title: string;
}

export default function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const topicFilter = searchParams.get('topic');
  
  const [allCards, setAllCards] = useState<ReviewCard[]>([]);
  const [availableTopics, setAvailableTopics] = useState<TopicMeta[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(topicFilter);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [startTime, setStartTime] = useState(Date.now());

  // Filter cards by topic
  const dueCards = useMemo(() => {
    if (!selectedTopic) return allCards;
    return allCards.filter(card => card.topicId === selectedTopic);
  }, [allCards, selectedTopic]);

  useEffect(() => {
    loadDueCards();
    loadTopics();
  }, []);

  useEffect(() => {
    if (dueCards.length > 0 && currentIndex < dueCards.length) {
      const card = dueCards[currentIndex];
      const exercise = getExercise(card.exerciseId);
      setCurrentExercise(exercise || null);
      setStartTime(Date.now());
      setShowFeedback(false);
      setEvaluationResult(null);
    }
  }, [currentIndex, dueCards]);

  async function loadDueCards() {
    setLoading(true);
    const cards = await getDueReviewCards();
    setAllCards(cards);
    setLoading(false);
  }

  async function loadTopics() {
    const topics = await getAllTopics();
    setAvailableTopics(topics.map(t => ({ id: t.id, title: t.title })));
  }

  const handleTopicFilter = (topicId: string | null) => {
    setSelectedTopic(topicId);
    setCurrentIndex(0);
    // Update URL params
    if (topicId) {
      router.push(`/review?topic=${topicId}`);
    } else {
      router.push('/review');
    }
  }

  const handleSubmit = async (answer: unknown) => {
    if (!currentExercise) return;

    const timeSpent = Date.now() - startTime;
    const result = evaluateAnswer(currentExercise, answer);
    
    setEvaluationResult(result);
    setShowFeedback(true);

    // Save attempt
    await saveAttempt(currentExercise.id, {
      timestamp: Date.now(),
      correct: result.correct,
      answer,
      timeSpent,
      hintsUsed: 0,
    });

    // Update review schedule
    await scheduleReview(currentExercise.id, result.correct);

    // Auto-advance after delay
    setTimeout(() => {
      if (currentIndex < dueCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        router.push('/?reviewComplete=true');
      }
    }, 2500);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading review session...
        </div>
      </div>
    );
  }

  if (dueCards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
            <RotateCcw className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            All Caught Up!
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
            No reviews due right now. Great job! 🎉
          </p>
          
          <button
            onClick={() => router.push('/learn')}
            className="px-6 py-3 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors"
          >
            Continue Learning
          </button>
        </div>
      </div>
    );
  }

  if (!currentExercise) {
    return (
      <div className="max-w-4xl mx-auto text-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Exercise not found
        </div>
      </div>
    );
  }

  const progress = ((currentIndex + 1) / dueCards.length) * 100;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <RotateCcw className="w-6 h-6 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Review Session
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Reinforce what you&apos;ve learned
              </p>
            </div>
          </div>
        </div>

        {/* Topic Filter */}
        {availableTopics.length > 0 && (
          <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Topic</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleTopicFilter(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedTopic
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All ({allCards.length})
              </button>
              {availableTopics.map(topic => {
                const count = allCards.filter(c => c.topicId === topic.id).length;
                if (count === 0) return null;
                return (
                  <button
                    key={topic.id}
                    onClick={() => handleTopicFilter(topic.id)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${
                      selectedTopic === topic.id
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {topic.title} ({count})
                    {selectedTopic === topic.id && (
                      <X className="w-3 h-3" onClick={(e) => { e.stopPropagation(); handleTopicFilter(null); }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Progress</span>
            <span>{currentIndex + 1} / {dueCards.length}</span>
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <div className="mb-6">
          <div className="inline-block px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded-full text-sm font-semibold mb-4">
            REVIEW
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
    </div>
  );
}
