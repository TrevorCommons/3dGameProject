// Server-side game state management
export class GameState {
  constructor() {
    this.players = new Map(); // playerId -> {position, rotation, color, health}
    this.towers = new Map(); // towerId -> {type, position, stats, placedBy}
    this.enemies = new Map(); // enemyId -> {position, health, maxHealth}
    this.gold = 150; // Shared gold pool (multiplayer starting amount)
    this.castleHealth = 10; // Will scale based on player count
    this.wave = 1;
    this.roundInProgress = false;
    this.enemiesInWave = 0;
    this.towerIdCounter = 0;
    this.enemyIdCounter = 0;
    this.towersPlacedThisRound = 0;
    this.towerLimitThisRound = 0;
    this.towersPlacedByPlayer = new Map(); // playerId -> count for this round
    
    // Generate path once on server
    this.pathCoords = this.generatePath();
    
    // Generate decorations (trees, rocks) once on server
    this.decorations = this.generateDecorations();
    
    // Generate cloud positions once on server
    this.cloudPositions = this.generateCloudPositions();
    
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
  
  generatePath() {
    const GRID_SIZE = 50;
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const pathCoords = [];
    
    let curX = Math.floor(GRID_SIZE / 2);
    let curY = 0;
    let curDirection = "DOWN";
    let forceDirectionChange = false;
    let currentCount = 0;
    
    grid[curY][curX] = 1;
    pathCoords.push({ x: curX, y: curY });
    
    const checkDirections = () => {
      if (curDirection === "LEFT" && (curX - 1 < 0 || grid[curY][curX - 1] !== 0)) forceDirectionChange = true;
      else if (curDirection === "RIGHT" && (curX + 1 >= GRID_SIZE || grid[curY][curX + 1] !== 0)) forceDirectionChange = true;
      else if (curDirection !== "DOWN") forceDirectionChange = true;
    };
    
    const changeDirection = () => {
      const dirValue = Math.floor(Math.random() * 3);
      if (curDirection === "LEFT" || curDirection === "RIGHT") {
        curDirection = "DOWN";
        return;
      }
      if (dirValue === 0 && curX > 0) curDirection = "LEFT";
      else if (dirValue === 1 && curX < GRID_SIZE - 1) curDirection = "RIGHT";
      else curDirection = "DOWN";
    };
    
    const chooseDirection = () => {
      if (currentCount < 4 && !forceDirectionChange) currentCount++;
      else {
        const chanceToChange = Math.floor(Math.random() * 2) === 0;
        if (chanceToChange || forceDirectionChange || currentCount > 7) {
          currentCount = 0;
          forceDirectionChange = false;
          changeDirection();
        }
        currentCount++;
      }
    };
    
    while (curY < GRID_SIZE - 1) {
      checkDirections();
      chooseDirection();
      
      if (curDirection === "LEFT" && curX > 0) curX--;
      else if (curDirection === "RIGHT" && curX < GRID_SIZE - 1) curX++;
      else if (curDirection === "DOWN" && curY < GRID_SIZE - 1) curY++;
      
      grid[curY][curX] = 1;
      pathCoords.push({ x: curX, y: curY });
    }
    
    return pathCoords;
  }
  
  generateDecorations() {
    const GRID_SIZE = 50;
    const TILE_SIZE = 1;
    const decorations = [];
    const avoidRadius = 3;
    
    // Build grid from pathCoords
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    for (const coord of this.pathCoords) {
      grid[coord.y][coord.x] = 1;
    }
    
    const pathTiles = this.pathCoords;
    
    const isNearPath = (x, y) => {
      for (const tile of pathTiles) {
        const dx = x - tile.x;
        const dy = y - tile.y;
        if (Math.sqrt(dx * dx + dy * dy) <= avoidRadius) {
          return true;
        }
      }
      return false;
    };
    
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === 1) continue;
        if (isNearPath(x, y)) continue;
        
        const rand = Math.random();
        if (rand < 0.05) {
          decorations.push({
            type: 'tree',
            x: (x - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2,
            y: 0.75,
            z: (y - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2
          });
        } else if (rand < 0.08) {
          decorations.push({
            type: 'rock',
            x: (x - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2,
            y: 0.4,
            z: (y - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2
          });
        }
      }
    }
    
    return decorations;
  }
  
  generateCloudPositions() {
    const GRID_SIZE = 50;
    const spawnMargin = 5;
    const clouds = [];
    
    for (let i = 0; i < 100; i++) {
      const halfArea = GRID_SIZE / 2 + spawnMargin;
      const x = (Math.random() * 2 - 1) * halfArea;
      const z = (Math.random() * 2 - 1) * halfArea;
      const y = 12 + Math.random() ** 1.5 * 20;
      
      // Generate cloud sphere data
      const spheres = [];
      for (let j = 0; j < 5; j++) {
        spheres.push({
          radius: Math.random() * 1.5 + 0.5,
          x: Math.random() * 2 - 1,
          y: Math.random() * 0.5,
          z: Math.random() * 2 - 1
        });
      }
      
      const scale = 0.5 + Math.random() * 1.5;
      
      clouds.push({ x, y, z, scale, spheres });
    }
    
    return clouds;
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
    
    // Update castle health based on player count
    this.updateCastleHealthForPlayerCount();
  }
  
  updateCastleHealthForPlayerCount() {
    const playerCount = this.players.size;
    this.castleHealth = 10 + (5 * playerCount); // 10 base + 5 per player
  }
  
  getTowerLimitForRound() {
    const playerCount = this.players.size;
    if (playerCount === 1) return 2; // Single player gets 2 towers
    return 1; // Multiplayer: 1 tower per player
  }
  
  getTowerLimitPerPlayer() {
    return this.getTowerLimitForRound();
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

  updatePlayerPosition(playerId, newPosition, rotation) {
    const player = this.players.get(playerId);
    if (!player) return;

    const RADIUS = 1; // size of player sphere (adjust as needed)

    // Check collision with all other players
    for (let [otherId, other] of this.players) {
        if (otherId === playerId) continue;

        const dx = newPosition.x - other.position.x;
        const dz = newPosition.z - other.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        const minDist = RADIUS * 2;

        if (dist < minDist) {
            // They are overlapping - hard collision resolution

            // If they are exactly on top of each other (rare, but safe to handle)
            const nx = dist === 0 ? 1 : dx / dist;
            const nz = dist === 0 ? 0 : dz / dist;

            const overlap = minDist - dist;

            // Push THIS player back fully until they no longer overlap
            newPosition.x += nx * overlap;
            newPosition.z += nz * overlap;

            // Push OTHER player back equally (fair collision)
            other.position.x -= nx * overlap;
            other.position.z -= nz * overlap;
        }
    }

    // Save new position
    player.position = newPosition;
    player.rotation = rotation;
}



  getPlayers() {
    const playerArray = [];
    this.players.forEach((data, id) => {
      playerArray.push({ id, ...data });
    });
    return playerArray;
  }
  
  placeTower(type, position, playerId) {
    // Check per-player tower placement limit for this round
    const currentPlayerTowerCount = this.towersPlacedByPlayer.get(playerId) || 0;
    const limitPerPlayer = this.getTowerLimitPerPlayer();
    
    if (this.roundInProgress && currentPlayerTowerCount >= limitPerPlayer) {
      return { success: false, reason: `Tower limit reached (${limitPerPlayer} per player this round)` };
    }
    
    // Tower costs (should match client-side constants)
    const costs = {
      'Healer': 30,
      'Mage': 50,
      'Archer': 40
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
    
    // Increment tower counter for this round (both global and per-player)
    if (this.roundInProgress) {
      this.towersPlacedThisRound++;
      const currentCount = this.towersPlacedByPlayer.get(playerId) || 0;
      this.towersPlacedByPlayer.set(playerId, currentCount + 1);
    }
    
    // Calculate remaining towers for this player
    const playerTowerCount = this.towersPlacedByPlayer.get(playerId) || 0;
    const towerLimit = this.getTowerLimitPerPlayer();
    const towersRemaining = towerLimit - playerTowerCount;
    
    return { success: true, towerId, towersRemaining };
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
    
    // Check if all enemies are dead and round should end
    console.log(`Enemy removed. Enemies remaining: ${this.enemies.size}, Round in progress: ${this.roundInProgress}`);
    if (this.roundInProgress && this.enemies.size === 0) {
      console.log('All enemies dead - ending round');
      this.endRound();
    }
    
    // Return gold reward based on enemy type
    return 5; // Base gold reward (reduced from 10)
  }
  
  addGold(amount) {
    this.gold += amount;
  }
  
  damageCastle(damage) {
    this.castleHealth = Math.max(0, this.castleHealth - damage);
  }
  
  startRound() {
    this.roundInProgress = true;
    
    // Reset tower placement counter and set limit
    this.towersPlacedThisRound = 0;
    this.towerLimitThisRound = this.getTowerLimitForRound();
    this.towersPlacedByPlayer.clear(); // Reset per-player counters
    
    // Calculate scaled enemy count based on player count
    const playerCount = Math.max(1, this.players.size);
    const baseEnemies = Math.floor(3 + (this.wave - 1) * 0.6); // Base formula
    
    // Apply player count multiplier
    let countMultiplier = 1.0;
    if (playerCount === 2) countMultiplier = 1.5;
    else if (playerCount === 3) countMultiplier = 2.0;
    else if (playerCount >= 4) countMultiplier = 2.5;
    
    this.enemiesInWave = Math.floor(baseEnemies * countMultiplier);
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
      enemies: Array.from(this.enemies.entries()).map(([id, enemy]) => ({ id, ...enemy })),
      pathCoords: this.pathCoords,
      decorations: this.decorations,
      cloudPositions: this.cloudPositions,
      playerCount: this.players.size,
      towersPlacedThisRound: this.towersPlacedThisRound,
      towerLimitThisRound: this.towerLimitThisRound
    };
  }
  
  generateEnemySpawns(numEnemies, waveNumber) {
    const spawns = [];
    
    // Calculate health multiplier based on player count (buffed for better challenge)
    const playerCount = Math.max(1, this.players.size);
    let healthMultiplier = 1.5; // Increased base from 1.0 to 1.5
    if (playerCount === 2) healthMultiplier = 2.0; // Increased from 1.2
    else if (playerCount === 3) healthMultiplier = 2.5; // Increased from 1.35
    else if (playerCount >= 4) healthMultiplier = 3.0; // Increased from 1.5
    
    // Determine loot carriers (same logic as client)
    const lootKeys = ['powercore_module', 'overclock_chip', 'sharpened_blade', 'gold_hoard'];
    const chosenLootKey = lootKeys[Math.floor(Math.random() * lootKeys.length)];
    const carryIndex = Math.floor(Math.random() * numEnemies);
    const carryIndices = [carryIndex];
    
    // Extra powerup every 5 waves
    if (waveNumber % 5 === 0) {
      if (Math.random() < 0.45) {
        let extraIdx = Math.floor(Math.random() * numEnemies);
        let attempts = 0;
        while (extraIdx === carryIndex && attempts < 12) {
          extraIdx = Math.floor(Math.random() * numEnemies);
          attempts++;
        }
        if (extraIdx !== carryIndex) carryIndices.push(extraIdx);
      }
    }
    
    for (let i = 0; i < numEnemies; i++) {
      const enemyId = `enemy_${this.enemyIdCounter++}`;
      const carriesLoot = carryIndices.includes(i) ? chosenLootKey : null;
      
      // Add enemy to server tracking immediately
      // We'll set proper health and position when clients report them
      const baseHealth = 12; // Default starting health
      const enemyHealth = baseHealth * healthMultiplier;
      this.enemies.set(enemyId, {
        position: { x: 0, y: 0, z: 0 },
        health: enemyHealth,
        maxHealth: enemyHealth
      });
      
      spawns.push({
        id: enemyId,
        spawnDelay: i * 0.5,
        carriesLoot: carriesLoot,
        healthMultiplier: healthMultiplier
      });
    }
    console.log(`Generated ${numEnemies} enemies for wave ${waveNumber}, server tracking ${this.enemies.size} enemies`);
    return spawns;
  }
}
