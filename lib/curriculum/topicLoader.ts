// Topic loader and accessor functions

import { Topic, VocabularyItem, Exercise, TopicIndex, TopicMeta } from '@/types/curriculum';

// Import topic data
import topicMeta from '@/content/a1/topics/_meta.json';
import greetingsTopic from '@/content/a1/topics/greetings.json';
import numbersTimeTopic from '@/content/a1/topics/numbers-time.json';
import foodTopic from '@/content/a1/topics/food.json';
import householdTopic from '@/content/a1/topics/household.json';
import shoppingTopic from '@/content/a1/topics/shopping.json';
import cityTransportTopic from '@/content/a1/topics/city-transport.json';

// Cache for loaded topics
const topicCache = new Map<string, Topic>();

// Initialize topic cache with imported data
function initializeCache(): void {
  if (topicCache.size === 0) {
    // Add all imported topics to cache
    const topics = [
      greetingsTopic, 
      numbersTimeTopic, 
      foodTopic, 
      householdTopic, 
      shoppingTopic, 
      cityTransportTopic
    ] as Topic[];
    for (const topic of topics) {
      topicCache.set(topic.id, topic);
    }
  }
}

/**
 * Get the topic index/metadata
 */
export function getTopicIndex(): TopicIndex {
  return topicMeta as TopicIndex;
}

/**
 * Get all topic metadata (lightweight, for listing)
 */
export function getAllTopicMeta(): TopicMeta[] {
  return (topicMeta as TopicIndex).topics;
}

/**
 * Get all fully loaded topics
 */
export function getAllTopics(): Topic[] {
  initializeCache();
  return Array.from(topicCache.values()).sort((a, b) => a.order - b.order);
}

/**
 * Get available topic IDs
 */
export function getAvailableTopicIds(): string[] {
  return getAllTopicMeta().map(t => t.id);
}

/**
 * Get a topic by ID (full data)
 */
export function getTopic(topicId: string): Topic | undefined {
  initializeCache();
  return topicCache.get(topicId);
}

/**
 * Get topic metadata by ID (lightweight)
 */
export function getTopicMeta(topicId: string): TopicMeta | undefined {
  return getAllTopicMeta().find(t => t.id === topicId);
}

/**
 * Get vocabulary items for a topic
 */
export function getTopicVocabulary(topicId: string): VocabularyItem[] {
  const topic = getTopic(topicId);
  return topic?.vocabularyItems ?? [];
}

/**
 * Get practice exercises for a topic (excluding checkpoint)
 */
export function getTopicExercises(topicId: string): Exercise[] {
  const topic = getTopic(topicId);
  return topic?.exercises ?? [];
}

/**
 * Get checkpoint exercises for a topic
 */
export function getTopicCheckpointExercises(topicId: string): Exercise[] {
  const topic = getTopic(topicId);
  return topic?.checkpointExercises ?? [];
}

/**
 * Get a specific exercise from a topic
 */
export function getTopicExercise(topicId: string, exerciseId: string): Exercise | undefined {
  const topic = getTopic(topicId);
  if (!topic) return undefined;
  
  // Search in regular exercises
  const exercise = topic.exercises.find(e => e.id === exerciseId);
  if (exercise) return exercise;
  
  // Search in checkpoint exercises
  return topic.checkpointExercises.find(e => e.id === exerciseId);
}

/**
 * Get a vocabulary item by ID
 */
export function getVocabularyItem(vocabId: string): VocabularyItem | undefined {
  initializeCache();
  for (const topic of topicCache.values()) {
    const item = topic.vocabularyItems.find(v => v.id === vocabId);
    if (item) return item;
  }
  return undefined;
}

/**
 * Get topics by CEFR level
 */
export function getTopicsByLevel(level: string): Topic[] {
  return getAllTopics().filter(t => t.cefrLevel === level);
}

/**
 * Get topics by sublevel
 */
export function getTopicsBySublevel(sublevel: string): Topic[] {
  return getAllTopics().filter(t => t.sublevel === sublevel);
}

/**
 * Get topics by tag
 */
export function getTopicsByTag(tag: string): Topic[] {
  return getAllTopics().filter(t => t.tags.includes(tag));
}

/**
 * Search vocabulary across all topics
 */
export function searchVocabulary(query: string): VocabularyItem[] {
  const normalizedQuery = query.toLowerCase().trim();
  const results: VocabularyItem[] = [];
  
  for (const topic of getAllTopics()) {
    for (const item of topic.vocabularyItems) {
      if (
        item.word.toLowerCase().includes(normalizedQuery) ||
        item.translationEN.toLowerCase().includes(normalizedQuery)
      ) {
        results.push(item);
      }
    }
  }
  
  return results;
}

/**
 * Get topic statistics
 */
export function getTopicStats(topicId: string): {
  vocabCount: number;
  exerciseCount: number;
  checkpointCount: number;
  estimatedMinutes: number;
} | null {
  const topic = getTopic(topicId);
  if (!topic) return null;
  
  return {
    vocabCount: topic.vocabularyItems.length,
    exerciseCount: topic.exercises.length,
    checkpointCount: topic.checkpointExercises.length,
    estimatedMinutes: topic.estimatedMinutes,
  };
}

/**
 * Get all vocabulary from all topics
 */
export function getAllVocabulary(): VocabularyItem[] {
  return getAllTopics().flatMap(t => t.vocabularyItems);
}

/**
 * Get all exercises from all topics (including checkpoints)
 */
export function getAllTopicExercises(): Exercise[] {
  return getAllTopics().flatMap(t => [...t.exercises, ...t.checkpointExercises]);
}

/**
 * Get exercises by type from all topics
 */
export function getExercisesByType(type: string): Exercise[] {
  return getAllTopicExercises().filter(e => e.type === type);
}

/**
 * Get the next topic in order
 */
export function getNextTopic(currentTopicId: string): Topic | null {
  const topics = getAllTopics();
  const currentIndex = topics.findIndex(t => t.id === currentTopicId);
  
  if (currentIndex === -1 || currentIndex === topics.length - 1) {
    return null;
  }
  
  return topics[currentIndex + 1];
}

/**
 * Get the previous topic in order
 */
export function getPreviousTopic(currentTopicId: string): Topic | null {
  const topics = getAllTopics();
  const currentIndex = topics.findIndex(t => t.id === currentTopicId);
  
  if (currentIndex <= 0) {
    return null;
  }
  
  return topics[currentIndex - 1];
}

/**
 * Get overall topic content statistics
 */
export function getOverallTopicStats(): {
  totalTopics: number;
  totalVocab: number;
  totalExercises: number;
  byLevel: Record<string, number>;
  bySublevel: Record<string, number>;
} {
  const topics = getAllTopics();
  const byLevel: Record<string, number> = {};
  const bySublevel: Record<string, number> = {};
  
  for (const topic of topics) {
    byLevel[topic.cefrLevel] = (byLevel[topic.cefrLevel] || 0) + 1;
    bySublevel[topic.sublevel] = (bySublevel[topic.sublevel] || 0) + 1;
  }
  
  return {
    totalTopics: topics.length,
    totalVocab: getAllVocabulary().length,
    totalExercises: getAllTopicExercises().length,
    byLevel,
    bySublevel,
  };
}
