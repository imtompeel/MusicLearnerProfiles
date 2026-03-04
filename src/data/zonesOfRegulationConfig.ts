export type AgeBandId = 'early' | 'primary' | 'secondary';

export interface AgeBandConfig {
  id: AgeBandId;
  label: string;
  description: string;
}

export const AGE_BANDS: AgeBandConfig[] = [
  {
    id: 'early',
    label: 'Ages 4–7',
    description: 'Early years and KS1 learners'
  },
  {
    id: 'primary',
    label: 'Ages 7–11',
    description: 'Primary learners (upper KS2)'
  },
  {
    id: 'secondary',
    label: 'Ages 11+',
    description: 'Secondary and older learners'
  }
];

export type ZoneId = 'blue' | 'green' | 'yellow' | 'red';

export interface ZoneConfig {
  id: ZoneId;
  label: string;
  colourHex: string;
  description: string;
  /**
   * Example feeling words to display at the top of the session.
   * These are designed to be age-appropriate summaries rather than
   * an exhaustive list of every possible emotion.
   */
  subWords: Record<AgeBandId, string[]>;
}

export const ZONES_OF_REGULATION: ZoneConfig[] = [
  {
    id: 'blue',
    label: 'Blue Zone',
    colourHex: '#2196F3',
    description: 'Low energy feelings',
    subWords: {
      early: ['sad', 'tired', 'bored'],
      primary: ['sad', 'tired', 'bored', 'lonely'],
      secondary: ['sad', 'tired', 'bored', 'lonely', 'flat']
    }
  },
  {
    id: 'green',
    label: 'Green Zone',
    colourHex: '#4CAF50',
    description: 'Calm and ready to learn',
    subWords: {
      early: ['happy', 'calm', 'okay'],
      primary: ['happy', 'calm', 'content', 'focused'],
      secondary: ['happy', 'calm', 'content', 'focused', 'peaceful']
    }
  },
  {
    id: 'yellow',
    label: 'Yellow Zone',
    colourHex: '#FFEB3B',
    description: 'Heightened but still in control',
    subWords: {
      early: ['worried', 'silly', 'excited'],
      primary: ['worried', 'silly', 'excited', 'nervous'],
      secondary: ['worried', 'frustrated', 'excited', 'nervous']
    }
  },
  {
    id: 'red',
    label: 'Red Zone',
    colourHex: '#F44336',
    description: 'Very big feelings',
    subWords: {
      early: ['angry', 'cross', 'out of control'],
      primary: ['angry', 'furious', 'out of control'],
      secondary: ['angry', 'furious', 'overwhelmed', 'out of control']
    }
  }
];

