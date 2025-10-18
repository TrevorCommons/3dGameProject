import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

export class Player {
    constructor(camera, bounds = null) {
        this.camera = camera; // store the camera reference for first-person usage

        // Player mesh
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ color: 0x0000ff });
        this.mesh = new THREE.Mesh(geometry, material);
        this.speed = 0.2;
        this.bounds = bounds;

         // Sword mesh (parented to camera)
         const swordGeo = new THREE.BoxGeometry(0.1, 0.1, 1);
         const swordMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
         this.sword = new THREE.Mesh(swordGeo, swordMat);
         camera.add(this.sword);
         this.sword.position.set(0.5, -0.3, -1); // adjust for first-person view
         this.sword.rotation.set(0, 0, 0);

         this.camera.add(this.sword);       // attach sword to first-person camera
         this.sword.position.set(0.5, -0.5, -1); // in front and slightly to the right
         this.sword.rotation.set(0, 0, 0); // adjust if needed       

        // Swing properties
        this.swordCooldown = 0.5; // seconds
        this.lastSwingTime = 0;
        this.swingDuration = 0.2; 
        this.swordRange = 5;
        this.swordDamage = 1;

        // Swing state
        this.swinging = false;
        this.swingElapsed = 0;

        // Enemies reference (set in main)
        this.enemies = [];

        // Listen for key press
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'f') {
                this.startSwing();
            }
        });
    }

    move(direction) {
        switch(direction) {
            case 'up': this.mesh.position.z -= this.speed; break;
            case 'down': this.mesh.position.z += this.speed; break;
            case 'left': this.mesh.position.x -= this.speed; break;
            case 'right': this.mesh.position.x += this.speed; break;
        }
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

    startSwing() {
        const currentTime = performance.now() / 1000;
        if (currentTime - this.lastSwingTime < this.swordCooldown) return;

        this.lastSwingTime = currentTime;
        this.swinging = true;
        this.swingElapsed = 0;

        // Damage enemies immediately
        this.enemies.forEach(e => {
            const dx = e.mesh.position.x - this.mesh.position.x;
            const dz = e.mesh.position.z - this.mesh.position.z;
            const dist = Math.sqrt(dx*dx + dz*dz);
            if (dist <= this.swordRange) {
                e.takeDamage(this.swordDamage);
            }
        });
    }

    update(delta) {
        if (this.swinging) {
            this.swingElapsed += delta;
            const t = this.swingElapsed / this.swingDuration;
            if (t >= 1) {
                this.sword.rotation.y = 0;
                this.sword.position.set(0.6, 1, 0);
                this.swinging = false;
            } else {
                const startRot = -Math.PI / 4;
                const endRot = Math.PI / 4;
                this.sword.rotation.y = startRot + Math.sin(t * Math.PI) * (endRot - startRot);
                this.sword.position.z = Math.sin(t * Math.PI) * 0.5;
            }
        }
    }
}
