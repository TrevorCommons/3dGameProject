import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class Player {
    // Accept optional bounds object: { minX, maxX, minZ, maxZ }
    constructor(bounds = null) {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.speed = 0.2;
        this.bounds = bounds; // store bounds to clamp player inside playable area
    }

    move(direction) {
        switch(direction) {
            case 'up': this.mesh.position.z -= this.speed; break;
            case 'down': this.mesh.position.z += this.speed; break;
            case 'left': this.mesh.position.x -= this.speed; break;
            case 'right': this.mesh.position.x += this.speed; break;
        }
        // After moving, clamp inside bounds if provided
        this.clampPosition();
    }

    clampPosition() {
        if (!this.bounds) return;
        const b = this.bounds;
        if (this.mesh.position.x < b.minX) this.mesh.position.x = b.minX;
        if (this.mesh.position.x > b.maxX) this.mesh.position.x = b.maxX;
        if (this.mesh.position.z < b.minZ) this.mesh.position.z = b.minZ;
        if (this.mesh.position.z > b.maxZ) this.mesh.position.z = b.maxZ;
    }
}
