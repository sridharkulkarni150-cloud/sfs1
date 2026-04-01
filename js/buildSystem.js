import { gameState, getNextPartId, MODES, setMode, updateLaunchReady, emit } from './stateManager.js';

const PART_LIBRARY = [
  { type: 'nose', label: 'Nose Cone', mass: 80, fuel: 0, maxFuel: 0, thrust: 0, color: '#f6d66d' },
  { type: 'capsule', label: 'Command Capsule', mass: 120, fuel: 0, maxFuel: 0, thrust: 0, color: '#78c6ff' },
  { type: 'tank', label: 'Fuel Tank', mass: 60, fuel: 400, maxFuel: 400, thrust: 0, color: '#89d67d' },
  { type: 'engine', label: 'Engine', mass: 40, fuel: 0, maxFuel: 0, thrust: 650, color: '#ff9e57' }
];

const canvas = document.getElementById('gameCanvas');
const rect = canvas.getBoundingClientRect();
const launchBtn = document.getElementById('launch-btn');
const paletteButtons = [...document.querySelectorAll('.part-item[data-type]')];

let selectedPartType = null;
let dragPreview = null;

function getPartTemplate(type) {
  const base = PART_LIBRARY.find((p) => p.type === type);
  if (!base) {
    console.warn('Unknown part requested:', type);
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

function updateSelectedButtonUi() {
  paletteButtons.forEach((btn) => {
    btn.classList.toggle('selected', btn.dataset.type === selectedPartType);
  });
}

function setSelectedPartType(type) {
  if (!PART_LIBRARY.some((p) => p.type === type)) return;
  selectedPartType = type;
  gameState.selectedPartType = type;
  updateSelectedButtonUi();
}

function getMouseGridPos(e) {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gridX = Math.floor(x / 40);
  const gridY = Math.floor(y / 40);
  return { gridX: Math.max(0, Math.min(19, gridX)), gridY: Math.max(0, Math.min(11, gridY)) };
}

function isInsideGrid(gridX, gridY) {
  return gridX >= 0 && gridX < gameState.grid.cols && gridY >= 0 && gridY < gameState.grid.rows;
}

function getPartAt(gridX, gridY) {
  return gameState.rocketParts.find((part) => gridX >= part.x && gridX < part.x + part.width && gridY >= part.y && gridY < part.y + part.height) || null;
}

function overlaps(gridX, gridY) {
  return gameState.rocketParts.some((part) => gridX >= part.x && gridX < part.x + part.width && gridY >= part.y && gridY < part.y + part.height);
}

function updatePreview(gridX, gridY) {
  if (!selectedPartType || !isInsideGrid(gridX, gridY)) {
    dragPreview = null;
    gameState.dragPreview = null;
    return;
  }
  dragPreview = { type: selectedPartType, gridX, gridY };
  gameState.dragPreview = dragPreview;
}

function placePreviewPart() {
  if (!dragPreview) return;
  const { gridX, gridY, type } = dragPreview;
  if (overlaps(gridX, gridY)) {
    dragPreview = null;
    gameState.dragPreview = null;
    return;
  }

  const part = getPartTemplate(type);
  if (!part) return;
  part.x = gridX;
  part.y = gridY;
  gameState.rocketParts.push(part);
  updateLaunchReady();

  dragPreview = { type: selectedPartType, gridX, gridY };
  gameState.dragPreview = dragPreview;
}

function removePartAt(gridX, gridY) {
  const found = getPartAt(gridX, gridY);
  if (!found) return;
  gameState.rocketParts = gameState.rocketParts.filter((part) => part.id !== found.id);
  if (gameState.selectedPartId === found.id) gameState.selectedPartId = null;
  updateLaunchReady();
}

export function getPartLibrary() {
  return PART_LIBRARY;
}

export function handleCanvasMouseDown(event) {
  if (gameState.mode !== MODES.BUILD_MODE || event.button !== 0) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
}

export function handleCanvasMouseMove(event) {
  if (gameState.mode !== MODES.BUILD_MODE || !selectedPartType) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
}

export function handleCanvasMouseUp(event) {
  if (gameState.mode !== MODES.BUILD_MODE || event.button !== 0 || !selectedPartType) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
  placePreviewPart();
}

export function handleCanvasContextMenu(event) {
  if (gameState.mode !== MODES.BUILD_MODE) return;
  event.preventDefault();
  const { gridX, gridY } = getMouseGridPos(event);
  removePartAt(gridX, gridY);
}

export function handleCanvasMouseLeave() {
  dragPreview = null;
  gameState.dragPreview = null;
}

function launch() {
  if (!gameState.launchReady) return;
  setMode(MODES.FLIGHT_MODE);
}

export function initBuildSystem() {
  paletteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setSelectedPartType(button.dataset.type);
    });
  });

  canvas.addEventListener('mouseleave', handleCanvasMouseLeave);

  launchBtn.addEventListener('click', launch);
  emit('buildUpdated', gameState.rocketParts);
}
