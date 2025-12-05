import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameState } from './server/gameState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Serve static files
app.use(express.static(__dirname));

// Game state manager
const gameState = new GameState();

io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Assign player color
  const playerColor = gameState.getNextPlayerColor();
  
  // Send initial game state to the new player
  socket.emit('init', {
    playerId: socket.id,
    playerColor: playerColor,
    gameState: gameState.getState(),
    players: gameState.getPlayers()
  });
  
  // Add player to game state
  gameState.addPlayer(socket.id, playerColor);
  
  // Notify all other players about the new player
  socket.broadcast.emit('playerJoined', {
    playerId: socket.id,
    playerColor: playerColor
  });
  
  // Handle player movement
  socket.on('playerMove', (data) => {
    gameState.updatePlayerPosition(socket.id, data.position, data.rotation);
    socket.broadcast.emit('playerMoved', {
      playerId: socket.id,
      position: data.position,
      rotation: data.rotation
    });
  });
  
  // Handle tower placement
  socket.on('placeTower', (data) => {
    const result = gameState.placeTower(data.type, data.position, socket.id);
    if (result.success) {
      // Broadcast to all players including sender
      io.emit('towerPlaced', {
        id: result.towerId,
        type: data.type,
        position: data.position,
        placedBy: socket.id
      });
      // Update gold for all players
      io.emit('goldUpdate', { gold: gameState.gold });
    } else {
      // Send error only to the player who tried to place
      socket.emit('towerPlaceFailed', { reason: result.reason });
    }
  });
  
  // Handle tower upgrades
  socket.on('upgradeTower', (data) => {
    const result = gameState.upgradeTower(data.towerId, data.upgradeType);
    if (result.success) {
      io.emit('towerUpgraded', {
        towerId: data.towerId,
        upgradeType: data.upgradeType
      });
    }
  });
  
  // Handle starting a round
  socket.on('startRound', () => {
    if (!gameState.roundInProgress) {
      gameState.startRound();
      io.emit('roundStarted', {
        wave: gameState.wave,
        enemiesCount: gameState.enemiesInWave
      });
    }
  });
  
  // Handle enemy spawning (server authoritative)
  socket.on('enemySpawned', (data) => {
    gameState.addEnemy(data.enemyId, data.position, data.health);
    socket.broadcast.emit('enemySpawned', data);
  });
  
  // Handle enemy updates
  socket.on('enemyUpdate', (data) => {
    gameState.updateEnemy(data.enemyId, data.position, data.health);
    socket.broadcast.emit('enemyUpdate', data);
  });
  
  // Handle enemy death
  socket.on('enemyDied', (data) => {
    const goldReward = gameState.removeEnemy(data.enemyId);
    gameState.addGold(goldReward);
    io.emit('enemyDied', {
      enemyId: data.enemyId,
      gold: gameState.gold,
      goldEarned: goldReward
    });
  });
  
  // Handle castle damage
  socket.on('castleDamaged', (data) => {
    gameState.damageCastle(data.damage);
    io.emit('castleHealthUpdate', { health: gameState.castleHealth });
    
    if (gameState.castleHealth <= 0) {
      io.emit('gameOver', { reason: 'castle destroyed' });
    }
  });
  
  // Handle player attacks
  socket.on('playerAttack', (data) => {
    socket.broadcast.emit('playerAttacked', {
      playerId: socket.id,
      targetId: data.targetId,
      damage: data.damage
    });
  });
  
  // Handle loot pickup
  socket.on('lootPickup', (data) => {
    io.emit('lootCollected', {
      lootId: data.lootId,
      playerId: socket.id,
      lootType: data.lootType
    });
  });
  
  // Handle camera mode change
  socket.on('cameraMode', (data) => {
    socket.broadcast.emit('playerCameraMode', {
      playerId: socket.id,
      mode: data.mode
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    gameState.removePlayer(socket.id);
    socket.broadcast.emit('playerLeft', { playerId: socket.id });
  });
  
  // Chat message
  socket.on('chatMessage', (data) => {
    io.emit('chatMessage', {
      playerId: socket.id,
      message: data.message,
      timestamp: Date.now()
    });
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Players can connect to start playing!');
});
