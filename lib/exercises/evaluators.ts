// Exercise answer evaluation logic

import { levenshteinDistance, removeDiacritics } from '../utils/string';
import type { 
  Exercise, 
  MCQData, 
  MatchData, 
  FillBlankData, 
  TypedAnswerData, 
  OrderingData, 
  ConnectData,
  ListeningChoiceData,
  DictationData,
  ImageMatchData,
  DialogueCompData,
  FlashcardData,
} from '@/types/curriculum';

export interface EvaluationResult {
  correct: boolean;
  partialCorrect?: boolean; // For 3-tier feedback: correct, partially correct, wrong
  feedback?: string;
  errorType?: 'diacritics' | 'word-order' | 'wrong-form' | 'wrong-word' | 'spelling' | 'other';
}

export function evaluateAnswer(exercise: Exercise, userAnswer: unknown): EvaluationResult {
  switch (exercise.type) {
    case 'mcq':
      return evaluateMCQ(exercise.data as MCQData, userAnswer as string);
    case 'match':
      return evaluateMatch(exercise.data as MatchData, userAnswer as Record<string, string>);
    case 'fill-blank':
      return evaluateFillBlank(exercise.data as FillBlankData, userAnswer as string[]);
    case 'typed-answer':
      return evaluateTypedAnswer(exercise.data as TypedAnswerData, userAnswer as string);
    case 'ordering':
      return evaluateOrdering(exercise.data as OrderingData, userAnswer as string[]);
    case 'connect':
      return evaluateConnect(exercise.data as ConnectData, userAnswer as Array<{leftId: string, rightId: string}>);
    // New exercise types
    case 'flashcard':
      return evaluateFlashcard(exercise.data as FlashcardData, userAnswer as string);
    case 'image-match':
      return evaluateImageMatch(exercise.data as ImageMatchData, userAnswer as Array<{imageId: string, wordId: string}>);
    case 'listening-choice':
    case 'listening-mcq':
      return evaluateListeningChoice(exercise.data as ListeningChoiceData, userAnswer as string);
    case 'dictation':
      return evaluateDictation(exercise.data as DictationData, userAnswer as string);
    case 'dialogue-comp':
    case 'dialogue-builder':
      return evaluateDialogueComp(exercise.data as DialogueCompData, userAnswer as Record<string, string>);
    default:
      return { correct: false, feedback: 'Unknown exercise type' };
  }
}

function evaluateMCQ(data: MCQData, userAnswer: string): EvaluationResult {
  return {
    correct: userAnswer === data.correctOptionId,
  };
}

function evaluateMatch(data: MatchData, userAnswer: Record<string, string>): EvaluationResult {
  for (const pair of data.pairs) {
    if (userAnswer[pair.left] !== pair.right) {
      return { correct: false };
    }
  }
  return { correct: true };
}

function evaluateFillBlank(data: FillBlankData, userAnswer: string[]): EvaluationResult {
  if (userAnswer.length !== data.blanks.length) {
    return { correct: false, feedback: 'Incorrect number of answers' };
  }

  for (let i = 0; i < data.blanks.length; i++) {
    const blank = data.blanks[i];
    const answer = userAnswer[i]?.trim() || '';
    const caseSensitive = blank.caseSensitive ?? false;
    
    const normalizedAnswer = caseSensitive ? answer : answer.toLowerCase();
    const isCorrect = blank.acceptedAnswers.some(accepted => {
      const normalizedAccepted = caseSensitive ? accepted : accepted.toLowerCase();
      return normalizedAnswer === normalizedAccepted;
    });

    if (!isCorrect) {
      return { correct: false };
    }
  }

  return { correct: true };
}

export function evaluateTypedAnswer(
  data: TypedAnswerData,
  userAnswer: string
): EvaluationResult {
  const normalized = data.evaluationRules.caseSensitive 
    ? userAnswer.trim() 
    : userAnswer.trim().toLowerCase();
  
  for (const accepted of data.acceptedAnswers) {
    const target = data.evaluationRules.caseSensitive 
      ? accepted 
      : accepted.toLowerCase();
    
    // Exact match
    if (normalized === target) {
      return { correct: true };
    }
    
    // Diacritic-insensitive match
    if (data.evaluationRules.allowDiacriticErrors) {
      if (removeDiacritics(normalized) === removeDiacritics(target)) {
        return { 
          correct: true,
          feedback: "Correct! (Remember to use proper diacritics: ą, ę, ć, ł, ń, ó, ś, ź, ż)",
          errorType: 'diacritics',
        };
      }
    }
    
    // Typo tolerance (Levenshtein distance ≤ 1)
    if (data.evaluationRules.allowTypos) {
      if (levenshteinDistance(normalized, target) <= 1) {
        return { 
          correct: true,
          feedback: "Correct! (Small typo detected, but accepted)",
          errorType: 'spelling',
        };
      }
    }
  }
  
  // Provide structured feedback hints
  const { feedback, errorType } = generateTypedAnswerFeedback(normalized, data);
  return { correct: false, feedback, errorType };
}

function generateTypedAnswerFeedback(
  userAnswer: string, 
  data: TypedAnswerData
): { feedback: string; errorType?: EvaluationResult['errorType'] } {
  const firstAccepted = data.acceptedAnswers[0].toLowerCase();
  const normalized = userAnswer.toLowerCase();
  
  // Check for diacritic issues
  if (removeDiacritics(normalized) === removeDiacritics(firstAccepted)) {
    return {
      feedback: "Almost! Check your Polish diacritics (ą, ę, ć, ł, ń, ó, ś, ź, ż)",
      errorType: 'diacritics',
    };
  }
  
  // Check if answer is significantly shorter (might be wrong case)
  if (data.feedbackHints?.wrongCase && userAnswer.length < firstAccepted.length) {
    return {
      feedback: data.feedbackHints.wrongCase,
      errorType: 'wrong-form',
    };
  }
  
  // Check if answer has wrong gender markers
  if (data.feedbackHints?.wrongGender) {
    return {
      feedback: data.feedbackHints.wrongGender,
      errorType: 'wrong-form',
    };
  }
  
  // Check word order (if multi-word)
  const userWords = normalized.split(/\s+/);
  const targetWords = firstAccepted.split(/\s+/);
  if (userWords.length === targetWords.length && userWords.length > 1) {
    const sortedUser = [...userWords].sort();
    const sortedTarget = [...targetWords].sort();
    if (JSON.stringify(sortedUser) === JSON.stringify(sortedTarget)) {
      return {
        feedback: "Check the word order!",
        errorType: 'word-order',
      };
    }
  }
  
  return {
    feedback: "Not quite. Check the hints or try again.",
    errorType: 'other',
  };
}

function evaluateOrdering(data: OrderingData, userAnswer: string[]): EvaluationResult {
  if (userAnswer.length !== data.items.length) {
    return { correct: false };
  }

  for (let i = 0; i < data.items.length; i++) {
    if (userAnswer[i] !== data.items[i]) {
      return { correct: false, errorType: 'word-order' };
    }
  }

  return { correct: true };
}

function evaluateConnect(
  data: ConnectData, 
  userAnswer: Array<{leftId: string, rightId: string}>
): EvaluationResult {
  if (userAnswer.length !== data.correctPairs.length) {
    return { correct: false };
  }

  const correctMap = new Map<string, string>();
  for (const pair of data.correctPairs) {
    correctMap.set(pair.leftId, pair.rightId);
  }

  for (const userPair of userAnswer) {
    const correctRightId = correctMap.get(userPair.leftId);
    if (correctRightId !== userPair.rightId) {
      return { correct: false };
    }
  }

  return { correct: true };
}

// ============================================
// NEW EXERCISE TYPE EVALUATORS
// ============================================

function evaluateFlashcard(data: FlashcardData, userAnswer: string): EvaluationResult {
  const normalized = userAnswer.trim().toLowerCase();
  const target = data.word.toLowerCase();
  
  // 1. Exact match (case-insensitive, trimmed)
  if (normalized === target) {
    return { 
      correct: true, 
      partialCorrect: false,
    };
  }
  
  // 2. Diacritic-only error
  if (removeDiacritics(normalized) === removeDiacritics(target)) {
    return { 
      correct: true,
      partialCorrect: true,
      feedback: "Almost! Remember to use Polish diacritics: ą, ć, ę, ł, ń, ó, ś, ź, ż",
      errorType: 'diacritics',
    };
  }
  
  // 3. Minor typo (Levenshtein distance)
  // Allow distance of 1 for short words (≤5 chars), 2 for longer words
  const distance = levenshteinDistance(normalized, target);
  const threshold = target.length <= 5 ? 1 : 2;
  
  if (distance <= threshold) {
    return { 
      correct: true,
      partialCorrect: true,
      feedback: "Close! Minor spelling error detected.",
      errorType: 'spelling',
    };
  }
  
  // 4. Wrong answer
  return { 
    correct: false,
    partialCorrect: false,
    feedback: `The correct answer is: ${data.word}`,
  };
}

function evaluateImageMatch(
  data: ImageMatchData, 
  userAnswer: Array<{imageId: string, wordId: string}>
): EvaluationResult {
  if (userAnswer.length !== data.correctPairs.length) {
    return { correct: false };
  }

  for (const userPair of userAnswer) {
    const isCorrectPair = data.correctPairs.some(
      p => p.imageId === userPair.imageId && p.wordId === userPair.wordId
    );
    if (!isCorrectPair) {
      return { correct: false };
    }
  }

  return { correct: true };
}

function evaluateListeningChoice(data: ListeningChoiceData, userAnswer: string): EvaluationResult {
  return {
    correct: userAnswer === data.correctOptionId,
  };
}

function evaluateDictation(data: DictationData, userAnswer: string): EvaluationResult {
  const normalized = data.evaluationRules.caseSensitive 
    ? userAnswer.trim() 
    : userAnswer.trim().toLowerCase();
  
  for (const accepted of data.acceptedAnswers) {
    const target = data.evaluationRules.caseSensitive 
      ? accepted 
      : accepted.toLowerCase();
    
    // Exact match
    if (normalized === target) {
      return { correct: true };
    }
    
    // Diacritic-insensitive match
    if (data.evaluationRules.allowDiacriticErrors) {
      if (removeDiacritics(normalized) === removeDiacritics(target)) {
        return { 
          correct: true,
          feedback: "Correct! (Watch your diacritics: ą, ę, ć, ł, ń, ó, ś, ź, ż)",
          errorType: 'diacritics',
        };
      }
    }
    
    // Typo tolerance
    if (data.evaluationRules.allowTypos) {
      const distance = levenshteinDistance(normalized, target);
      const threshold = Math.max(1, Math.floor(target.length / 5)); // Allow more typos for longer text
      if (distance <= threshold) {
        return { 
          correct: true,
          feedback: "Correct! (Minor spelling issues detected)",
          errorType: 'spelling',
        };
      }
    }
  }
  
  return { 
    correct: false,
    errorType: 'spelling',
  };
}

function evaluateDialogueComp(
  data: DialogueCompData, 
  userAnswers: Record<string, string>
): EvaluationResult {
  let allCorrect = true;
  
  for (let i = 0; i < data.questions.length; i++) {
    const questionKey = `q${i + 1}`;
    const userAnswer = userAnswers[questionKey];
    const correctAnswer = data.questions[i].correctId;
    
    if (userAnswer !== correctAnswer) {
      allCorrect = false;
    }
  }
  
  return { correct: allCorrect };
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get detailed error analysis for a typed answer
 */
export function analyzeTypedAnswerError(
  userAnswer: string,
  acceptedAnswers: string[]
): { 
  closestMatch: string; 
  distance: number; 
  hasDiacriticIssue: boolean;
  hasWordOrderIssue: boolean;
} {
  const normalized = userAnswer.toLowerCase().trim();
  let closestMatch = acceptedAnswers[0];
  let minDistance = Infinity;
  let hasDiacriticIssue = false;
  let hasWordOrderIssue = false;
  
  for (const accepted of acceptedAnswers) {
    const target = accepted.toLowerCase();
    const distance = levenshteinDistance(normalized, target);
    
    if (distance < minDistance) {
      minDistance = distance;
      closestMatch = accepted;
    }
    
    // Check diacritics
    if (removeDiacritics(normalized) === removeDiacritics(target)) {
      hasDiacriticIssue = true;
    }
    
    // Check word order
    const userWords = normalized.split(/\s+/);
    const targetWords = target.split(/\s+/);
    if (userWords.length === targetWords.length && userWords.length > 1) {
      const sortedUser = [...userWords].sort();
      const sortedTarget = [...targetWords].sort();
      if (JSON.stringify(sortedUser) === JSON.stringify(sortedTarget)) {
        hasWordOrderIssue = true;
      }
    }
  }
  
  return {
    closestMatch,
    distance: minDistance,
    hasDiacriticIssue,
    hasWordOrderIssue,
  };
}
