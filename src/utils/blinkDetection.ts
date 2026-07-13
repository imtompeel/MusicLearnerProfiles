export type FaceLandmark = { x: number; y: number; z?: number };

const LEFT_EYE = [33, 160, 158, 133, 153, 144] as const;
const RIGHT_EYE = [362, 385, 387, 263, 373, 380] as const;

export const EAR_OPEN_THRESHOLD = 0.22;
export const MIN_BLINK_MS = 100;
export const MAX_BLINK_MS = 350;
export const MIN_GAP_BETWEEN_BLINKS_MS = 450;
export const DOUBLE_BLINK_WINDOW_MS = 1800;
const COOLDOWN_MS = 3500;
const POST_TOGGLE_ARM_MS = 500;

type EyeState = 'open' | 'closed';

export type BlinkLogEvent =
  | 'armed'
  | 'first-blink'
  | 'second-blink'
  | 'window-expired'
  | 'toggle'
  | 'face-lost'
  | 'too-soon'
  | 'cooldown';

function distance(a: FaceLandmark, b: FaceLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(landmarks: FaceLandmark[], indices: readonly number[]): number {
  const [p1, p2, p3, p4, p5, p6] = indices.map((index) => landmarks[index]);
  const vertical1 = distance(p2, p6);
  const vertical2 = distance(p3, p5);
  const horizontal = distance(p1, p4);
  if (horizontal < 1e-6) {
    return 1;
  }
  return (vertical1 + vertical2) / (2 * horizontal);
}

export function estimateEyeOpenness(landmarks: FaceLandmark[]): number | null {
  if (!landmarks || landmarks.length < 388) {
    return null;
  }

  const leftEar = eyeAspectRatio(landmarks, LEFT_EYE);
  const rightEar = eyeAspectRatio(landmarks, RIGHT_EYE);
  return (leftEar + rightEar) / 2;
}

export type BlinkDetectorState = {
  eyeState: EyeState;
  closedSince: number | null;
  blinkCount: number;
  lastBlinkAt: number | null;
  lastToggleAt: number;
  armedAt: number;
};

export function createBlinkDetectorState(): BlinkDetectorState {
  return {
    eyeState: 'open',
    closedSince: null,
    blinkCount: 0,
    lastBlinkAt: null,
    lastToggleAt: 0,
    armedAt: 0,
  };
}

export type BlinkDetectorResult = {
  state: BlinkDetectorState;
  shouldToggle: boolean;
  secondBlinkCountdown: number;
  logEvent?: BlinkLogEvent;
  logDetail?: string;
};

export function getSecondBlinkCountdown(state: BlinkDetectorState, now: number): number {
  if (state.lastBlinkAt === null || state.blinkCount < 1) {
    return 0;
  }

  const elapsed = now - state.lastBlinkAt;
  if (elapsed <= 0 || elapsed >= DOUBLE_BLINK_WINDOW_MS) {
    return 0;
  }

  return 1 - elapsed / DOUBLE_BLINK_WINDOW_MS;
}

export function processBlinkFrame(
  landmarks: FaceLandmark[] | undefined,
  state: BlinkDetectorState,
  now: number,
): BlinkDetectorResult {
  const nextState: BlinkDetectorState = { ...state };
  let logEvent: BlinkLogEvent | undefined;
  let logDetail: string | undefined;

  if (now < nextState.armedAt) {
    return {
      state: nextState,
      shouldToggle: false,
      secondBlinkCountdown: 0,
      logEvent: 'armed',
    };
  }

  if (
    nextState.lastBlinkAt !== null &&
    now - nextState.lastBlinkAt > DOUBLE_BLINK_WINDOW_MS
  ) {
    nextState.lastBlinkAt = null;
    nextState.blinkCount = 0;
    logEvent = 'window-expired';
  }

  if (!landmarks) {
    nextState.eyeState = 'open';
    nextState.closedSince = null;
    return {
      state: nextState,
      shouldToggle: false,
      secondBlinkCountdown: 0,
      logEvent: 'face-lost',
    };
  }

  const ear = estimateEyeOpenness(landmarks);
  if (ear === null) {
    return {
      state: nextState,
      shouldToggle: false,
      secondBlinkCountdown: getSecondBlinkCountdown(nextState, now),
    };
  }

  const eyesClosed = ear < EAR_OPEN_THRESHOLD;

  if (eyesClosed) {
    if (nextState.eyeState === 'open') {
      nextState.eyeState = 'closed';
      nextState.closedSince = now;
    }
    return {
      state: nextState,
      shouldToggle: false,
      secondBlinkCountdown: getSecondBlinkCountdown(nextState, now),
    };
  }

  if (nextState.eyeState === 'closed' && nextState.closedSince !== null) {
    const closedFor = now - nextState.closedSince;
    if (closedFor >= MIN_BLINK_MS && closedFor <= MAX_BLINK_MS) {
      if (nextState.lastBlinkAt !== null) {
        const gapSinceFirstBlink = now - nextState.lastBlinkAt;
        if (
          gapSinceFirstBlink >= MIN_GAP_BETWEEN_BLINKS_MS &&
          gapSinceFirstBlink <= DOUBLE_BLINK_WINDOW_MS
        ) {
          nextState.blinkCount = 2;
          logEvent = 'second-blink';
          logDetail = `gap=${Math.round(gapSinceFirstBlink)}ms ear=${ear.toFixed(3)}`;
        } else if (gapSinceFirstBlink < MIN_GAP_BETWEEN_BLINKS_MS) {
          logEvent = 'too-soon';
          logDetail = `gap=${Math.round(gapSinceFirstBlink)}ms`;
        }
      } else {
        nextState.blinkCount = 1;
        nextState.lastBlinkAt = now;
        logEvent = 'first-blink';
        logDetail = `ear=${ear.toFixed(3)}`;
      }
    }
  }

  nextState.eyeState = 'open';
  nextState.closedSince = null;

  if (
    nextState.blinkCount === 2 &&
    now - nextState.lastToggleAt >= COOLDOWN_MS
  ) {
    nextState.lastToggleAt = now;
    nextState.lastBlinkAt = null;
    nextState.blinkCount = 0;
    nextState.armedAt = now + POST_TOGGLE_ARM_MS;
    return {
      state: nextState,
      shouldToggle: true,
      secondBlinkCountdown: 0,
      logEvent: 'toggle',
    };
  }

  if (nextState.blinkCount === 2 && now - nextState.lastToggleAt < COOLDOWN_MS) {
    logEvent = 'cooldown';
    nextState.blinkCount = 1;
  }

  return {
    state: nextState,
    shouldToggle: false,
    secondBlinkCountdown: getSecondBlinkCountdown(nextState, now),
    logEvent,
    logDetail,
  };
}
