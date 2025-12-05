import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

// Load grass texture
const loader = new THREE.TextureLoader();
const grassTexture = loader.load("assets/grass.jpg");
grassTexture.wrapS = THREE.RepeatWrapping;
grassTexture.wrapT = THREE.RepeatWrapping;
grassTexture.repeat.set(2, 2); // adjust tiling
grassTexture.magFilter = THREE.NearestFilter;
grassTexture.minFilter = THREE.LinearMipMapLinearFilter;

const GRID_SIZE = 50;
const TILE_SIZE = 1;

export function createPath(scene) {
    const grid = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));
    const tiles = [];
    const pathTiles = [];
    const pathCoords = [];

    // Path generation state
    let curX = Math.floor(GRID_SIZE / 2);
    let curY = 0;
    let curDirection = "DOWN";
    let forceDirectionChange = false;
    let currentCount = 0;

    grid[curY][curX] = 1;
    pathCoords.push({ x: curX, y: curY });

    // === Generate path ===
    while (curY < GRID_SIZE - 1) {
        checkDirections();
        chooseDirection();

        if (curDirection === "LEFT" && curX > 0) curX--;
        else if (curDirection === "RIGHT" && curX < GRID_SIZE - 1) curX++;
        else if (curDirection === "DOWN" && curY < GRID_SIZE - 1) curY++;

        grid[curY][curX] = 1;
        pathCoords.push({ x: curX, y: curY });
    }

    // === Draw tiles ===
    for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
            const val = grid[r][c]; // 1 = path, 0 = buildable
            const geo = new THREE.BoxGeometry(TILE_SIZE, 0.5, TILE_SIZE);

            let mat;
            if (val === 1) {
                mat = new THREE.MeshBasicMaterial({ color: 0xffd700 }); // path
            } else {
                mat = new THREE.MeshBasicMaterial({ map: grassTexture }); // grass
            }

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
    function checkDirections() {
        if (curDirection === "LEFT" && (curX - 1 < 0 || grid[curY][curX - 1] !== 0)) forceDirectionChange = true;
        else if (curDirection === "RIGHT" && (curX + 1 >= GRID_SIZE || grid[curY][curX + 1] !== 0)) forceDirectionChange = true;
        else if (curDirection !== "DOWN") forceDirectionChange = true;
    }

    function chooseDirection() {
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
    }

    function changeDirection() {
        const dirValue = Math.floor(Math.random() * 3);
        if (curDirection === "LEFT" || curDirection === "RIGHT") {
            curDirection = "DOWN";
            return;
        }
        if (dirValue === 0 && curX > 0) curDirection = "LEFT";
        else if (dirValue === 1 && curX < GRID_SIZE - 1) curDirection = "RIGHT";
        else curDirection = "DOWN";
    }

    return { pathTiles, tiles, grid, pathCoords };
}
