import {
  initBuildSystem,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleCanvasContextMenu,
  rotateSelectedPart
} from './buildSystem.js';
import { initPhysicsEngine, updatePhysics } from './physicsEngine.js';
import { render } from './renderer.js';
import { gameState, MODES, on, resetGameState, setMode, emit } from './stateManager.js';

const canvas = document.getElementById('gameCanvas');
const modeIndicator = document.getElementById('mode-indicator');
const resetBtn = document.getElementById('reset-btn');
const launchBtn = document.getElementById('launch-btn');
const thrustBtn = document.getElementById('thrust-btn');
const returnBtn = document.getElementById('return-btn');
const sidebar = document.getElementById('left-sidebar');
const throttleWrap = document.getElementById('throttle-wrap');
const throttleSlider = document.getElementById('throttle-slider');
const throttleValue = document.getElementById('throttle-value');
const fuelDisplay = document.getElementById('fuel-display');
const altitudeDisplay = document.getElementById('altitude-display');
const velocityDisplay = document.getElementById('velocity-display');

function updateUiForMode() {
  const build = gameState.mode === MODES.BUILD_MODE;
  modeIndicator.textContent = `Mode: ${build ? 'BUILD' : 'FLIGHT'}`;
  sidebar.classList.toggle('hidden', !build);
  launchBtn.classList.toggle('hidden', !build);
  throttleWrap.classList.toggle('hidden', build);
  thrustBtn.classList.toggle('hidden', build);
  returnBtn.classList.toggle('hidden', build);
  launchBtn.disabled = !gameState.launchReady;
}

function updateStats() {
  const r = gameState.flight.rocket;
  if (!r) {
    fuelDisplay.textContent = `Fuel: ${gameState.rocketParts.reduce((s, p) => s + (p.type === 'tank' ? p.fuel : 0), 0).toFixed(0)}`;
    altitudeDisplay.textContent = 'Altitude: 0.0 m';
    velocityDisplay.textContent = 'Velocity: 0.0 px/s';
    return;
  }
  const highestY = r.y - r.height / 2;
  fuelDisplay.textContent = `Fuel: ${r.parts.reduce((s, p) => s + (p.type === 'tank' ? p.fuel : 0), 0).toFixed(0)}`;
  altitudeDisplay.textContent = `Altitude: ${Math.max(0, (620 - highestY) * 0.3).toFixed(1)} m`;
  velocityDisplay.textContent = `Velocity: ${(-r.vy).toFixed(1)} px/s`;
}

function setThrottle(v) {
  gameState.throttle = Math.max(0, Math.min(100, v));
  throttleSlider.value = String(gameState.throttle);
  throttleValue.textContent = `${Math.round(gameState.throttle)}%`;
}

function registerInput() {
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') gameState.keys.rotateLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') gameState.keys.rotateRight = true;
    if (e.code === 'Space') { e.preventDefault(); gameState.throttleEnabled = !gameState.throttleEnabled; }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') setThrottle(gameState.throttle + 5);
    if (e.code === 'ControlLeft' || e.code === 'ControlRight') setThrottle(gameState.throttle - 5);
    if (e.code === 'KeyS' && gameState.mode === MODES.FLIGHT_MODE) emit('stage');
    if (e.code === 'KeyR' && gameState.mode === MODES.BUILD_MODE) rotateSelectedPart();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') gameState.keys.rotateLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') gameState.keys.rotateRight = false;
  });

  throttleSlider.addEventListener('input', () => setThrottle(Number(throttleSlider.value)));
  thrustBtn.addEventListener('click', () => { gameState.throttleEnabled = !gameState.throttleEnabled; });
  returnBtn.addEventListener('click', () => setMode(MODES.BUILD_MODE));
  resetBtn.addEventListener('click', () => resetGameState());

  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('contextmenu', handleCanvasContextMenu);
}

function wire() {
  on('buildUpdated', () => { launchBtn.disabled = !gameState.launchReady; });
  on('modeChanged', updateUiForMode);
  on('gameReset', () => { setThrottle(0); updateUiForMode(); });
}

let last = performance.now();
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  updatePhysics(dt);
  updateStats();
  render();
  requestAnimationFrame(loop);
}

function start() {
  initBuildSystem();
  initPhysicsEngine();
  registerInput();
  wire();
  updateUiForMode();
  setThrottle(0);
  requestAnimationFrame(loop);
}
start();
