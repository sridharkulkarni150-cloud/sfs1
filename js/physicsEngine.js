import { gameState, MODES, on, setMode, validateNumber, emit } from './stateManager.js';

function clampDt(dt) {
  if (!Number.isFinite(dt) || dt <= 0) return 1 / 60;
  return Math.min(dt, 0.05);
}

function computeRocketBounds(parts, cellSize) {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  parts.forEach((part) => {
    minX = Math.min(minX, part.x * cellSize);
    minY = Math.min(minY, part.y * cellSize);
    maxX = Math.max(maxX, (part.x + part.width) * cellSize);
    maxY = Math.max(maxY, (part.y + part.height) * cellSize);
  });
  return {
    width: maxX - minX,
    height: maxY - minY,
    minX,
    minY
  };
}

function aggregateRocketForFlight() {
  const parts = gameState.rocketParts;
  if (!parts.length) {
    console.warn('Cannot launch: no parts present.');
    return null;
  }

  const cellSize = gameState.grid.cellSize;
  const bounds = computeRocketBounds(parts, cellSize);
  const baseX = gameState.buildOrigin.x + bounds.minX + bounds.width / 2;
  const baseY = gameState.worldGroundY ?? gameState.flight.world.groundY;

  let dryMass = 0;
  let fuel = 0;
  let thrust = 0;

  parts.forEach((part) => {
    dryMass += part.mass;
    fuel += part.fuel;
    thrust += part.thrust;
  });

  return {
    x: baseX,
    y: baseY - bounds.height / 2,
    vx: 0,
    vy: 0,
    angle: 0,
    angularVelocity: 0,
    width: bounds.width,
    height: bounds.height,
    dryMass,
    fuel,
    thrust,
    engineCount: parts.filter((p) => p.type === 'engine').length,
    thrustOffset: 18,
    alive: true
  };
}

function launchSetup() {
  const rocket = aggregateRocketForFlight();
  if (!rocket) {
    setMode(MODES.BUILD_MODE);
    return;
  }

  gameState.flight.active = true;
  gameState.flight.rocket = rocket;
  gameState.flight.particles = [];
  gameState.flight.thrusting = false;
  gameState.flight.crashed = false;
  gameState.flight.landed = false;
  gameState.flight.crashTimer = 0;
  gameState.camera.x = 0;
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

function spawnFlame(dt, rocket) {
  const count = Math.max(1, Math.floor(18 * dt));
  for (let i = 0; i < count; i += 1) {
    gameState.flight.particles.push({
      x: rocket.x - Math.sin(rocket.angle) * (rocket.height * 0.5),
      y: rocket.y + Math.cos(rocket.angle) * (rocket.height * 0.5),
      vx: -Math.sin(rocket.angle) * (80 + Math.random() * 70) + (Math.random() - 0.5) * 30,
      vy: Math.cos(rocket.angle) * (80 + Math.random() * 70) + (Math.random() - 0.5) * 30,
      life: 0.45 + Math.random() * 0.2,
      color: Math.random() > 0.5 ? '#ff9f43' : '#ffd166'
    });
  }
}

function spawnExplosion(rocket) {
  for (let i = 0; i < 70; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 210;
    gameState.flight.particles.push({
      x: rocket.x,
      y: rocket.y + rocket.height * 0.5,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.2 + Math.random() * 0.6,
      color: Math.random() > 0.4 ? '#ff4d4f' : '#ff9f1a'
    });
  }
}

function updateParticles(dt) {
  gameState.flight.particles = gameState.flight.particles
    .map((p) => ({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, life: p.life - dt, vy: p.vy + 120 * dt }))
    .filter((p) => p.life > 0);
}

export function updatePhysics(rawDt) {
  if (gameState.mode !== MODES.FLIGHT_MODE || !gameState.flight.active || !gameState.flight.rocket) return;

  const dt = clampDt(rawDt);
  const rocket = gameState.flight.rocket;
  const world = gameState.flight.world;
  sanitizeRocket(rocket);

  if (gameState.flight.crashed) {
    gameState.flight.crashTimer -= dt;
    updateParticles(dt);
    if (gameState.flight.crashTimer <= 0) {
      setMode(MODES.BUILD_MODE);
    }
    return;
  }

  const thrusting = gameState.keys.thrust && rocket.fuel > 0;
  gameState.flight.thrusting = thrusting;

  const totalMass = Math.max(rocket.dryMass + rocket.fuel, 1);
  let ax = 0;
  let ay = world.gravity;

  if (thrusting && rocket.thrust > 0) {
    const thrustForce = rocket.thrust;
    ax += (-Math.sin(rocket.angle) * thrustForce) / totalMass;
    ay += (-Math.cos(rocket.angle) * thrustForce) / totalMass;
    rocket.fuel = Math.max(0, rocket.fuel - rocket.engineCount * 120 * dt);
    spawnFlame(dt, rocket);
  }

  const torqueInput = Number(gameState.keys.rotateRight) - Number(gameState.keys.rotateLeft);
  const rotationalAcceleration = torqueInput * 2.2;
  rocket.angularVelocity += rotationalAcceleration * dt;
  if (thrusting) {
    rocket.angularVelocity += (rocket.thrustOffset / totalMass) * 0.004 * dt;
  }
  rocket.angularVelocity *= 0.985;
  rocket.angle += rocket.angularVelocity * dt;

  rocket.vx += ax * dt;
  rocket.vy += ay * dt;
  rocket.vx *= world.drag;
  rocket.vy *= world.drag;

  rocket.x += rocket.vx * dt;
  rocket.y += rocket.vy * dt;

  const bottomY = rocket.y + rocket.height / 2;
  if (bottomY >= world.groundY) {
    rocket.y = world.groundY - rocket.height / 2;
    const impactSpeed = rocket.vy;

    if (impactSpeed > 80) {
      gameState.flight.crashed = true;
      gameState.flight.crashTimer = 1.4;
      rocket.alive = false;
      spawnExplosion(rocket);
      emit('flightEvent', { type: 'crash' });
    } else {
      rocket.vy = -impactSpeed * world.restitution;
      rocket.vx *= 0.7;
      rocket.angularVelocity *= 0.7;
      if (Math.abs(rocket.vy) < 8) {
        rocket.vy = 0;
        gameState.flight.landed = true;
      }
    }
  }

  updateParticles(dt);

  const targetCamY = rocket.y - 380;
  gameState.camera.y += (targetCamY - gameState.camera.y) * Math.min(1, dt * 3);
}

export function initPhysicsEngine() {
  on('modeChanged', (mode) => {
    if (mode === MODES.FLIGHT_MODE) {
      launchSetup();
    }
    if (mode === MODES.BUILD_MODE) {
      gameState.flight.active = false;
      gameState.flight.rocket = null;
      gameState.flight.thrusting = false;
      gameState.keys.thrust = false;
    }
  });
}
