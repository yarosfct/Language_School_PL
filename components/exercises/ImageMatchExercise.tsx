'use client';

import { useState, useEffect } from 'react';
import { ImageMatchData } from '@/types/curriculum';
import { Check, X, Image as ImageIcon } from 'lucide-react';
import { shuffle } from '@/lib/utils/string';
import { TTSIconButton } from '@/components/ui/TTSButton';
import { speak } from '@/lib/tts';

interface ImageMatchExerciseProps {
  data: ImageMatchData;
  onSubmit: (answer: { imageId: string; wordId: string }[]) => void;
  showFeedback?: boolean;
  isCorrect?: boolean;
  explanation?: string;
}

export function ImageMatchExercise({
  data,
  onSubmit,
  showFeedback,
  isCorrect,
  explanation,
}: ImageMatchExerciseProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [matches, setMatches] = useState<Map<string, string>>(new Map());
  const [shuffledWords, setShuffledWords] = useState(data.words);
  const [submitted, setSubmitted] = useState(false);
  const [incorrectPairs, setIncorrectPairs] = useState<Set<string>>(new Set());

  useEffect(() => {
    setShuffledWords(shuffle(data.words));
  }, [data.words]);

  const handleImageClick = (imageId: string) => {
    if (submitted) return;
    
    if (selectedImage === imageId) {
      setSelectedImage(null);
    } else {
      setSelectedImage(imageId);
    }
  };

  const handleWordClick = (wordId: string) => {
    if (submitted || !selectedImage) return;

    const newMatches = new Map(matches);
    
    // Remove any existing match for this word
    for (const [imgId, wId] of newMatches.entries()) {
      if (wId === wordId) {
        newMatches.delete(imgId);
        break;
      }
    }
    
    // Add new match
    newMatches.set(selectedImage, wordId);
    setMatches(newMatches);
    setSelectedImage(null);
    
    // Play TTS for matched word
    const word = data.words.find(w => w.id === wordId);
    if (word) {
      speak(word.text);
    }
  };

  const getWordForImage = (imageId: string): string | undefined => {
    return matches.get(imageId);
  };

  const isWordUsed = (wordId: string): boolean => {
    return Array.from(matches.values()).includes(wordId);
  };

  const getImageForWord = (wordId: string): string | undefined => {
    for (const [imgId, wId] of matches.entries()) {
      if (wId === wordId) return imgId;
    }
    return undefined;
  };

  const handleSubmit = () => {
    if (matches.size !== data.images.length) return;
    
    setSubmitted(true);
    
    // Check for incorrect pairs
    const incorrect = new Set<string>();
    for (const [imageId, wordId] of matches.entries()) {
      const isCorrectPair = data.correctPairs.some(
        p => p.imageId === imageId && p.wordId === wordId
      );
      if (!isCorrectPair) {
        incorrect.add(imageId);
      }
    }
    setIncorrectPairs(incorrect);
    
    const answer = Array.from(matches.entries()).map(([imageId, wordId]) => ({
      imageId,
      wordId,
    }));
    onSubmit(answer);
  };

  const removeMatch = (imageId: string) => {
    if (submitted) return;
    const newMatches = new Map(matches);
    newMatches.delete(imageId);
    setMatches(newMatches);
  };

  const allMatched = matches.size === data.images.length;

  return (
    <div className="space-y-6">
      {/* Images grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {data.images.map((image) => {
          const matchedWordId = getWordForImage(image.id);
          const matchedWord = data.words.find(w => w.id === matchedWordId);
          const isSelected = selectedImage === image.id;
          const isIncorrect = incorrectPairs.has(image.id);
          const isCorrectMatch = submitted && matchedWordId && !isIncorrect;

          return (
            <div
              key={image.id}
              className={`relative rounded-xl border-2 overflow-hidden transition-all cursor-pointer ${
                isCorrectMatch
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                  : isIncorrect
                  ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                  : isSelected
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-300'
                  : matchedWord
                  ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300'
              }`}
              onClick={() => handleImageClick(image.id)}
            >
              {/* Image */}
              <div className="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                {image.src ? (
                  <img
                    src={image.src}
                    alt={image.alt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <ImageIcon className="w-12 h-12 mb-2" />
                    <span className="text-sm">{image.alt}</span>
                  </div>
                )}
              </div>

              {/* Matched word label */}
              {matchedWord && (
                <div
                  className={`absolute bottom-0 left-0 right-0 px-2 py-1 text-center text-sm font-medium ${
                    isCorrectMatch
                      ? 'bg-green-500 text-white'
                      : isIncorrect
                      ? 'bg-red-500 text-white'
                      : 'bg-blue-500 text-white'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!submitted) removeMatch(image.id);
                  }}
                >
                  {matchedWord.text}
                  {!submitted && (
                    <X className="w-4 h-4 inline ml-1 cursor-pointer hover:text-red-200" />
                  )}
                </div>
              )}

              {/* Result indicator */}
              {submitted && (
                <div className="absolute top-2 right-2">
                  {isCorrectMatch ? (
                    <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                  ) : isIncorrect ? (
                    <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                      <X className="w-4 h-4 text-white" />
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Words */}
      <div className="flex flex-wrap gap-2 justify-center">
        {shuffledWords.map((word) => {
          const isUsed = isWordUsed(word.id);
          const linkedImageId = getImageForWord(word.id);
          const isIncorrect = linkedImageId ? incorrectPairs.has(linkedImageId) : false;
          const isCorrectMatch = submitted && isUsed && !isIncorrect;

          return (
            <div key={word.id} className="relative">
              <button
                onClick={() => handleWordClick(word.id)}
                disabled={submitted || (isUsed && !selectedImage)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  isCorrectMatch
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default'
                    : isIncorrect
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 cursor-default'
                    : isUsed
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 opacity-50'
                    : selectedImage
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-200 cursor-pointer'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                } pr-8`}
              >
                {word.text}
              </button>
              <div className="absolute right-1 top-1/2 -translate-y-1/2">
                <TTSIconButton text={word.text} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Instructions */}
      {!submitted && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          {selectedImage
            ? 'Now click a word to match it'
            : 'Click an image, then click a word to match them'}
        </p>
      )}

      {/* Submit button */}
      {!submitted && (
        <button
          onClick={handleSubmit}
          disabled={!allMatched}
          className="w-full py-3 px-6 bg-primary-500 text-white rounded-lg font-semibold hover:bg-primary-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
        >
          {allMatched ? 'Check Answers' : `Match all images (${matches.size}/${data.images.length})`}
        </button>
      )}

      {/* Feedback */}
      {submitted && showFeedback && (
        <div
          className={`p-4 rounded-lg ${
            isCorrect
              ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300'
          }`}
        >
          <p className="font-semibold mb-2">
            {isCorrect ? '✓ All correct!' : '✗ Some matches are incorrect'}
          </p>
          {explanation && <p>{explanation}</p>}
          {!isCorrect && (
            <div className="mt-2 text-sm">
              <p className="font-medium">Correct matches:</p>
              <ul className="list-disc list-inside">
                {data.correctPairs.map((pair) => {
                  const image = data.images.find(i => i.id === pair.imageId);
                  const word = data.words.find(w => w.id === pair.wordId);
                  return (
                    <li key={pair.imageId}>
                      {image?.alt} → {word?.text}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
