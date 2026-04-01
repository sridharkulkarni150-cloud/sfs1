import { gameState, MODES, on, setMode, validateNumber, emit } from './stateManager.js';

const CELL = 40;
const partPixel = { nose: 60, capsule: 50, tank: 80, engine: 50 };

function clampDt(dt) { return Math.min(0.05, Math.max(1 / 240, Number.isFinite(dt) ? dt : 1 / 60)); }

function toLocal(part, originY) {
  const h = partPixel[part.type] || 40;
  return { ...part, px: part.x * CELL, py: part.y * CELL + (CELL - h) - originY, w: part.width * CELL, h };
}

function aggregateRocket() {
  if (!gameState.rocketParts.length) return null;
  const top = Math.min(...gameState.rocketParts.map((p) => p.y * CELL + (CELL - (partPixel[p.type] || 40))));
  const parts = gameState.rocketParts.map((p) => toLocal(p, top));
  const h = Math.max(...parts.map((p) => p.py + p.h));
  return { x: 500, y: 620 - h / 2, vx: 0, vy: 0, angle: 0, angularVelocity: 0, parts, height: h, alive: true };
}

function computeMassAndCom(rocket) {
  let mass = 0; let mx = 0; let my = 0;
  rocket.parts.forEach((p) => {
    const m = p.mass + (p.type === 'tank' ? p.fuel : 0);
    const cx = p.px + p.w / 2;
    const cy = p.py + p.h / 2;
    mass += m;
    mx += cx * m;
    my += cy * m;
  });
  if (mass <= 0) return { mass: 1, comX: 0, comY: 0 };
  return { mass, comX: mx / mass, comY: my / mass };
}

function nearestTankAbove(engine, parts) {
  const tanks = parts.filter((p) => p.type === 'tank' && p.fuel > 0 && (p.connectedTo === engine.connectedTo || p.id === engine.connectedTo || true));
  let best = null;
  let bestDist = Infinity;
  tanks.forEach((t) => {
    if (t.py > engine.py) return;
    const d = Math.abs((t.px + t.w / 2) - (engine.px + engine.w / 2)) + Math.abs((t.py + t.h) - engine.py);
    if (d < bestDist) { bestDist = d; best = t; }
  });
  return best;
}

function spawnEngineFlame(rocket, engineWorldX, engineWorldY) {
  for (let i = 0; i < 12; i += 1) {
    gameState.flight.particles.push({
      x: engineWorldX + (Math.random() - 0.5) * 10,
      y: engineWorldY,
      vx: (Math.random() - 0.5) * 80,
      vy: 140 + Math.random() * 220,
      life: 0.35 + Math.random() * 0.35,
      size: 2 + Math.random() * 4,
      color: Math.random() > 0.65 ? '#ffffff' : Math.random() > 0.35 ? '#ffd166' : '#ff8f3f'
    });
  }
}

function spawnCrashDebris(rocket) {
  rocket.parts.forEach((p) => {
    gameState.flight.debris.push({
      x: rocket.x + p.px,
      y: rocket.y + p.py,
      vx: (Math.random() - 0.5) * 220,
      vy: -120 - Math.random() * 180,
      w: p.w,
      h: p.h,
      color: p.color,
      life: 2
    });
  });
}

function stageSeparation() {
  const rocket = gameState.flight.rocket;
  if (!rocket || rocket.parts.length < 2) return;
  const maxY = Math.max(...rocket.parts.map((p) => p.y));
  const dropped = rocket.parts.filter((p) => p.y === maxY);
  rocket.parts = rocket.parts.filter((p) => p.y !== maxY);
  dropped.forEach((p) => {
    gameState.flight.debris.push({ x: rocket.x + p.px, y: rocket.y + p.py, vx: (Math.random() - 0.5) * 80, vy: 40, w: p.w, h: p.h, color: p.color, life: 3 });
  });
}

function updateParticles(dt) {
  gameState.flight.particles = gameState.flight.particles.map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + 180 * dt, life: p.life - dt })).filter((p) => p.life > 0);
  gameState.flight.debris = gameState.flight.debris.map((d) => ({ ...d, x: d.x + d.vx * dt, y: d.y + d.vy * dt, vy: d.vy + 420 * dt, life: d.life - dt })).filter((d) => d.life > 0);
}

export function updatePhysics(rawDt) {
  if (gameState.mode !== MODES.FLIGHT_MODE || !gameState.flight.rocket) return;
  const dt = clampDt(rawDt);
  const r = gameState.flight.rocket;

  if (!r.alive) {
    updateParticles(dt);
    gameState.flight.crashTimer -= dt;
    if (gameState.flight.crashTimer <= 0) setMode(MODES.BUILD_MODE);
    return;
  }

  r.x = validateNumber(r.x, 500); r.y = validateNumber(r.y, 300);
  r.vx = validateNumber(r.vx, 0); r.vy = validateNumber(r.vy, 0);
  r.angle = validateNumber(r.angle, 0); r.angularVelocity = validateNumber(r.angularVelocity, 0);

  const { mass, comX, comY } = computeMassAndCom(r);
  const throttle = gameState.throttleEnabled ? gameState.throttle / 100 : 0;

  let forceX = 0;
  let forceY = mass * 420;
  let torque = 0;

  r.parts.forEach((part) => {
    if (part.type !== 'engine' || throttle <= 0) return;
    const tank = nearestTankAbove(part, r.parts);
    if (!tank) return;
    const fuelNeed = 180 * throttle * dt;
    if (tank.fuel <= 0) return;
    const used = Math.min(tank.fuel, fuelNeed);
    tank.fuel -= used;

    const thrust = part.thrust * throttle;
    const fx = -Math.sin(r.angle) * thrust;
    const fy = -Math.cos(r.angle) * thrust;
    forceX += fx;
    forceY += fy;

    const ex = part.px + part.w / 2;
    const ey = part.py + part.h;
    const rx = ex - comX;
    const ry = ey - comY;
    torque += rx * fy - ry * fx;

    spawnEngineFlame(r, r.x + ex, r.y + ey);
  });

  const speed = Math.hypot(r.vx, r.vy);
  const drag = 0.08 * speed;
  forceX += -r.vx * drag;
  forceY += -r.vy * drag;

  const rotateInput = Number(gameState.keys.rotateRight) - Number(gameState.keys.rotateLeft);
  r.angularVelocity += rotateInput * 2.5 * dt;

  const inertia = Math.max(mass * (r.height * r.height) / 12, 1);
  r.angularVelocity += (torque / inertia) * dt;
  r.angularVelocity *= 0.992;
  r.angle += r.angularVelocity * dt;

  r.vx += (forceX / mass) * dt;
  r.vy += (forceY / mass) * dt;
  r.vx *= 0.992;
  r.vy *= 0.992;
  r.x += r.vx * dt;
  r.y += r.vy * dt;

  const bottomY = r.y + r.height / 2;
  if (bottomY >= 620) {
    r.y = 620 - r.height / 2;
    if (r.vy > 80) {
      r.alive = false;
      gameState.flight.crashed = true;
      gameState.flight.crashTimer = 1.5;
      spawnCrashDebris(r);
      emit('flightEvent', { type: 'crash' });
    } else {
      if (Math.abs(r.vy) < 40) gameState.flight.landed = true;
      r.vy = -r.vy * 0.25;
      if (Math.abs(r.vy) < 4) r.vy = 0;
    }
  }

  updateParticles(dt);
  gameState.camera.y += ((r.y - 350) - gameState.camera.y) * Math.min(1, dt * 3);
}

export function initPhysicsEngine() {
  on('modeChanged', (mode) => {
    if (mode === MODES.FLIGHT_MODE) {
      gameState.flight.rocket = aggregateRocket();
      gameState.flight.active = true;
      gameState.flight.crashed = false;
      gameState.flight.landed = false;
      gameState.flight.particles = [];
      gameState.flight.debris = [];
      gameState.throttle = 0;
      gameState.throttleEnabled = false;
    }
    if (mode === MODES.BUILD_MODE) {
      gameState.flight.rocket = null;
      gameState.flight.active = false;
      gameState.flight.particles = [];
      gameState.flight.debris = [];
      gameState.dragPreview = null;
    }
  });

  on('stage', () => stageSeparation());
}
