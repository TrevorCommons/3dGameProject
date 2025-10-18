import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { Player } from './game/player.js';
import { createPath } from './game/path.js';
import { Enemy } from './game/enemy.js';
import { LOOT_DEFS, Loot, loadPersistentState, savePersistentState } from './game/loot.js';
import { HealerTower, MageTower, ArcherTower } from './game/tower.js';

// Tower selection
let selectedTowerType = null; // "Healer", "Mage", "Archer"
let towers = []; // store all placed towers
let selectedTowerId = null; // persistent 'focused' tower id
// Ghost preview for tower placement
let ghostMesh = null;
let lastMouse = { x: 0, y: 0 };

document.addEventListener("DOMContentLoaded", () => {
  const healerBtn = document.getElementById("selectHealer");
  const mageBtn = document.getElementById("selectMage");
  const archerBtn = document.getElementById("selectArcher");

  function clearTowerButtonSelection() {
    [healerBtn, mageBtn, archerBtn].forEach(b => { if (b) b.classList.remove('tower-btn-selected'); });
  }

  if (healerBtn) healerBtn.addEventListener("click", () => {
    // toggle selection: clicking again cancels placement
    if (selectedTowerType === 'Healer') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Healer";
      clearTowerButtonSelection();
      healerBtn.classList.add('tower-btn-selected');
      createGhost('Healer');
    }
  });

  if (mageBtn) mageBtn.addEventListener("click", () => {
    if (selectedTowerType === 'Mage') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Mage";
      clearTowerButtonSelection();
      mageBtn.classList.add('tower-btn-selected');
      createGhost('Mage');
    }
  });

  if (archerBtn) archerBtn.addEventListener("click", () => {
    if (selectedTowerType === 'Archer') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Archer";
      clearTowerButtonSelection();
      archerBtn.classList.add('tower-btn-selected');
      createGhost('Archer');
    }
  });
});

// --- Ghost preview helpers ---
function createGhost(type) {
  removeGhost();
  let geom, color;
  switch ((type || '').toLowerCase()) {
    case 'healer': geom = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); color = 0x00ff00; break;
    case 'mage': geom = new THREE.ConeGeometry(0.5, 1, 12); color = 0x8000ff; break;
    case 'archer': geom = new THREE.BoxGeometry(0.5, 1, 0.5); color = 0xff0000; break;
    default: return;
  }
  const mat = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: 0.55, depthWrite: false });
  ghostMesh = new THREE.Mesh(geom, mat);
  ghostMesh.renderOrder = 999;
  ghostMesh.visible = true;
  scene.add(ghostMesh);
}

function removeGhost() {
  if (!ghostMesh) return;
  try { scene.remove(ghostMesh); } catch (e) {}
  ghostMesh = null;
}

function isPlacementValid(gridX, gridY) {
  // Bounds check
  if (gridX < 0 || gridY < 0 || gridX >= GRID_SIZE || gridY >= GRID_SIZE) return false;
  // Can't place on path tiles (grid value 1 is path)
  if (grid && grid[gridY] && grid[gridY][gridX] === 1) return false;
  // Can't place where an existing tower occupies
  for (const t of towers) {
    const g = towerWorldToGrid(t);
    if (!g) continue;
    if (g.x === gridX && g.y === gridY) return false;
  }
  return true;
}

function updateGhostFromMouse(clientX, clientY) {
  if (!ghostMesh || !selectedTowerType) return;
  // compute NDC coords
  const ndc = new THREE.Vector2();
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(ground);
  if (hits.length === 0) {
    ghostMesh.visible = false;
    return;
  }
  const pt = hits[0].point;
  const gx = Math.round(pt.x + GRID_SIZE/2);
  const gy = Math.round(pt.z + GRID_SIZE/2);
  const worldX = (gx - GRID_SIZE/2) + 0.5;
  const worldZ = (gy - GRID_SIZE/2) + 0.5;
  ghostMesh.position.set(worldX, 0.5, worldZ);
  ghostMesh.visible = true;

  // indicate validity by tinting color/emissive
  const valid = isPlacementValid(gx, gy);
  try {
    if (valid) {
      ghostMesh.material.color.setHex(0x88ff88);
      ghostMesh.material.opacity = 0.55;
    } else {
      ghostMesh.material.color.setHex(0xff8888);
      ghostMesh.material.opacity = 0.45;
    }
  } catch (e) {}
}

// Track last mouse position for animate loop updates
window.addEventListener('mousemove', (ev) => {
  lastMouse.x = ev.clientX;
  lastMouse.y = ev.clientY;
  // update ghost position live when top-down and a ghost exists
  if (selectedTowerType && ghostMesh && usingTopDown) updateGhostFromMouse(ev.clientX, ev.clientY);
});


// Constants
const TILE_SIZE = 1;
const GRID_SIZE = 50;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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
const lootInstances = [];
let persistentState = loadPersistentState();
let lootSpawnedThisRound = false;
let enemiesRemainingEl = null;
// Castle health
let castleHealth = 10;
let castleHealthEl = null;

function updateEnemiesRemaining() {
  if (typeof enemiesRemainingEl === 'undefined' || enemiesRemainingEl === null) return;
  enemiesRemainingEl.textContent = enemies.length.toString();
}

function updateCastleHealthUI() {
  if (castleHealthEl) castleHealthEl.textContent = castleHealth.toString();
}
function spawnWave(numEnemies) {
  // Choose a random loot definition for this wave (weighted by rarity could be added)
  const lootKeys = Object.keys(LOOT_DEFS);
  const chosenLootKey = lootKeys[Math.floor(Math.random() * lootKeys.length)];
  const carryIndex = Math.floor(Math.random() * numEnemies);
  lootSpawnedThisRound = false;

  for (let i = 0; i < numEnemies; i++) {
    const carriesLootId = (i === carryIndex) ? chosenLootKey : null;
    const enemy = new Enemy(pathCoords, scene, { carriesLootId });
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

  const avoidRadius = 3; // tiles away from path to avoid

  // Collect all path coordinates
  const pathTiles = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === 1) {
        pathTiles.push({ x, y });
      }
    }
  }

  // Helper to check if (x, y) is too close to a path tile
  function isNearPath(x, y) {
    for (const tile of pathTiles) {
      const dx = x - tile.x;
      const dy = y - tile.y;
      if (Math.sqrt(dx * dx + dy * dy) <= avoidRadius) {
        return true;
      }
    }
    return false;
  }

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      // Skip path tiles
      if (grid[y][x] === 1) continue;
      if (isNearPath(x, y)) continue;

      const rand = Math.random();
      if (rand < 0.05) {
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.set((x - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2, 0.75, (y - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2);
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

const player = new Player(fpCamera, bounds);
player.mesh.position.y = 1; // raise above ground
scene.add(player.mesh);
player.enemies = enemies;

// Player movement
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Start menu handling
const startMenu = document.getElementById('startMenu');
const startGameBtn = document.getElementById('startGameBtn');

function resetGameState() {
  // Reset castle, waves, towers, enemies, loot, and persistent upgrades
  // remove any lingering game over overlay
  try {
    const existingOverlay = document.getElementById('gameOverOverlay');
    if (existingOverlay && existingOverlay.parentNode) existingOverlay.parentNode.removeChild(existingOverlay);
  } catch (e) {}
  castleHealth = 10;
  persistentState = { player: { upgrades: [] }, towers: {} };
  savePersistentState(persistentState);
  // remove enemies and loot from scene
  enemies.forEach(e => { try { scene.remove(e.mesh); } catch (e) {} });
  enemies.length = 0;
  lootInstances.forEach(li => { try { li.dispose(); } catch (e) {} });
  lootInstances.length = 0;
  // remove towers from scene
  towers.forEach(t => { try { if (t.mesh) scene.remove(t.mesh); } catch (e) {} });
  towers.length = 0;
  // reset UI
  waveNumber = 1;
  currentWaveTotal = 0;
  waveProgressBar && (waveProgressBar.style.width = '0%');
  updateEnemiesRemaining();
  updateWaveUI();
  updateCastleHealthUI();
  refreshUpgradesUI();
}

function startGame() {
  // hide start menu and reset state
  if (startMenu) startMenu.style.display = 'none';
  resetGameState();
  roundActive = false;
  setUsingTopDown(true);
}

if (startGameBtn) startGameBtn.addEventListener('click', () => startGame());

// Now that canvas, renderer and player exist, wire up UI elements and events
cameraToggleBtn = document.getElementById('cameraToggle');
startRoundBtn = document.getElementById('startRound');
crosshairEl = document.getElementById('crosshair');
enemiesRemainingEl = document.getElementById('enemiesRemaining');
// castle health element
castleHealthEl = document.getElementById('castleHealth');
// Assign wave UI refs
waveProgressBar = document.getElementById('waveProgressBar');
waveEl = document.getElementById('wave');
// initialize UI text
updateEnemiesRemaining();
updateWaveUI();
updateCastleHealthUI();

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

function findNearestTowerToPlayer() {
  if (towers.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const t of towers) {
    const dx = (t.mesh.position.x || 0) - player.mesh.position.x;
    const dz = (t.mesh.position.z || 0) - player.mesh.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

function ensureTowerId(tower) {
  if (!tower._id) tower._id = 'tower_' + Math.random().toString(36).slice(2,9);
  if (!persistentState.towers) persistentState.towers = {};
  if (!persistentState.towers[tower._id]) persistentState.towers[tower._id] = [];
  return tower._id;
}

// Helper: convert a tower's world position to grid coords for friendly labeling
function towerWorldToGrid(tower) {
  if (!tower || !tower.mesh) return null;
  const gx = Math.round(tower.mesh.position.x + GRID_SIZE/2);
  const gy = Math.round(tower.mesh.position.z + GRID_SIZE/2);
  return { x: gx, y: gy };
}

// Highlight a tower briefly in-world by changing material/emissive and scaling
function highlightTowerById(tid) {
  const t = towers.find(x => x._id === tid);
  if (!t) {
    console.log(`No tower found with id ${tid}`);
    return;
  }
  if (!t.mesh) return;
  // preserve original state (scale + material color/emissive)
  const origScale = t.mesh.scale.clone();
  const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
  const origEmissives = mats.map(m => (m && m.emissive ? m.emissive.clone() : null));
  const origColors = mats.map(m => (m && m.color ? m.color.clone() : null));

  // apply highlight (best-effort)
  try {
    t.mesh.scale.set(origScale.x * 1.18, origScale.y * 1.18, origScale.z * 1.18);
    mats.forEach(m => {
      if (!m) return;
      if ('emissive' in m && m.emissive) m.emissive.setHex(0xFFFF66);
      else if ('color' in m && m.color) m.color.setHex(0xFFFF66);
    });
  } catch (e) { /* ignore if material not compatible */ }

  // revert after a short pulse, restoring both emissive and color when available
  setTimeout(() => {
    try {
      if (!t.mesh) return;
      t.mesh.scale.copy(origScale);
      mats.forEach((m, idx) => {
        if (!m) return;
        // restore emissive if we saved one
        if (origEmissives[idx] && 'emissive' in m && m.emissive) {
          m.emissive.copy(origEmissives[idx]);
        } else if (origColors[idx] && 'color' in m && m.color) {
          // if emissive wasn't used, restore color
          m.color.copy(origColors[idx]);
        }
      });
    } catch (e) { /* ignore restore errors */ }
  }, 1200);
}

function selectTowerById(tid) {
  selectedTowerId = tid;
  // ensure top-down to view selection and highlight persistently
  setUsingTopDown(true);
  const t = towers.find(x => x._id === tid);
  if (t && t.mesh) {
    // store original scale and material colors/emissive so we can restore later
    try {
      if (!t._origScale) t._origScale = t.mesh.scale.clone();
      const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
      if (!t._origMaterials) {
        t._origMaterials = mats.map(m => ({ color: m && m.color ? m.color.clone() : null, emissive: m && m.emissive ? m.emissive.clone() : null }));
      }
      // small persistent visual indicator while selected (based on original scale)
      t.mesh.scale.set(t._origScale.x * 1.08, t._origScale.y * 1.08, t._origScale.z * 1.08);
    } catch (e) { /* ignore */ }
  }
}

function clearTowerSelection() {
  if (!selectedTowerId) return;
  const t = towers.find(x => x._id === selectedTowerId);
  if (t && t.mesh) {
    // restore original scale and material colors/emissive (best-effort)
    try {
      if (t._origScale) t.mesh.scale.copy(t._origScale);
      const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
      if (t._origMaterials) {
        mats.forEach((m, idx) => {
          const orig = t._origMaterials[idx];
          if (!m || !orig) return;
          if (orig.emissive && 'emissive' in m && m.emissive) m.emissive.copy(orig.emissive);
          if (orig.color && 'color' in m && m.color) m.color.copy(orig.color);
        });
      }
      // cleanup stored originals if desired (keep for repeated focus)
      // delete t._origScale; delete t._origMaterials;
    } catch (e) { /* ignore restore errors */ }
  }
  selectedTowerId = null;
  // revert camera to default top-down position (centered)
  createTopDownCamera();
}

function applyLootToPlayerOrTower(defId) {
  const def = LOOT_DEFS[defId];
  if (!def) return;
  if (def.target === 'player') {
    persistentState.player = persistentState.player || { upgrades: [] };
    // stacking check
    const existing = persistentState.player.upgrades.filter(u => u.id === defId).length;
    const cap = def.stackCapPlayer || 99;
    if (existing >= cap) return; // ignore if at cap
    persistentState.player.upgrades.push({ id: defId, appliedAt: Date.now() });
    // Apply immediate effect for player (e.g., damage multiplier)
    if (def.effect.type === 'mul_playerDamage') {
      player.baseDamage = (player.baseDamage || ATTACK_DAMAGE) * def.effect.value;
    }
    if (def.effect.type === 'add_goldPercent') {
      persistentState.player.goldBonus = (persistentState.player.goldBonus || 0) + def.effect.value;
    }
    // show UI feedback
    if (goldEl) {
      // simple feedback: console + gold text pulse
      console.log(`Player acquired ${def.name}`);
    }
  } else if (def.target === 'tower_individual') {
    const tower = findNearestTowerToPlayer();
    if (!tower) return;
    const tid = ensureTowerId(tower);
    const upgrades = persistentState.towers[tid] || [];
    const sameCount = upgrades.filter(u => u.id === defId).length;
    if (sameCount >= (def.stackCapPerTower || 1)) return; // at cap for this tower
    upgrades.push({ id: defId, appliedAt: Date.now() });
    persistentState.towers[tid] = upgrades;
    // apply effect to the tower object (best-effort; towers have different APIs)
    if (!tower._modifiers) tower._modifiers = {};
    if (def.effect.type === 'mul_damage') {
      tower._modifiers.damage = (tower._modifiers.damage || 1) * def.effect.value;
    }
    if (def.effect.type === 'mul_fireRate') {
      tower._modifiers.fireRate = (tower._modifiers.fireRate || 1) * def.effect.value;
    }
    console.log(`Applied ${def.name} to tower ${tid}`);
  }
}

// UI wiring for upgrades panel and loot modal
const upgradesPanel = document.getElementById('upgradesPanel');
const playerUpgradesList = document.getElementById('playerUpgradesList');
const towerUpgradesList = document.getElementById('towerUpgradesList');
const resetUpgradesBtn = document.getElementById('resetUpgrades');
const lootModal = document.getElementById('lootModal');
const lootModalContent = document.getElementById('lootModalContent');
const lootTowerList = document.getElementById('lootTowerList');
const lootCancelBtn = document.getElementById('lootCancel');

function refreshUpgradesUI() {
  const p = persistentState.player || { upgrades: [] };
  if (p.upgrades && p.upgrades.length > 0) {
    playerUpgradesList.textContent = p.upgrades.map(u => LOOT_DEFS[u.id].name).join(', ');
  } else playerUpgradesList.textContent = '(none)';

  // towers
  towerUpgradesList.innerHTML = '';
  if (persistentState.towers) {
    for (const tid of Object.keys(persistentState.towers)) {
      const ups = persistentState.towers[tid].map(u => LOOT_DEFS[u.id].name).join(', ');
      const el = document.createElement('div');
      el.textContent = `${tid}: ${ups}`;
      towerUpgradesList.appendChild(el);
    }
  }

  // Update persistent visible panel (always-on)
  const persistentPlayerEl = document.getElementById('persistentPlayerUpgradesList');
  const persistentTowersEl = document.getElementById('persistentTowersList');
  if (persistentPlayerEl) {
    if (p.upgrades && p.upgrades.length > 0) persistentPlayerEl.textContent = p.upgrades.map(u => LOOT_DEFS[u.id].name).join(', ');
    else persistentPlayerEl.textContent = '(none)';
  }
  if (persistentTowersEl) {
    persistentTowersEl.innerHTML = '';
    if (persistentState.towers) {
      for (const tid of Object.keys(persistentState.towers)) {
        const ups = persistentState.towers[tid].map(u => LOOT_DEFS[u.id].name).join(', ');
        const row = document.createElement('div');
        // try to find the live tower instance for friendly labeling
        const live = towers.find(tt => tt._id === tid);
        let label = tid;
        if (live) {
          const pos = towerWorldToGrid(live);
          label = `${live.constructor.name} (${pos.x},${pos.y}) [${tid}]`;
        } else {
          label = `${tid} (missing)`;
        }
        // content and focus button
        const text = document.createElement('span');
        text.textContent = `${label}: ${ups}`;
        text.style.marginRight = '8px';
        row.appendChild(text);
        const btn = document.createElement('button');
        btn.textContent = (selectedTowerId === tid) ? 'Unfocus' : 'Focus';
        btn.style.marginLeft = '6px';
        btn.addEventListener('click', () => {
          if (selectedTowerId === tid) {
            // currently focused -> unfocus
            clearTowerSelection();
            btn.textContent = 'Focus';
          } else {
            // focus this tower
            // clear previous selection first
            clearTowerSelection();
            selectTowerById(tid);
            highlightTowerById(tid);
            btn.textContent = 'Unfocus';
            // center camera on tower if live
            if (live && camera) {
              camera.position.set(live.mesh.position.x, camera.position.y, live.mesh.position.z + 0.01);
              camera.lookAt(live.mesh.position.x, 0, live.mesh.position.z);
            }
          }
        });
        row.appendChild(btn);
        persistentTowersEl.appendChild(row);
      }
    }
  }
}

// Upgrades open button removed from UI; panel can still be toggled via code if needed

if (resetUpgradesBtn) resetUpgradesBtn.addEventListener('click', () => {
  persistentState = { player: { upgrades: [] }, towers: {} };
  savePersistentState(persistentState);
  // Reset runtime modifiers
  for (const t of towers) t._modifiers = {};
  refreshUpgradesUI();
});

if (lootCancelBtn) lootCancelBtn.addEventListener('click', () => { lootModal.style.display = 'none'; });

function openLootModalForTowerSelection(defId) {
  lootTowerList.innerHTML = '';
  // Create list of towers with buttons to choose
  towers.forEach((t, idx) => {
    const b = document.createElement('button');
    b.textContent = `Apply to ${t.constructor.name} (${idx})`;
    b.addEventListener('click', () => {
      // ensure tower id
      ensureTowerId(t);
      // directly apply to tower id (applyLootToPlayerOrTower will find nearest - but we want specific)
      // instead, apply modifiers here
      const def = LOOT_DEFS[defId];
      const tid = t._id;
      const upgrades = persistentState.towers[tid] || [];
      const sameCount = upgrades.filter(u => u.id === defId).length;
      if (sameCount >= (def.stackCapPerTower || 1)) return;
      upgrades.push({ id: defId, appliedAt: Date.now() });
      persistentState.towers[tid] = upgrades;
      if (!t._modifiers) t._modifiers = {};
      if (def.effect.type === 'mul_damage') t._modifiers.damage = (t._modifiers.damage || 1) * def.effect.value;
      if (def.effect.type === 'mul_fireRate') t._modifiers.fireRate = (t._modifiers.fireRate || 1) * def.effect.value;
      savePersistentState(persistentState);
      lootModal.style.display = 'none';
      refreshUpgradesUI();
    });
    lootTowerList.appendChild(b);
  });
  if (towers.length === 0) {
    lootTowerList.textContent = 'No towers placed yet. Place a tower and return to apply.';
  }
  lootModal.style.display = 'flex';
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

  // Deal damage (use player.baseDamage if persistent upgrade applied)
  const damageToDeal = player.baseDamage || ATTACK_DAMAGE;
  const result = nearest.enemy.takeDamage(damageToDeal);

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
    // If this enemy dropped loot, spawn the pickup (only one per round allowed)
    if (result.loot && !lootSpawnedThisRound) {
      const lootId = result.loot.id || null;
      const pos = result.loot.pos || { x: nearest.enemy.mesh.position.x, y: nearest.enemy.mesh.position.y, z: nearest.enemy.mesh.position.z };
      // If lootId is null, pick random from LOOT_DEFS
      const finalLootId = lootId || Object.keys(LOOT_DEFS)[Math.floor(Math.random() * Object.keys(LOOT_DEFS).length)];
      const li = new Loot(scene, finalLootId, pos, null);
      lootInstances.push(li);
      lootSpawnedThisRound = true;
    }
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

//Towers
let towersBuiltThisRound = 0;
let towerLimitPerRound = 1;



function buildTower(type, x, y) {
  if (towersBuiltThisRound >= towerLimitPerRound) return; // limit per round
  type = type.toLowerCase(); // normalize

  let tower;
  switch(type) {
    case "healer": tower = new HealerTower(x, y, scene); break;
    case "mage":   tower = new MageTower(x, y, scene); break;
    case "archer": tower = new ArcherTower(x, y, scene); break;
    default: return;
  }

  towers.push(tower);
  towersBuiltThisRound++;
}

function getGridCoordsFromClick(mouseX, mouseY) {
  // Use raycasting in THREE.js
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  mouse.x = (mouseX / window.innerWidth) * 2 - 1;
  mouse.y = -(mouseY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
    const point = intersects[0].point;
    const x = Math.round(point.x + GRID_SIZE/2);
    const y = Math.round(point.z + GRID_SIZE/2);
    buildTower(selectedTowerType, x, y);
    selectedTowerType = null;
  }
  return null;
}

window.addEventListener("click", (event) => {
  if (!selectedTowerType) return; if (towersBuiltThisRound >= towerLimitPerRound) {
    console.log("Tower limit reached for this round");
    return;
  }

  // Convert mouse coordinates to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Assuming 'ground' is your THREE.Mesh plane
  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
      const point = intersects[0].point;

      // Snap to grid
      const x = Math.round(point.x + GRID_SIZE/2);
      const y = Math.round(point.z + GRID_SIZE/2);

    // Validate placement
    if (!isPlacementValid(x, y)) {
    console.log('Invalid placement at', x, y);
    return;
    }

    let tower;
    if (selectedTowerType === "Healer") {
      tower = new HealerTower(x, y, scene);
    } else if (selectedTowerType === "Mage") {
      tower = new MageTower(x, y, scene);
    } else if (selectedTowerType === "Archer") {
      tower = new ArcherTower(x, y, scene);
    }

    towers.push(tower);
    towersBuiltThisRound++; // increment here!
  // reset after placing
  selectedTowerType = null;
  // clear selected button state
  const healerBtn = document.getElementById("selectHealer");
  const mageBtn = document.getElementById("selectMage");
  const archerBtn = document.getElementById("selectArcher");
  [healerBtn, mageBtn, archerBtn].forEach(b => { if (b) b.classList.remove('tower-btn-selected'); });
  // remove ghost if present
  removeGhost();
      console.log(`${tower.constructor.name} placed at (${x},${y})`);
  }
});


// For swinging sword
const clock = new THREE.Clock();

// Animate
function animate() {
  requestAnimationFrame(animate);
  handlePlayerMovement();
  const delta = clock.getDelta(); // seconds since last frame

  player.update(delta);

  renderer.render(scene, camera);

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
    // Remove enemy if it reached the end -> damage castle
    if (enemies[i].currentStep >= enemies[i].pathCoords.length - 1) {
      // remove visual
      scene.remove(enemies[i].mesh);
      enemies.splice(i, 1);
      // damage castle
      castleHealth = Math.max(0, castleHealth - 1);
      updateCastleHealthUI();
      updateEnemiesRemaining();
      // simple game over check
      if (castleHealth <= 0) {
        // stop the round and show basic game over UI
        roundActive = false;
        // avoid creating multiple overlays
        if (!document.getElementById('gameOverOverlay')) {
          // display a simple overlay with return button
          const overlay = document.createElement('div');
          overlay.id = 'gameOverOverlay';
          overlay.style.position = 'fixed';
          overlay.style.left = '0';
          overlay.style.top = '0';
          overlay.style.right = '0';
          overlay.style.bottom = '0';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.background = 'rgba(0,0,0,0.7)';
          overlay.style.color = 'white';
          overlay.style.fontSize = '28px';
          overlay.style.zIndex = 999;
          const box = document.createElement('div');
          box.style.textAlign = 'center';
          box.style.padding = '20px';
          box.style.background = '#222';
          box.style.borderRadius = '8px';
          box.textContent = 'Game Over - Castle Destroyed';
          const btn = document.createElement('button');
          btn.textContent = 'Return to Menu';
          btn.addEventListener('click', () => {
            // remove overlay by querying DOM (more robust)
            try {
              const ov = document.getElementById('gameOverOverlay');
              if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
            } catch (e) {}
            if (startMenu) startMenu.style.display = 'flex';
            resetGameState();
          });
          box.appendChild(btn);
          overlay.appendChild(box);
          document.body.appendChild(overlay);
        }
      }
    }
  }

  // Update loot instances and check for player pickup
  const pickupRange = 1.2;
  for (let i = lootInstances.length - 1; i >= 0; i--) {
    const li = lootInstances[i];
    li.update(0.016); // approx frame delta
    const dx = li.mesh.position.x - player.mesh.position.x;
    const dz = li.mesh.position.z - player.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist <= pickupRange) {
      // apply loot or open selection modal for tower-targeted upgrades
      const def = LOOT_DEFS[li.defId];
      if (def && def.target === 'tower_individual') {
        // open modal to let player choose tower; store a temporary ref
        window.__pendingLoot = { defId: li.defId };
        openLootModalForTowerSelection(li.defId);
        // remove the pickup visually and from array
        li.dispose();
        lootInstances.splice(i, 1);
      } else {
        applyLootToPlayerOrTower(li.defId);
        li.dispose();
        lootInstances.splice(i, 1);
        savePersistentState(persistentState);
        refreshUpgradesUI();
      }
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
    towersBuiltThisRound = 0;
  }

  // Choose the active camera each frame
  const activeCam = usingTopDown ? camera : fpCamera;
  renderer.render(scene, activeCam);

// Update towers
const currentTime = performance.now() / 1000;

towers.forEach(tower => {
  if (tower instanceof HealerTower) tower.update(player, currentTime);
  else tower.update(enemies, currentTime);
});

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