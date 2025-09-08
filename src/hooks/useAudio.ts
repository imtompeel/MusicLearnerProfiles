import { useEffect, useRef } from 'react';
import { initAudio, resumeAudioContext } from '../utils/audio';

export function useAudio() {
  const audioInitialized = useRef(false);

  useEffect(() => {
    if (!audioInitialized.current) {
      initAudio();
      audioInitialized.current = true;
    }

    // Resume audio context on first user interaction
    const handleFirstClick = () => {
      resumeAudioContext();
      document.body.removeEventListener('click', handleFirstClick);
    };

    document.body.addEventListener('click', handleFirstClick, { once: true });

    return () => {
      document.body.removeEventListener('click', handleFirstClick);
    };
  }, []);
}
