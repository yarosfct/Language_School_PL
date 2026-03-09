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
  const [isSlow, setIsSlow] = useState(options.slowMode ?? false);
  const [currentLoop, setCurrentLoop] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const textRef = useRef(options.text);
  const loopCountRef = useRef(options.loopCount ?? 1);
  const loopRef = useRef(options.loop ?? false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | HTMLAudioElement | null>(null);

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
    if (!isTTSSupported()) {
      setError('Text-to-speech is not supported in your browser');
      return;
    }

    try {
      setIsPlaying(true);
      setError(null);
      
      options.onStart?.();

      const speakFn = slow ? speakSlow : speak;
      const utterance = await speakFn(text, {
        onEnd: () => {
          // Check if we should loop
          const shouldLoop = loopRef.current && (loopCountRef.current === 0 || loopNum < loopCountRef.current);
          
          if (shouldLoop) {
            const nextLoop = loopNum + 1;
            setCurrentLoop(nextLoop);
            // Small delay between loops
            setTimeout(() => {
              if (utteranceRef.current) {
                playInternal(text, slow, nextLoop);
              }
            }, 500);
          } else {
            setIsPlaying(false);
            setCurrentLoop(0);
            utteranceRef.current = null;
            options.onEnd?.();
          }
        },
        onError: (err) => {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
          setError(errorMessage);
          setIsPlaying(false);
          options.onError?.(err);
        },
      });

      utteranceRef.current = utterance;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
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
    stopSpeaking();
    setIsPlaying(false);
    setCurrentLoop(0);
    utteranceRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      play();
    }
  }, [isPlaying, play, stop]);

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
