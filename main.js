import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { Player } from './game/player.js';

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
  camera.position.set(10, 20, 10); // back and above
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
const groundGeometry = new THREE.BoxGeometry(50, 1, 50);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.y = -0.5; // so top of ground is at y=0
scene.add(ground);

// Grid helper (optional)
const grid = new THREE.GridHelper(50, 50);
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
