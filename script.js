const STORAGE_KEY = "nebula-strike-save-v1";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const menuScreen = document.getElementById("menuScreen");
const panelScreen = document.getElementById("panelScreen");
const panelTitle = document.getElementById("panelTitle");
const panelContent = document.getElementById("panelContent");
const overlayScreen = document.getElementById("overlayScreen");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const hud = document.getElementById("hud");
const continueBtn = document.getElementById("continueBtn");
const touchControls = document.getElementById("touchControls");
const movePad = document.getElementById("movePad");
const stick = document.getElementById("stick");
const fireButton = document.getElementById("fireButton");
const pauseButton = document.getElementById("pauseButton");

const SHIP_LIBRARY = {
  scout: { id: "scout", name: "Scout", cost: 0, maxHealth: 100, maxShield: 60, speed: 320, fireRate: 0.22, damage: 16, weapon: "Pulse Blaster", shotCount: 1, spread: 0, color: "#7ce8ff", accent: "#d5f5ff" },
  vanguard: { id: "vanguard", name: "Vanguard", cost: 250, maxHealth: 120, maxShield: 80, speed: 300, fireRate: 0.18, damage: 22, weapon: "Scatter Cannon", shotCount: 2, spread: 0.18, color: "#b4a7ff", accent: "#efe7ff" },
  nova: { id: "nova", name: "Nova", cost: 500, maxHealth: 130, maxShield: 90, speed: 340, fireRate: 0.14, damage: 26, weapon: "Nova Beam", shotCount: 1, spread: 0, color: "#ffbd68", accent: "#ffe7bb" },
  aegis: { id: "aegis", name: "Aegis", cost: 750, maxHealth: 165, maxShield: 110, speed: 285, fireRate: 0.16, damage: 18, weapon: "Twin Guard", shotCount: 2, spread: 0.12, color: "#8ef4ad", accent: "#ddffe7" }
};

const MISSION_CATALOG = [
  { id: "score_500", label: "Scout Route", objective: "Reach 500 score", target: 500, reward: 150, type: "score" },
  { id: "wave_3", label: "Frontline Breach", objective: "Reach Wave 3", target: 3, reward: 250, type: "wave" },
  { id: "credits_400", label: "Resupply Run", objective: "Collect 400 credits", target: 400, reward: 300, type: "credits" },
  { id: "wave_8", label: "Deep Drift", objective: "Reach Wave 8", target: 8, reward: 500, type: "wave" }
];

const defaultSave = {
  bestScore: 0,
  credits: 0,
  xp: 0,
  level: 1,
  selectedShip: "scout",
  unlockedShips: ["scout"],
  upgrades: { weapon: 0, engine: 0, shield: 0 },
  settings: { volume: 0.65, muted: false },
  missions: {
    score_500: { complete: false, claimed: false },
    wave_3: { complete: false, claimed: false },
    credits_400: { complete: false, claimed: false },
    wave_8: { complete: false, claimed: false }
  }
};

const state = {
  save: loadSave(),
  screen: "menu",
  game: null,
  keys: Object.create(null),
  touch: { active: false, pointerId: null, x: 0, y: 0, firing: false },
  audioCtx: null
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const rand = (min, max) => min + Math.random() * (max - min);
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function mergeSave(base, incoming) {
  const next = JSON.parse(JSON.stringify(base));
  if (!incoming) return next;
  Object.assign(next, incoming);
  next.upgrades = { ...base.upgrades, ...(incoming.upgrades || {}) };
  next.settings = { ...base.settings, ...(incoming.settings || {}) };
  next.missions = { ...base.missions, ...(incoming.missions || {}) };
  next.unlockedShips = Array.isArray(incoming.unlockedShips) ? incoming.unlockedShips : base.unlockedShips;
  return next;
}

function loadSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(defaultSave));
    return mergeSave(defaultSave, JSON.parse(raw));
  } catch (error) {
    console.warn("Storage unavailable; using default save state.");
    return JSON.parse(JSON.stringify(defaultSave));
  }
}

function saveGame() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.save));
  } catch (error) {
    console.warn("Could not persist save data.");
  }
}

function ensureAudio() {
  if (state.audioCtx) return;
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  state.audioCtx = new AudioCtor();
}

function playTone(freq, duration = 0.08, type = "sine", volume = 0.03) {
  if (state.save.settings.muted) return;
  ensureAudio();
  if (!state.audioCtx) return;
  const osc = state.audioCtx.createOscillator();
  const gain = state.audioCtx.createGain();
  const t = state.audioCtx.currentTime;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume * state.save.settings.volume, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(state.audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playSfx(kind) {
  if (kind === "shoot") playTone(240, 0.06, "square", 0.018);
  else if (kind === "explosion") playTone(90, 0.18, "sawtooth", 0.05);
  else if (kind === "pickup") playTone(520, 0.12, "triangle", 0.03);
  else if (kind === "hurt") playTone(140, 0.09, "square", 0.03);
  else if (kind === "menu") playTone(420, 0.08, "triangle", 0.02);
}

function updateContinueButton() {
  const hasProgress = state.save.bestScore > 0 || state.save.credits > 0 || state.save.xp > 0 || state.save.unlockedShips.length > 1;
  continueBtn.disabled = !hasProgress;
}

function setScreen(name) {
  state.screen = name;
  menuScreen.classList.toggle("active", name === "menu");
  menuScreen.classList.toggle("hidden", name !== "menu");
  panelScreen.classList.toggle("active", name === "panel");
  panelScreen.classList.toggle("hidden", name !== "panel");
  overlayScreen.classList.toggle("active", name === "overlay");
  overlayScreen.classList.toggle("hidden", name !== "overlay");
}

function showMenu() {
  setScreen("menu");
  hud.classList.add("hidden");
  state.game = null;
  updateContinueButton();
}

function openPanel(title, renderFn) {
  panelTitle.textContent = title;
  renderFn();
  setScreen("panel");
}

function showOverlay(title, text, allowResume = true) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  const resumeButton = document.querySelector('[data-action="resume"]');
  if (resumeButton) resumeButton.style.display = allowResume ? "block" : "none";
  setScreen("overlay");
}

function getShipConfig(shipId) {
  return SHIP_LIBRARY[shipId] || SHIP_LIBRARY.scout;
}

function getShipStats(shipId = state.save.selectedShip) {
  const base = getShipConfig(shipId);
  const weaponLvl = state.save.upgrades.weapon || 0;
  const engineLvl = state.save.upgrades.engine || 0;
  const shieldLvl = state.save.upgrades.shield || 0;
  return {
    maxHealth: base.maxHealth + shieldLvl * 12,
    maxShield: base.maxShield + shieldLvl * 18,
    speed: base.speed + engineLvl * 18,
    fireRate: Math.max(0.08, base.fireRate - weaponLvl * 0.02),
    damage: base.damage + weaponLvl * 8,
    weaponLabel: base.weapon,
    shotCount: base.shotCount,
    spread: base.spread,
    color: base.color,
    accent: base.accent
  };
}

function beginGame(continueRun = false) {
  ensureAudio();
  const ship = getShipConfig(state.save.selectedShip);
  const stats = getShipStats(state.save.selectedShip);
  const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 16,
    angle: -Math.PI / 2,
    lives: 3,
    maxHealth: stats.maxHealth,
    maxShield: stats.maxShield,
    health: stats.maxHealth,
    shield: stats.maxShield,
    speed: stats.speed,
    fireRate: stats.fireRate,
    damage: stats.damage,
    weaponLabel: stats.weaponLabel,
    shotCount: stats.shotCount,
    spread: stats.spread,
    color: stats.color,
    accent: stats.accent,
    fireCooldown: 0,
    invuln: 0,
    speedBoost: 0,
    shieldBoost: 0,
    weaponBoost: 0,
    ship
  };

  state.game = {
    running: true,
    score: continueRun ? Math.max(0, Math.floor(state.save.bestScore * 0.35)) : 0,
    wave: 1,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    asteroids: [],
    pickups: [],
    particles: [],
    stars: generateStars(150),
    player,
    spawnTimer: 0.8,
    waveTarget: 5,
    waveSpawned: 0,
    waveActive: true,
    waveDelay: 0,
    elapsed: 0
  };

  startWave(1);
  setScreen("menu");
  hud.classList.remove("hidden");
  updateHud();
}

function endRun(saveProgressNow = true) {
  if (!state.game) return;
  if (saveProgressNow) {
    state.save.bestScore = Math.max(state.save.bestScore, Math.floor(state.game.score));
    state.save.credits += Math.floor(state.game.score / 20);
    state.save.xp += Math.min(120, Math.floor(state.game.score / 12));
    while (state.save.xp >= 100 + state.save.level * 20) {
      state.save.xp -= 100 + state.save.level * 20;
      state.save.level += 1;
    }
    saveGame();
    updateMissionProgress();
  }
  state.game = null;
  hud.classList.add("hidden");
}

function generateStars(count) {
  const stars = [];
  for (let i = 0; i < count; i += 1) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: rand(1, 3),
      s: rand(20, 130),
      a: rand(0.3, 1)
    });
  }
  return stars;
}

function spawnAsteroid() {
  if (!state.game) return;
  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  const radius = rand(18, 38);
  if (side === 0) { x = rand(0, canvas.width); y = -50; }
  else if (side === 1) { x = canvas.width + 50; y = rand(0, canvas.height); }
  else if (side === 2) { x = rand(0, canvas.width); y = canvas.height + 50; }
  else { x = -50; y = rand(0, canvas.height); }
  state.game.asteroids.push({ x, y, radius, vx: rand(-25, 25), vy: rand(-25, 25), angle: rand(0, Math.PI * 2), spin: rand(-1.2, 1.2), health: 28 + radius * 1.2 });
}

function spawnEnemy() {
  if (!state.game) return;
  const wave = state.game.wave;
  const typeRoll = Math.random();
  let type = "scout";
  if (wave >= 3 && typeRoll > 0.72) type = "zigzag";
  if (wave >= 5 && typeRoll > 0.86) type = "brute";
  if (wave >= 7 && typeRoll > 0.94) type = "kamikaze";

  const side = Math.floor(Math.random() * 4);
  let x = 0, y = 0;
  const margin = 34;
  if (side === 0) { x = rand(0, canvas.width); y = -margin; }
  else if (side === 1) { x = canvas.width + margin; y = rand(0, canvas.height); }
  else if (side === 2) { x = rand(0, canvas.width); y = canvas.height + margin; }
  else { x = -margin; y = rand(0, canvas.height); }

  const enemy = {
    type,
    x,
    y,
    radius: type === "brute" ? 22 : type === "kamikaze" ? 18 : 16,
    speed: type === "brute" ? 72 : type === "kamikaze" ? 165 : 110,
    health: type === "brute" ? 90 + wave * 12 : type === "zigzag" ? 55 + wave * 8 : 36 + wave * 6,
    fireCooldown: rand(0.8, 2.2),
    phase: rand(0, Math.PI * 2),
    value: type === "brute" ? 220 : type === "kamikaze" ? 180 : 100
  };
  state.game.enemies.push(enemy);
}

function startWave(waveNumber) {
  if (!state.game) return;
  const wave = Math.max(1, waveNumber);
  state.game.wave = wave;
  state.game.waveTarget = 4 + wave * 2;
  state.game.waveSpawned = 0;
  state.game.waveActive = true;
  state.game.spawnTimer = 0.6;
  for (let i = 0; i < 2 + wave; i += 1) spawnAsteroid();
  updateHud();
}

function spawnPickup(x, y) {
  if (!state.game) return;
  const options = ["health", "shield", "credits", "boost", "weapon"];
  state.game.pickups.push({ x, y, radius: 11, drift: rand(-18, 18), type: options[Math.floor(Math.random() * options.length)] });
}

function firePlayerBullet() {
  if (!state.game) return;
  const player = state.game.player;
  if (player.fireCooldown > 0) return;
  player.fireCooldown = player.fireRate;
  const count = player.shotCount || 1;
  const spread = player.spread || 0;
  for (let i = 0; i < count; i += 1) {
    const offset = (i - (count - 1) / 2) * spread;
    const angle = player.angle + offset;
    state.game.bullets.push({
      x: player.x + Math.cos(angle) * 22,
      y: player.y + Math.sin(angle) * 22,
      vx: Math.cos(angle) * 760,
      vy: Math.sin(angle) * 760,
      radius: 4,
      damage: player.damage,
      life: 1.5
    });
  }
  playSfx("shoot");
}

function fireEnemyWeapon(enemy) {
  if (!state.game) return;
  const dx = state.game.player.x - enemy.x;
  const dy = state.game.player.y - enemy.y;
  const angle = Math.atan2(dy, dx);
  state.game.enemyBullets.push({ x: enemy.x, y: enemy.y, vx: Math.cos(angle) * 260, vy: Math.sin(angle) * 260, radius: 5, damage: enemy.type === "brute" ? 18 : 10, life: 4 });
}

function createExplosion(x, y, radius, style = "enemy") {
  if (!state.game) return;
  const count = style === "enemy" ? 24 : 18;
  for (let i = 0; i < count; i += 1) {
    const ang = (Math.PI * 2 * i) / count + Math.random();
    const speed = rand(25, 180);
    state.game.particles.push({
      x,
      y,
      vx: Math.cos(ang) * speed,
      vy: Math.sin(ang) * speed,
      life: rand(0.3, 0.9),
      maxLife: rand(0.3, 0.9),
      radius: rand(2, 4),
      color: style === "enemy" ? "#ff9a63" : "#dfeaff"
    });
  }
}

function applyDamage(amount) {
  if (!state.game) return;
  const player = state.game.player;
  if (player.invuln > 0) return;
  let dmg = amount;
  if (player.shield > 0) {
    const absorb = Math.min(player.shield, dmg);
    player.shield -= absorb;
    dmg -= absorb;
  }
  if (dmg > 0) player.health -= dmg;
  player.invuln = 0.7;
  playSfx("hurt");

  if (player.health <= 0) {
    player.lives -= 1;
    if (player.lives <= 0) {
      const finalScore = Math.floor(state.game.score);
      endRun(true);
      showOverlay("Mission Failed", `Final Score: ${finalScore.toLocaleString()}`, false);
      return;
    }
    player.health = player.maxHealth;
    player.shield = player.maxShield;
    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.invuln = 2.0;
  }
}

function updatePlayer(dt) {
  if (!state.game) return;
  const player = state.game.player;
  const ax = (state.keys.KeyD || state.keys.ArrowRight || state.touch.x > 0 ? 1 : 0) - (state.keys.KeyA || state.keys.ArrowLeft || state.touch.x < 0 ? 1 : 0);
  const ay = (state.keys.KeyS || state.keys.ArrowDown || state.touch.y > 0 ? 1 : 0) - (state.keys.KeyW || state.keys.ArrowUp || state.touch.y < 0 ? 1 : 0);
  const mag = Math.hypot(ax, ay) || 1;
  const nx = ax / mag;
  const ny = ay / mag;
  const boostFactor = player.speedBoost > 0 ? 1.55 : 1;
  player.x += nx * player.speed * boostFactor * dt;
  player.y += ny * player.speed * boostFactor * dt;
  player.x = clamp(player.x, 26, canvas.width - 26);
  player.y = clamp(player.y, 26, canvas.height - 26);

  const aimX = ax;
  const aimY = ay;
  if (aimX !== 0 || aimY !== 0) player.angle = Math.atan2(aimY, aimX);

  if (state.keys.Space || state.touch.firing) firePlayerBullet();
  player.fireCooldown = Math.max(0, player.fireCooldown - dt);
  if (player.invuln > 0) player.invuln -= dt;
  if (player.speedBoost > 0) player.speedBoost = Math.max(0, player.speedBoost - dt);
  if (player.shieldBoost > 0) player.shieldBoost = Math.max(0, player.shieldBoost - dt);
  if (player.weaponBoost > 0) player.weaponBoost = Math.max(0, player.weaponBoost - dt);
}

function updateBullets(dt) {
  if (!state.game) return;
  state.game.bullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  });
  state.game.enemyBullets.forEach((bullet) => {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  });
  state.game.bullets = state.game.bullets.filter((b) => b.life > 0 && b.x > -30 && b.x < canvas.width + 30 && b.y > -30 && b.y < canvas.height + 30);
  state.game.enemyBullets = state.game.enemyBullets.filter((b) => b.life > 0 && b.x > -30 && b.x < canvas.width + 30 && b.y > -30 && b.y < canvas.height + 30);
}

function updateAsteroids(dt) {
  if (!state.game) return;
  const { player } = state.game;
  for (let i = state.game.asteroids.length - 1; i >= 0; i -= 1) {
    const rock = state.game.asteroids[i];
    rock.angle += rock.spin * dt;
    rock.x += rock.vx * dt;
    rock.y += rock.vy * dt;
    if (rock.x < -60) rock.x = canvas.width + 60;
    if (rock.x > canvas.width + 60) rock.x = -60;
    if (rock.y < -60) rock.y = canvas.height + 60;
    if (rock.y > canvas.height + 60) rock.y = -60;
    if (dist(rock.x, rock.y, player.x, player.y) < rock.radius + player.radius + 8) {
      applyDamage(18);
      rock.health -= 18;
    }
    if (rock.health <= 0) {
      createExplosion(rock.x, rock.y, rock.radius, "asteroid");
      state.game.asteroids.splice(i, 1);
      if (Math.random() < 0.25) spawnPickup(rock.x, rock.y);
      playSfx("explosion");
    }
  }
}

function updateEnemies(dt) {
  if (!state.game) return;
  const { player, enemies } = state.game;
  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const e = enemies[i];
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    e.fireCooldown -= dt;
    e.phase += dt * 3;

    if (e.type === "zigzag") {
      e.x += (nx * e.speed * 0.8 + Math.cos(e.phase) * 24) * dt;
      e.y += (ny * e.speed * 0.8 + Math.sin(e.phase) * 24) * dt;
    } else if (e.type === "kamikaze") {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    } else {
      e.x += nx * e.speed * dt;
      e.y += ny * e.speed * dt;
    }

    if (len < 500 && e.fireCooldown <= 0) {
      fireEnemyWeapon(e);
      e.fireCooldown = e.type === "brute" ? 1.3 : 1.1;
    }

    if (len < e.radius + player.radius + 4) {
      applyDamage(e.type === "brute" ? 26 : 18);
      e.health = 0;
    }

    if (e.health <= 0) {
      createExplosion(e.x, e.y, e.radius, "enemy");
      state.game.score += e.value;
      if (Math.random() < 0.25) spawnPickup(e.x, e.y);
      enemies.splice(i, 1);
      playSfx("explosion");
    }
  }
}

function updatePickups(dt) {
  if (!state.game) return;
  const player = state.game.player;
  for (let i = state.game.pickups.length - 1; i >= 0; i -= 1) {
    const p = state.game.pickups[i];
    p.y += Math.sin((performance.now() * 0.003) + i) * 0.5;
    p.x += p.drift * dt;
    if (dist(player.x, player.y, p.x, p.y) < player.radius + p.radius + 4) {
      if (p.type === "health") player.health = Math.min(player.maxHealth, player.health + 30);
      else if (p.type === "shield") player.shield = Math.min(player.maxShield, player.shield + 36);
      else if (p.type === "credits") state.save.credits += 60;
      else if (p.type === "boost") player.speedBoost = 5.5;
      else if (p.type === "weapon") player.weaponBoost = 5.0;
      state.game.pickups.splice(i, 1);
      playSfx("pickup");
    }
  }
}

function updateCollisions() {
  if (!state.game) return;
  const { bullets, enemies, asteroids, enemyBullets, player } = state.game;

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    for (let j = enemies.length - 1; j >= 0; j -= 1) {
      const e = enemies[j];
      if (dist(b.x, b.y, e.x, e.y) < e.radius + b.radius) {
        e.health -= b.damage;
        bullets.splice(i, 1);
        break;
      }
    }
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const b = bullets[i];
    for (let j = asteroids.length - 1; j >= 0; j -= 1) {
      const a = asteroids[j];
      if (dist(b.x, b.y, a.x, a.y) < a.radius + b.radius) {
        a.health -= b.damage;
        bullets.splice(i, 1);
        break;
      }
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = enemyBullets[i];
    if (dist(b.x, b.y, player.x, player.y) < player.radius + b.radius + 4) {
      applyDamage(b.damage);
      enemyBullets.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  if (!state.game) return;
  for (let i = state.game.particles.length - 1; i >= 0; i -= 1) {
    const p = state.game.particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= dt;
    if (p.life <= 0) state.game.particles.splice(i, 1);
  }
}

function updateWave(dt) {
  if (!state.game) return;
  if (state.game.waveActive) {
    state.game.spawnTimer -= dt;
    if (state.game.waveSpawned < state.game.waveTarget && state.game.spawnTimer <= 0) {
      spawnEnemy();
      state.game.waveSpawned += 1;
      state.game.spawnTimer = Math.max(0.35, 1.05 - state.game.wave * 0.08 + Math.random() * 0.22);
    }
    if (state.game.waveSpawned >= state.game.waveTarget && state.game.enemies.length === 0 && state.game.asteroids.length === 0) {
      state.game.waveActive = false;
      state.game.waveDelay = 1.4;
      state.game.wave += 1;
    }
  } else {
    state.game.waveDelay -= dt;
    if (state.game.waveDelay <= 0) {
      startWave(state.game.wave);
    }
  }
}

function updateMissionProgress() {
  if (!state.game) {
    const missions = state.save.missions || {};
    const scoreValue = state.save.bestScore;
    const waveValue = Math.max(1, Math.floor(state.save.level / 2));
    missions.score_500 = { ...missions.score_500, complete: scoreValue >= 500 };
    missions.wave_3 = { ...missions.wave_3, complete: waveValue >= 3 };
    missions.credits_400 = { ...missions.credits_400, complete: state.save.credits >= 400 };
    missions.wave_8 = { ...missions.wave_8, complete: waveValue >= 8 };
    state.save.missions = missions;
    saveGame();
    return;
  }

  const missions = state.save.missions || {};
  missions.score_500 = { ...missions.score_500, complete: state.game.score >= 500 };
  missions.wave_3 = { ...missions.wave_3, complete: state.game.wave >= 3 };
  missions.credits_400 = { ...missions.credits_400, complete: state.save.credits >= 400 };
  missions.wave_8 = { ...missions.wave_8, complete: state.game.wave >= 8 };
  state.save.missions = missions;
}

function renderHangar() {
  const unlocked = new Set(state.save.unlockedShips);
  const cards = Object.values(SHIP_LIBRARY).map((ship) => {
    const unlockedShip = unlocked.has(ship.id);
    const selected = state.save.selectedShip === ship.id;
    const buttonLabel = unlockedShip ? (selected ? "Selected" : "Select") : `Unlock (${ship.cost})`;
    const action = unlockedShip ? "select-ship" : "unlock-ship";
    return `
      <div class="ship-card ${selected ? "selected" : ""} ${unlockedShip ? "" : "locked"}">
        <div class="ship-preview"></div>
        <div class="row">
          <h3>${ship.name}</h3>
          <span class="tag ${unlockedShip ? "success" : "warning"}">${unlockedShip ? "Unlocked" : "Locked"}</span>
        </div>
        <div class="meta">
          <div>Hull: ${ship.maxHealth}</div>
          <div>Shield: ${ship.maxShield}</div>
          <div>Speed: ${ship.speed}</div>
          <div>Weapon: ${ship.weapon}</div>
        </div>
        <button class="menu-btn ${selected ? "primary" : ""}" data-ship-id="${ship.id}" data-ship-action="${action}" ${selected && unlockedShip ? "disabled" : ""}>${buttonLabel}</button>
      </div>
    `;
  }).join("");
  panelContent.innerHTML = `<div class="card-grid">${cards}</div>`;
}

function renderMissions() {
  const cards = MISSION_CATALOG.map((mission) => {
    const progressValue = mission.type === "score" ? (state.game ? state.game.score : state.save.bestScore) : mission.type === "wave" ? (state.game ? state.game.wave : Math.max(1, Math.floor(state.save.level / 2))) : state.save.credits;
    const complete = state.save.missions[mission.id]?.complete || false;
    const claimed = state.save.missions[mission.id]?.claimed || false;
    const pct = Math.min((progressValue / mission.target) * 100, 100);
    return `
      <div class="mission-card">
        <div class="row">
          <h3>${mission.label}</h3>
          <span class="tag ${complete ? "success" : "warning"}">${complete ? "Complete" : "Active"}</span>
        </div>
        <div class="meta">${mission.objective}</div>
        <div class="mission-progress"><div class="mission-progress-bar" style="width:${pct}%"></div></div>
        <div class="row">
          <strong>${Math.min(Math.floor(progressValue), mission.target)} / ${mission.target}</strong>
          <span class="tag">Reward ${mission.reward}</span>
        </div>
        <button class="menu-btn primary" data-mission-id="${mission.id}" data-mission-action="claim" ${(!complete || claimed) ? "disabled" : ""}>${claimed ? "Claimed" : complete ? "Claim Reward" : "In Progress"}</button>
      </div>
    `;
  }).join("");
  panelContent.innerHTML = `<div class="card-grid">${cards}</div>`;
}

function renderUpgrades() {
  const entries = [
    { key: "weapon", label: "Weapon Systems", desc: "Increase damage and fire rate." },
    { key: "engine", label: "Engine Core", desc: "Improve ship speed and handling." },
    { key: "shield", label: "Shield Matrix", desc: "Increase hull and shield capacity." }
  ];
  const cards = entries.map((entry) => {
    const level = state.save.upgrades[entry.key] || 0;
    const cost = 150 + level * 100;
    const canAfford = state.save.credits >= cost;
    return `
      <div class="upgrade-card">
        <div class="row">
          <h3>${entry.label}</h3>
          <span class="tag">Lv ${level}</span>
        </div>
        <div class="meta">${entry.desc}</div>
        <div class="row">
          <strong>Cost: ${cost}</strong>
          <button class="menu-btn primary" data-upgrade="${entry.key}" ${!canAfford ? "disabled" : ""}>Upgrade</button>
        </div>
      </div>
    `;
  }).join("");
  panelContent.innerHTML = `<div class="card-grid">${cards}</div>`;
}

function renderSettings() {
  panelContent.innerHTML = `
    <div class="setting-card">
      <h3>Audio</h3>
      <div class="volume-wrap">
        <input id="volumeSlider" type="range" min="0" max="1" step="0.01" value="${state.save.settings.volume}" />
        <strong>${state.save.settings.volume.toFixed(2)}</strong>
      </div>
      <button class="menu-btn primary" id="muteToggle">${state.save.settings.muted ? "Unmute" : "Mute"}</button>
    </div>
  `;
  document.getElementById("volumeSlider").addEventListener("input", (event) => {
    state.save.settings.volume = Number(event.target.value);
    event.target.nextElementSibling.textContent = state.save.settings.volume.toFixed(2);
    saveGame();
  });
  document.getElementById("muteToggle").addEventListener("click", () => {
    state.save.settings.muted = !state.save.settings.muted;
    saveGame();
    renderSettings();
    if (!state.save.settings.muted) playSfx("menu");
  });
}

function renderHelp() {
  panelContent.innerHTML = `
    <div class="help-card">
      <h3>Command Briefing</h3>
      <ul>
        <li>Move with WASD or arrow keys.</li>
        <li>Hold Space to fire, or use the touch FIRE button.</li>
        <li>Collect drops to gain health, shield, credits, and boosts.</li>
        <li>Destroy enemy ships and asteroids to build score.</li>
        <li>Survive each wave to unlock progression rewards.</li>
      </ul>
    </div>
  `;
}

function renderCredits() {
  panelContent.innerHTML = `
    <div class="credit-card">
      <h3>Credits</h3>
      <p>NEBULA STRIKE is a handcrafted arcade survival game built with HTML5 Canvas, CSS, and JavaScript.</p>
      <p>Created for responsive browser play with optional procedural audio, persistent progression, and clean UI design.</p>
    </div>
  `;
}

function handleShipSelection(shipId, action) {
  if (action === "unlock-ship") {
    const ship = getShipConfig(shipId);
    if (state.save.credits >= ship.cost) {
      state.save.credits -= ship.cost;
      if (!state.save.unlockedShips.includes(shipId)) state.save.unlockedShips.push(shipId);
      state.save.selectedShip = shipId;
      saveGame();
      renderHangar();
      playSfx("pickup");
    }
  } else if (action === "select-ship") {
    state.save.selectedShip = shipId;
    saveGame();
    renderHangar();
  }
}

function handleMissionClaim(missionId) {
  const mission = state.save.missions[missionId];
  if (!mission || !mission.complete || mission.claimed) return;
  const reward = MISSION_CATALOG.find((m) => m.id === missionId)?.reward || 0;
  mission.claimed = true;
  state.save.credits += reward;
  saveGame();
  renderMissions();
  playSfx("pickup");
}

function buyUpgrade(key) {
  const level = state.save.upgrades[key] || 0;
  const cost = 150 + level * 100;
  if (state.save.credits < cost) return;
  state.save.credits -= cost;
  state.save.upgrades[key] = level + 1;
  saveGame();
  renderUpgrades();
  playSfx("pickup");
}

document.addEventListener("click", (event) => {
  const actionEl = event.target.closest("[data-action]");
  if (actionEl) {
    const action = actionEl.dataset.action;
    if (action === "start") beginGame(false);
    else if (action === "continue") beginGame(true);
    else if (action === "hangar") openPanel("Spaceship Hangar", renderHangar);
    else if (action === "missions") openPanel("Missions", renderMissions);
    else if (action === "upgrades") openPanel("Upgrades", renderUpgrades);
    else if (action === "settings") openPanel("Settings", renderSettings);
    else if (action === "help") openPanel("How to Play", renderHelp);
    else if (action === "credits") openPanel("Credits", renderCredits);
    else if (action === "back") showMenu();
    else if (action === "resume") {
      if (state.game) {
        state.game.running = true;
        setScreen("menu");
      }
    } else if (action === "restart") beginGame(false);
    else if (action === "menu") {
      endRun(false);
      showMenu();
    }
  }

  const shipControl = event.target.closest("[data-ship-action]");
  if (shipControl) handleShipSelection(shipControl.dataset.shipId, shipControl.dataset.shipAction);

  const missionControl = event.target.closest("[data-mission-action]");
  if (missionControl) handleMissionClaim(missionControl.dataset.missionId);

  const upgradeControl = event.target.closest("[data-upgrade]");
  if (upgradeControl) buyUpgrade(upgradeControl.dataset.upgrade);
});

function updateHud() {
  if (!state.game) return;
  const player = state.game.player;
  document.getElementById("scoreValue").textContent = Math.floor(state.game.score).toLocaleString();
  document.getElementById("waveValue").textContent = String(state.game.wave);
  document.getElementById("livesValue").textContent = String(player.lives);
  document.getElementById("creditsValue").textContent = state.save.credits.toLocaleString();
  document.getElementById("healthBar").style.width = `${(player.health / player.maxHealth) * 100}%`;
  document.getElementById("shieldBar").style.width = `${(player.shield / player.maxShield) * 100}%`;
  document.getElementById("healthValue").textContent = String(Math.round(player.health));
  document.getElementById("shieldValue").textContent = String(Math.round(player.shield));
  document.getElementById("weaponValue").textContent = player.weaponLabel || "Pulse";
  let boostName = "None";
  if (player.speedBoost > 0) boostName = "Speed";
  else if (player.weaponBoost > 0) boostName = "Weapon";
  else if (player.shieldBoost > 0) boostName = "Shield";
  document.getElementById("boostValue").textContent = boostName;
}

function renderBackground() {
  const gradient = ctx.createRadialGradient(canvas.width * 0.5, canvas.height * 0.5, 50, canvas.width * 0.5, canvas.height * 0.5, canvas.width * 0.8);
  gradient.addColorStop(0, "#122847");
  gradient.addColorStop(0.45, "#091728");
  gradient.addColorStop(1, "#02060d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const stars = state.game ? state.game.stars : generateStars(100);
  for (const star of stars) {
    ctx.beginPath();
    ctx.fillStyle = `rgba(255,255,255,${star.a})`;
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "rgba(93, 149, 255, 0.06)";
  for (let i = 0; i < 5; i += 1) {
    const x = (canvas.width / 5) * i + 60;
    const y = 100 + (i % 2) * 120;
    ctx.beginPath();
    ctx.arc(x, y, 120 + i * 28, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawShip(player) {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  ctx.fillStyle = player.color;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-12, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-12, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = player.accent;
  ctx.fillRect(-18, -4, 10, 8);

  if (player.invuln > 0) {
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius + 9, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawEnemy(enemy) {
  ctx.save();
  ctx.translate(enemy.x, enemy.y);
  const angle = Math.atan2(state.game.player.y - enemy.y, state.game.player.x - enemy.x);
  ctx.rotate(angle);

  if (enemy.type === "brute") {
    ctx.fillStyle = "#ff8f6c";
    ctx.fillRect(-18, -18, 36, 36);
    ctx.fillStyle = "#ffd6bf";
    ctx.fillRect(-8, -8, 16, 16);
  } else if (enemy.type === "zigzag") {
    ctx.fillStyle = "#5be0ff";
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, 12);
    ctx.closePath();
    ctx.fill();
  } else if (enemy.type === "kamikaze") {
    ctx.fillStyle = "#ffc95c";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = "#ff6d8d";
    ctx.fillRect(-14, -10, 28, 20);
    ctx.fillStyle = "#ffd7e1";
    ctx.fillRect(-8, -5, 16, 10);
  }

  ctx.restore();
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  ctx.beginPath();
  const sides = 7;
  for (let i = 0; i < sides; i += 1) {
    const ang = (Math.PI * 2 * i) / sides;
    const r = a.radius * (0.75 + ((i % 2) * 0.25));
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = "#7b899d";
  ctx.fill();
  ctx.strokeStyle = "rgba(233,243,255,0.24)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawBullets() {
  if (!state.game) return;
  ctx.fillStyle = "#72f8ff";
  for (const b of state.game.bullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = "#ffb76a";
  for (const b of state.game.enemyBullets) {
    ctx.beginPath(); ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2); ctx.fill();
  }
}

function drawPickups() {
  if (!state.game) return;
  const palette = { health: "#8ef8a2", shield: "#7fe2ff", credits: "#ffd76a", boost: "#b39cff", weapon: "#ff8ecc" };
  for (const p of state.game.pickups) {
    ctx.fillStyle = palette[p.type] || "#fff";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawParticles() {
  if (!state.game) return;
  for (const p of state.game.particles) {
    const alpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color.replace(")", `, ${alpha})`).replace("rgb", "rgba");
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderGame() {
  if (!state.game) return;
  renderBackground();
  state.game.asteroids.forEach(drawAsteroid);
  state.game.enemies.forEach(drawEnemy);
  drawPickups();
  drawBullets();
  drawParticles();
  drawShip(state.game.player);
}

function updateStars(dt) {
  const stars = state.game ? state.game.stars : null;
  if (!stars) return;
  for (const star of stars) {
    star.y += star.s * dt;
    if (star.y > canvas.height + 5) {
      star.y = -5;
      star.x = Math.random() * canvas.width;
    }
  }
}

function tick(timestamp) {
  const previous = tick.lastTime || timestamp;
  const dt = Math.min((timestamp - previous) / 1000, 0.032);
  tick.lastTime = timestamp;

  updateStars(dt);
  if (state.game && state.game.running) {
    state.game.elapsed += dt;
    updatePlayer(dt);
    updateWave(dt);
    updateAsteroids(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateCollisions();
    updatePickups(dt);
    updateParticles(dt);
    state.save.bestScore = Math.max(state.save.bestScore, Math.floor(state.game.score));
    updateMissionProgress();
    updateHud();
  }

  if (state.screen === "menu" || state.screen === "panel" || state.screen === "overlay") {
    renderBackground();
  } else if (state.game) {
    renderGame();
  }

  requestAnimationFrame(tick);
}

function handleKey(event, pressed) {
  const key = event.code;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) event.preventDefault();
  state.keys[key] = pressed;
}

document.addEventListener("keydown", (event) => handleKey(event, true));
document.addEventListener("keyup", (event) => handleKey(event, false));

movePad.addEventListener("pointerdown", (event) => {
  state.touch.active = true;
  state.touch.pointerId = event.pointerId;
  movePad.setPointerCapture(event.pointerId);
  updateTouch(event);
});

movePad.addEventListener("pointermove", (event) => {
  if (state.touch.active && state.touch.pointerId === event.pointerId) updateTouch(event);
});

function updateTouch(event) {
  const rect = movePad.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const max = rect.width / 2 - 18;
  const len = Math.hypot(dx, dy) || 1;
  const clamped = Math.min(len, max);
  const nx = dx / len;
  const ny = dy / len;
  const x = nx * clamped;
  const y = ny * clamped;
  stick.style.transform = `translate(${x - 24}px, ${y - 24}px)`;
  state.touch.x = clamp(x / max, -1, 1);
  state.touch.y = clamp(y / max, -1, 1);
}

function releaseTouch(event) {
  if (state.touch.pointerId === event.pointerId) {
    state.touch.active = false;
    state.touch.pointerId = null;
    state.touch.x = 0;
    state.touch.y = 0;
    stick.style.transform = "translate(-50%, -50%)";
  }
}

movePad.addEventListener("pointerup", releaseTouch);
movePad.addEventListener("pointercancel", releaseTouch);
movePad.addEventListener("pointerleave", releaseTouch);

fireButton.addEventListener("pointerdown", (event) => {
  state.touch.firing = true;
  fireButton.setPointerCapture(event.pointerId);
});
fireButton.addEventListener("pointerup", () => { state.touch.firing = false; });
fireButton.addEventListener("pointerleave", () => { state.touch.firing = false; });

pauseButton.addEventListener("click", () => {
  if (!state.game) return;
  state.game.running = false;
  showOverlay("Paused", "Your run is temporarily on hold.", true);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.game && state.game.running) {
    state.game.running = false;
    showOverlay("Paused", "Your run is temporarily on hold.", true);
  }
});

window.addEventListener("resize", () => {
  canvas.width = Math.min(window.innerWidth, 1280);
  canvas.height = Math.min(window.innerHeight, 720);
  if (state.game) {
    state.game.player.x = clamp(state.game.player.x, 10, canvas.width - 10);
    state.game.player.y = clamp(state.game.player.y, 10, canvas.height - 10);
  }
});

window.addEventListener("pointerdown", () => ensureAudio(), { passive: true });

updateContinueButton();
showMenu();
requestAnimationFrame(tick);
