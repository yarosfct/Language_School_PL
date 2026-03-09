'use client';

import React from 'react';

// Polish special characters
const POLISH_DIACRITICS = [
  { lower: 'ą', upper: 'Ą' },
  { lower: 'ć', upper: 'Ć' },
  { lower: 'ę', upper: 'Ę' },
  { lower: 'ł', upper: 'Ł' },
  { lower: 'ń', upper: 'Ń' },
  { lower: 'ó', upper: 'Ó' },
  { lower: 'ś', upper: 'Ś' },
  { lower: 'ź', upper: 'Ź' },
  { lower: 'ż', upper: 'Ż' },
];

interface DiacriticsKeyboardProps {
  onCharacter: (char: string) => void;
  uppercase?: boolean;
  className?: string;
  compact?: boolean;
}

export function DiacriticsKeyboard({
  onCharacter,
  uppercase = false,
  className = '',
  compact = false,
}: DiacriticsKeyboardProps) {
  return (
    <div
      className={`flex flex-wrap gap-1 p-2 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
    >
      {POLISH_DIACRITICS.map((char) => (
        <button
          key={char.lower}
          type="button"
          className={`${compact ? 'w-8 h-8' : 'w-10 h-10'} p-0 font-medium text-lg 
            bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md
            text-gray-700 dark:text-gray-300
            hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-700 dark:hover:text-primary-300 
            hover:border-primary-300 dark:hover:border-primary-700
            transition-colors`}
          onClick={() => onCharacter(uppercase ? char.upper : char.lower)}
        >
          {uppercase ? char.upper : char.lower}
        </button>
      ))}
    </div>
  );
}

// Floating version that can be positioned near input fields
interface FloatingDiacriticsProps extends DiacriticsKeyboardProps {
  visible: boolean;
  position?: 'above' | 'below';
}

export function FloatingDiacritics({
  visible,
  position = 'below',
  ...props
}: FloatingDiacriticsProps) {
  if (!visible) return null;

  return (
    <div
      className={`absolute z-50 ${
        position === 'above' ? 'bottom-full mb-2' : 'top-full mt-2'
      } left-0 right-0`}
    >
      <DiacriticsKeyboard {...props} />
    </div>
  );
}

// Hook to manage diacritics input for text fields
export function useDiacriticsInput(
  inputRef: React.RefObject<HTMLInputElement | HTMLTextAreaElement>
) {
  const [showKeyboard, setShowKeyboard] = React.useState(false);
  const [uppercase, setUppercase] = React.useState(false);

  const insertCharacter = React.useCallback(
    (char: string) => {
      const input = inputRef.current;
      if (!input) return;

      const start = input.selectionStart ?? 0;
      const end = input.selectionEnd ?? 0;
      const value = input.value;

      const newValue = value.substring(0, start) + char + value.substring(end);

      // Update input value
      input.value = newValue;

      // Move cursor after inserted character
      const newPosition = start + char.length;
      input.setSelectionRange(newPosition, newPosition);

      // Trigger input event for React forms
      const event = new Event('input', { bubbles: true });
      input.dispatchEvent(event);

      // Keep focus on input
      input.focus();
    },
    [inputRef]
  );

  const toggleUppercase = React.useCallback(() => {
    setUppercase((prev) => !prev);
  }, []);

  const handleFocus = React.useCallback(() => {
    setShowKeyboard(true);
  }, []);

  const handleBlur = React.useCallback((e: React.FocusEvent) => {
    // Delay hiding to allow clicking on keyboard
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget?.closest('.diacritics-keyboard')) {
      setTimeout(() => setShowKeyboard(false), 150);
    }
  }, []);

  return {
    showKeyboard,
    uppercase,
    insertCharacter,
    toggleUppercase,
    handleFocus,
    handleBlur,
    setShowKeyboard,
  };
}

export default DiacriticsKeyboard;
