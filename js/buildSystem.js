import { gameState, getNextPartId, MODES, setMode, updateLaunchReady, emit } from './stateManager.js';

const PART_LIBRARY = [
  { type: 'nose', label: 'Nose Cone', mass: 80, fuel: 0, maxFuel: 0, thrust: 0, baseW: 1, baseH: 1, color: '#f6d66d' },
  { type: 'capsule', label: 'Command Capsule', mass: 120, fuel: 0, maxFuel: 0, thrust: 0, baseW: 1, baseH: 1, color: '#78c6ff' },
  { type: 'tank', label: 'Fuel Tank', mass: 60, fuel: 400, maxFuel: 400, thrust: 0, baseW: 1, baseH: 2, color: '#89d67d' },
  { type: 'engine', label: 'Engine', mass: 40, fuel: 0, maxFuel: 0, thrust: 1250, baseW: 1, baseH: 1, color: '#ff9e57' }
];

const canvas = document.getElementById('gameCanvas');
const rect = canvas.getBoundingClientRect();
const launchBtn = document.getElementById('launch-btn');
const paletteButtons = [...document.querySelectorAll('.part-item[data-type]')];

function getMouseGridPos(e) {
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const gridX = Math.floor(x / 40);
  const gridY = Math.floor(y / 40);
  return { gridX: Math.max(0, Math.min(19, gridX)), gridY: Math.max(0, Math.min(11, gridY)) };
}

function cellsForPart(p) {
  const cells = [];
  for (let dx = 0; dx < p.width; dx += 1) for (let dy = 0; dy < p.height; dy += 1) cells.push({ x: p.x + dx, y: p.y + dy });
  return cells;
}

function overlap(part) {
  return cellsForPart(part).some((c) => gameState.rocketParts.some((p) => c.x >= p.x && c.x < p.x + p.width && c.y >= p.y && c.y < p.y + p.height));
}

function inside(part) {
  return part.x >= 0 && part.y >= 0 && (part.x + part.width) <= 20 && (part.y + part.height) <= 12;
}

function adjacentPart(candidate) {
  const cset = cellsForPart(candidate);
  for (const part of gameState.rocketParts) {
    const pset = cellsForPart(part);
    for (const a of cset) {
      for (const b of pset) {
        const manhattan = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
        if (manhattan === 1) return part;
      }
    }
  }
  return null;
}

function structureConnected(parts) {
  if (!parts.length) return true;
  const roots = parts.filter((p) => (p.y + p.height) === 12);
  if (!roots.length) return false;
  const visited = new Set(roots.map((r) => r.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const part of parts) {
      if (visited.has(part.id)) continue;
      const connected = parts.some((other) => visited.has(other.id) && cellsForPart(part).some((a) => cellsForPart(other).some((b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1)));
      if (connected) { visited.add(part.id); changed = true; }
    }
  }
  return visited.size === parts.length;
}

function templateFor(type, x, y) {
  const base = PART_LIBRARY.find((p) => p.type === type);
  if (!base) return null;
  const rotated = gameState.selectedPartRotation % 180 !== 0;
  return {
    id: getNextPartId(),
    type: base.type,
    x,
    y,
    width: rotated ? base.baseH : base.baseW,
    height: rotated ? base.baseW : base.baseH,
    mass: base.mass,
    fuel: base.fuel,
    maxFuel: base.maxFuel,
    thrust: base.thrust,
    angle: gameState.selectedPartRotation,
    connectedTo: null,
    color: base.color
  };
}

function updatePreview(gridX, gridY) {
  if (!gameState.selectedPartType) {
    gameState.dragPreview = null;
    return;
  }
  const candidate = templateFor(gameState.selectedPartType, gridX, gridY);
  if (!candidate) return;
  const adjacent = adjacentPart(candidate);
  const trial = [...gameState.rocketParts, { ...candidate, connectedTo: adjacent?.id ?? null }];
  const valid = inside(candidate) && !overlap(candidate) && (gameState.rocketParts.length === 0 || adjacent) && structureConnected(trial);
  gameState.dragPreview = { type: candidate.type, gridX, gridY, width: candidate.width, height: candidate.height, angle: candidate.angle, valid };
}

function placePreview() {
  const preview = gameState.dragPreview;
  if (!preview || !preview.valid) return;
  const candidate = templateFor(preview.type, preview.gridX, preview.gridY);
  if (!candidate) return;
  const adjacent = adjacentPart(candidate);
  candidate.connectedTo = adjacent?.id ?? null;
  gameState.rocketParts.push(candidate);
  updateLaunchReady();
}

function removeAt(gridX, gridY) {
  const hit = gameState.rocketParts.find((p) => gridX >= p.x && gridX < p.x + p.width && gridY >= p.y && gridY < p.y + p.height);
  if (!hit) return;
  gameState.rocketParts = gameState.rocketParts.filter((p) => p.id !== hit.id);
  updateLaunchReady();
}

function setSelectedPartType(type) {
  gameState.selectedPartType = type;
  paletteButtons.forEach((b) => b.classList.toggle('selected', b.dataset.type === type));
}

export function rotateSelectedPart() {
  if (!gameState.selectedPartType || gameState.mode !== MODES.BUILD_MODE) return;
  gameState.selectedPartRotation = (gameState.selectedPartRotation + 90) % 180;
  if (gameState.dragPreview) updatePreview(gameState.dragPreview.gridX, gameState.dragPreview.gridY);
}

export function getPartLibrary() { return PART_LIBRARY; }

export function handleCanvasMouseDown(event) {
  if (gameState.mode !== MODES.BUILD_MODE || event.button !== 0) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
}
export function handleCanvasMouseMove(event) {
  if (gameState.mode !== MODES.BUILD_MODE) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
}
export function handleCanvasMouseUp(event) {
  if (gameState.mode !== MODES.BUILD_MODE || event.button !== 0) return;
  const { gridX, gridY } = getMouseGridPos(event);
  updatePreview(gridX, gridY);
  placePreview();
}
export function handleCanvasContextMenu(event) {
  if (gameState.mode !== MODES.BUILD_MODE) return;
  event.preventDefault();
  const { gridX, gridY } = getMouseGridPos(event);
  removeAt(gridX, gridY);
}
export function handleCanvasMouseLeave() { gameState.dragPreview = null; }

function launch() { if (gameState.launchReady) setMode(MODES.FLIGHT_MODE); }

export function initBuildSystem() {
  paletteButtons.forEach((b) => b.addEventListener('click', () => setSelectedPartType(b.dataset.type)));
  canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
  launchBtn.addEventListener('click', launch);
  emit('buildUpdated', gameState.rocketParts);
}
