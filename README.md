# 3dGameProject

Top-down tower-defense / small action hybrid built with Three.js and vanilla JavaScript.

Overview
--------
Defend your castle from waves of enemies. You can place towers between waves, pick up loot dropped by enemies, and apply upgrades to either the player or individual towers. The game supports a campaign-style win condition (beat round 20) and an Endless Mode for continuing past that point.

Rules
-----
- Each wave spawns a number of enemies that follow the path to your castle. If an enemy reaches the end, the castle loses 1 health.
- If castle health reaches 0 you lose and are returned to the menu.
- Clearing wave 20 normally triggers a Victory overlay. If Endless Mode is enabled, waves continue past 20.
- Towers cost gold to build. Gold is awarded by killing enemies.
- Loot/powerups may be dropped by enemies. Some apply immediately to the player, others are stored in your inventory for application to towers.

Powerups (Loot)
----------------
Loot definitions are in `game/loot.js`. Current notable powerups:

- `gold_hoard` (Gold Hoard Token)
	- Effect: grants an additive gold bonus (each token adds +20% in raw terms).
	- The game applies diminishing returns when awarding gold. The effective multiplier is computed by a diminishing formula and capped at 200% (i.e., at most double gold). The effective multiplier is shown in the UI under Applied Upgrades when active.
	- Stored under persistent upgrades; multiple tokens stack but are subject to diminishing returns and a hard cap.

- `sharpened_blade` (Sharpened Blade)
	- Effect: increases player melee damage (permanent; stacks up to the per-item cap).

- `powercore_module` and `overclock_chip`
	- Tower-targeted upgrades. Apply them to an individual tower (from the inventory modal) to permanently increase that tower's damage or fire rate. Tower caps apply per definition.

Towers
------
There are three tower classes (see `game/tower.js`):

- Healer Tower — supports allied recovery.
- Mage Tower — high single-target damage and ranged (recently buffed).
- Archer Tower — standard DPS tower.

Each tower type has a gold cost (configured in `game/constants.js`) and may be upgraded with loot applied to that tower.

Controls
--------
- Mouse:
	- Left click in top-down mode to place a selected tower (when you have selected a tower type).
	- Left click in first-person mode swings the player's weapon (melee).
- Keyboard:
	- C — Toggle camera between top-down and first-person.
	- R or Enter — Start the next round (when not already active).
	- Tab — Pause / Resume the game (also available as the Pause button in the UI). While paused the game world freezes and a pause menu appears with Resume and End/Reset options.

UI Notes
--------
- Inventory: picked-up tower-targeted loot is stored in your inventory with a unique id (to avoid accidental loss). Open the inventory to Apply or Drop items.
- Applied Upgrades panel shows persistent player upgrades and the effective gold multiplier when Gold Hoard tokens are active.
- The Start Round and Pause buttons show their keyboard shortcuts in the label (e.g., Pause (Tab)).
- Endless Mode: toggle the "Endless Mode" checkbox to allow continuing past round 20. The on-screen "Endless ON" indicator shows when enabled.

Dev / Run instructions (VS Code Live Server)
------------------------------------------
1. Open this project folder (`3dGameProject`) in Visual Studio Code.
2. If you don't already have Live Server installed, install the extension named "Live Server" (by Ritwick Dey) from the Extensions view.
3. Start Live Server:
	 - Right-click `index.html` in the Explorer and choose "Open with Live Server", or
	 - Press F1 and run the "Live Server: Open with Live Server" command, or
	 - Click the "Go Live" button in the status bar.
4. A browser should open at `http://127.0.0.1:5500/` (or another port). The game is loaded as an ES module and will run in the browser.

Notes for development
---------------------
- The codebase uses vanilla ES modules and Three.js for rendering. Major game logic lives in:
	- `main.js` — game loop, UI wiring, wave logic, inventory modal, and scene setup.
	- `game/loot.js` — loot definitions and persistence helpers.
	- `game/tower.js` — tower classes and behaviors.
	- `game/enemy.js` — enemy behavior and coin/loot drops.
- Persistent player upgrades and inventory are stored in `localStorage` under a storage key defined in `game/constants.js`.
- If you change module imports or add new files, ensure the import paths are correct (browser module loader requires valid URLs/paths).

Testing / Tuning
----------------
- To tune drop rates, check `main.js` (wave spawn logic) and `game/loot.js` (loot weights). A weighted picker was implemented for loot selection.
- To tune the economy, adjust `TOWER_COSTS` and `STARTING_GOLD` in `game/constants.js`.

Feedback or changes
-------------------
If you want different diminishing-return math, different caps, a visible debug overlay for drop-rates, or extra UI polish for the pause/win overlays, tell me what you'd like and I can implement it.
