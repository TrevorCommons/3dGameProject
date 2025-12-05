# Multiplayer Debugging Guide

## Issue: Players can't see each other move or place towers

I've updated the code to fix the player position sync. Here's how to test and debug:

### **Changes Made:**
- Fixed `updateMultiplayerPosition()` to use `player.mesh.position` instead of `player.position`
- Added debug logging (commented out) that you can enable

---

## **Testing Steps:**

### **1. Restart the Server**
```powershell
# Stop the current server (Ctrl+C)
node server.js
```

### **2. Open Browser Console (F12)**
On both players' browsers, open Developer Tools:
- Press `F12`
- Click "Console" tab
- Keep it open while testing

### **3. Connect Both Players**
- Player 1: Open `http://localhost:3000`
- Player 2: Open `http://YOUR-IP:3000`
- Both click "Join Multiplayer"
- Both click "Connect"

### **4. Check Console Logs**

**You should see:**
```
Connected to multiplayer server!
Multiplayer initialized: {playerId: "...", ...}
Player joined: [other-player-id]
```

**If you don't see "Player joined":**
- Check server terminal - should show "Player connected: [id]"
- Make sure both players clicked "Connect"

---

## **Enable Debug Logging:**

### **In `main.js`, uncomment these lines:**

**Line ~2201 (sending position):**
```javascript
// console.log('Sending position:', pos.x.toFixed(2), pos.y.toFixed(2), pos.z.toFixed(2));
```
Remove the `//` to enable

**Line ~2090 (receiving position):**
```javascript
// console.log('Player moved:', playerId.substring(0, 6), 'pos:', position.x.toFixed(2), position.y.toFixed(2), position.z.toFixed(2));
```
Remove the `//` to enable

### **What to look for:**
- **Sending position** should log every 50ms when you move
- **Player moved** should log when OTHER player moves
- If you see "Sending" but not "Player moved" = server not broadcasting
- If you see neither = position updates not working

---

## **Common Issues & Fixes:**

### **Issue 1: Players connect but can't see each other**

**Symptoms:**
- Console shows "Player joined"
- But no colored capsule appears

**Debug:**
```javascript
// In browser console, type:
otherPlayerMeshes
// Should show a Map with the other player's ID
```

**Fix:** Check if `createOtherPlayerMesh()` is being called. Look for:
```
Player joined: [id]
```

---

### **Issue 2: Can see players but they don't move**

**Symptoms:**
- Colored capsules visible
- But they stay at (0,0,0) and don't move

**Debug:**
```javascript
// Enable the debug logs mentioned above
// Move around with WASD
// Check if "Sending position" logs appear
// Check if "Player moved" logs appear on other client
```

**Possible causes:**
- Position updates not being sent
- Server not broadcasting
- Meshes not updating

---

### **Issue 3: Tower placement doesn't work**

**Symptoms:**
- Place tower, gold deducts
- Tower doesn't appear for either player

**Debug in server terminal:**
```
Tower placed: [id] [type]
```

If this appears, the issue is client-side rendering.

**In browser console:**
```javascript
// Check if callback is set:
multiplayerClient.onTowerPlaced
// Should show: ƒ (towerId, type, position, placedBy) { ... }
```

---

## **Quick Test Commands:**

### **In browser console (F12):**

**Check multiplayer status:**
```javascript
isMultiplayer  // Should be: true
multiplayerClient.connected  // Should be: true
multiplayerClient.playerId  // Your player ID
```

**Check other players:**
```javascript
otherPlayerMeshes.size  // Should be: 1 (or more)
multiplayerClient.otherPlayers.size  // Should match
```

**Manually test position update:**
```javascript
// Move your player, then check:
player.mesh.position
// Should show your current position, not (0,0,0)
```

**Force send position:**
```javascript
multiplayerClient.sendPlayerMove(
  {x: 5, y: 1, z: 5},
  {x: 0, y: 0, z: 0}
);
// Other player should see your capsule move to (5,1,5)
```

---

## **Server-Side Debugging:**

### **In `server.js`, add logging:**

After line ~52 (playerMove handler):
```javascript
socket.on('playerMove', (data) => {
  gameState.updatePlayerPosition(socket.id, data.position, data.rotation);
  console.log(`Player ${socket.id.substring(0,6)} moved to (${data.position.x.toFixed(2)}, ${data.position.y.toFixed(2)}, ${data.position.z.toFixed(2)})`);
  socket.broadcast.emit('playerMoved', {
    playerId: socket.id,
    position: data.position,
    rotation: data.rotation
  });
});
```

**What to look for:**
- Server should log "Player [id] moved to ..." when players move
- If you see this, the server is receiving updates
- If you don't, the client isn't sending them

---

## **Expected Behavior:**

### **When working correctly:**

1. **Connection:**
   - Server logs: "Player connected: [id]"
   - Browser console: "Connected to multiplayer server!"
   - Status indicator: Green "Connected"

2. **Player Join:**
   - Server logs: broadcasts playerJoined
   - Browser console: "Player joined: [id]"
   - In-game: Colored capsule appears at (0, 0.9, 0)

3. **Movement:**
   - Move with WASD
   - Server logs: "Player [id] moved to ..."
   - Other player sees capsule move smoothly
   - Position updates ~20 times per second (every 50ms)

4. **Tower Placement:**
   - Click to place tower
   - Server logs: "Tower placed: [id] [type]"
   - Both players see tower appear
   - Gold deducts for both players

---

## **If Still Not Working:**

1. **Check the commit is applied:**
   ```powershell
   git status
   # Should show clean working directory
   git log --oneline -1
   # Should show "Complete multiplayer integration..."
   ```

2. **Refresh browsers (Ctrl+F5)** - Hard refresh to clear cache

3. **Check server restart** - Make sure you stopped old server before starting new one

4. **Port conflict** - Make sure port 3000 isn't used by another app

5. **Share console logs** - Copy console output from both clients and server

---

## **Next Steps After Fixing:**

Once players can see each other move:
1. Test tower placement
2. Test ready system
3. Test wave spawning
4. Test gold sync
5. Test castle damage

Let me know what you see in the console logs!
