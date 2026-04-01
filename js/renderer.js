import { gameState, MODES } from './stateManager.js';
import { getPartLibrary } from './buildSystem.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const colorsByType = getPartLibrary().reduce((acc, p) => {
  acc[p.type] = p.color;
  return acc;
}, {});

const partHeights = {
  nose: 60,
  capsule: 50,
  tank: 80,
  engine: 50
};

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 9301 + 49297) % 233280;
    return value / 233280;
  };
}

const rnd = seededRandom(42);
const stars = Array.from({ length: 150 }, () => ({
  x: rnd() * canvas.width,
  y: rnd() * canvas.height,
  r: 0.8 + rnd() * 1.8,
  a: 0.3 + rnd() * 0.7
}));

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#070d1c');
  gradient.addColorStop(1, '#02050c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  stars.forEach((s) => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  });
  ctx.globalAlpha = 1;
}

function drawGround(cameraY = 0) {
  const groundTop = 620 - cameraY;
  ctx.fillStyle = '#6f4a2d';
  ctx.fillRect(0, groundTop, canvas.width, 80);

  ctx.fillStyle = '#8b603e';
  ctx.fillRect(0, groundTop + 6, canvas.width, 8);

  ctx.fillStyle = '#808890';
  ctx.fillRect(450, groundTop - 10, 100, 10);
}

function drawGrid() {
  const { grid } = gameState;
  ctx.strokeStyle = 'rgba(189, 220, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= grid.cols; c += 1) {
    const x = c * grid.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, grid.rows * grid.cellSize);
    ctx.stroke();
  }
  for (let r = 0; r <= grid.rows; r += 1) {
    const y = r * grid.cellSize;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(grid.cols * grid.cellSize, y);
    ctx.stroke();
  }
}

function drawPartShape(type, x, y, width, height, alpha = 1, tankFuelRatio = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';

  if (type === 'nose') {
    ctx.fillStyle = colorsByType.nose;
    ctx.beginPath();
    ctx.moveTo(x + width / 2, y);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'capsule') {
    ctx.fillStyle = colorsByType.capsule;
    const radius = 10;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (type === 'tank') {
    ctx.fillStyle = colorsByType.tank;
    ctx.fillRect(x, y, width, height);
    ctx.strokeRect(x, y, width, height);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(x + 8, y + 8, width - 16, height - 16);
    ctx.fillStyle = '#6de26f';
    const fuelHeight = (height - 16) * Math.max(0, Math.min(1, tankFuelRatio));
    ctx.fillRect(x + 8, y + (height - 8 - fuelHeight), width - 16, fuelHeight);
  } else if (type === 'engine') {
    ctx.fillStyle = colorsByType.engine;
    ctx.fillRect(x, y, width, height - 10);
    ctx.strokeRect(x, y, width, height - 10);
    ctx.fillStyle = '#3b2c24';
    ctx.beginPath();
    ctx.moveTo(x + 8, y + height - 10);
    ctx.lineTo(x + width - 8, y + height - 10);
    ctx.lineTo(x + width - 14, y + height);
    ctx.lineTo(x + 14, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1020';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  const label = type === 'capsule' ? 'CAP' : type === 'tank' ? 'TANK' : type === 'engine' ? 'ENG' : 'NOSE';
  ctx.fillText(label, x + width / 2, y + height / 2 + 4);
  ctx.restore();
}

function buildPartPixelRect(part) {
  const x = part.x * 40;
  const width = 40;
  const height = partHeights[part.type] || 40;
  const y = part.y * 40 + (40 - height);
  return { x, y, width, height };
}

function drawBuildParts() {
  gameState.rocketParts.forEach((part) => {
    const rect = buildPartPixelRect(part);
    const fuelRatio = part.maxFuel > 0 ? part.fuel / part.maxFuel : 1;
    drawPartShape(part.type, rect.x, rect.y, rect.width, rect.height, 1, fuelRatio);
  });
}

function drawPreview() {
  if (!gameState.dragPreview) return;
  const part = { type: gameState.dragPreview.type, x: gameState.dragPreview.gridX, y: gameState.dragPreview.gridY };
  const rect = buildPartPixelRect(part);
  const tint = gameState.dragPreview.valid ? 'rgba(110, 255, 150, 0.25)' : 'rgba(255, 80, 80, 0.25)';
  drawPartShape(part.type, rect.x, rect.y, rect.width, rect.height, 0.6, 1);
  ctx.fillStyle = tint;
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
}

function drawFlightRocket() {
  const rocket = gameState.flight.rocket;
  if (!rocket || !rocket.alive) return;

  const cameraY = gameState.camera.y;
  ctx.save();
  ctx.translate(rocket.x, rocket.y - cameraY);
  ctx.rotate(rocket.angle);

  rocket.parts.forEach((part) => {
    const x = part.offsetX - 20;
    const y = part.offsetY;
    drawPartShape(part.type, x, y, 40, partHeights[part.type], 1, part.fuelRatio);
  });

  ctx.restore();
}

function drawParticles() {
  const cameraY = gameState.camera.y;
  gameState.flight.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - cameraY, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

export function render() {
  drawBackground();
  if (gameState.mode === MODES.BUILD_MODE) {
    drawGround(0);
    drawGrid();
    drawBuildParts();
    drawPreview();
  } else {
    drawGround(gameState.camera.y);
    drawFlightRocket();
    drawParticles();
  }
}
