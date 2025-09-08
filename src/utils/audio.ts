// Musical notes for each key press
export const notes = [
  'C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5',
  'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6', 'F6', 'G6', 'A6',
  'B6', 'C7', 'D7', 'E7', 'F7', 'G7', 'A7', 'B7'
];

// Convert note to frequency
export function noteToFrequency(note: string): number {
  const noteMap: { [key: string]: number } = {
    'C4': 261.63, 'D4': 293.66, 'E4': 329.63, 'F4': 349.23, 'G4': 392.00, 'A4': 440.00, 'B4': 493.88,
    'C5': 523.25, 'D5': 587.33, 'E5': 659.25, 'F5': 698.46, 'G5': 783.99, 'A5': 880.00, 'B5': 987.77,
    'C6': 1046.50, 'D6': 1174.66, 'E6': 1318.51, 'F6': 1396.91, 'G6': 1567.98, 'A6': 1760.00, 'B6': 1975.53,
    'C7': 2093.00, 'D7': 2349.32, 'E7': 2637.02, 'F7': 2793.83, 'G7': 3135.96,
    'A7': 3520.00, 'B7': 3951.07
  };
  return noteMap[note] || 440;
}

// Audio context and oscillator management
let audioContext: AudioContext | null = null;
const oscillators: { [key: string]: OscillatorNode } = {};

// Initialize audio context
export function initAudio(): void {
  try {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (e) {
    console.log('Audio context not supported');
  }
}

// Play a musical note
export function playNote(frequency: number, duration: number = 0.3): void {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.type = 'sine';

  gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);

  const id = Date.now().toString();
  oscillators[id] = oscillator;
  setTimeout(() => delete oscillators[id], duration * 1000);
}

// Resume audio context if suspended
export function resumeAudioContext(): void {
  if (audioContext && audioContext.state === 'suspended') {
    audioContext.resume();
  }
}

// Play sound file
export function playSoundFile(soundType: string): void {
  // Map sound types to audio files
  const soundFiles: { [key: string]: string } = {
    'Nature sounds': 'nature-sounds.mp3',
    'Musical sounds': 'musical-sounds.mp3',
    'Animal sounds': 'animal-sounds.mp3',
    'Everyday sounds': 'everyday-sounds.mp3'
  };
  
  const audioFile = soundFiles[soundType];
  if (audioFile) {
    // Create and play the audio
    const audio = new Audio(`./sounds/${audioFile}`);
    audio.play().catch(error => {
      console.error('Error playing sound file:', error);
    });
  }
}

// Audio preview management
let currentAudio: HTMLAudioElement | null = null;

export function playAudioPreview(url: string): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  if (url) {
    currentAudio = new Audio(url);
    currentAudio.play().catch(error => {
      console.error('Error playing audio:', error);
    });
  }
}

export function stopAudioPreview(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
}
