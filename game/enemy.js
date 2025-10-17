import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

const GRID_SIZE = 50;
const TILE_SIZE = 1;

export function createPath(scene) {
    // --- Initialize grid ---
    // grid: 2D array representing the map, 0 = buildable, 1 = path
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const tiles = [];
    const pathTiles = [];
    const pathCoords = [];

    // --- Path state ---
    // curX, curY: current position of the path
    // curDirection: current movement direction ('DOWN', 'LEFT', 'RIGHT')
    // forceDirectionChange: flag to force a direction change if blocked
    // currentCount: how many tiles we've moved in the current direction
    let curX = Math.floor(GRID_SIZE / 2); // middle column
    let curY = 0;                         // top row (start)
    let curDirection = "DOWN";
    let forceDirectionChange = false;
    let currentCount = 0;

    // Mark starting tile as path
    grid[curY][curX] = 1;
    pathCoords.push({ x: curX, y: curY });

    // === Path generation ===
    // The path moves down until it reaches the bottom row,
    // occasionally turning left or right, but never overlapping itself.
    while (curY < GRID_SIZE - 1) {
        checkDirections();      // Check if we need to force a direction change
        chooseDirection();      // Decide whether to change direction or keep going

        // Move based on direction
        if (curDirection === "LEFT" && curX > 0) curX--;
        else if (curDirection === "RIGHT" && curX < GRID_SIZE - 1) curX++;
        else if (curDirection === "DOWN" && curY < GRID_SIZE - 1) curY++;

        // Mark the new tile as path
        grid[curY][curX] = 1;
        pathCoords.push({ x: curX, y: curY });
    }

    // === Drawing tiles ===
    // Render the grid: gold for path, green for buildable
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = grid[r][c];
            const color = val === 1 ? 0xffd700 : 0x228B22; // gold path, green ground

            const geo = new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE);
            const mat = new THREE.MeshLambertMaterial({ color });
            const mesh = new THREE.Mesh(geo, mat);

            mesh.position.x = (c - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;
            mesh.position.y = 0.25;
            mesh.position.z = (r - GRID_SIZE / 2) * TILE_SIZE + TILE_SIZE / 2;

            scene.add(mesh);
            tiles.push(mesh);
            if (val === 1) pathTiles.push(mesh);
        }
    }

    // === Helper functions ===
    // checkDirections: If blocked in current direction, force a direction change
    function checkDirections() {
        if (curDirection === "LEFT" && curX - 1 >= 0 && grid[curY][curX - 1] === 0) {
            // Can keep going left
        } else if (curDirection === "RIGHT" && curX + 1 < GRID_SIZE && grid[curY][curX + 1] === 0) {
            // Can keep going right
        } else if (curDirection !== "DOWN") {
            // If blocked left/right, force a direction change
            forceDirectionChange = true;
        }
    }

    // chooseDirection: Decides whether to keep going or change direction
    // - Keeps going in current direction for at least 3 tiles
    // - Randomly decides to change direction after 3+ tiles, or if forced
    function chooseDirection() {
        if (currentCount < 4 && !forceDirectionChange) {
            currentCount++;
        } else {
            const chanceToChange = Math.floor(Math.random() * 2) === 0;
            if (chanceToChange || forceDirectionChange || currentCount > 7) {
                currentCount = 0;
                forceDirectionChange = false;
                changeDirection();
            }
            currentCount++;
        }
    }

    // changeDirection: Chooses a new direction
    // - If currently moving left/right, always switch to down
    // - If moving down, randomly pick left, right, or keep going down
    function changeDirection() {
        const dirValue = Math.floor(Math.random() * 3);
        if (curDirection === "LEFT" || curDirection === "RIGHT") {
            curDirection = "DOWN";
            return;
        }

        if (dirValue === 0 && curX > 0) {
            curDirection = "LEFT";
        } else if (dirValue === 1 && curX < GRID_SIZE - 1) {
            curDirection = "RIGHT";
        } else {
            curDirection = "DOWN";
        }
    }

    // Return all path and tile meshes, the grid, and the ordered path coordinates
    return { pathTiles, tiles, grid, pathCoords };
export class Enemy {
  
  constructor(pathCoords, scene, options = {}) {
    // Create a simple enemy mesh (sphere)
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);

    // Path following state
    this.pathCoords = pathCoords;
    this.currentStep = 0;
    this.speed = 0.03; // Adjust for desired speed
    this.progress = 0; // Progress between steps

    // Enemy stats
    this.maxHealth = options.maxHealth || 10;
    this.health = this.maxHealth;
    this.maxCoins = options.maxCoins || 5;
    this.coinDrop = Math.floor(Math.random() * (this.maxCoins + 1));
    this.lootChance = options.lootChance || 0.2; // 20% default chance
    this.hasDroppedLoot = false;
  }

  update() {
    if (this.currentStep < this.pathCoords.length - 1) {
      const start = this.pathCoords[this.currentStep];
      const end = this.pathCoords[this.currentStep + 1];

      // Interpolate position
      this.mesh.position.x = THREE.MathUtils.lerp(
        (start.x - 25) + 0.5, (end.x - 25) + 0.5, this.progress
      );
      this.mesh.position.z = THREE.MathUtils.lerp(
        (start.y - 25) + 0.5, (end.y - 25) + 0.5, this.progress
      );
      this.mesh.position.y = 0.5;

      this.progress += this.speed;
      if (this.progress >= 1) {
        this.progress = 0;
        this.currentStep++;
      }
    }
  }

  // Call this to deal damage to the enemy
  takeDamage(amount) {
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      // Handle defeat: drop coins/loot, remove mesh, etc.
      return this.onDefeat();
    }
    return null;
  }
  
  // Call this when the enemy is defeated
  onDefeat() {
    // Drop coins
    const coins = this.coinDrop;
    // Drop loot (handled in loot.js)
    let loot = null;
    if (!this.hasDroppedLoot && Math.random() < this.lootChance) {
      this.hasDroppedLoot = true;
      // You would call your loot.js logic here, e.g.:
      // loot = generateLoot(this.mesh.position);
    }
    return { coins, loot };
  }
}