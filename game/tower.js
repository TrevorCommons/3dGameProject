//tower.js
const GRID_SIZE = 50;
const TILE_SIZE = 1;


import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class Tower {
  constructor(x, y, scene) {
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.level = 1;
    this.mesh = null;
    this.attackCooldown = 1.0; // seconds
    this.lastAttackTime = 0;
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  recordAttack(currentTime) {
    this.lastAttackTime = currentTime;
  }

  update(playerOrEnemies) {
    // overridden by subclasses
  }
}

export class HealerTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(player, currentTime) {
    if (!this.canAttack(currentTime)) return;

    const dx = player.mesh.position.x - this.mesh.position.x;
    const dz = player.mesh.position.z - this.mesh.position.z;
    if (Math.sqrt(dx*dx + dz*dz) <= 10) {
      player.health = Math.min(player.health + 0.05, player.maxHealth);
      }
  }
}

export class MageTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    const geometry = new THREE.ConeGeometry(0.5, 1, 12);
    const material = new THREE.MeshStandardMaterial({ color: 0x8000ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;

    enemies.forEach(e => {
      const dx = e.mesh.position.x - this.mesh.position.x;
      const dz = e.mesh.position.z - this.mesh.position.z;
      if (Math.sqrt(dx*dx + dz*dz) <= 8) {
        e.takeDamage(3);
      }
    });
    
    this.recordAttack(currentTime);
  }
}

export class ArcherTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    const geometry = new THREE.BoxGeometry(0.5, 1, 0.5);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (enemies.length === 0) return;

    let closest = enemies[0];
let dist = Math.hypot(
  closest.mesh.position.x - this.mesh.position.x,
  closest.mesh.position.z - this.mesh.position.z
);

for (const e of enemies) {
  const d = Math.hypot(
    e.mesh.position.x - this.mesh.position.x,
    e.mesh.position.z - this.mesh.position.z
  );
  if (d < dist) {
    dist = d;
    closest = e;
  }
}
    if (dist <= 20) {
      closest.takeDamage(7); 
      this.recordAttack(currentTime);
    }
  }
}
