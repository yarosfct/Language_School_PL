// SM-2 Spaced Repetition Algorithm

import { ReviewCard } from '@/types/progress';
import { getReviewCard, saveReviewCard } from '@/lib/db';

export interface SM2Params {
  interval: number;
  easeFactor: number;
  repetitions: number;
}

/**
 * Update SM-2 parameters based on quality of recall
 * @param card Current review card
 * @param quality Quality of recall (0-5 scale: 0=total fail, 5=perfect)
 * @returns Updated SM-2 parameters
 */
export function updateSM2(
  card: ReviewCard,
  quality: number
): SM2Params {
  let { interval, easeFactor, repetitions } = card;
  
  // Update ease factor
  easeFactor = Math.max(
    1.3, 
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );
  
  if (quality < 3) {
    // Incorrect: reset repetitions, review again soon
    repetitions = 0;
    interval = 1; // Review tomorrow
  } else {
    // Correct: increase interval
    repetitions += 1;
    if (repetitions === 1) {
      interval = 1; // 1 day
    } else if (repetitions === 2) {
      interval = 6; // 6 days
    } else {
      interval = Math.round(interval * easeFactor);
    }
  }
  
  return { interval, easeFactor, repetitions };
}

/**
 * Calculate due date based on interval
 * @param intervalDays Number of days until next review
 * @returns Unix timestamp for due date
 */
export function calculateDueDate(intervalDays: number): number {
  return Date.now() + intervalDays * 24 * 60 * 60 * 1000;
}

/**
 * Create an initial review card for a new exercise
 * @param exerciseId Exercise ID
 * @returns New review card
 */
export function createInitialCard(exerciseId: string): ReviewCard {
  return {
    id: exerciseId, // Use exerciseId as card ID
    exerciseId,
    due: Date.now(), // Due immediately
    interval: 0,
    easeFactor: 2.5, // Default ease factor
    repetitions: 0,
    lastReviewed: null,
    createdAt: Date.now(),
  };
}

/**
 * Schedule or update review for an exercise
 * @param exerciseId Exercise ID
 * @param correct Whether the answer was correct
 */
export async function scheduleReview(
  exerciseId: string, 
  correct: boolean
): Promise<void> {
  let card = await getReviewCard(exerciseId);
  
  if (!card) {
    card = createInitialCard(exerciseId);
  }
  
  // Convert boolean to quality (simplified: 4=correct, 1=incorrect)
  const quality = correct ? 4 : 1;
  const updated = updateSM2(card, quality);
  
  const newCard: ReviewCard = {
    ...card,
    interval: updated.interval,
    easeFactor: updated.easeFactor,
    repetitions: updated.repetitions,
    due: calculateDueDate(updated.interval),
    lastReviewed: Date.now()
  };
  
  await saveReviewCard(newCard);
}

/**
 * Get quality score from more detailed feedback
 * @param correct Whether answer was correct
 * @param hintUsed Whether hints were used
 * @param timeSpent Time spent in seconds
 * @returns Quality score 0-5
 */
export function calculateQuality(
  correct: boolean,
  hintsUsed: number = 0
): number {
  if (!correct) {
    return 1; // Incorrect
  }
  
  // Correct answers: adjust quality based on difficulty
  if (hintsUsed === 0) {
    return 5; // Perfect recall
  } else if (hintsUsed === 1) {
    return 4; // Correct with slight hesitation
  } else {
    return 3; // Correct with difficulty
  }
}
