export const MODES = Object.freeze({ BUILD_MODE: 'BUILD_MODE', FLIGHT_MODE: 'FLIGHT_MODE' });

const listeners = new Map();
let nextPartId = 1;

const grid = Object.freeze({ cols: 20, rows: 12, cellSize: 40 });

const createDefaultState = () => ({
  mode: MODES.BUILD_MODE,
  grid,
  rocketParts: [],
  selectedPartType: null,
  selectedPartRotation: 0,
  dragPreview: null,
  launchReady: false,
  throttle: 0,
  throttleEnabled: false,
  keys: { rotateLeft: false, rotateRight: false },
  camera: { y: 0 },
  flight: {
    active: false,
    rocket: null,
    particles: [],
    debris: [],
    crashed: false,
    landed: false,
    crashTimer: 0,
    world: { gravity: 420, groundY: 620 }
  }
});

export const gameState = createDefaultState();

export function on(event, cb) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(cb);
  return () => listeners.get(event)?.delete(cb);
}

export function emit(event, payload) {
  listeners.get(event)?.forEach((cb) => {
    try { cb(payload); } catch (error) { console.warn('Listener error', error); }
  });
}

export function getNextPartId() { return nextPartId++; }

export function validateNumber(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

export function setMode(mode) {
  if (!Object.values(MODES).includes(mode)) return;
  if (mode === gameState.mode) return;
  gameState.mode = mode;
  emit('modeChanged', mode);
}

export function updateLaunchReady() {
  const hasCapsule = gameState.rocketParts.some((p) => p.type === 'capsule');
  const hasEngine = gameState.rocketParts.some((p) => p.type === 'engine');
  gameState.launchReady = hasCapsule && hasEngine;
  emit('buildUpdated', gameState.rocketParts);
}

export function resetGameState() {
  const fresh = createDefaultState();
  Object.keys(fresh).forEach((k) => { gameState[k] = fresh[k]; });
  nextPartId = 1;
  emit('gameReset');
  emit('modeChanged', gameState.mode);
  emit('buildUpdated', gameState.rocketParts);
}
