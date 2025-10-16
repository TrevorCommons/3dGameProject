import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { Player } from './game/player.js';
import { createPath } from './game/path.js';
// import { isBuildable } from './game/tower.js';

// Constants
const TILE_SIZE = 1;
const GRID_SIZE = 50;

// Scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb); // light blue sky

// Camera (slightly tilted for better view)
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(20, 30, 20); // back and above
  camera.lookAt(0, 0, 0);

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

const { pathTiles, tiles, grid: gridArray } = createPath(scene);

// Extract path coordinates for potential use (e.g., enemy spawning)
const pathCoords = [];
for (let y = 0; y < gridArray.length; y++) {
  for (let x = 0; x < gridArray[y].length; x++) {
    if (gridArray[y][x] === 1) pathCoords.push({ x, y });
  }
}

//need to add some substance to the map (trees, rocks, castle, etc.)
function addDecorations(scene, gridArray) {
  const treeGeometry = new THREE.ConeGeometry(2, 5, 12);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
  const rockGeometry = new THREE.DodecahedronGeometry(.8);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

  for (let y = 0; y < gridArray.length; y++) {
    for (let x = 0; x < gridArray[y].length; x++) {
      // Skip path tiles
      if (gridArray[y][x] === 1) continue;

      // Got this random generator so should make levels vary
      const rand = Math.random();
      if (rand < 0.05) { // 5% chance of tree
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.set(x - GRID_SIZE / 2, 0.75, y - GRID_SIZE / 2);
        scene.add(tree);
      } else if (rand < 0.08) { // 3% chance of rock
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x - GRID_SIZE / 2, 0.25, y - GRID_SIZE / 2);
        scene.add(rock);
      }
    }
  }
}
addDecorations(scene, gridArray);

// Castle
const castleGeometry = new THREE.BoxGeometry(3, 3, 3);
const castleMaterial = new THREE.MeshStandardMaterial({color: 0x777777});
const castle = new THREE.Mesh(castleGeometry, castleMaterial);
// Place at end of path
const endTile = pathCoords[pathCoords.length - 1];
castle.position.set(endTile.x - GRID_SIZE / 2, 1.5, endTile.y - GRID_SIZE / 2);
scene.add(castle);

// Sun
const sunGeometry = new THREE.CircleGeometry(1.5, 20, 15);
const sunMaterial = new THREE.MeshStandardMaterial({color: 0xFFF200});
const sun = new THREE.Mesh(sunGeometry, sunMaterial);
//East placement
const eastX = GRID_SIZE - 1;
const eastZ = Math.floor(GRID_SIZE / 2)
sun.position.set(
  eastX - GRID_SIZE / 2, // x
  20,                      // y (height / 2)
  eastZ - GRID_SIZE / 2  // z
);
scene.add(sun);

// Grid helper (optional)
const grid = new THREE.GridHelper(GRID_SIZE, GRID_SIZE);
scene.add(grid);

// Player
const player = new Player();
player.mesh.position.y = 1; // raise above ground
scene.add(player.mesh);

// Player movement
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

function handlePlayerMovement() {
  if (keys['w'] || keys['ArrowUp']) player.move('up');
  if (keys['s'] || keys['ArrowDown']) player.move('down');
  if (keys['a'] || keys['ArrowLeft']) player.move('left');
  if (keys['d'] || keys['ArrowRight']) player.move('right');
}

// Animate
function animate() {
  requestAnimationFrame(animate);
  handlePlayerMovement();
  renderer.render(scene, camera);
}

animate();

// Handle window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
