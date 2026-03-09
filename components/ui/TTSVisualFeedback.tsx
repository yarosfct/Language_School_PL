'use client';

import { Volume2 } from 'lucide-react';

export interface TTSVisualFeedbackProps {
  isPlaying: boolean;
  variant?: 'pulse' | 'wave' | 'glow' | 'bounce';
  children?: React.ReactNode;
  className?: string;
}

export function TTSVisualFeedback({
  isPlaying,
  variant = 'pulse',
  children,
  className = '',
}: TTSVisualFeedbackProps) {
  const getAnimationClass = () => {
    if (!isPlaying) return '';
    
    switch (variant) {
      case 'pulse':
        return 'animate-pulse';
      case 'bounce':
        return 'animate-bounce';
      case 'glow':
        return 'shadow-lg shadow-primary-500/50';
      case 'wave':
        return 'animate-pulse';
      default:
        return 'animate-pulse';
    }
  };

  const getContainerClass = () => {
    if (!isPlaying) return '';
    
    switch (variant) {
      case 'glow':
        return 'ring-2 ring-primary-500 ring-opacity-50';
      default:
        return '';
    }
  };

  return (
    <div className={`relative ${getContainerClass()} ${className}`}>
      {children}
      {isPlaying && variant === 'wave' && <SoundWaveAnimation />}
    </div>
  );
}

/**
 * Animated sound wave visualization
 */
function SoundWaveAnimation() {
  return (
    <div className="absolute -top-1 -right-1 flex items-center gap-0.5">
      <div className="w-1 bg-primary-500 rounded-full animate-sound-wave-1" style={{ height: '8px' }} />
      <div className="w-1 bg-primary-500 rounded-full animate-sound-wave-2" style={{ height: '12px' }} />
      <div className="w-1 bg-primary-500 rounded-full animate-sound-wave-3" style={{ height: '8px' }} />
    </div>
  );
}

export interface HighlightedTextProps {
  text: string;
  isPlaying: boolean;
  currentWord?: number; // Index of currently spoken word
  className?: string;
}

/**
 * Text component that highlights words as they're spoken
 */
export function HighlightedText({
  text,
  isPlaying,
  currentWord = 0,
  className = '',
}: HighlightedTextProps) {
  const words = text.split(' ');

  return (
    <div className={`${className}`}>
      {words.map((word, index) => (
        <span
          key={index}
          className={`
            inline-block mr-1 transition-all duration-200
            ${isPlaying && index === currentWord 
              ? 'text-primary-600 dark:text-primary-400 font-bold scale-110 bg-primary-100 dark:bg-primary-900/30 px-1 rounded' 
              : ''
            }
          `}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

export interface SpeakerIconAnimatedProps {
  isPlaying: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Animated speaker icon
 */
export function SpeakerIconAnimated({
  isPlaying,
  size = 'md',
  className = '',
}: SpeakerIconAnimatedProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <Volume2 
        className={`
          ${sizeClasses[size]} 
          ${isPlaying ? 'text-primary-500 animate-pulse' : 'text-gray-500'}
          transition-colors
        `} 
      />
      {isPlaying && (
        <>
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-ping opacity-75" />
          <span className="absolute inset-0 rounded-full bg-primary-500 animate-pulse opacity-50" />
        </>
      )}
    </div>
  );
}
