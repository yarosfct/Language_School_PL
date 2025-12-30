'use client';

import { getAllUnits } from '@/lib/curriculum/loader';
import { getAllTopicMeta, getTopic } from '@/lib/curriculum/topicLoader';
import { getUserProgress, getTopicProgress, getAllTopicProgress } from '@/lib/db';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  BookOpen, 
  CheckCircle, 
  Circle, 
  Grid3X3,
  List,
  Clock,
  Target,
  Star,
  ChevronRight
} from 'lucide-react';
import type { TopicMeta } from '@/types/curriculum';
import type { TopicProgress } from '@/types/progress';

type ViewMode = 'curriculum' | 'topics';
type TopicFilter = 'all' | 'A1.1' | 'A1.2';

// Dynamic icon component
function TopicIcon({ name, className }: { name: string; className?: string }) {
  // Map icon names to simple representations
  const icons: Record<string, string> = {
    HandWaving: '👋',
    Clock: '🕐',
    Utensils: '🍽️',
    Home: '🏠',
    ShoppingBag: '🛍️',
    Bus: '🚌',
  };
  
  return (
    <span className={className} role="img" aria-label={name}>
      {icons[name] || '📚'}
    </span>
  );
}

export default function LearnPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('topics');
  const [topicFilter, setTopicFilter] = useState<TopicFilter>('all');
  const [lessonsCompleted, setLessonsCompleted] = useState<string[]>([]);
  const [topicProgressMap, setTopicProgressMap] = useState<Map<string, TopicProgress>>(new Map());
  
  const units = getAllUnits();
  const topicMetas = getAllTopicMeta();

  useEffect(() => {
    async function loadProgress() {
      const progress = await getUserProgress();
      setLessonsCompleted(progress.lessonsCompleted);
      
      const allTopicProgress = await getAllTopicProgress();
      const progressMap = new Map<string, TopicProgress>();
      for (const tp of allTopicProgress) {
        progressMap.set(tp.topicId, tp);
      }
      setTopicProgressMap(progressMap);
    }
    loadProgress();
  }, []);

  const filteredTopics = topicMetas.filter(topic => {
    if (topicFilter === 'all') return true;
    return topic.sublevel === topicFilter;
  });

  const getTopicProgressPercent = (topicId: string, meta: TopicMeta): number => {
    const progress = topicProgressMap.get(topicId);
    if (!progress) return 0;
    
    const vocabPercent = meta.vocabCount > 0 
      ? (progress.vocabLearned.length / meta.vocabCount) * 100 
      : 0;
    const exercisePercent = meta.exerciseCount > 0 
      ? (progress.exercisesCompleted.length / meta.exerciseCount) * 100 
      : 0;
    
    return Math.round((vocabPercent + exercisePercent) / 2);
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Learn Polish
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Choose your learning path: structured curriculum or topic-based learning
        </p>
      </div>

      {/* View Mode Tabs */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setViewMode('topics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'topics'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Grid3X3 className="w-4 h-4" />
            Topics
          </button>
          <button
            onClick={() => setViewMode('curriculum')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              viewMode === 'curriculum'
                ? 'bg-white dark:bg-gray-700 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <List className="w-4 h-4" />
            Curriculum
          </button>
        </div>

        {/* Topic filters */}
        {viewMode === 'topics' && (
          <div className="flex gap-2">
            {(['all', 'A1.1', 'A1.2'] as TopicFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setTopicFilter(filter)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  topicFilter === filter
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {filter === 'all' ? 'All A1' : filter}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Topics View */}
      {viewMode === 'topics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTopics.map((topic) => {
            const progress = getTopicProgressPercent(topic.id, topic);
            const topicProgress = topicProgressMap.get(topic.id);
            const isStarted = !!topicProgress;
            const isCompleted = topicProgress?.checkpointScore !== undefined && topicProgress.checkpointScore >= 70;

            return (
              <Link
                key={topic.id}
                href={`/topic/${topic.id}`}
                className="group block bg-white dark:bg-gray-800 rounded-2xl shadow-md hover:shadow-lg transition-all overflow-hidden border border-gray-100 dark:border-gray-700"
              >
                {/* Topic header */}
                <div className="p-6 pb-4">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 flex items-center justify-center text-3xl">
                      <TopicIcon name={topic.icon} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        topic.sublevel === 'A1.1'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {topic.sublevel}
                      </span>
                      {isCompleted && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {topic.title}
                  </h3>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-4 h-4" />
                      {topic.vocabCount} words
                    </span>
                    <span className="flex items-center gap-1">
                      <Target className="w-4 h-4" />
                      {topic.exerciseCount} exercises
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="px-6 pb-6">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-gray-600 dark:text-gray-400">
                      {isStarted ? `${progress}% complete` : 'Not started'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-primary-500 group-hover:translate-x-1 transition-all" />
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </Link>
            );
          })}

          {/* Coming soon placeholder */}
          {filteredTopics.length < 6 && (
            <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
              <Star className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="text-gray-500 dark:text-gray-400 font-medium">More topics coming soon!</p>
              <p className="text-sm text-gray-400 dark:text-gray-500">A2 content in development</p>
            </div>
          )}
        </div>
      )}

      {/* Curriculum View */}
      {viewMode === 'curriculum' && (
        <div className="space-y-8">
          {units.map((unit) => {
            const totalLessons = unit.lessons.length;
            const completedLessons = unit.lessons.filter(l => 
              lessonsCompleted.includes(l.id)
            ).length;
            const progress = totalLessons > 0 
              ? Math.round((completedLessons / totalLessons) * 100)
              : 0;

            return (
              <div key={unit.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
                {/* Unit header */}
                <div className="p-6 bg-gradient-to-r from-primary-500 to-primary-600">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="inline-block px-3 py-1 bg-white/20 rounded-full text-white text-sm font-semibold mb-2">
                        {unit.level}
                      </div>
                      <h2 className="text-2xl font-bold text-white mb-2">
                        {unit.title}
                      </h2>
                      <p className="text-primary-100">
                        {unit.description}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-white">{progress}%</div>
                      <div className="text-primary-100 text-sm">
                        {completedLessons}/{totalLessons} lessons
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Lessons list */}
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {unit.lessons.map((lesson) => {
                      const isCompleted = lessonsCompleted.includes(lesson.id);
                      
                      return (
                        <Link
                          key={lesson.id}
                          href={`/lesson/${lesson.id}`}
                          className="block p-4 border-2 border-gray-200 dark:border-gray-700 rounded-lg hover:border-primary-500 dark:hover:border-primary-500 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            {isCompleted ? (
                              <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                            ) : (
                              <Circle className="w-6 h-6 text-gray-400 flex-shrink-0 mt-0.5" />
                            )}
                            
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                                {lesson.title}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                {lesson.description}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
                                <BookOpen className="w-3 h-3" />
                                <span>{lesson.exercises.length} exercises</span>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
