import { gameState, MODES } from './stateManager.js';
import { getPartLibrary } from './buildSystem.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const colorsByType = getPartLibrary().reduce((acc, p) => {
  acc[p.type] = p.color;
  return acc;
}, {});

const labelByType = {
  nose: 'NOSE',
  capsule: 'CAP',
  tank: 'TANK',
  engine: 'ENG'
};

const stars = Array.from({ length: 180 }, () => ({
  x: Math.random() * canvas.width,
  y: Math.random() * canvas.height,
  r: Math.random() * 1.6 + 0.2,
  a: 0.3 + Math.random() * 0.7
}));

function drawBackground() {
  ctx.fillStyle = '#04070f';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  stars.forEach((s) => {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#d9ecff';
    ctx.fillRect(s.x, s.y, s.r, s.r);
  });
  ctx.globalAlpha = 1;
}

function drawGround(cameraY = 0) {
  const y = gameState.flight.world.groundY - cameraY;
  ctx.fillStyle = '#593826';
  ctx.fillRect(0, y, canvas.width, canvas.height - y);
  ctx.fillStyle = '#754b2f';
  ctx.fillRect(canvas.width / 2 - 70, y - 10, 140, 10);
}

function drawGrid() {
  const { buildOrigin, grid } = gameState;
  ctx.strokeStyle = 'rgba(189, 220, 255, 0.15)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= grid.cols; c += 1) {
    const x = buildOrigin.x + c * grid.cellSize;
    ctx.beginPath();
    ctx.moveTo(x, buildOrigin.y);
    ctx.lineTo(x, buildOrigin.y + grid.rows * grid.cellSize);
    ctx.stroke();
  }
  for (let r = 0; r <= grid.rows; r += 1) {
    const y = buildOrigin.y + r * grid.cellSize;
    ctx.beginPath();
    ctx.moveTo(buildOrigin.x, y);
    ctx.lineTo(buildOrigin.x + grid.cols * grid.cellSize, y);
    ctx.stroke();
  }
}

function drawPartRect(type, gridX, gridY, alpha = 1) {
  const { buildOrigin, grid } = gameState;
  const px = buildOrigin.x + gridX * grid.cellSize;
  const py = buildOrigin.y + gridY * grid.cellSize;
  const pw = grid.cellSize;
  const ph = grid.cellSize;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colorsByType[type] || '#bbbbbb';
  ctx.fillRect(px + 2, py + 2, pw - 4, ph - 4);
  ctx.strokeStyle = '#203246';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, pw - 4, ph - 4);
  ctx.fillStyle = '#0b1020';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(labelByType[type] || type.toUpperCase(), px + pw / 2, py + ph / 2 + 4);
  ctx.restore();
}

function drawBuildParts() {
  gameState.rocketParts.forEach((part) => {
    drawPartRect(part.type, part.x, part.y, 1);

    if (gameState.selectedPartId === part.id && part.type === 'engine') {
      const px = part.x * gameState.grid.cellSize;
      const py = part.y * gameState.grid.cellSize;
      const pw = gameState.grid.cellSize;
      const ph = gameState.grid.cellSize;
      ctx.fillStyle = '#ff944d';
      ctx.beginPath();
      ctx.moveTo(px + pw / 2, py + ph + 10);
      ctx.lineTo(px + pw / 2 - 7, py + ph - 2);
      ctx.lineTo(px + pw / 2 + 7, py + ph - 2);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function drawPreview() {
  if (!gameState.dragPreview) return;
  drawPartRect(gameState.dragPreview.type, gameState.dragPreview.gridX, gameState.dragPreview.gridY, 0.6);
}

function drawFlightRocket() {
  const rocket = gameState.flight.rocket;
  if (!rocket || !rocket.alive) return;

  const cameraY = gameState.camera.y;

  ctx.save();
  ctx.translate(rocket.x, rocket.y - cameraY);
  ctx.rotate(rocket.angle);

  const ordered = [...gameState.rocketParts].sort((a, b) => a.y - b.y);
  const cellSize = gameState.grid.cellSize;
  const minGridX = Math.min(...ordered.map((p) => p.x));
  const minGridY = Math.min(...ordered.map((p) => p.y));

  ordered.forEach((part) => {
    const localX = ((part.x - minGridX) * cellSize) - rocket.width / 2;
    const localY = ((part.y - minGridY) * cellSize) - rocket.height / 2;
    const w = part.width * cellSize;
    const h = part.height * cellSize;

    ctx.fillStyle = colorsByType[part.type] || '#bbb';
    ctx.fillRect(localX + 2, localY + 2, w - 4, h - 4);
    ctx.strokeStyle = '#102033';
    ctx.lineWidth = 2;
    ctx.strokeRect(localX + 2, localY + 2, w - 4, h - 4);

    ctx.fillStyle = '#0b1020';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(labelByType[part.type] || 'PART', localX + w / 2, localY + h / 2 + 3);
  });

  ctx.restore();
}

function drawParticles() {
  const cameraY = gameState.camera.y;
  gameState.flight.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life));
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - cameraY, 2 + (1 - p.life) * 2, 0, Math.PI * 2);
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
