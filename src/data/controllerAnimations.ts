export const SLOT_ANIMATIONS = [
  { id: 'jiggle', label: 'Jiggle' },
  { id: 'pulse', label: 'Pulse' },
  { id: 'shake', label: 'Shake' },
  { id: 'bounce', label: 'Bounce' },
  { id: 'spin', label: 'Spin' },
  { id: 'zoom', label: 'Zoom' }
] as const;

export type SlotAnimation = (typeof SLOT_ANIMATIONS)[number]['id'];

export const DEFAULT_SLOT_ANIMATION: SlotAnimation = 'jiggle';

export const REPEAT_ANIMATION_CLASS: Record<SlotAnimation, string> = {
  jiggle: 'anim-jiggle',
  pulse: 'anim-pulse',
  shake: 'anim-shake',
  bounce: 'anim-bounce',
  spin: 'anim-spin',
  zoom: 'anim-zoom'
};
