import { useState, useEffect, useCallback, useRef } from 'react';
import { speak, speakSlow, stopSpeaking, isSpeaking, isTTSSupported } from '@/lib/tts';

export interface TTSOptions {
  text: string;
  autoPlay?: boolean;
  slowMode?: boolean;
  loop?: boolean;
  loopCount?: number; // 0 = infinite
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

export interface TTSState {
  isPlaying: boolean;
  isLoading: boolean;
  isSlow: boolean;
  currentLoop: number;
  error: string | null;
}

export interface TTSControls {
  play: (text?: string) => void;
  stop: () => void;
  toggle: () => void;
  toggleSpeed: () => void;
  setSlowMode: (slow: boolean) => void;
  replay: () => void;
}

export function useTTS(options: TTSOptions): [TTSState, TTSControls] {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSlow, setIsSlow] = useState(options.slowMode ?? false);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const textRef = useRef(options.text);
  const loopCountRef = useRef(options.loopCount ?? 1);
  const loopRef = useRef(options.loop ?? false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | HTMLAudioElement | null>(null);
  const playbackRequestRef = useRef(0);

  // Update refs when options change
  useEffect(() => {
    textRef.current = options.text;
  }, [options.text]);

  useEffect(() => {
    loopCountRef.current = options.loopCount ?? 1;
  }, [options.loopCount]);

  useEffect(() => {
    loopRef.current = options.loop ?? false;
  }, [options.loop]);

  const playInternal = useCallback(async (text: string, slow: boolean, loopNum: number) => {
    const playbackRequestId = playbackRequestRef.current + 1;
    playbackRequestRef.current = playbackRequestId;

    if (!isTTSSupported()) {
      setError('Text-to-speech is not supported in your browser');
      return;
    }

    try {
      setIsLoading(true);
      setIsPlaying(false);
      setError(null);

      const speakFn = slow ? speakSlow : speak;
      const utterance = await speakFn(text, {
        onStart: () => {
          if (playbackRequestRef.current !== playbackRequestId) {
            return;
          }

          setIsLoading(false);
          setIsPlaying(true);
          options.onStart?.();
        },
        onEnd: () => {
          if (playbackRequestRef.current !== playbackRequestId) {
            return;
          }

          // Check if we should loop
          const shouldLoop = loopRef.current && (loopCountRef.current === 0 || loopNum < loopCountRef.current);
          
          if (shouldLoop) {
            const nextLoop = loopNum + 1;
            setCurrentLoop(nextLoop);
            // Small delay between loops
            setTimeout(() => {
              if (utteranceRef.current && playbackRequestRef.current === playbackRequestId) {
                playInternal(text, slow, nextLoop);
              }
            }, 500);
          } else {
            setIsLoading(false);
            setIsPlaying(false);
            setCurrentLoop(0);
            utteranceRef.current = null;
            options.onEnd?.();
          }
        },
        onError: (err) => {
          if (playbackRequestRef.current !== playbackRequestId) {
            return;
          }

          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(errorMessage);
          setIsLoading(false);
          setIsPlaying(false);
          options.onError?.(err);
        },
      });

      if (playbackRequestRef.current !== playbackRequestId) {
        return;
      }

      utteranceRef.current = utterance;

      if (!utterance) {
        setIsLoading(false);
        setIsPlaying(false);
      }
    } catch (err) {
      if (playbackRequestRef.current !== playbackRequestId) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      setIsLoading(false);
      setIsPlaying(false);
      options.onError?.(err);
    }
  }, [options]);

  const play = useCallback((text?: string) => {
    const textToSpeak = text ?? textRef.current;
    if (!textToSpeak) return;
    
    setCurrentLoop(1);
    playInternal(textToSpeak, isSlow, 1);
  }, [isSlow, playInternal]);

  const stop = useCallback(() => {
    playbackRequestRef.current += 1;
    stopSpeaking();
    setIsLoading(false);
    setIsPlaying(false);
    setCurrentLoop(0);
    utteranceRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying || isLoading) {
      stop();
    } else {
      play();
    }
  }, [isLoading, isPlaying, play, stop]);

  const toggleSpeed = useCallback(() => {
    const newSlow = !isSlow;
    setIsSlow(newSlow);
    
    // If currently playing, restart with new speed
    if (isPlaying) {
      stop();
      setTimeout(() => {
        playInternal(textRef.current, newSlow, currentLoop);
      }, 100);
    }
  }, [isSlow, isPlaying, stop, playInternal, currentLoop]);

  const setSlowModeManual = useCallback((slow: boolean) => {
    setIsSlow(slow);
  }, []);

  const replay = useCallback(() => {
    stop();
    setTimeout(() => play(), 100);
  }, [stop, play]);

  // Auto-play on mount if enabled
  useEffect(() => {
    if (options.autoPlay && options.text) {
      play();
    }

    // Cleanup on unmount
    return () => {
      stop();
    };
  }, []); // Empty deps - only run on mount/unmount

  const state: TTSState = {
    isPlaying,
    isLoading,
    isSlow,
    currentLoop,
    error,
  };

  const controls: TTSControls = {
    play,
    stop,
    toggle,
    toggleSpeed,
    setSlowMode: setSlowModeManual,
    replay,
  };

  return [state, controls];
}
