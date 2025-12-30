'use client';

import { 
  Exercise, 
  MCQData, 
  MatchData, 
  FillBlankData, 
  TypedAnswerData, 
  OrderingData, 
  ConnectData,
  FlashcardData,
  ImageMatchData,
  ListeningChoiceData,
  DictationData,
  DialogueCompData,
} from '@/types/curriculum';
import { MCQExercise } from './MCQExercise';
import { MatchExercise } from './MatchExercise';
import { FillBlankExercise } from './FillBlankExercise';
import { TypedAnswerExercise } from './TypedAnswerExercise';
import { OrderingExercise } from './OrderingExercise';
import { ConnectExercise } from './ConnectExercise';
import { FlashcardExercise } from './FlashcardExercise';
import { ImageMatchExercise } from './ImageMatchExercise';
import { ListeningChoiceExercise } from './ListeningChoiceExercise';
import { DictationExercise } from './DictationExercise';
import { DialogueCompExercise } from './DialogueCompExercise';

interface ExerciseRendererProps {
  exercise: Exercise;
  onSubmit: (answer: unknown) => void;
  showFeedback?: boolean;
  feedbackMessage?: string;
  isCorrect?: boolean;
  autoPlayTTS?: boolean;
}

export function ExerciseRenderer({ 
  exercise, 
  onSubmit,
  showFeedback,
  feedbackMessage,
  isCorrect,
  autoPlayTTS = false,
}: ExerciseRendererProps) {
  const commonProps = {
    onSubmit,
    showFeedback,
    feedbackMessage,
    isCorrect,
    explanation: exercise.explanation,
    hints: exercise.hints,
  };

  switch (exercise.type) {
    case 'mcq':
      return <MCQExercise data={exercise.data as MCQData} {...commonProps} />;
    
    case 'match':
      return <MatchExercise data={exercise.data as MatchData} {...commonProps} />;
    
    case 'fill-blank':
      return <FillBlankExercise data={exercise.data as FillBlankData} {...commonProps} />;
    
    case 'typed-answer':
      return <TypedAnswerExercise data={exercise.data as TypedAnswerData} {...commonProps} />;
    
    case 'ordering':
      return <OrderingExercise data={exercise.data as OrderingData} {...commonProps} />;
    
    case 'connect':
      return <ConnectExercise data={exercise.data as ConnectData} {...commonProps} />;
    
    // New exercise types
    case 'flashcard':
      return (
        <FlashcardExercise 
          data={exercise.data as FlashcardData} 
          onSubmit={onSubmit as (answer: boolean) => void}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          explanation={exercise.explanation}
          autoPlayTTS={autoPlayTTS}
        />
      );
    
    case 'image-match':
      return (
        <ImageMatchExercise 
          data={exercise.data as ImageMatchData} 
          onSubmit={onSubmit as (answer: { imageId: string; wordId: string }[]) => void}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          explanation={exercise.explanation}
        />
      );
    
    case 'listening-choice':
    case 'listening-mcq':
      return (
        <ListeningChoiceExercise 
          data={exercise.data as ListeningChoiceData} 
          onSubmit={onSubmit as (answer: string) => void}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          explanation={exercise.explanation}
        />
      );
    
    case 'dictation':
      return (
        <DictationExercise 
          data={exercise.data as DictationData} 
          onSubmit={onSubmit as (answer: string) => void}
          showFeedback={showFeedback}
          feedbackMessage={feedbackMessage}
          isCorrect={isCorrect}
          explanation={exercise.explanation}
          hints={exercise.hints}
        />
      );
    
    case 'dialogue-comp':
    case 'dialogue-builder':
      return (
        <DialogueCompExercise 
          data={exercise.data as DialogueCompData} 
          onSubmit={onSubmit as (answers: Record<string, string>) => void}
          showFeedback={showFeedback}
          isCorrect={isCorrect}
          explanation={exercise.explanation}
        />
      );
    
    default:
      return (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg">
          Unknown exercise type: {exercise.type}
        </div>
      );
  }
}
