export type TierId = '1' | '2' | '3';

export type LayoutMode = 'centerColumn' | 'grid2x2' | 'row';
export type RevealMode = 'replaceScreen' | 'expandUnder' | 'modal';

export interface TierLayoutConfig {
  id: TierId;
  layoutMode: LayoutMode;
  revealMode: RevealMode;
  maxOptions: number;
  scrollEmotions: boolean;
  // sizing tokens (pixels unless noted)
  zoneButtonMinHeight: number;
  zoneLabelFontSize: number;
  zoneGap: number;
  containerWidthPercent: number;
  emotionButtonMinHeight: number;
  emotionLabelFontSize: number;
}

export const TIER_CONFIG: Record<TierId, TierLayoutConfig> = {
  '1': {
    id: '1',
    layoutMode: 'centerColumn',
    revealMode: 'replaceScreen',
    maxOptions: 3,
    scrollEmotions: false,
    zoneButtonMinHeight: 200, // ~18–22vh on iPad
    zoneLabelFontSize: 28,
    zoneGap: 20,
    containerWidthPercent: 60,
    emotionButtonMinHeight: 80,
    emotionLabelFontSize: 22
  },
  '2': {
    id: '2',
    layoutMode: 'grid2x2',
    revealMode: 'expandUnder',
    maxOptions: 6,
    scrollEmotions: false,
    zoneButtonMinHeight: 180,
    zoneLabelFontSize: 20,
    zoneGap: 24,
    containerWidthPercent: 75,
    emotionButtonMinHeight: 64,
    emotionLabelFontSize: 18
  },
  '3': {
    id: '3',
    layoutMode: 'grid2x2',
    revealMode: 'expandUnder',
    maxOptions: 6,
    scrollEmotions: false,
    zoneButtonMinHeight: 180,
    zoneLabelFontSize: 20,
    zoneGap: 24,
    containerWidthPercent: 75,
    emotionButtonMinHeight: 64,
    emotionLabelFontSize: 18
  }
};

