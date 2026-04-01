import { gameState, MODES, on, setMode, validateNumber, emit } from './stateManager.js';

const GRAVITY = 420;
const DRAG = 0.992;
const GROUND_Y = 620;
const FUEL_BURN = 180;

const partHeights = { nose: 60, capsule: 50, tank: 80, engine: 50 };

function clampDt(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return 1 / 60;
  return Math.min(dt, 0.05);
}

function buildFlightStack(parts) {
  const sorted = [...parts].sort((a, b) => a.y - b.y);
  let cursorY = 0;
  const stack = sorted.map((part) => {
    const h = partHeights[part.type] || 40;
    const entry = {
      type: part.type,
      mass: part.mass,
      fuel: part.fuel,
      maxFuel: part.maxFuel,
      thrust: part.thrust,
      offsetX: 0,
      offsetY: cursorY,
      height: h,
      fuelRatio: part.maxFuel > 0 ? part.fuel / part.maxFuel : 1
    };
    cursorY += h;
    return entry;
  });
  return { stack, height: cursorY };
}

function computeCenterOfMass(parts) {
  let weighted = 0;
  let massSum = 0;
  parts.forEach((part) => {
    const partMass = part.mass + part.fuel;
    const centerY = part.offsetY + part.height * 0.5;
    weighted += centerY * partMass;
    massSum += partMass;
  });
  return massSum > 0 ? weighted / massSum : 0;
}

function aggregateRocketForFlight() {
  const parts = gameState.rocketParts;
  if (!parts.length) {
    console.warn('Cannot launch: no parts present.');
    return null;
  }

  const { stack, height } = buildFlightStack(parts);
  const dryMass = stack.reduce((sum, p) => sum + p.mass, 0);
  const totalFuel = stack.reduce((sum, p) => sum + p.fuel, 0);
  const totalThrust = stack.reduce((sum, p) => sum + p.thrust, 0);
  const centerOfMass = computeCenterOfMass(stack);

  return {
    x: 500,
    y: GROUND_Y - height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    width: 40,
    height,
    dryMass,
    fuel: totalFuel,
    thrust: totalThrust,
    engineCount: stack.filter((p) => p.type === 'engine').length,
    parts: stack,
    centerOfMass,
    alive: true
  };
}

function launchSetup() {
  const rocket = aggregateRocketForFlight();
  if (!rocket) {
    setMode(MODES.BUILD_MODE);
    return;
  }

  gameState.flight.world.gravity = GRAVITY;
  gameState.flight.world.drag = DRAG;
  gameState.flight.world.groundY = GROUND_Y;
  gameState.flight.world.restitution = 0.25;

  gameState.flight.active = true;
  gameState.flight.rocket = rocket;
  gameState.flight.particles = [];
  gameState.flight.thrusting = false;
  gameState.flight.crashed = false;
  gameState.flight.landed = false;
  gameState.flight.crashTimer = 0;
  gameState.camera.y = 0;
}

function sanitizeRocket(rocket) {
  rocket.x = validateNumber(rocket.x, 500, 'rocket.x');
  rocket.y = validateNumber(rocket.y, 300, 'rocket.y');
  rocket.vx = validateNumber(rocket.vx, 0, 'rocket.vx');
  rocket.vy = validateNumber(rocket.vy, 0, 'rocket.vy');
  rocket.angle = validateNumber(rocket.angle, 0, 'rocket.angle');
  rocket.angularVelocity = validateNumber(rocket.angularVelocity, 0, 'rocket.angularVelocity');
  rocket.fuel = Math.max(0, validateNumber(rocket.fuel, 0, 'rocket.fuel'));
}

function applyFuelBurn(rocket, amount) {
  let remaining = amount;
  rocket.parts.forEach((part) => {
    if (part.type !== 'tank' || remaining <= 0 || part.fuel <= 0) return;
    const used = Math.min(part.fuel, remaining);
    part.fuel -= used;
    part.fuelRatio = part.maxFuel > 0 ? part.fuel / part.maxFuel : 1;
    remaining -= used;
  });
  rocket.fuel = Math.max(0, rocket.parts.reduce((sum, p) => sum + (p.type === 'tank' ? p.fuel : 0), 0));
}

function spawnFlame(rocket) {
  for (let i = 0; i < 12; i += 1) {
    const baseY = rocket.y + rocket.height / 2;
    gameState.flight.particles.push({
      x: rocket.x + (Math.random() - 0.5) * 18,
      y: baseY + 2,
      vx: (Math.random() - 0.5) * 80,
      vy: 140 + Math.random() * 210,
      life: 0.35 + Math.random() * 0.25,
      size: 2 + Math.random() * 4,
      color: Math.random() > 0.66 ? '#ffffff' : Math.random() > 0.4 ? '#ffd166' : '#ff8f3f'
    });
  }
}

function spawnCrash(rocket) {
  for (let i = 0; i < 70; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const s = 60 + Math.random() * 260;
    gameState.flight.particles.push({
      x: rocket.x,
      y: rocket.y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.6 + Math.random() * 0.8,
      size: 2 + Math.random() * 4,
      color: Math.random() > 0.5 ? '#ff3b30' : '#ff7a45'
    });
  }
}

function updateParticles(dt) {
  gameState.flight.particles = gameState.flight.particles
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + 180 * dt,
      life: p.life - dt
    }))
    .filter((p) => p.life > 0);
}

export function updatePhysics(rawDt) {
  if (gameState.mode !== MODES.FLIGHT_MODE || !gameState.flight.active || !gameState.flight.rocket) return;

  const dt = clampDt(rawDt);
  const rocket = gameState.flight.rocket;
  sanitizeRocket(rocket);

  if (gameState.flight.crashed) {
    gameState.flight.crashTimer -= dt;
    updateParticles(dt);
    if (gameState.flight.crashTimer <= 0) setMode(MODES.BUILD_MODE);
    return;
  }

  const thrusting = gameState.keys.thrust && rocket.fuel > 0;
  gameState.flight.thrusting = thrusting;

  const totalMass = Math.max(rocket.dryMass + rocket.fuel, 1);
  const effectiveMass = Math.max(totalMass * 0.002, 1);
  let ax = 0;
  let ay = GRAVITY;

  if (thrusting && rocket.thrust > 0) {
    const thrustAccel = rocket.thrust / effectiveMass;
    ax += -Math.sin(rocket.angle) * thrustAccel;
    ay += -Math.cos(rocket.angle) * thrustAccel;
    applyFuelBurn(rocket, rocket.engineCount * FUEL_BURN * dt);
    spawnFlame(rocket);
  }

  const rotateInput = Number(gameState.keys.rotateRight) - Number(gameState.keys.rotateLeft);
  rocket.angularVelocity += rotateInput * 2.5 * dt;
  rocket.angularVelocity *= 0.988;
  rocket.angle += rocket.angularVelocity * dt;

  rocket.vx += ax * dt;
  rocket.vy += ay * dt;
  rocket.vx *= DRAG;
  rocket.vy *= DRAG;

  rocket.x += rocket.vx * dt;
  rocket.y += rocket.vy * dt;

  const bottom = rocket.y + rocket.height / 2;
  if (bottom >= GROUND_Y) {
    rocket.y = GROUND_Y - rocket.height / 2;
    if (rocket.vy > 120) {
      gameState.flight.crashed = true;
      rocket.alive = false;
      gameState.flight.crashTimer = 1.2;
      spawnCrash(rocket);
      emit('flightEvent', { type: 'crash' });
    } else {
      rocket.vy = -rocket.vy * 0.25;
      if (Math.abs(rocket.vy) < 4) rocket.vy = 0;
    }
  }

  updateParticles(dt);

  const targetCamY = rocket.y - 360;
  gameState.camera.y += (targetCamY - gameState.camera.y) * Math.min(1, dt * 3.2);
}

export function initPhysicsEngine() {
  on('modeChanged', (mode) => {
    if (mode === MODES.FLIGHT_MODE) launchSetup();
    if (mode === MODES.BUILD_MODE) {
      gameState.flight.active = false;
      gameState.flight.rocket = null;
      gameState.flight.thrusting = false;
      gameState.keys.thrust = false;
      gameState.dragPreview = null;
    }
  });
}
