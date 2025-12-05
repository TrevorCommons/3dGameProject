// MultiplayerClient - Handles all Socket.io communication and multiplayer state
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class MultiplayerClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.playerId = null;
    this.playerColor = null;
    
    // Track other players
    this.otherPlayers = new Map(); // playerId -> {mesh, position, rotation, color}
    
    // Ready system
    this.readyPlayers = new Set(); // Set of player IDs who are ready
    this.isReady = false;
    
    // Callbacks - these will be set by main.js
    this.onConnectionChange = null; // (connected) => {}
    this.onPlayerJoined = null; // (playerId, color) => {}
    this.onPlayerLeft = null; // (playerId) => {}
    this.onPlayerMoved = null; // (playerId, position, rotation) => {}
    this.onTowerPlaced = null; // (towerId, type, position, placedBy) => {}
    this.onTowerUpgraded = null; // (towerId, upgradeType) => {}
    this.onEnemySpawned = null; // (enemyId, position, health) => {}
    this.onEnemyUpdate = null; // (enemyId, position, health) => {}
    this.onEnemyDied = null; // (enemyId, gold, goldEarned) => {}
    this.onGoldUpdate = null; // (gold) => {}
    this.onCastleHealthUpdate = null; // (health) => {}
    this.onRoundStarted = null; // (wave, enemiesCount) => {}
    this.onGameOver = null; // (reason) => {}
    this.onReadyStatusChanged = null; // (playerId, isReady, readyCount, totalPlayers) => {}
    this.onChatMessage = null; // (playerId, message, timestamp) => {}
  }
  
  // Connect to the server
  connect(serverUrl = 'http://localhost:3000') {
    return new Promise((resolve, reject) => {
      try {
        // Socket.io client is loaded from CDN in index.html
        this.socket = io(serverUrl);
        
        // Connection established
        this.socket.on('connect', () => {
          console.log('Connected to multiplayer server');
          this.connected = true;
          if (this.onConnectionChange) this.onConnectionChange(true);
        });
        
        // Initial game state from server
        this.socket.on('init', (data) => {
          console.log('Received initial state:', data);
          this.playerId = data.playerId;
          this.playerColor = data.playerColor;
          
          // Initialize existing players
          if (data.players) {
            data.players.forEach(player => {
              if (player.id !== this.playerId) {
                this.otherPlayers.set(player.id, {
                  position: player.position,
                  rotation: player.rotation,
                  color: player.color,
                  mesh: null // Will be created by callback
                });
              }
            });
          }
          
          resolve({
            playerId: this.playerId,
            playerColor: this.playerColor,
            gameState: data.gameState,
            players: data.players
          });
        });
        
        // Player joined
        this.socket.on('playerJoined', (data) => {
          console.log('Player joined:', data.playerId);
          this.otherPlayers.set(data.playerId, {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            color: data.playerColor,
            mesh: null
          });
          if (this.onPlayerJoined) this.onPlayerJoined(data.playerId, data.playerColor);
        });
        
        // Player left
        this.socket.on('playerLeft', (data) => {
          console.log('Player left:', data.playerId);
          this.otherPlayers.delete(data.playerId);
          this.readyPlayers.delete(data.playerId);
          if (this.onPlayerLeft) this.onPlayerLeft(data.playerId);
        });
        
        // Player moved
        this.socket.on('playerMoved', (data) => {
          const player = this.otherPlayers.get(data.playerId);
          if (player) {
            player.position = data.position;
            player.rotation = data.rotation;
            if (this.onPlayerMoved) this.onPlayerMoved(data.playerId, data.position, data.rotation);
          }
        });
        
        // Tower placed
        this.socket.on('towerPlaced', (data) => {
          console.log('Tower placed:', data);
          if (this.onTowerPlaced) this.onTowerPlaced(data.id, data.type, data.position, data.placedBy);
        });
        
        // Tower placement failed
        this.socket.on('towerPlaceFailed', (data) => {
          console.warn('Tower placement failed:', data.reason);
          // Could show a toast notification here
        });
        
        // Tower upgraded
        this.socket.on('towerUpgraded', (data) => {
          if (this.onTowerUpgraded) this.onTowerUpgraded(data.towerId, data.upgradeType);
        });
        
        // Gold updated
        this.socket.on('goldUpdate', (data) => {
          if (this.onGoldUpdate) this.onGoldUpdate(data.gold);
        });
        
        // Castle health updated
        this.socket.on('castleHealthUpdate', (data) => {
          if (this.onCastleHealthUpdate) this.onCastleHealthUpdate(data.health);
        });
        
        // Round started
        this.socket.on('roundStarted', (data) => {
          console.log('Round started:', data.wave);
          // Reset ready status for all players
          this.readyPlayers.clear();
          this.isReady = false;
          if (this.onRoundStarted) this.onRoundStarted(data.wave, data.enemiesCount, data.enemySpawns);
        });
        
        // Enemy spawned
        this.socket.on('enemySpawned', (data) => {
          if (this.onEnemySpawned) this.onEnemySpawned(data.enemyId, data.position, data.health);
        });
        
        // Enemy updated
        this.socket.on('enemyUpdate', (data) => {
          if (this.onEnemyUpdate) this.onEnemyUpdate(data.enemyId, data.position, data.health);
        });
        
        // Enemy died
        this.socket.on('enemyDied', (data) => {
          if (this.onEnemyDied) this.onEnemyDied(data.enemyId, data.gold, data.goldEarned);
        });
        
        // Game over
        this.socket.on('gameOver', (data) => {
          console.log('Game over:', data.reason);
          if (this.onGameOver) this.onGameOver(data.reason);
        });
        
        // Ready status changed
        this.socket.on('readyStatusChanged', (data) => {
          if (data.isReady) {
            this.readyPlayers.add(data.playerId);
          } else {
            this.readyPlayers.delete(data.playerId);
          }
          if (this.onReadyStatusChanged) {
            this.onReadyStatusChanged(data.playerId, data.isReady, data.readyCount, data.totalPlayers);
          }
        });
        
        // Chat message
        this.socket.on('chatMessage', (data) => {
          if (this.onChatMessage) this.onChatMessage(data.playerId, data.message, data.timestamp);
        });
        
        // Disconnection
        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.connected = false;
          if (this.onConnectionChange) this.onConnectionChange(false);
        });
        
        // Connection error
        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });
        
      } catch (error) {
        console.error('Failed to connect:', error);
        reject(error);
      }
    });
  }
  
  // Send player movement to server
  sendPlayerMove(position, rotation) {
    if (this.socket && this.connected) {
      this.socket.emit('playerMove', { position, rotation });
    }
  }
  
  // Send tower placement request
  sendPlaceTower(type, position) {
    if (this.socket && this.connected) {
      this.socket.emit('placeTower', { type, position });
    }
  }
  
  // Send tower upgrade request
  sendUpgradeTower(towerId, upgradeType) {
    if (this.socket && this.connected) {
      this.socket.emit('upgradeTower', { towerId, upgradeType });
    }
  }
  
  // Toggle ready status
  toggleReady() {
    if (this.socket && this.connected) {
      this.isReady = !this.isReady;
      this.socket.emit('toggleReady', { isReady: this.isReady });
    }
  }
  
  // Send enemy spawned (for sync)
  sendEnemySpawned(enemyId, position, health) {
    if (this.socket && this.connected) {
      this.socket.emit('enemySpawned', { enemyId, position, health });
    }
  }
  
  // Send enemy update
  sendEnemyUpdate(enemyId, position, health) {
    if (this.socket && this.connected) {
      this.socket.emit('enemyUpdate', { enemyId, position, health });
    }
  }
  
  // Send enemy died
  sendEnemyDied(enemyId) {
    if (this.socket && this.connected) {
      this.socket.emit('enemyDied', { enemyId });
    }
  }
  
  // Send castle damaged
  sendCastleDamaged(damage) {
    if (this.socket && this.connected) {
      this.socket.emit('castleDamaged', { damage });
    }
  }
  
  // Send player attack
  sendPlayerAttack(targetId, damage) {
    if (this.socket && this.connected) {
      this.socket.emit('playerAttack', { targetId, damage });
    }
  }
  
  // Send loot pickup
  sendLootPickup(lootId, lootType) {
    if (this.socket && this.connected) {
      this.socket.emit('lootPickup', { lootId, lootType });
    }
  }
  
  // Send camera mode change
  sendCameraMode(mode) {
    if (this.socket && this.connected) {
      this.socket.emit('cameraMode', { mode });
    }
  }
  
  // Send chat message
  sendChatMessage(message) {
    if (this.socket && this.connected) {
      this.socket.emit('chatMessage', { message });
    }
  }
  
  // Get other players
  getOtherPlayers() {
    return this.otherPlayers;
  }
  
  // Check if all players are ready
  areAllPlayersReady() {
    const totalPlayers = this.otherPlayers.size + 1; // +1 for local player
    return this.readyPlayers.size === totalPlayers && totalPlayers > 0;
  }
  
  // Disconnect from server
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
      this.otherPlayers.clear();
      this.readyPlayers.clear();
    }
  }
}
