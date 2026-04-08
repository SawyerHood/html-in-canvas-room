import * as THREE from 'three';

const MOVE_SPEED = 3.0;
const LOOK_SENSITIVITY = 0.002;
const PITCH_LIMIT = Math.PI * 0.47; // ~85 degrees

// Room boundaries
const ROOM_HALF = 3.8;
const EYE_HEIGHT = 1.6;

export class FPSControls {
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  enabled = true;

  private yaw = 0;
  private pitch = 0;
  private keys: Record<string, boolean> = {};
  private _isLocked = false;

  private onMouseMove: (e: MouseEvent) => void;
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onLockChange: () => void;

  constructor(camera: THREE.Camera, canvas: HTMLCanvasElement) {
    this.camera = camera;
    this.canvas = canvas;

    // Initialize yaw from camera direction
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, dir.y)));

    this.onMouseMove = (e: MouseEvent) => {
      if (!this._isLocked || !this.enabled) return;
      this.yaw -= e.movementX * LOOK_SENSITIVITY;
      this.pitch -= e.movementY * LOOK_SENSITIVITY;
      this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
    };

    this.onKeyDown = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = true;
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      this.keys[e.key.toLowerCase()] = false;
    };

    this.onLockChange = () => {
      this._isLocked = document.pointerLockElement === canvas;
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    document.addEventListener('pointerlockchange', this.onLockChange);
  }

  get isLocked(): boolean {
    return this._isLocked;
  }

  lock(): void {
    this.canvas.requestPointerLock();
  }

  unlock(): void {
    if (this._isLocked) document.exitPointerLock();
  }

  update(dt: number): void {
    if (!this.enabled) return;

    // Apply look rotation
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(euler);

    if (!this._isLocked) return;

    // Compute movement direction
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(this.camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0);
    right.applyQuaternion(this.camera.quaternion);
    right.y = 0;
    right.normalize();

    const velocity = new THREE.Vector3();
    if (this.keys['w']) velocity.add(forward);
    if (this.keys['s']) velocity.sub(forward);
    if (this.keys['d']) velocity.add(right);
    if (this.keys['a']) velocity.sub(right);

    if (velocity.lengthSq() > 0) {
      velocity.normalize().multiplyScalar(MOVE_SPEED * dt);
      this.camera.position.add(velocity);
    }

    // Clamp to room boundaries
    this.camera.position.x = Math.max(
      -ROOM_HALF,
      Math.min(ROOM_HALF, this.camera.position.x),
    );
    this.camera.position.z = Math.max(
      -ROOM_HALF,
      Math.min(ROOM_HALF, this.camera.position.z),
    );
    this.camera.position.y = EYE_HEIGHT;
  }

  dispose(): void {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    if (this._isLocked) document.exitPointerLock();
  }
}
