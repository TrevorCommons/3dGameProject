import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { Player } from './game/player.js';
import { createPath } from './game/path.js';
//import { isBuildable } from './game/tower.js';
import { Enemy } from './game/enemy.js';

// Constants
const TILE_SIZE = 1;
const GRID_SIZE = 50;

// Scene
const scene = new THREE.Scene();
// Use a neutral background so the horizon/sky doesn't show when we look straight down
scene.background = new THREE.Color(0x222222);

// Camera - orthographic top-down view so the horizon/sky can't be seen
let camera;
function createTopDownCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  // frustumHeight should comfortably fit the whole map
  const frustumHeight = GRID_SIZE + 6; // small margin around the grid
  const frustumWidth = frustumHeight * aspect;

  const left = -frustumWidth / 2;
  const right = frustumWidth / 2;
  const top = frustumHeight / 2;
  const bottom = -frustumHeight / 2;

  camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 500);
  // Place camera high above the scene and look straight down
  camera.position.set(0, 60, 0);
  camera.up.set(0, 0, -1); // orient forward along -Z so positive Z points 'down' on screen
  camera.lookAt(0, 0, 0);
}
createTopDownCamera();

// FIRST-PERSON CAMERA (attached to player)
let fpCamera = null;
let usingTopDown = true; // default to top-down for between-round view

function createFirstPersonCamera() {
  fpCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  // initial position will be updated each frame to follow player
}
createFirstPersonCamera();
// Camera toggle UI and keyboard + start round + crosshair
let cameraToggleBtn;
let startRoundBtn;
let crosshairEl;
let roundActive = false;

function setUsingTopDown(v) {
  // Prevent switching back to top-down during an active round
  if (roundActive && v === true) return;
  usingTopDown = v;
  // hide player model in FP, show in top-down
  if (typeof player !== 'undefined' && player && player.mesh) player.mesh.visible = usingTopDown;
  // show/hide crosshair if element exists
  if (typeof crosshairEl !== 'undefined' && crosshairEl) crosshairEl.style.display = usingTopDown ? 'none' : 'block';
  if (!usingTopDown) {
    // attempt to enter pointer lock for a proper FPS feel (must be user gesture in many browsers)
    try { if (typeof canvas !== 'undefined' && canvas && canvas.requestPointerLock) canvas.requestPointerLock(); } catch (e) {}
  } else {
    // exit pointer lock when returning to top-down
    try { if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
  }
}

// Pointer lock & mouse look state
let pointerLocked = false;
let yaw = 0; // rotation around Y
let pitch = 0; // rotation around X
const pitchLimit = Math.PI / 2 - 0.05;

function onPointerLockChange() {
  pointerLocked = document.pointerLockElement === canvas;
}
document.addEventListener('pointerlockchange', onPointerLockChange);

function onMouseMove(e) {
  if (!pointerLocked) return;
  const sensitivity = 0.0025;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  if (pitch > pitchLimit) pitch = pitchLimit;
  if (pitch < -pitchLimit) pitch = -pitchLimit;
}
document.addEventListener('mousemove', onMouseMove);

// Renderer
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);


// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.BoxGeometry(GRID_SIZE, 1, GRID_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.y = -0.5; // so top of ground is at y=0
scene.add(ground);

const {pathTiles, tiles, grid, pathCoords} = createPath(scene);

// Use pathCoords directly for enemy movement
// Enemy wave logic
const enemies = [];
let enemiesRemainingEl = null;

function updateEnemiesRemaining() {
  if (typeof enemiesRemainingEl === 'undefined' || enemiesRemainingEl === null) return;
  enemiesRemainingEl.textContent = enemies.length.toString();
}
function spawnWave(numEnemies) {
  for (let i = 0; i < numEnemies; i++) {
    const enemy = new Enemy(pathCoords, scene);
    // Stagger spawn by offsetting their starting progress
    enemy.progress = -i * 0.5;
    // If a cave spawn position exists, place enemy inside cave initially
    if (typeof caveSpawnPos !== 'undefined' && caveSpawnPos) {
      enemy.mesh.position.set(caveSpawnPos.x, caveSpawnPos.y, caveSpawnPos.z);
    }
    enemies.push(enemy);
  }
  updateEnemiesRemaining();
}

// Wave progress tracking
let waveNumber = 1;
let currentWaveTotal = 0;
let waveEl = null;
let waveProgressBar = null;

function startWave(numEnemies) {
  currentWaveTotal = numEnemies;
  updateWaveUI();
  // pulse the enemies counter to draw attention
  if (enemiesRemainingEl) {
    enemiesRemainingEl.classList.remove('pulse');
    // force reflow to restart animation
    void enemiesRemainingEl.offsetWidth;
    enemiesRemainingEl.classList.add('pulse');
  }
  spawnWave(numEnemies);
}

function updateWaveUI() {
  if (waveEl) waveEl.textContent = waveNumber.toString();
  if (waveProgressBar) {
    const remaining = enemies.length;
    const pct = currentWaveTotal > 0 ? ((currentWaveTotal - remaining) / currentWaveTotal) * 100 : 0;
    waveProgressBar.style.width = pct + '%';
  }
}



// need to add some substance to the map (trees, rocks, castle, etc.)
function addDecorations(scene, grid) {
  const treeGeometry = new THREE.ConeGeometry(2, 5, 12);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
  const rockGeometry = new THREE.DodecahedronGeometry(0.8);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      // Skip path tiles
      if (grid[y][x] === 1) continue;

      const rand = Math.random();
      if (rand < 0.05) {
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.set(x - GRID_SIZE / 2, 0.75, y - GRID_SIZE / 2);
        scene.add(tree);
      } else if (rand < 0.08) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x - GRID_SIZE / 2, 0.25, y - GRID_SIZE / 2);
        scene.add(rock);
      }
    }
  }
}
addDecorations(scene, grid);

// Deterministic, gapless mountain ranges on left and right edges
function addMountainRanges(scene) {
  const half = GRID_SIZE / 2;
  const leftX = -half - 1.5;   // place mountains just outside the playable area
  const rightX = half + 1.5;
  const count = GRID_SIZE + 2; // one per tile plus a little extra to cover edges

  const baseHeight = 4;
  const heightRange = 6;
  const baseRadius = 1.5; // large radius to ensure overlap and no gaps

  for (let i = -1; i <= GRID_SIZE; i++) {
    // Deterministic variation using sine so it's the same every run
    const t = i / GRID_SIZE;
    const height = baseHeight + Math.abs(Math.sin(t * Math.PI * 2)) * heightRange;
    const radius = baseRadius + Math.abs(Math.cos(t * Math.PI)) * 0.8;
    const geom = new THREE.ConeGeometry(radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a }); // brownish

    // Position along Z to cover the whole edge continuously
    const z = (i) - (GRID_SIZE - 1) / 2;

    const leftPeak = new THREE.Mesh(geom, mat);
    leftPeak.position.set(leftX, height / 2 - 0.5, z);
    scene.add(leftPeak);

    const rightPeak = new THREE.Mesh(geom.clone(), mat.clone());
    rightPeak.position.set(rightX, height / 2 - 0.5, z);
    scene.add(rightPeak);
  }
}

addMountainRanges(scene);

// Add entrance-side mountain range with a cave opening aligned to the path start
let caveSpawnPos = null;
function addEntranceRangeWithCave(scene, pathCoords) {
  const half = GRID_SIZE / 2;
  const topZ = -half - 1.5; // just outside the playable area

  // Determine cave center from first path tile
  const start = pathCoords[0];
  const caveCenterX = start.x - half; // world x coordinate offset
  const caveZ = start.y - half - 0.5; // slightly outside

  // Create continuous peaks across X but leave a gap around cave
  const caveWidthTiles = 3; // number of tiles to leave open for cave
  for (let x = 0; x < GRID_SIZE; x++) {
    // Skip peaks inside cave area
    if (Math.abs(x - start.x) <= caveWidthTiles) continue;

    const t = x / GRID_SIZE;
    const height = 3 + Math.abs(Math.sin(t * Math.PI * 2)) * 5;
    const radius = 1.5 + Math.abs(Math.cos(t * Math.PI)) * 1.2;
    const geom = new THREE.ConeGeometry(radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5b4636 });

    const z = topZ + (Math.random() - 0.5) * 0.4; // small jitter
    const worldX = x - half;

    const peak = new THREE.Mesh(geom, mat);
    peak.position.set(worldX, height / 2 - 0.5, z);
    scene.add(peak);
  }

  // Build a simple cave entrance: two pillars and a lintel
  const pillarGeom = new THREE.BoxGeometry(1.4, 3, 1.4);
  const lintelGeom = new THREE.BoxGeometry(caveWidthTiles * 1.2 + 1.4, 1.2, 1.4);
  const caveMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });

  const leftPillar = new THREE.Mesh(pillarGeom, caveMat);
  const rightPillar = new THREE.Mesh(pillarGeom, caveMat);
  const lintel = new THREE.Mesh(lintelGeom, caveMat);

  const pillarXOffset = (caveWidthTiles / 2) + 0.6;
  leftPillar.position.set(caveCenterX - pillarXOffset, 1.0, caveZ);
  rightPillar.position.set(caveCenterX + pillarXOffset, 1.0, caveZ);
  lintel.position.set(caveCenterX, 2.2, caveZ);

  scene.add(leftPillar);
  scene.add(rightPillar);
  scene.add(lintel);

  // Save cave spawn position slightly behind the lintel so enemies appear inside
  caveSpawnPos = { x: caveCenterX, y: 0.5, z: caveZ - 1.0 };

  // Add a dark interior box so enemies look like they're emerging from darkness
  const interiorWidth = caveWidthTiles * 1.2 + 0.6;
  const interiorHeight = 2.2;
  const interiorDepth = 2.2;
  const darkGeom = new THREE.BoxGeometry(interiorWidth, interiorHeight, interiorDepth);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const darkBox = new THREE.Mesh(darkGeom, darkMat);
  // Position the box slightly inside the cave (behind the lintel)
  darkBox.position.set(caveCenterX, interiorHeight / 2 - 0.5, caveZ - 1.4);
  scene.add(darkBox);
}

addEntranceRangeWithCave(scene, pathCoords);

// Castle
const castleGeometry = new THREE.BoxGeometry(3, 3, 3);
const castleMaterial = new THREE.MeshStandardMaterial({ color: 0x777777 });
const castle = new THREE.Mesh(castleGeometry, castleMaterial);
const endTile = pathCoords[pathCoords.length - 1];
castle.position.set(endTile.x - GRID_SIZE / 2, 1.5, endTile.y - GRID_SIZE / 2);
scene.add(castle);

// Add exit battlement and corner towers aligned to the path end
addExitBattlement(scene, pathCoords);

function addExitBattlement(scene, pathCoords) {
  const half = GRID_SIZE / 2;

  // Determine entrance location from the first path tile so we place the battlement
  // on the opposite side (exit side). This makes the wall consistently opposite the cave.
  const start = pathCoords[0];
  const dx = start.x - half;
  const dy = start.y - half;

  let entranceSide;
  if (Math.abs(dx) > Math.abs(dy)) {
    entranceSide = dx < 0 ? 'left' : 'right';
  } else {
    entranceSide = dy < 0 ? 'top' : 'bottom';
  }

  // Choose the opposite side for the exit battlement
  let targetSide;
  if (entranceSide === 'left') targetSide = 'right';
  else if (entranceSide === 'right') targetSide = 'left';
  else if (entranceSide === 'top') targetSide = 'bottom';
  else targetSide = 'top';

  const wallHeight = 2.2;
  const wallThickness = 1.2;
  const wallLength = GRID_SIZE + 2; // a little extra to cover corners

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const crenelMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });

  let wall;

  if (targetSide === 'left' || targetSide === 'right') {
    const isLeft = targetSide === 'left';
    const x = isLeft ? -half - 0.8 : half + 0.8;
    const geom = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(x, wallHeight / 2 - 0.5, 0);
    scene.add(wall);

    // Crenellations along Z
    const crenelW = wallThickness + 0.02;
    const crenelH = 0.8;
    const crenelD = 1.0;
    for (let i = 0; i < GRID_SIZE; i++) {
      const z = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Corner towers at the two ends of the wall
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerZ = -half + 0.5;
    const rightTowerZ = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(x, towerHeight / 2 - 0.5, leftTowerZ);
    towerRight.position.set(x, towerHeight / 2 - 0.5, rightTowerZ);
    scene.add(towerLeft);
    scene.add(towerRight);

  } else if (targetSide === 'top' || targetSide === 'bottom') {
    const isTop = targetSide === 'top';
    const z = isTop ? -half - 0.8 : half + 0.8;
    const geom = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(0, wallHeight / 2 - 0.5, z);
    scene.add(wall);

    // Crenellations along X
    const crenelW = 1.0;
    const crenelH = 0.8;
    const crenelD = wallThickness + 0.02;
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Corner towers at the two ends of the wall
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerX = -half + 0.5;
    const rightTowerX = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(leftTowerX, towerHeight / 2 - 0.5, z);
    towerRight.position.set(rightTowerX, towerHeight / 2 - 0.5, z);
    scene.add(towerLeft);
    scene.add(towerRight);
  } else {
    // Fallback: bottom
    const z = half + 0.8;
    const geom = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(0, wallHeight / 2 - 0.5, z);
    scene.add(wall);

    // Simple crenellations
    const crenelW = 1.0;
    const crenelH = 0.8;
    const crenelD = wallThickness + 0.02;
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Towers
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerX = -half + 0.5;
    const rightTowerX = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(leftTowerX, towerHeight / 2 - 0.5, z);
    towerRight.position.set(rightTowerX, towerHeight / 2 - 0.5, z);
    scene.add(towerLeft);
    scene.add(towerRight);
  }
}

// Sun
const sunGeometry = new THREE.CircleGeometry(1.5, 20, 15);
const sunMaterial = new THREE.MeshStandardMaterial({ color: 0xFFF200 });
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
const eastX = GRID_SIZE - 1;
const eastZ = Math.floor(GRID_SIZE / 2);
sun.position.set(
  eastX - GRID_SIZE / 2, // x
  20,                    // y
  eastZ - GRID_SIZE / 2  // z
);
scene.add(sun);


// Player
// Compute playable area bounds based on GRID_SIZE and tile placement (ground centered at 0)
const half = GRID_SIZE / 2;
const bounds = {
  minX: -half + 0.5,
  maxX: half - 0.5,
  minZ: -half + 0.5,
  maxZ: half - 0.5,
};
const player = new Player(bounds);
player.mesh.position.y = 1; // raise above ground
scene.add(player.mesh);

// Player movement
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Now that canvas, renderer and player exist, wire up UI elements and events
cameraToggleBtn = document.getElementById('cameraToggle');
startRoundBtn = document.getElementById('startRound');
crosshairEl = document.getElementById('crosshair');
enemiesRemainingEl = document.getElementById('enemiesRemaining');
// Assign wave UI refs
waveProgressBar = document.getElementById('waveProgressBar');
waveEl = document.getElementById('wave');
// initialize UI text
updateEnemiesRemaining();
updateWaveUI();

// Gold UI
const goldEl = document.getElementById('gold');
let gold = goldEl ? parseInt(goldEl.textContent || '0', 10) : 0;

// Attack configuration
const ATTACK_RANGE = 1.8; // world units
const ATTACK_DAMAGE = 4;
const ATTACK_COOLDOWN = 600; // ms
let lastAttackAt = 0;

function addGold(amount) {
  gold += amount;
  if (goldEl) goldEl.textContent = gold.toString();
}

function attemptAttack() {
  if (usingTopDown) return; // only allow attacks in first-person
  const now = performance.now();
  if (now - lastAttackAt < ATTACK_COOLDOWN) return; // cooldown
  lastAttackAt = now;

  // find the nearest alive enemy within ATTACK_RANGE
  let nearest = null;
  let nearestDist = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || !e.mesh) continue;
    if (e.health <= 0) continue;
    const dx = e.mesh.position.x - player.mesh.position.x;
    const dz = e.mesh.position.z - player.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= ATTACK_RANGE && dist < nearestDist) {
      nearest = { enemy: e, index: i, dist };
      nearestDist = dist;
    }
  }

  if (!nearest) return; // nothing in range

  // Deal damage
  const result = nearest.enemy.takeDamage(ATTACK_DAMAGE);

  // Visual feedback: scale up briefly and flash
  const origScale = nearest.enemy.mesh.scale.clone();
  nearest.enemy.mesh.scale.set(origScale.x * 1.25, origScale.y * 1.25, origScale.z * 1.25);
  const origColor = nearest.enemy.mesh.material.color.getHex();
  nearest.enemy.mesh.material.color.setHex(0xffff66);
  setTimeout(() => {
    if (nearest && nearest.enemy && nearest.enemy.mesh) {
      nearest.enemy.mesh.scale.copy(origScale);
      nearest.enemy.mesh.material.color.setHex(origColor);
    }
  }, 180);

  // If defeated, process rewards and remove enemy
  if (result) {
    const coins = result.coins || 0;
    addGold(coins);
    scene.remove(nearest.enemy.mesh);
    const idx = enemies.indexOf(nearest.enemy);
    if (idx !== -1) enemies.splice(idx, 1);
    updateEnemiesRemaining();
    updateWaveUI();
  }
}

// Mouse and keyboard attack handlers
if (canvas) {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) attemptAttack();
  });
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    attemptAttack();
    e.preventDefault();
  }
});

if (cameraToggleBtn) cameraToggleBtn.addEventListener('click', () => setUsingTopDown(!usingTopDown));
if (startRoundBtn) startRoundBtn.addEventListener('click', () => {
  if (roundActive) return;
  roundActive = true;
  setUsingTopDown(false);
  startWave(6);
});
// Keyboard shortcut to start round: Enter or R
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key.toLowerCase() === 'r') && !roundActive) {
    roundActive = true;
    setUsingTopDown(false);
    startWave(6);
  }
});
document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'c') setUsingTopDown(!usingTopDown); });

function handlePlayerMovement() {
  // If in first-person, move relative to camera yaw
  if (!usingTopDown && fpCamera) {
    const moveSpeed = player.speed;
    let forward = 0;
    let right = 0;
    if (keys['w'] || keys['ArrowUp']) forward += 1;
    if (keys['s'] || keys['ArrowDown']) forward -= 1;
    if (keys['d'] || keys['ArrowRight']) right += 1;
    if (keys['a'] || keys['ArrowLeft']) right -= 1;

    if (forward !== 0 || right !== 0) {
      // Compute direction in world space from yaw
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);
      // forward vector (z negative is forward in this world setup)
      const fx = -sinY * forward;
      const fz = -cosY * forward;
      // right vector
      const rx = cosY * right;
      const rz = -sinY * right;

      const dx = (fx + rx) * moveSpeed;
      const dz = (fz + rz) * moveSpeed;
      player.mesh.position.x += dx;
      player.mesh.position.z += dz;
      player.clampPosition();
    }
    return;
  }

  // top-down movement (grid-aligned)
  if (keys['w'] || keys['ArrowUp']) player.move('up');
  if (keys['s'] || keys['ArrowDown']) player.move('down');
  if (keys['a'] || keys['ArrowLeft']) player.move('left');
  if (keys['d'] || keys['ArrowRight']) player.move('right');
}

// Animate
function animate() {
  requestAnimationFrame(animate);
  handlePlayerMovement();
  // Update first-person camera to follow player if active
  if (fpCamera && player) {
    // Apply yaw/pitch to the fpCamera orientation
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Place camera slightly in front of the player's head so player geometry is not visible
    const forwardOffset = 0.35; // small forward offset
    const camX = player.mesh.position.x - sinY * forwardOffset;
    const camZ = player.mesh.position.z - cosY * forwardOffset;
    const camY = player.mesh.position.y + 1.2;
    fpCamera.position.set(camX, camY, camZ);

    // Build a quaternion from yaw/pitch and apply to camera
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    quat.setFromEuler(euler);
    fpCamera.quaternion.copy(quat);
  }
  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    enemies[i].update();
    // Remove enemy if it reached the end
    if (enemies[i].currentStep >= enemies[i].pathCoords.length - 1) {
      scene.remove(enemies[i].mesh);
      enemies.splice(i, 1);
      updateEnemiesRemaining();
    }
  }

  // If a round is active and there are no more enemies, end the round
  if (roundActive && enemies.length === 0) {
    roundActive = false;
    // advance wave count and reset progress
    waveNumber += 1;
    currentWaveTotal = 0;
    if (waveProgressBar) waveProgressBar.style.width = '0%';
    updateWaveUI();
    setUsingTopDown(true);
  }
  // Choose the active camera each frame
  const activeCam = usingTopDown ? camera : fpCamera;
  renderer.render(scene, activeCam);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  // Recreate the orthographic frustum to match new aspect
  createTopDownCamera();
  // Update perspective camera aspect as well
  if (fpCamera) {
    fpCamera.aspect = window.innerWidth / window.innerHeight;
    fpCamera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});