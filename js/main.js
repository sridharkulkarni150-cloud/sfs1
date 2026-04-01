import {
  initBuildSystem,
  handleCanvasMouseDown,
  handleCanvasMouseMove,
  handleCanvasMouseUp,
  handleCanvasContextMenu
} from './buildSystem.js';
import { initPhysicsEngine, updatePhysics } from './physicsEngine.js';
import { render } from './renderer.js';
import { gameState, MODES, on, resetGameState, setMode } from './stateManager.js';

const canvas = document.getElementById('gameCanvas');
const modeIndicator = document.getElementById('mode-indicator');
const resetBtn = document.getElementById('reset-btn');
const launchBtn = document.getElementById('launch-btn');
const thrustBtn = document.getElementById('thrust-btn');
const returnBtn = document.getElementById('return-btn');
const sidebar = document.getElementById('left-sidebar');
const flightStats = document.getElementById('flight-stats');
const fuelDisplay = document.getElementById('fuel-display');
const altitudeDisplay = document.getElementById('altitude-display');
const velocityDisplay = document.getElementById('velocity-display');

function updateUiForMode() {
  const inBuild = gameState.mode === MODES.BUILD_MODE;
  modeIndicator.textContent = `Mode: ${inBuild ? 'BUILD' : 'FLIGHT'}`;
  sidebar.classList.toggle('hidden', !inBuild);
  launchBtn.classList.toggle('hidden', !inBuild);
  thrustBtn.classList.toggle('hidden', inBuild);
  returnBtn.classList.toggle('hidden', inBuild);
  flightStats.classList.toggle('hidden', inBuild);
  launchBtn.disabled = !gameState.launchReady;
}

function updateFlightStats() {
  const rocket = gameState.flight.rocket;
  if (!rocket) return;
  const fuel = Math.max(0, rocket.fuel).toFixed(0);
  const altitude = Math.max(0, ((gameState.flight.world.groundY - (rocket.y + rocket.height / 2)) / 10)).toFixed(1);
  const speed = Math.hypot(rocket.vx, rocket.vy).toFixed(1);

  fuelDisplay.textContent = `Fuel: ${fuel}`;
  altitudeDisplay.textContent = `Altitude: ${altitude} m`;
  velocityDisplay.textContent = `Velocity: ${speed} px/s`;
}

function registerInput() {
  const keyMap = {
    ArrowLeft: 'rotateLeft',
    KeyA: 'rotateLeft',
    ArrowRight: 'rotateRight',
    KeyD: 'rotateRight',
    Space: 'thrust'
  };

  window.addEventListener('keydown', (event) => {
    if (keyMap[event.code]) {
      event.preventDefault();
      gameState.keys[keyMap[event.code]] = true;
    }
    if (event.code === 'KeyR') {
      resetGameState();
    }
  });

  window.addEventListener('keyup', (event) => {
    if (keyMap[event.code]) {
      event.preventDefault();
      gameState.keys[keyMap[event.code]] = false;
    }
  });

  thrustBtn.addEventListener('mousedown', () => { gameState.keys.thrust = true; });
  thrustBtn.addEventListener('mouseup', () => { gameState.keys.thrust = false; });
  thrustBtn.addEventListener('mouseleave', () => { gameState.keys.thrust = false; });

  thrustBtn.addEventListener('touchstart', (event) => {
    event.preventDefault();
    gameState.keys.thrust = true;
  }, { passive: false });
  thrustBtn.addEventListener('touchend', () => { gameState.keys.thrust = false; });

  returnBtn.addEventListener('click', () => { setMode(MODES.BUILD_MODE); });
  resetBtn.addEventListener('click', () => { resetGameState(); });

  canvas.addEventListener('mousedown', handleCanvasMouseDown);
  canvas.addEventListener('mousemove', handleCanvasMouseMove);
  canvas.addEventListener('mouseup', handleCanvasMouseUp);
  canvas.addEventListener('contextmenu', handleCanvasContextMenu);
}

function wireStateEvents() {
  on('buildUpdated', () => {
    launchBtn.disabled = !gameState.launchReady;
  });

  on('modeChanged', updateUiForMode);
  on('gameReset', updateUiForMode);
  on('flightEvent', (event) => {
    if (event?.type === 'crash') {
      modeIndicator.textContent = 'Mode: FLIGHT (CRASHED)';
    }
  });
}

let lastTime = performance.now();
function gameLoop(time) {
  const dt = Math.min(0.05, (time - lastTime) / 1000);
  lastTime = time;

  updatePhysics(dt);
  updateFlightStats();
  render();

  requestAnimationFrame(gameLoop);
}

function start() {
  initBuildSystem();
  initPhysicsEngine();
  registerInput();
  wireStateEvents();
  updateUiForMode();
  requestAnimationFrame(gameLoop);
}

start();
