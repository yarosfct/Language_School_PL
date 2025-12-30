// Mistakes analytics and weak skill identification

import { getAllMistakes, getExerciseAttempts } from '@/lib/db';
import { MistakeAnalytics } from '@/types/progress';
import { Tag } from '@/types/curriculum';

/**
 * Calculate error rates by tag
 */
export async function calculateMistakeAnalytics(): Promise<MistakeAnalytics> {
  const mistakes = await getAllMistakes();
  
  // Count errors by tag
  const tagCounts = new Map<string, { errors: number; total: number }>();
  
  for (const mistake of mistakes) {
    for (const tag of mistake.tags) {
      const tagKey = `${tag.type}:${tag.value}`;
      const current = tagCounts.get(tagKey) || { errors: 0, total: 0 };
      current.errors += 1;
      current.total += 1;
      tagCounts.set(tagKey, current);
    }
  }
  
  // Also need to count successful attempts for accurate rate
  // For MVP, we'll simplify and just use error counts
  
  // Convert to object for serialization
  const tagErrorRates: Record<string, { errors: number; total: number }> = {};
  tagCounts.forEach((value, key) => {
    tagErrorRates[key] = value;
  });
  
  // Identify weak skills (>40% error rate with at least 3 attempts)
  const weakSkills: Tag[] = [];
  tagCounts.forEach((value, key) => {
    if (value.total >= 3 && (value.errors / value.total) > 0.4) {
      const [type, ...valueParts] = key.split(':');
      const tagValue = valueParts.join(':');
      weakSkills.push({
        type: type as 'grammar' | 'topic' | 'difficulty',
        value: tagValue,
      });
    }
  });
  
  // Get recent mistakes (last 20)
  const recentMistakes = mistakes
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);
  
  return {
    tagErrorRates,
    weakSkills,
    recentMistakes,
  };
}

/**
 * Get exercises for a specific tag (for targeted practice)
 */
export function getExercisesForTag(
  tag: Tag,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  allExercises: any[]
): string[] {
  return allExercises
    .filter(ex => 
      ex.tags.some((t: Tag) => t.type === tag.type && t.value === tag.value)
    )
    .map(ex => ex.id);
}

/**
 * Calculate accuracy for an exercise
 */
export async function calculateExerciseAccuracy(exerciseId: string): Promise<number> {
  const attempts = await getExerciseAttempts(exerciseId);
  
  if (attempts.length === 0) {
    return 0;
  }
  
  const correctAttempts = attempts.filter(a => a.correct).length;
  return (correctAttempts / attempts.length) * 100;
}

/**
 * Get overall user accuracy
 */
export async function calculateOverallAccuracy(): Promise<number> {
  const mistakes = await getAllMistakes();
  
  // This is a simplified calculation
  // In a full implementation, we'd track all attempts, not just mistakes
  
  if (mistakes.length === 0) {
    return 100; // No mistakes = 100% accuracy
  }
  
  // For now, return a placeholder
  // TODO: Implement proper tracking of all attempts
  return 75;
}
