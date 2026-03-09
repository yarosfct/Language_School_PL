'use client';

import { useState, useEffect } from 'react';
import { OrderingData } from '@/types/curriculum';
import { shuffle } from '@/lib/utils/string';
import { ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { TTSButton } from '@/components/ui/TTSButton';
import { TTSControls } from '@/components/ui/TTSControls';

interface OrderingExerciseProps {
  data: OrderingData;
  onSubmit: (answer: string[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
  autoPlayTTS?: boolean;
}

export function OrderingExercise({ 
  data, 
  onSubmit, 
  showFeedback, 
  isCorrect,
  explanation,
  autoPlayTTS = false,
}: OrderingExerciseProps) {
  const [items, setItems] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);

  useEffect(() => {
    // Initialize with scrambled items
    setItems(data.scrambled || shuffle(data.items));
  }, [data]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    if (submitted) return;
    
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    setItems(newItems);
  };

  const handleDragStart = (index: number) => {
    if (submitted) return;
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (submitted || draggedIndex === null) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (submitted || draggedIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newItems = [...items];
    const [draggedItem] = newItems.splice(draggedIndex, 1);
    newItems.splice(dragOverIndex, 0, draggedItem);
    
    setItems(newItems);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleSubmit = () => {
    setSubmitted(true);
    onSubmit(items);
  };

  return (
    <div className="space-y-4">
      {/* Instructions with Play All */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600 dark:text-gray-400 italic">
          💡 Drag items to reorder them, or use the arrow buttons
        </p>
        {submitted && showFeedback && isCorrect && (
          <TTSControls 
            text={data.items.join('. ')}
            showSlowToggle={true}
            showReplayButton={false}
          />
        )}
      </div>

      {/* Ordering list */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const isPlaying = playingIndex === index;
          
          return (
            <div 
              key={index} 
              className="flex items-center gap-2"
              draggable={!submitted}
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              onDragLeave={handleDragLeave}
            >
              {/* Drag handle */}
              <div className={`p-2 rounded cursor-grab active:cursor-grabbing ${
                submitted ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
                <GripVertical className="w-5 h-5 text-gray-400" />
              </div>

              {/* Arrow buttons */}
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveItem(index, 'up')}
                  disabled={submitted || index === 0}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveItem(index, 'down')}
                  disabled={submitted || index === items.length - 1}
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  title="Move down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
              
              {/* Item content */}
              <div className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                isDragging
                  ? 'opacity-50 scale-95'
                  : isDragOver && !submitted
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-105'
                  : submitted && showFeedback
                  ? isCorrect
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800'
              } ${!submitted && 'hover:border-gray-400 dark:hover:border-gray-500'} ${
                isPlaying ? 'ring-2 ring-primary-500' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400 mr-2">{index + 1}.</span>
                    <span className="text-gray-900 dark:text-white">{item}</span>
                  </div>
                  <TTSButton 
                    text={item}
                    size="sm"
                    variant="minimal"
                    onStart={() => setPlayingIndex(index)}
                    onEnd={() => setPlayingIndex(null)}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 transition-colors"
        >
          Submit Answer
        </button>
      )}

      {/* Feedback */}
      {submitted && showFeedback && (
        <div className={`p-4 rounded-lg ${
          isCorrect
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
        }`}>
          <p className="font-semibold mb-2">
            {isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </p>
          {explanation && <p>{explanation}</p>}
          {!isCorrect && (
            <div className="mt-2 text-sm">
              <p className="font-semibold">Correct order:</p>
              <ol className="list-decimal list-inside">
                {data.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
