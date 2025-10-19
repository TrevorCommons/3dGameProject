import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { GRID_SIZE, TOWER_DEFAULTS } from './constants.js';

export class Tower {
  constructor(x, y, scene) {
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.level = 1;
    this.mesh = null;
    this.attackCooldown = 1.0;
    this.lastAttackTime = 0;
    this._modifiers = null;
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  recordAttack(currentTime) {
    this.lastAttackTime = currentTime;
  }

  update() {}
}

export class HealerTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    this.attackCooldown = 0.5;
    const geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(player, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!player || !player.mesh) return;
    const dx = player.mesh.position.x - this.mesh.position.x;
    const dz = player.mesh.position.z - this.mesh.position.z;
    const r = (TOWER_DEFAULTS.healer && TOWER_DEFAULTS.healer.range) || 10;
    if (Math.hypot(dx, dz) <= r) {
      player.health = Math.min(player.health + 10, player.maxHealth);
      this.recordAttack(currentTime);
    }
  }
}

export class MageTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    const geo = new THREE.ConeGeometry(0.5, 1, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x8000ff });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
    // Mage should fire slightly faster by default
    this.attackCooldown = 0.85;
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!enemies || enemies.length === 0) return;
    const range = (TOWER_DEFAULTS.mage && TOWER_DEFAULTS.mage.range) || 8;
    for (const e of enemies) {
      if (!e || !e.mesh) continue;
      const d = Math.hypot(e.mesh.position.x - this.mesh.position.x, e.mesh.position.z - this.mesh.position.z);
      if (d <= range) {
  // Slightly higher base damage for mage (buffed)
  const dmg = 0.18 * ((this._modifiers && this._modifiers.damage) || 1);
        if (typeof e.takeDamage === 'function') {
          const res = e.takeDamage(dmg);
          if (res) e._deathResult = res;
        } else {
          e.health -= dmg;
          if (e.health <= 0 && typeof e.die === 'function') e._deathResult = e.die();
        }
      }
    }
    this.recordAttack(currentTime);
  }
}

export class ArcherTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    const geo = new THREE.BoxGeometry(0.5, 1, 0.5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!enemies || enemies.length === 0) return;
    let closest = null;
    let dist = Infinity;
    for (const e of enemies) {
      if (!e || !e.mesh) continue;
      const d = Math.hypot(e.mesh.position.x - this.mesh.position.x, e.mesh.position.z - this.mesh.position.z);
      if (d < dist) { dist = d; closest = e; }
    }
    const range = (TOWER_DEFAULTS.archer && TOWER_DEFAULTS.archer.range) || 20;
    if (closest && dist <= range) {
      if (typeof closest.takeDamage === 'function') {
        const result = closest.takeDamage(7);
        if (result) closest._deathResult = result;
      } else {
        closest.health -= 7;
        if (closest.health <= 0 && typeof closest.die === 'function') closest._deathResult = closest.die();
      }
      this.recordAttack(currentTime);
    }
  }
}

// Helpers for UI interactions with towers
export function highlightTowerById(towers, tid) {
  const t = towers.find(x => x._id === tid);
  if (!t || !t.mesh) return;
  const origScale = t.mesh.scale ? t.mesh.scale.clone() : new THREE.Vector3(1,1,1);
  const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
  const origEmissives = mats.map(m => (m && m.emissive ? m.emissive.clone() : null));
  try {
    t.mesh.scale.set(origScale.x * 1.18, origScale.y * 1.18, origScale.z * 1.18);
    mats.forEach(m => { if (!m) return; if (m.emissive) m.emissive.setHex(0xFFFF66); });
  } catch (e) {}
  setTimeout(() => {
    try { if (!t.mesh) return; t.mesh.scale.copy(origScale); mats.forEach((m, i) => { if (!m) return; if (origEmissives[i] && m.emissive) m.emissive.copy(origEmissives[i]); }); } catch (e) {}
  }, 1200);
}

export function selectTowerById(towers, tid, camera) {
  const t = towers.find(x => x._id === tid);
  if (!t || !t.mesh) return null;
  if (!t._origScale) t._origScale = t.mesh.scale.clone();
  try { t.mesh.scale.set(t._origScale.x * 1.08, t._origScale.y * 1.08, t._origScale.z * 1.08); } catch (e) {}
  if (camera && t.mesh) { try { camera.position.set(t.mesh.position.x, camera.position.y, t.mesh.position.z + 0.01); camera.lookAt(t.mesh.position.x, 0, t.mesh.position.z); } catch (e) {} }
  return tid;
}

export function clearTowerSelection(towers, selectedTid) {
  if (!selectedTid) return null;
  const t = towers.find(x => x._id === selectedTid);
  if (!t || !t.mesh) return null;
  try { if (t._origScale) t.mesh.scale.copy(t._origScale); if (t._origMaterials) { const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material]; mats.forEach((m, idx) => { const orig = t._origMaterials[idx]; if (!m || !orig) return; if (orig.emissive && m.emissive) m.emissive.copy(orig.emissive); if (orig.color && m.color) m.color.copy(orig.color); }); } } catch (e) {}
  return null;
}

