export const MODES = Object.freeze({
  BUILD_MODE: 'BUILD_MODE',
  FLIGHT_MODE: 'FLIGHT_MODE'
});

const listeners = new Map();
let nextPartId = 1;

const buildOrigin = Object.freeze({ x: 0, y: 0 });
const grid = Object.freeze({ cols: 20, rows: 12, cellSize: 40 });

const createDefaultState = () => ({
  mode: MODES.BUILD_MODE,
  grid,
  buildOrigin,
  rocketParts: [],
  selectedPartId: null,
  selectedPartType: null,
  dragPreview: null,
  launchReady: false,
  keys: {
    thrust: false,
    rotateLeft: false,
    rotateRight: false
  },
  camera: { x: 0, y: 0 },
  flight: {
    active: false,
    rocket: null,
    thrusting: false,
    particles: [],
    crashed: false,
    landed: false,
    crashTimer: 0,
    world: {
      gravity: 300,
      groundY: 650,
      drag: 0.995,
      restitution: 0.3
    }
  }
});

export const gameState = createDefaultState();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

export function emit(event, payload) {
  if (!listeners.has(event)) return;
  listeners.get(event).forEach((cb) => {
    try {
      cb(payload);
    } catch (error) {
      console.warn(`Listener error for event ${event}:`, error);
    }
  });
}

export function getNextPartId() {
  return nextPartId++;
}

export function validateNumber(value, fallback = 0, label = 'number') {
  if (!Number.isFinite(value)) {
    console.warn(`Invalid ${label}; applying fallback ${fallback}.`);
    return fallback;
  }
  return value;
}

export function setMode(mode) {
  if (!Object.values(MODES).includes(mode)) {
    console.warn('Attempted to set invalid mode:', mode);
    return;
  }
  if (gameState.mode === mode) return;
  gameState.mode = mode;
  emit('modeChanged', mode);
}

export function updateLaunchReady() {
  const hasCapsule = gameState.rocketParts.some((part) => part.type === 'capsule');
  const hasEngine = gameState.rocketParts.some((part) => part.type === 'engine');
  gameState.launchReady = hasCapsule && hasEngine;
  emit('buildUpdated', gameState.rocketParts);
}

export function resetGameState() {
  const fresh = createDefaultState();
  Object.keys(gameState).forEach((key) => {
    gameState[key] = fresh[key];
  });
  nextPartId = 1;
  emit('gameReset', null);
  emit('modeChanged', gameState.mode);
  emit('buildUpdated', gameState.rocketParts);
}
