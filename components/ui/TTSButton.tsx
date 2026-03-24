'use client';

import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { useTTS } from '@/hooks/useTTS';

export interface TTSButtonProps {
  text: string;
  autoPlay?: boolean;
  slowMode?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'primary' | 'ghost' | 'minimal';
  showLabel?: boolean;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
  disabled?: boolean;
}

export function TTSButton({
  text,
  autoPlay = false,
  slowMode = false,
  size = 'md',
  variant = 'default',
  showLabel = false,
  className = '',
  onStart,
  onEnd,
  disabled = false,
}: TTSButtonProps) {
  const [state, controls] = useTTS({
    text,
    autoPlay,
    slowMode,
    onStart,
    onEnd,
  });

  const sizeClasses = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const variantClasses = {
    default: state.isPlaying
      ? 'bg-primary-500 text-white'
      : state.isLoading
      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
    primary: state.isPlaying
      ? 'bg-primary-600 text-white'
      : state.isLoading
      ? 'bg-primary-400 text-white'
      : 'bg-primary-500 text-white hover:bg-primary-600',
    ghost: state.isPlaying
      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
      : state.isLoading
      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
      : 'bg-transparent text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800',
    minimal: 'bg-transparent text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400',
  };

  const disabledClasses = 'opacity-50 cursor-not-allowed';

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        controls.toggle();
      }}
      disabled={disabled}
      className={`
        ${sizeClasses[size]} 
        ${variantClasses[variant]} 
        ${disabled ? disabledClasses : ''}
        rounded-full transition-all duration-200
        ${state.isPlaying || state.isLoading ? 'animate-pulse' : ''}
        ${className}
      `}
      title={state.isLoading ? 'Loading audio' : state.isPlaying ? 'Stop' : 'Listen'}
      aria-label={state.isLoading ? 'Loading audio' : state.isPlaying ? 'Stop audio' : 'Play audio'}
    >
      <div className="flex items-center gap-2">
        {state.isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : state.isPlaying ? (
          <VolumeX className={iconSizes[size]} />
        ) : (
          <Volume2 className={iconSizes[size]} />
        )}
        {showLabel && (
          <span className="text-sm font-medium">
            {state.isLoading ? 'Loading...' : state.isPlaying ? 'Stop' : 'Listen'}
          </span>
        )}
      </div>
    </button>
  );
}

export interface TTSIconButtonProps {
  text: string;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Minimal icon-only TTS button for inline use
 */
export function TTSIconButton({ text, className = '', onStart, onEnd }: TTSIconButtonProps) {
  return (
    <TTSButton
      text={text}
      size="sm"
      variant="minimal"
      className={className}
      onStart={onStart}
      onEnd={onEnd}
    />
  );
}
