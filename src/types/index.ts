export interface ClassData {
  class_name: string;
  soi_median: string;
}

export interface MusicQuestion {
  session_type: string;
  class_level: string;
  question_number: string;
  question_text: string;
  question_type: 'multiple' | 'single' | 'sound' | 'search' | 'freesound' | 'pattern_match' | 'word_cloud' | 'open_ended' | 'idea_collection' | 'idea_voting';
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  emoji1: string;
  emoji2: string;
  emoji3: string;
  emoji4: string;
  search_terms?: string[];
  anti_terms?: string[];
  pattern_images?: string[];
  pattern_sounds?: string[];
  matching_pairs?: { sound: string; image: string; label: string }[];
  placeholder?: string;
  min_duration?: number;
  max_duration?: number;
}

export interface StudentData {
  class: string;
  session: string;
  name: string;
  timestamp: string;
  date: string;
  time: string;
  soi_level: string;
  [key: string]: any; // For dynamic question responses
}

export interface SpotifyArtist {
  id: string;
  name: string;
  image: string;
  popularity: number;
  genres: string[];
}

export interface SpotifyTrack {
  id: string;
  name: string;
  preview_url: string;
  album: string;
  album_image: string;
  duration: number;
}

export interface SpotifySong {
  id: string;
  name: string;
  artist: string;
  album: string;
  album_image: string;
  preview_url: string;
  duration: number;
}

export interface StudentPreference {
  artist_id?: string;
  artist_name?: string;
  track_id?: string;
  track_name?: string;
  preview_url?: string;
  song_id?: string;
  [key: string]: any;
}

export interface CurrentClass {
  name: string;
  soiMedian: string;
}

export type StatusType = 'success' | 'error' | 'info' | '';
