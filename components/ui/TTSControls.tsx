'use client';

import { useState } from 'react';
import { Play, Pause, RotateCcw, Turtle, Zap, Repeat } from 'lucide-react';
import { useTTS } from '@/hooks/useTTS';

export interface TTSControlsProps {
  text: string;
  autoPlay?: boolean;
  showSlowToggle?: boolean;
  showReplayButton?: boolean;
  showLoopToggle?: boolean;
  className?: string;
  onStart?: () => void;
  onEnd?: () => void;
}

export function TTSControls({
  text,
  autoPlay = false,
  showSlowToggle = true,
  showReplayButton = true,
  showLoopToggle = false,
  className = '',
  onStart,
  onEnd,
}: TTSControlsProps) {
  const [loopEnabled, setLoopEnabled] = useState(false);
  const [state, controls] = useTTS({
    text,
    autoPlay,
    slowMode: false,
    loop: loopEnabled,
    loopCount: 0, // Infinite when loop is enabled
    onStart,
    onEnd,
  });

  const toggleLoop = () => {
    setLoopEnabled(!loopEnabled);
    if (state.isPlaying) {
      controls.stop();
    }
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Main Play/Pause Button */}
      <button
        onClick={controls.toggle}
        className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-semibold
          transition-all duration-200
          ${
            state.isPlaying
              ? 'bg-primary-600 text-white hover:bg-primary-700'
              : 'bg-primary-500 text-white hover:bg-primary-600'
          }
        `}
        aria-label={state.isPlaying ? 'Pause audio' : 'Play audio'}
      >
        {state.isPlaying ? (
          <>
            <Pause className="w-5 h-5" />
            <span>Stop</span>
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            <span>Play</span>
          </>
        )}
      </button>

      {/* Slow Mode Toggle */}
      {showSlowToggle && (
        <button
          onClick={controls.toggleSpeed}
          className={`
            p-2 rounded-lg transition-colors
            ${
              state.isSlow
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
          title={state.isSlow ? 'Normal speed' : 'Slow speed'}
          aria-label={state.isSlow ? 'Switch to normal speed' : 'Switch to slow speed'}
        >
          {state.isSlow ? <Turtle className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
        </button>
      )}

      {/* Replay Button */}
      {showReplayButton && (
        <button
          onClick={controls.replay}
          className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          title="Replay"
          aria-label="Replay audio"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      )}

      {/* Loop Toggle */}
      {showLoopToggle && (
        <button
          onClick={toggleLoop}
          className={`
            p-2 rounded-lg transition-colors
            ${
              loopEnabled
                ? 'bg-purple-500 text-white hover:bg-purple-600'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }
          `}
          title={loopEnabled ? 'Disable loop' : 'Enable loop'}
          aria-label={loopEnabled ? 'Disable loop mode' : 'Enable loop mode'}
        >
          <Repeat className="w-5 h-5" />
        </button>
      )}

      {/* Loop Counter (if looping) */}
      {loopEnabled && state.isPlaying && state.currentLoop > 0 && (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Loop {state.currentLoop}
        </span>
      )}

      {/* Error Display */}
      {state.error && (
        <span className="text-sm text-red-500 dark:text-red-400">
          {state.error}
        </span>
      )}
    </div>
  );
}

export interface TTSCompactControlsProps {
  text: string;
  slowMode?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
  className?: string;
}

/**
 * Compact version with just play and slow toggle
 */
export function TTSCompactControls({
  text,
  slowMode = false,
  onStart,
  onEnd,
  className = '',
}: TTSCompactControlsProps) {
  const [state, controls] = useTTS({
    text,
    slowMode,
    onStart,
    onEnd,
  });

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <button
        onClick={controls.toggle}
        className={`
          p-1.5 rounded transition-colors
          ${
            state.isPlaying
              ? 'bg-primary-500 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-primary-500 dark:hover:text-primary-400'
          }
        `}
        aria-label={state.isPlaying ? 'Stop' : 'Play'}
      >
        {state.isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>

      <button
        onClick={controls.toggleSpeed}
        className={`
          p-1.5 rounded transition-colors text-xs
          ${
            state.isSlow
              ? 'bg-blue-500 text-white'
              : 'text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400'
          }
        `}
        title={state.isSlow ? 'Normal' : 'Slow'}
      >
        {state.isSlow ? <Turtle className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
      </button>
    </div>
  );
}
