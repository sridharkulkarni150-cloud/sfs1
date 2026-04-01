import { gameState, MODES } from './stateManager.js';
import { getPartLibrary } from './buildSystem.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const colors = Object.fromEntries(getPartLibrary().map((p) => [p.type, p.color]));
const partHeightPx = { nose: 60, capsule: 50, tank: 80, engine: 50 };

function seededRandom(seed) { let v = seed; return () => ((v = (v * 1103515245 + 12345) % 2147483648) / 2147483648); }
const rand = seededRandom(9);
const stars = Array.from({ length: 150 }, () => ({ x: rand() * 1000, y: rand() * 700, r: 1 + rand() * 1.4 }));

function drawBackground(cameraY = 0) {
  ctx.fillStyle = '#040915';
  ctx.fillRect(0, 0, 1000, 700);
  stars.forEach((s) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(s.x, (s.y + cameraY * 0.15) % 700, s.r, s.r);
  });
}

function drawGround(cameraY = 0) {
  const top = 620 - cameraY;
  ctx.fillStyle = '#6e4b2d';
  ctx.fillRect(0, top, 1000, 80);
  ctx.fillStyle = '#88919b';
  ctx.fillRect(460, top - 10, 80, 10);
}

function drawPartShape(type, x, y, w, h, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = colors[type] || '#ddd';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;

  if (type === 'nose') {
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (type === 'capsule') {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill(); ctx.stroke();
  } else if (type === 'tank') {
    ctx.fillRect(x, y, w, h); ctx.strokeRect(x, y, w, h);
  } else {
    ctx.fillRect(x, y, w, h - 10); ctx.strokeRect(x, y, w, h - 10);
    ctx.beginPath(); ctx.moveTo(x + 8, y + h - 10); ctx.lineTo(x + w - 8, y + h - 10); ctx.lineTo(x + w - 12, y + h); ctx.lineTo(x + 12, y + h); ctx.closePath(); ctx.fill(); ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0f1224';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  const lbl = type === 'capsule' ? 'CAP' : type === 'tank' ? 'TANK' : type === 'engine' ? 'ENG' : 'NOSE';
  ctx.fillText(lbl, x + w / 2, y + h / 2 + 4);
  ctx.restore();
}

function drawBuild() {
  ctx.strokeStyle = 'rgba(180,220,255,0.16)';
  for (let x = 0; x <= 20; x += 1) { ctx.beginPath(); ctx.moveTo(x * 40, 0); ctx.lineTo(x * 40, 480); ctx.stroke(); }
  for (let y = 0; y <= 12; y += 1) { ctx.beginPath(); ctx.moveTo(0, y * 40); ctx.lineTo(800, y * 40); ctx.stroke(); }

  gameState.rocketParts.forEach((p) => {
    const h = partHeightPx[p.type] || 40;
    drawPartShape(p.type, p.x * 40, p.y * 40 + (40 - h), p.width * 40, h);
  });

  const pv = gameState.dragPreview;
  if (pv) {
    const h = partHeightPx[pv.type] || 40;
    drawPartShape(pv.type, pv.gridX * 40, pv.gridY * 40 + (40 - h), pv.width * 40, h, 0.55);
    ctx.fillStyle = pv.valid ? 'rgba(80,255,120,0.25)' : 'rgba(255,90,90,0.25)';
    ctx.fillRect(pv.gridX * 40, pv.gridY * 40, pv.width * 40, pv.height * 40);
  }
}

function drawFlight() {
  const r = gameState.flight.rocket;
  if (r && r.alive) {
    ctx.save();
    ctx.translate(r.x, r.y - gameState.camera.y);
    ctx.rotate(r.angle);
    r.parts.forEach((p) => drawPartShape(p.type, p.px, p.py, p.w, p.h));
    ctx.restore();
  }

  gameState.flight.particles.forEach((p) => {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y - gameState.camera.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  gameState.flight.debris.forEach((d) => {
    ctx.fillStyle = d.color || '#ccc';
    ctx.fillRect(d.x, d.y - gameState.camera.y, d.w, d.h);
  });
}

export function render() {
  const cy = gameState.mode === MODES.FLIGHT_MODE ? gameState.camera.y : 0;
  drawBackground(cy);
  drawGround(cy);
  if (gameState.mode === MODES.BUILD_MODE) drawBuild();
  else drawFlight();
}
