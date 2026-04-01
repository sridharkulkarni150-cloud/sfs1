import { gameState, getNextPartId, MODES, setMode, updateLaunchReady, emit } from './stateManager.js';

const PART_LIBRARY = [
  { type: 'nose', label: 'Nose Cone', mass: 80, fuel: 0, maxFuel: 0, thrust: 0, color: '#f6d66d' },
  { type: 'capsule', label: 'Command Capsule', mass: 120, fuel: 0, maxFuel: 0, thrust: 0, color: '#78c6ff' },
  { type: 'tank', label: 'Fuel Tank', mass: 60, fuel: 400, maxFuel: 400, thrust: 0, color: '#89d67d' },
  { type: 'engine', label: 'Engine', mass: 40, fuel: 0, maxFuel: 0, thrust: 650, color: '#ff9e57' }
];

const partPalette = document.getElementById('part-palette');
const canvas = document.getElementById('game-canvas');
const launchBtn = document.getElementById('launch-btn');

let dragging = null;

function createPartTemplate(type) {
  const base = PART_LIBRARY.find((p) => p.type === type);
  if (!base) {
    console.warn('Unknown part template requested:', type);
    return null;
  }
  return {
    id: getNextPartId(),
    type: base.type,
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    mass: base.mass,
    fuel: base.fuel,
    maxFuel: base.maxFuel,
    thrust: base.thrust,
    angle: 0,
    label: base.label,
    color: base.color
  };
}

function occupiesCell(targetX, targetY, ignorePartId = null) {
  return gameState.rocketParts.some((part) => {
    if (ignorePartId !== null && part.id === ignorePartId) return false;
    return targetX >= part.x && targetX < part.x + part.width && targetY >= part.y && targetY < part.y + part.height;
  });
}

function getGridCellFromMouse(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const { buildOrigin, grid } = gameState;

  const col = Math.floor((x - buildOrigin.x) / grid.cellSize);
  const row = Math.floor((y - buildOrigin.y) / grid.cellSize);
  return { col, row };
}

function isInsideGrid(col, row) {
  const { cols, rows } = gameState.grid;
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

function getPlacedPartAt(col, row) {
  return gameState.rocketParts.find((part) => col >= part.x && col < part.x + part.width && row >= part.y && row < part.y + part.height) || null;
}

function addPaletteItem(part) {
  const item = document.createElement('div');
  item.className = 'part-item';
  item.dataset.type = part.type;
  item.textContent = part.label;
  item.style.background = part.color;
  item.addEventListener('mousedown', (event) => {
    if (event.button !== 0 || gameState.mode !== MODES.BUILD_MODE) return;
    dragging = { type: part.type };
    gameState.draggingFromPalette = part.type;
  });
  partPalette.appendChild(item);
}

function placePartAt(col, row, type) {
  if (!isInsideGrid(col, row) || occupiesCell(col, row)) return false;
  const nextPart = createPartTemplate(type);
  if (!nextPart) return false;
  nextPart.x = col;
  nextPart.y = row;
  gameState.rocketParts.push(nextPart);
  updateLaunchReady();
  return true;
}

function removePartAt(col, row) {
  const part = getPlacedPartAt(col, row);
  if (!part) return;
  gameState.rocketParts = gameState.rocketParts.filter((p) => p.id !== part.id);
  if (gameState.selectedPartId === part.id) gameState.selectedPartId = null;
  updateLaunchReady();
}

function selectPart(col, row) {
  const part = getPlacedPartAt(col, row);
  gameState.selectedPartId = part ? part.id : null;
  emit('buildUpdated', gameState.rocketParts);
}

function launch() {
  if (!gameState.launchReady) return;
  setMode(MODES.FLIGHT_MODE);
}

export function getPartLibrary() {
  return PART_LIBRARY;
}

export function initBuildSystem() {
  PART_LIBRARY.forEach(addPaletteItem);

  canvas.addEventListener('contextmenu', (event) => {
    if (gameState.mode !== MODES.BUILD_MODE) return;
    event.preventDefault();
    const { col, row } = getGridCellFromMouse(event);
    if (!isInsideGrid(col, row)) return;
    removePartAt(col, row);
  });

  canvas.addEventListener('mousedown', (event) => {
    if (gameState.mode !== MODES.BUILD_MODE || event.button !== 0) return;
    const { col, row } = getGridCellFromMouse(event);
    if (!isInsideGrid(col, row)) return;
    if (dragging?.type) {
      placePartAt(col, row, dragging.type);
    } else {
      selectPart(col, row);
    }
  });

  window.addEventListener('mouseup', () => {
    dragging = null;
    gameState.draggingFromPalette = null;
  });

  launchBtn.addEventListener('click', launch);
}
