'use client';

import { useEffect, useState, useMemo } from 'react';
import { calculateMistakeAnalytics } from '@/lib/mistakes/analytics';
import { MistakeAnalytics } from '@/types/progress';
import { AlertCircle, TrendingDown, Target, Filter, X, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { getAllTopics } from '@/lib/curriculum/topicLoader';
import { ButtonLink, Card, PageHeader, SectionTitle } from '@/components/ui/primitives';

interface TopicMeta {
  id: string;
  title: string;
}

export default function MistakesPage() {
  const [analytics, setAnalytics] = useState<MistakeAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [availableTopics, setAvailableTopics] = useState<TopicMeta[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [selectedErrorType, setSelectedErrorType] = useState<string | null>(null);

  // Extract unique error types from mistakes
  const errorTypes = useMemo(() => {
    if (!analytics) return [];
    const types = new Set<string>();
    analytics.recentMistakes.forEach(m => {
      m.tags.forEach(t => {
        if (t.type === 'error' || t.type === 'grammar') {
          types.add(t.value);
        }
      });
    });
    return Array.from(types);
  }, [analytics]);

  // Filter mistakes
  const filteredMistakes = useMemo(() => {
    if (!analytics) return [];
    let mistakes = analytics.recentMistakes;

    if (selectedTopic) {
      mistakes = mistakes.filter(m => 
        m.tags.some(t => t.type === 'topic' && t.value === selectedTopic)
      );
    }

    if (selectedErrorType) {
      mistakes = mistakes.filter(m => 
        m.tags.some(t => (t.type === 'error' || t.type === 'grammar') && t.value === selectedErrorType)
      );
    }

    return mistakes;
  }, [analytics, selectedTopic, selectedErrorType]);

  useEffect(() => {
    async function loadData() {
      const [data, topics] = await Promise.all([
        calculateMistakeAnalytics(),
        getAllTopics()
      ]);
      setAnalytics(data);
      setAvailableTopics(topics.map(t => ({ id: t.id, title: t.title })));
      setLoading(false);
    }
    loadData();
  }, []);

  const clearFilters = () => {
    setSelectedTopic(null);
    setSelectedErrorType(null);
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto text-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          Loading mistakes analytics...
        </div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="max-w-6xl mx-auto text-center">
        <div className="text-lg text-gray-600 dark:text-gray-400">
          No data available
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Mistakes Notebook"
        description="Learn from your errors and target weak areas."
      />

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <div className="inline-flex p-3 bg-red-100 dark:bg-red-900/30 rounded-lg mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Total Mistakes
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {analytics.recentMistakes.length}
          </p>
        </Card>

        <Card>
          <div className="inline-flex p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg mb-4">
            <TrendingDown className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Weak Skills
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {analytics.weakSkills.length}
          </p>
        </Card>

        <Card>
          <div className="inline-flex p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg mb-4">
            <Target className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
            Tags Tracked
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">
            {Object.keys(analytics.tagErrorRates).length}
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Filters</h2>
          </div>
          {(selectedTopic || selectedErrorType) && (
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
            >
              <X className="w-4 h-4" /> Clear all
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          {/* Topic Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              By Topic
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTopic(null)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  !selectedTopic
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                All Topics
              </button>
              {availableTopics.map(topic => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopic(topic.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedTopic === topic.id
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {topic.title}
                </button>
              ))}
            </div>
          </div>

          {/* Error Type Filter */}
          {errorTypes.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                By Error Type
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedErrorType(null)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    !selectedErrorType
                      ? 'bg-orange-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All Types
                </button>
                {errorTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setSelectedErrorType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      selectedErrorType === type
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Retry Mode Toggle */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">Retry Mode</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Practice only the exercises you got wrong
              </p>
            </div>
            <Link
              href={`/review?retry=true${selectedTopic ? `&topic=${selectedTopic}` : ''}`}
              className="px-4 py-2 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Start Retry ({filteredMistakes.length})
            </Link>
          </div>
        </div>
      </Card>

      {/* Weak Skills Section */}
      {analytics.weakSkills.length > 0 && (
        <Card className="mb-8" accent="warning">
          <SectionTitle title="Weak Skills (Need Practice)" icon={<Target className="w-5 h-5 text-warning-600 dark:text-amber-300" />} />
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            These topics have an error rate above 40%. Focus your practice here!
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.weakSkills.map((tag, idx) => {
              const tagKey = `${tag.type}:${tag.value}`;
              const stats = analytics.tagErrorRates[tagKey];
              const errorRate = stats ? Math.round((stats.errors / stats.total) * 100) : 0;
              
              return (
                <div key={idx} className="p-4 border-2 border-orange-200 dark:border-orange-800 rounded-lg bg-orange-50 dark:bg-orange-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="inline-block px-2 py-1 bg-orange-200 dark:bg-orange-800 rounded text-xs font-semibold text-orange-800 dark:text-orange-200 mb-2">
                        {tag.type}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {tag.value}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        {errorRate}%
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        error rate
                      </div>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {stats.errors} errors out of {stats.total} attempts
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6">
            <ButtonLink
              href="/review"
              size="lg"
              variant="primary"
            >
              Practice Weak Skills
            </ButtonLink>
          </div>
        </Card>
      )}

      {/* Tag Error Rates */}
      <Card className="mb-8">
        <SectionTitle title="Error Rates by Tag" />
        
        <div className="space-y-3">
          {Object.entries(analytics.tagErrorRates)
            .sort(([, a], [, b]) => (b.errors / b.total) - (a.errors / a.total))
            .map(([tagKey, stats]) => {
              const errorRate = Math.round((stats.errors / stats.total) * 100);
              const [type, ...valueParts] = tagKey.split(':');
              const value = valueParts.join(':');
              
              return (
                <div key={tagKey} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="inline-block px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded text-xs font-semibold text-gray-700 dark:text-gray-300 mr-2">
                        {type}
                      </span>
                      <span className="text-gray-900 dark:text-white font-medium">
                        {value}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-semibold text-gray-900 dark:text-white">
                        {errorRate}%
                      </span>
                    </div>
                  </div>
                  
                  {/* Progress bar */}
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        errorRate > 40
                          ? 'bg-red-500'
                          : errorRate > 20
                          ? 'bg-orange-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${errorRate}%` }}
                    />
                  </div>
                  
                  <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                    {stats.errors} errors out of {stats.total} attempts
                  </div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Recent Mistakes */}
      <Card>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          {selectedTopic || selectedErrorType ? 'Filtered Mistakes' : 'Recent Mistakes'}
          {(selectedTopic || selectedErrorType) && (
            <span className="text-lg font-normal text-gray-500 ml-2">
              ({filteredMistakes.length} results)
            </span>
          )}
        </h2>
        
        {filteredMistakes.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            {selectedTopic || selectedErrorType 
              ? 'No mistakes match your filters.' 
              : 'No mistakes yet. Keep learning!'}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredMistakes.slice(0, 10).map((mistake) => (
              <div key={mistake.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {new Date(mistake.timestamp).toLocaleString()}
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Your answer: </span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">
                        {JSON.stringify(mistake.userAnswer)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-gray-600 dark:text-gray-400">Correct: </span>
                      <span className="text-green-600 dark:text-green-400 font-semibold">
                        {JSON.stringify(mistake.correctAnswer)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {mistake.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-block px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-700 dark:text-gray-300"
                    >
                      {tag.type}: {tag.value}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
