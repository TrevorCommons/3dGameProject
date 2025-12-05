// Server-side game state management
export class GameState {
  constructor() {
    this.players = new Map(); // playerId -> {position, rotation, color, health}
    this.towers = new Map(); // towerId -> {type, position, stats, placedBy}
    this.enemies = new Map(); // enemyId -> {position, health, maxHealth}
    this.gold = 100; // Shared gold pool
    this.castleHealth = 10;
    this.wave = 1;
    this.roundInProgress = false;
    this.enemiesInWave = 0;
    this.towerIdCounter = 0;
    
    // Available player colors
    this.availableColors = [
      0xff0000, // Red
      0x0000ff, // Blue
      0x00ff00, // Green
      0xffff00, // Yellow
      0xff00ff, // Magenta
      0x00ffff, // Cyan
      0xffa500, // Orange
      0x800080  // Purple
    ];
    this.usedColorIndices = new Set();
  }
  
  getNextPlayerColor() {
    for (let i = 0; i < this.availableColors.length; i++) {
      if (!this.usedColorIndices.has(i)) {
        this.usedColorIndices.add(i);
        return this.availableColors[i];
      }
    }
    // If all colors used, return a random color
    return Math.floor(Math.random() * 0xffffff);
  }
  
  addPlayer(playerId, color) {
    this.players.set(playerId, {
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      color: color,
      health: 100
    });
  }
  
  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      // Free up the color
      const colorIndex = this.availableColors.indexOf(player.color);
      if (colorIndex !== -1) {
        this.usedColorIndices.delete(colorIndex);
      }
    }
    this.players.delete(playerId);
  }
  
  updatePlayerPosition(playerId, position, rotation) {
    const player = this.players.get(playerId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
    }
  }
  
  getPlayers() {
    const playerArray = [];
    this.players.forEach((data, id) => {
      playerArray.push({ id, ...data });
    });
    return playerArray;
  }
  
  placeTower(type, position, playerId) {
    // Tower costs (should match client-side constants)
    const costs = {
      'Healer': 30,
      'Mage': 40,
      'Archer': 25
    };
    
    const cost = costs[type] || 30;
    
    if (this.gold < cost) {
      return { success: false, reason: 'Not enough gold' };
    }
    
    // Check if position is valid (not too close to other towers)
    const minDistance = 2;
    for (const [id, tower] of this.towers.entries()) {
      const dx = tower.position.x - position.x;
      const dz = tower.position.z - position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDistance) {
        return { success: false, reason: 'Too close to another tower' };
      }
    }
    
    this.gold -= cost;
    const towerId = this.towerIdCounter++;
    
    this.towers.set(towerId, {
      type,
      position,
      placedBy: playerId,
      stats: this.getDefaultTowerStats(type),
      upgrades: []
    });
    
    return { success: true, towerId };
  }
  
  getDefaultTowerStats(type) {
    const defaults = {
      'Healer': { range: 5, cooldown: 2000, healAmount: 10 },
      'Mage': { range: 6, cooldown: 1500, damage: 30 },
      'Archer': { range: 7, cooldown: 800, damage: 15 }
    };
    return defaults[type] || {};
  }
  
  upgradeTower(towerId, upgradeType) {
    const tower = this.towers.get(towerId);
    if (!tower) {
      return { success: false, reason: 'Tower not found' };
    }
    
    // Apply upgrade to tower stats
    tower.upgrades.push(upgradeType);
    
    return { success: true };
  }
  
  addEnemy(enemyId, position, health) {
    this.enemies.set(enemyId, {
      position,
      health,
      maxHealth: health
    });
  }
  
  updateEnemy(enemyId, position, health) {
    const enemy = this.enemies.get(enemyId);
    if (enemy) {
      enemy.position = position;
      enemy.health = health;
    }
  }
  
  removeEnemy(enemyId) {
    this.enemies.delete(enemyId);
    // Return gold reward based on enemy type
    return 10; // Base gold reward
  }
  
  addGold(amount) {
    this.gold += amount;
  }
  
  damageCastle(damage) {
    this.castleHealth = Math.max(0, this.castleHealth - damage);
  }
  
  startRound() {
    this.roundInProgress = true;
    this.enemiesInWave = this.wave * 3 + 2; // Example formula
  }
  
  endRound() {
    this.roundInProgress = false;
    this.wave++;
  }
  
  getState() {
    return {
      gold: this.gold,
      castleHealth: this.castleHealth,
      wave: this.wave,
      roundInProgress: this.roundInProgress,
      towers: Array.from(this.towers.entries()).map(([id, tower]) => ({ id, ...tower })),
      enemies: Array.from(this.enemies.entries()).map(([id, enemy]) => ({ id, ...enemy }))
    };
  }
}
