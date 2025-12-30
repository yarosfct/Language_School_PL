'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getTopic, getNextTopic } from '@/lib/curriculum/topicLoader';
import { ExerciseRenderer } from '@/components/exercises/ExerciseRenderer';
import { evaluateAnswer, EvaluationResult } from '@/lib/exercises/evaluators';
import { 
  saveAttempt, 
  saveMistake, 
  getTopicProgress,
  initializeTopicProgress,
  markVocabLearned,
  markVocabToReview,
  markTopicExerciseCompleted,
  updateTopicCheckpointScore,
  addTopicTimeSpent,
  updateStreak,
} from '@/lib/db';
import { scheduleReview } from '@/lib/review/sm2';
import { generateId } from '@/lib/utils/string';
import { speakPolish, stopSpeaking } from '@/lib/tts';
import { 
  ArrowLeft, 
  ArrowRight, 
  BookOpen, 
  Target, 
  Trophy,
  CheckCircle,
  XCircle,
  Volume2,
  Lock,
  ChevronRight,
} from 'lucide-react';
import type { Topic, VocabularyItem, Exercise } from '@/types/curriculum';
import type { TopicProgress } from '@/types/progress';

type TabMode = 'teach' | 'practice' | 'checkpoint';

export default function TopicPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  const [topic, setTopic] = useState<Topic | null>(null);
  const [progress, setProgress] = useState<TopicProgress | null>(null);
  const [activeTab, setActiveTab] = useState<TabMode>('teach');
  const [sessionStartTime, setSessionStartTime] = useState(Date.now());
  
  // Teach mode state
  const [currentVocabIndex, setCurrentVocabIndex] = useState(0);
  
  // Practice mode state
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [exerciseStartTime, setExerciseStartTime] = useState(Date.now());
  
  // Checkpoint mode state
  const [checkpointStarted, setCheckpointStarted] = useState(false);
  const [checkpointExerciseIndex, setCheckpointExerciseIndex] = useState(0);
  const [checkpointCorrect, setCheckpointCorrect] = useState(0);
  const [checkpointComplete, setCheckpointComplete] = useState(false);

  useEffect(() => {
    const topicData = getTopic(resolvedParams.id);
    if (topicData) {
      setTopic(topicData);
      loadProgress(resolvedParams.id);
    }
    
    return () => {
      stopSpeaking();
    };
  }, [resolvedParams.id]);

  useEffect(() => {
    // Track time spent when leaving
    return () => {
      const timeSpent = Date.now() - sessionStartTime;
      if (topic && timeSpent > 5000) { // Only track if spent more than 5 seconds
        addTopicTimeSpent(topic.id, timeSpent);
      }
    };
  }, [topic, sessionStartTime]);

  async function loadProgress(topicId: string) {
    let tp = await getTopicProgress(topicId);
    if (!tp) {
      tp = await initializeTopicProgress(topicId);
    }
    setProgress(tp);
  }

  async function refreshProgress() {
    if (topic) {
      const tp = await getTopicProgress(topic.id);
      if (tp) setProgress(tp);
    }
  }

  if (!topic) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Topic not found
        </h1>
        <Link href="/learn" className="text-primary-600 hover:underline">
          Return to Learn
        </Link>
      </div>
    );
  }

  const currentVocab = topic.vocabularyItems[currentVocabIndex];
  const currentExercise = topic.exercises[currentExerciseIndex];
  const currentCheckpointExercise = topic.checkpointExercises[checkpointExerciseIndex];
  
  const vocabProgress = progress 
    ? Math.round((progress.vocabLearned.length / topic.vocabularyItems.length) * 100)
    : 0;
  const exerciseProgress = progress
    ? Math.round((progress.exercisesCompleted.length / topic.exercises.length) * 100)
    : 0;
  const canAccessCheckpoint = exerciseProgress >= 50;

  // Teach mode handlers
  const handleVocabKnown = async (known: boolean) => {
    if (!currentVocab || !topic) return;
    
    if (known) {
      await markVocabLearned(topic.id, currentVocab.id);
    } else {
      await markVocabToReview(topic.id, currentVocab.id);
    }
    
    await refreshProgress();
    
    if (currentVocabIndex < topic.vocabularyItems.length - 1) {
      setCurrentVocabIndex(prev => prev + 1);
    } else {
      // Last vocab item completed - automatically advance to Practice
      setActiveTab('practice');
    }
  };

  const handlePlayVocab = () => {
    if (currentVocab) {
      speakPolish(currentVocab.word);
    }
  };

  // Practice mode handlers
  const handleExerciseSubmit = async (answer: unknown) => {
    if (!currentExercise || !topic) return;
    
    const timeSpent = Date.now() - exerciseStartTime;
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
      errorTags: result.errorType ? [result.errorType] : undefined,
    }, topic.id);

    // Track exercise completion
    await markTopicExerciseCompleted(topic.id, currentExercise.id, result.correct);

    // Log mistake if incorrect
    if (!result.correct) {
      await saveMistake({
        id: generateId(),
        exerciseId: currentExercise.id,
        topicId: topic.id,
        timestamp: Date.now(),
        userAnswer: answer,
        correctAnswer: currentExercise.solution,
        tags: currentExercise.tags,
        errorType: result.errorType,
        reviewed: false,
      });
    }

    // Update review schedule
    await scheduleReview(currentExercise.id, result.correct);
    await refreshProgress();
    await updateStreak();
  };

  const handleNextExercise = () => {
    setShowFeedback(false);
    setEvaluationResult(null);
    setExerciseStartTime(Date.now());
    
    if (currentExerciseIndex < topic.exercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
    } else {
      // All exercises completed
      setActiveTab('checkpoint');
    }
  };

  // Checkpoint mode handlers
  const startCheckpoint = () => {
    setCheckpointStarted(true);
    setCheckpointExerciseIndex(0);
    setCheckpointCorrect(0);
    setCheckpointComplete(false);
    setShowFeedback(false);
    setEvaluationResult(null);
    setExerciseStartTime(Date.now());
  };

  const handleCheckpointSubmit = async (answer: unknown) => {
    if (!currentCheckpointExercise || !topic) return;
    
    const timeSpent = Date.now() - exerciseStartTime;
    const result = evaluateAnswer(currentCheckpointExercise, answer);
    
    setEvaluationResult(result);
    setShowFeedback(true);

    if (result.correct) {
      setCheckpointCorrect(prev => prev + 1);
    }

    // Save attempt
    await saveAttempt(currentCheckpointExercise.id, {
      timestamp: Date.now(),
      correct: result.correct,
      answer,
      timeSpent,
      hintsUsed: 0,
    }, topic.id);
  };

  const handleNextCheckpointExercise = async () => {
    setShowFeedback(false);
    setEvaluationResult(null);
    setExerciseStartTime(Date.now());
    
    if (checkpointExerciseIndex < topic.checkpointExercises.length - 1) {
      setCheckpointExerciseIndex(prev => prev + 1);
    } else {
      // Checkpoint complete
      setCheckpointComplete(true);
      const score = Math.round((checkpointCorrect / topic.checkpointExercises.length) * 100);
      await updateTopicCheckpointScore(topic.id, score);
      await refreshProgress();
    }
  };

  const checkpointScore = checkpointComplete
    ? Math.round(((checkpointCorrect + (evaluationResult?.correct ? 1 : 0)) / topic.checkpointExercises.length) * 100)
    : 0;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link 
          href="/learn"
          className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Learn
        </Link>
        
        <div className="flex items-start justify-between">
          <div>
            <span className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium mb-2">
              {topic.sublevel}
            </span>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {topic.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {topic.description}
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          onClick={() => setActiveTab('teach')}
          className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'teach'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Teach
          <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {vocabProgress}%
          </span>
        </button>
        
        <button
          onClick={() => setActiveTab('practice')}
          className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'practice'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Target className="w-4 h-4" />
          Practice
          <span className="ml-1 text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
            {exerciseProgress}%
          </span>
        </button>
        
        <button
          onClick={() => canAccessCheckpoint && setActiveTab('checkpoint')}
          disabled={!canAccessCheckpoint}
          className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition-colors ${
            activeTab === 'checkpoint'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : !canAccessCheckpoint
              ? 'border-transparent text-gray-300 dark:text-gray-600 cursor-not-allowed'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          {!canAccessCheckpoint && <Lock className="w-4 h-4" />}
          <Trophy className="w-4 h-4" />
          Checkpoint
          {progress?.checkpointScore !== undefined && (
            <span className={`ml-1 text-xs px-2 py-0.5 rounded-full ${
              progress.checkpointScore >= 70
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
            }`}>
              {progress.checkpointScore}%
            </span>
          )}
        </button>
      </div>

      {/* Teach Tab */}
      {activeTab === 'teach' && currentVocab && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Word {currentVocabIndex + 1} of {topic.vocabularyItems.length}
            </span>
            <div className="h-2 flex-1 mx-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all"
                style={{ width: `${((currentVocabIndex + 1) / topic.vocabularyItems.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Vocab flashcard */}
          <div className="text-center py-8">
            <button
              onClick={handlePlayVocab}
              className="mb-4 p-3 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors"
            >
              <Volume2 className="w-6 h-6" />
            </button>
            
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
              {currentVocab.word}
            </h2>
            
            {currentVocab.pronunciation && (
              <p className="text-lg text-gray-500 dark:text-gray-400 italic mb-4">
                [{currentVocab.pronunciation}]
              </p>
            )}
            
            <p className="text-2xl text-primary-600 dark:text-primary-400 mb-4">
              {currentVocab.translationEN}
            </p>
            
            <div className="flex justify-center gap-2 mb-6">
              <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-600 dark:text-gray-400">
                {currentVocab.partOfSpeech}
              </span>
              {currentVocab.gender && (
                <span className={`px-3 py-1 rounded-full text-sm ${
                  currentVocab.gender === 'masculine' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                  currentVocab.gender === 'feminine' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300' :
                  'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                }`}>
                  {currentVocab.gender}
                </span>
              )}
            </div>
            
            {currentVocab.examples.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 max-w-md mx-auto">
                <p className="text-gray-900 dark:text-white mb-1">
                  "{currentVocab.examples[0].polish}"
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  "{currentVocab.examples[0].english}"
                </p>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex gap-4 justify-center mt-8">
            <button
              onClick={() => handleVocabKnown(false)}
              className="flex-1 max-w-[180px] py-4 px-6 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              Learn this
            </button>
            <button
              onClick={() => handleVocabKnown(true)}
              className="flex-1 max-w-[180px] py-4 px-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-xl font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              I know this
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex justify-between mt-8">
            <button
              onClick={() => setCurrentVocabIndex(prev => Math.max(0, prev - 1))}
              disabled={currentVocabIndex === 0}
              className="px-4 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
            >
              ← Previous
            </button>
            <button
              onClick={() => setActiveTab('practice')}
              className="px-4 py-2 text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              Skip to Practice <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Practice Tab */}
      {activeTab === 'practice' && currentExercise && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
              <span>Exercise {currentExerciseIndex + 1} of {topic.exercises.length}</span>
              <span>{exerciseProgress}% complete</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-500 transition-all"
                style={{ width: `${((currentExerciseIndex + 1) / topic.exercises.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="mb-4">
            <span className="inline-block px-3 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full text-sm font-medium">
              {currentExercise.type.replace('-', ' ').toUpperCase()}
            </span>
          </div>
          
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
            {currentExercise.question}
          </h2>

          <ExerciseRenderer
            key={currentExercise.id}
            exercise={currentExercise}
            onSubmit={handleExerciseSubmit}
            showFeedback={showFeedback}
            feedbackMessage={evaluationResult?.feedback}
            isCorrect={evaluationResult?.correct}
            autoPlayTTS={true}
          />

          {showFeedback && (
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleNextExercise}
                className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600 flex items-center gap-2"
              >
                {currentExerciseIndex === topic.exercises.length - 1 ? 'Go to Checkpoint' : 'Next'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Checkpoint Tab */}
      {activeTab === 'checkpoint' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          {!canAccessCheckpoint ? (
            <div className="text-center py-12">
              <Lock className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Checkpoint Locked
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Complete at least 50% of practice exercises to unlock the checkpoint.
              </p>
              <button
                onClick={() => setActiveTab('practice')}
                className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600"
              >
                Continue Practice
              </button>
            </div>
          ) : !checkpointStarted ? (
            <div className="text-center py-12">
              <Trophy className="w-16 h-16 text-amber-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Ready for the Checkpoint?
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Answer {topic.checkpointExercises.length} questions to test your knowledge.
                Score 70% or higher to complete this topic!
              </p>
              {progress?.checkpointScore !== undefined && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Previous best: {progress.checkpointScore}%
                </p>
              )}
              <button
                onClick={startCheckpoint}
                className="px-8 py-4 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 text-lg"
              >
                Start Checkpoint
              </button>
            </div>
          ) : checkpointComplete ? (
            <div className="text-center py-12">
              {checkpointScore >= 70 ? (
                <>
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Trophy className="w-10 h-10 text-green-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2">
                    Topic Completed!
                  </h2>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    {checkpointScore}%
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Excellent work! You've mastered {topic.title}.
                  </p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-10 h-10 text-amber-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mb-2">
                    Keep Practicing!
                  </h2>
                  <p className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    {checkpointScore}%
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    You need 70% to complete this topic. Review and try again!
                  </p>
                </>
              )}
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => {
                    setCheckpointStarted(false);
                    setCheckpointComplete(false);
                  }}
                  className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Try Again
                </button>
                <Link
                  href="/learn"
                  className="px-6 py-3 bg-primary-500 text-white rounded-xl font-semibold hover:bg-primary-600"
                >
                  Back to Topics
                </Link>
              </div>
            </div>
          ) : currentCheckpointExercise && (
            <>
              <div className="mb-6">
                <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
                  <span>Question {checkpointExerciseIndex + 1} of {topic.checkpointExercises.length}</span>
                  <span>{checkpointCorrect} correct so far</span>
                </div>
                <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 transition-all"
                    style={{ width: `${((checkpointExerciseIndex + 1) / topic.checkpointExercises.length) * 100}%` }}
                  />
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                {currentCheckpointExercise.question}
              </h2>

              <ExerciseRenderer
                key={currentCheckpointExercise.id}
                exercise={currentCheckpointExercise}
                onSubmit={handleCheckpointSubmit}
                showFeedback={showFeedback}
                feedbackMessage={evaluationResult?.feedback}
                isCorrect={evaluationResult?.correct}
              />

              {showFeedback && (
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleNextCheckpointExercise}
                    className="px-6 py-3 bg-amber-500 text-white rounded-xl font-semibold hover:bg-amber-600 flex items-center gap-2"
                  >
                    {checkpointExerciseIndex === topic.checkpointExercises.length - 1 ? 'See Results' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
