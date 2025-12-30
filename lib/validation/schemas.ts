// Zod schemas for content validation

import { z } from 'zod';

// ============================================
// COMMON SCHEMAS
// ============================================

export const TagSchema = z.object({
  type: z.enum(['grammar', 'topic', 'difficulty', 'error-type']),
  value: z.string(),
});

export const AudioAssetSchema = z.object({
  url: z.string(),
  transcript: z.string().optional(),
  duration: z.number().optional(),
});

export const CEFRLevelSchema = z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

export const CEFRSublevelSchema = z.enum([
  'A1.1', 'A1.2', 'A2.1', 'A2.2', 
  'B1.1', 'B1.2', 'B2.1', 'B2.2', 
  'C1.1', 'C1.2', 'C2.1', 'C2.2'
]);

export const PartOfSpeechSchema = z.enum([
  'noun', 'verb', 'adjective', 'adverb', 'phrase', 
  'numeral', 'pronoun', 'preposition', 'conjunction', 'interjection'
]);

export const GenderSchema = z.enum(['masculine', 'feminine', 'neuter']);

// ============================================
// LEGACY VOCAB ITEM (for curriculum lessons)
// ============================================

export const VocabItemSchema = z.object({
  polish: z.string(),
  english: z.string(),
  partOfSpeech: z.string(),
  gender: GenderSchema.optional(),
  tags: z.array(TagSchema),
});

// ============================================
// EXISTING EXERCISE DATA SCHEMAS
// ============================================

export const MCQDataSchema = z.object({
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).min(3).max(6),
  correctOptionId: z.string(),
});

export const MatchDataSchema = z.object({
  pairs: z.array(z.object({
    left: z.string(),
    right: z.string(),
  })).min(3),
  shuffleRight: z.boolean(),
});

export const FillBlankDataSchema = z.object({
  template: z.string(),
  blanks: z.array(z.object({
    position: z.number(),
    acceptedAnswers: z.array(z.string()).min(1),
    caseSensitive: z.boolean().optional(),
  })).min(1),
});

export const EvaluationRulesSchema = z.object({
  allowDiacriticErrors: z.boolean(),
  allowTypos: z.boolean(),
  caseSensitive: z.boolean(),
});

export const TypedAnswerDataSchema = z.object({
  acceptedAnswers: z.array(z.string()).min(1),
  evaluationRules: EvaluationRulesSchema,
  feedbackHints: z.object({
    wrongCase: z.string().optional(),
    wrongGender: z.string().optional(),
    wrongAspect: z.string().optional(),
  }).optional(),
});

export const OrderingDataSchema = z.object({
  items: z.array(z.string()).min(3),
  scrambled: z.array(z.string()).optional(),
});

export const ConnectDataSchema = z.object({
  leftItems: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).min(3),
  rightItems: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).min(3),
  correctPairs: z.array(z.object({
    leftId: z.string(),
    rightId: z.string(),
  })).min(3),
});

// ============================================
// NEW EXERCISE DATA SCHEMAS
// ============================================

export const FlashcardDataSchema = z.object({
  word: z.string().min(1),
  translation: z.string().min(1),
  pronunciation: z.string().optional(),
  example: z.object({
    polish: z.string(),
    english: z.string(),
  }).optional(),
  imageAsset: z.string().optional(),
  gender: GenderSchema.optional(),
  partOfSpeech: z.string().optional(),
});

export const ImageMatchDataSchema = z.object({
  images: z.array(z.object({
    id: z.string(),
    src: z.string(),
    alt: z.string(),
  })).min(2),
  words: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).min(2),
  correctPairs: z.array(z.object({
    imageId: z.string(),
    wordId: z.string(),
  })).min(2),
});

export const ListeningChoiceDataSchema = z.object({
  audioText: z.string().min(1),
  options: z.array(z.object({
    id: z.string(),
    text: z.string(),
  })).min(3).max(6),
  correctOptionId: z.string(),
  playbackSpeed: z.number().min(0.5).max(1.5).optional(),
});

export const DictationDataSchema = z.object({
  audioText: z.string().min(1),
  acceptedAnswers: z.array(z.string()).min(1),
  evaluationRules: EvaluationRulesSchema,
  playbackSpeed: z.number().min(0.5).max(1.5).optional(),
});

export const DialogueCompDataSchema = z.object({
  dialogue: z.array(z.object({
    speaker: z.string(),
    text: z.string(),
    translation: z.string().optional(),
  })).min(2),
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.object({
      id: z.string(),
      text: z.string(),
    })).min(2),
    correctId: z.string(),
  })).min(1),
});

// ============================================
// EXERCISE TYPE ENUM (Extended)
// ============================================

export const ExerciseTypeSchema = z.enum([
  'mcq', 'match', 'fill-blank', 'typed-answer', 'ordering', 'connect',
  'dictation', 'listening-mcq', 'dialogue-builder',
  'flashcard', 'image-match', 'listening-choice', 'dialogue-comp'
]);

// ============================================
// EXERCISE SCHEMAS
// ============================================

// Flexible exercise ID pattern for both curriculum and topic exercises
const exerciseIdPattern = /^ex-[\w-]+-\d{2,3}$/;

export const ExerciseSchema = z.object({
  id: z.string().regex(exerciseIdPattern, 'Exercise ID must match pattern ex-{source}-{number}'),
  type: ExerciseTypeSchema,
  question: z.string().min(1),
  tags: z.array(TagSchema).min(1),
  data: z.unknown(), // Type-specific validation done separately
  solution: z.unknown(),
  explanation: z.string().optional(),
  hints: z.array(z.string()).optional(),
  audio: AudioAssetSchema.optional(),
  topicId: z.string().optional(),
  estimatedSeconds: z.number().positive().optional(),
});

// Stricter schema for curriculum exercises
export const CurriculumExerciseSchema = ExerciseSchema.extend({
  id: z.string().regex(/^ex-\d{2}-\d{2}-\d{2}$/, 'Curriculum exercise ID must match ex-XX-XX-XX'),
  tags: z.array(TagSchema).min(2),
});

// ============================================
// CURRICULUM SCHEMAS
// ============================================

export const LessonSchema = z.object({
  id: z.string().regex(/^lesson-\d{2}-\d{2}$/),
  unitId: z.string(),
  title: z.string(),
  description: z.string(),
  order: z.number(),
  exercises: z.array(CurriculumExerciseSchema),
  grammarTopics: z.array(z.string()),
  vocabularyIntroduced: z.array(VocabItemSchema),
});

export const UnitSchema = z.object({
  id: z.string().regex(/^unit-\d{2}$/),
  title: z.string(),
  description: z.string(),
  level: CEFRLevelSchema,
  order: z.number(),
  lessons: z.array(LessonSchema),
});

export const CurriculumSchema = z.array(UnitSchema);

// ============================================
// TOPIC-BASED LEARNING SCHEMAS
// ============================================

export const VocabularyItemSchema = z.object({
  id: z.string().regex(/^vocab-[\w-]+-\d{3}$/, 'Vocab ID must match vocab-{topic}-XXX'),
  topicId: z.string(),
  word: z.string().min(1),
  pronunciation: z.string().optional(),
  translationEN: z.string().min(1),
  translationPT: z.string().optional(),
  partOfSpeech: PartOfSpeechSchema,
  gender: GenderSchema.optional(),
  plural: z.string().optional(),
  examples: z.array(z.object({
    polish: z.string(),
    english: z.string(),
  })).min(1),
  imageAsset: z.string().optional(),
  audioAsset: z.string().optional(),
  tags: z.array(TagSchema),
  notes: z.string().optional(),
});

export const TopicSchema = z.object({
  id: z.string().regex(/^topic-[\w-]+$/, 'Topic ID must match topic-{name}'),
  title: z.string().min(1),
  description: z.string().min(10),
  icon: z.string().min(1),
  cefrLevel: CEFRLevelSchema,
  sublevel: CEFRSublevelSchema,
  tags: z.array(z.string()).min(1),
  estimatedMinutes: z.number().positive(),
  vocabularyItems: z.array(VocabularyItemSchema).min(10),
  exercises: z.array(ExerciseSchema).min(20),
  checkpointExercises: z.array(ExerciseSchema).min(5),
  order: z.number(),
});

export const TopicMetaSchema = z.object({
  id: z.string(),
  title: z.string(),
  icon: z.string(),
  sublevel: CEFRSublevelSchema,
  order: z.number(),
  vocabCount: z.number(),
  exerciseCount: z.number(),
});

export const TopicIndexSchema = z.object({
  level: CEFRLevelSchema,
  topics: z.array(TopicMetaSchema),
  lastUpdated: z.string(), // ISO date
});

// ============================================
// VALIDATION FUNCTIONS
// ============================================

export function validateCurriculum(data: unknown) {
  return CurriculumSchema.parse(data);
}

export function validateUnit(data: unknown) {
  return UnitSchema.parse(data);
}

export function validateLesson(data: unknown) {
  return LessonSchema.parse(data);
}

export function validateExercise(data: unknown) {
  return ExerciseSchema.parse(data);
}

export function validateTopic(data: unknown) {
  return TopicSchema.parse(data);
}

export function validateVocabularyItem(data: unknown) {
  return VocabularyItemSchema.parse(data);
}

export function validateTopicIndex(data: unknown) {
  return TopicIndexSchema.parse(data);
}

// ============================================
// TYPE-SPECIFIC EXERCISE DATA VALIDATION
// ============================================

export function validateExerciseData(type: string, data: unknown) {
  switch (type) {
    case 'mcq':
      return MCQDataSchema.parse(data);
    case 'match':
      return MatchDataSchema.parse(data);
    case 'fill-blank':
      return FillBlankDataSchema.parse(data);
    case 'typed-answer':
      return TypedAnswerDataSchema.parse(data);
    case 'ordering':
      return OrderingDataSchema.parse(data);
    case 'connect':
      return ConnectDataSchema.parse(data);
    case 'flashcard':
      return FlashcardDataSchema.parse(data);
    case 'image-match':
      return ImageMatchDataSchema.parse(data);
    case 'listening-choice':
    case 'listening-mcq':
      return ListeningChoiceDataSchema.parse(data);
    case 'dictation':
      return DictationDataSchema.parse(data);
    case 'dialogue-comp':
    case 'dialogue-builder':
      return DialogueCompDataSchema.parse(data);
    default:
      throw new Error(`Unknown exercise type: ${type}`);
  }
}
