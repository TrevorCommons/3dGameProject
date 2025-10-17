import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

const GRID_SIZE = 50;
const TILE_SIZE = 1;

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