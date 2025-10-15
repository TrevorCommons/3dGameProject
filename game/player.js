import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class Player {
    constructor() {
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.speed = 0.2;
    }

    move(direction) {
        switch(direction) {
            case 'up': this.mesh.position.z -= this.speed; break;
            case 'down': this.mesh.position.z += this.speed; break;
            case 'left': this.mesh.position.x -= this.speed; break;
            case 'right': this.mesh.position.x += this.speed; break;
        }
    }
}
