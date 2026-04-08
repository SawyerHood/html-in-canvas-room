import * as THREE from 'three';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06060e);

  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  // Spawn behind the desk, looking toward it
  camera.position.set(0, 1.6, 4);
  camera.lookAt(0, 0.8, 0);

  // ===== Room =====
  const ROOM_SIZE = 8;
  const ROOM_HEIGHT = 3;

  // Floor
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x2a1a0e,
    roughness: 0.8,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    floorMat,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  // Ceiling
  const ceilMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a24,
    roughness: 0.9,
  });
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    ceilMat,
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  scene.add(ceiling);

  // Walls
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x252535,
    roughness: 0.85,
  });

  // Back wall (behind the desk, -Z)
  const backWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    wallMat,
  );
  backWall.position.set(0, ROOM_HEIGHT / 2, -ROOM_SIZE / 2);
  scene.add(backWall);

  // Front wall (+Z, behind the player)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    wallMat,
  );
  frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_SIZE / 2);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

  // Left wall
  const leftWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    wallMat,
  );
  leftWall.position.set(-ROOM_SIZE / 2, ROOM_HEIGHT / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  // Right wall
  const rightWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    wallMat,
  );
  rightWall.position.set(ROOM_SIZE / 2, ROOM_HEIGHT / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Baseboard trim
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a20,
    roughness: 0.7,
  });
  const trimGeom = new THREE.BoxGeometry(ROOM_SIZE, 0.12, 0.04);
  for (const [x, z, ry] of [
    [0, -ROOM_SIZE / 2 + 0.02, 0],
    [0, ROOM_SIZE / 2 - 0.02, 0],
    [-ROOM_SIZE / 2 + 0.02, 0, Math.PI / 2],
    [ROOM_SIZE / 2 - 0.02, 0, Math.PI / 2],
  ] as [number, number, number][]) {
    const trim = new THREE.Mesh(trimGeom, trimMat);
    trim.position.set(x, 0.06, z);
    trim.rotation.y = ry;
    scene.add(trim);
  }

  // ===== CRT Monitor =====
  const monitorGroup = new THREE.Group();

  // Body — tapered box
  const bodyGeom = new THREE.BoxGeometry(2.0, 1.6, 1.6);
  const bodyPos = bodyGeom.attributes.position;
  for (let i = 0; i < bodyPos.count; i++) {
    if (bodyPos.getZ(i) < 0) {
      bodyPos.setX(i, bodyPos.getX(i) * 0.85);
      bodyPos.setY(i, bodyPos.getY(i) * 0.85);
    }
  }
  bodyGeom.computeVertexNormals();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xc8c0a8,
    roughness: 0.85,
  });
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.position.set(0, 0.8, 0);
  monitorGroup.add(bodyMesh);

  // Bezel
  const bezelMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 1.35, 0.06),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }),
  );
  bezelMesh.position.set(0, 0.8, 0.8);
  monitorGroup.add(bezelMesh);

  // Screen — curved plane
  const screenGeom = new THREE.PlaneGeometry(1.55, 1.16, 40, 40);
  const screenPos = screenGeom.attributes.position;
  for (let i = 0; i < screenPos.count; i++) {
    const x = screenPos.getX(i) / 0.775;
    const y = screenPos.getY(i) / 0.58;
    screenPos.setZ(i, (x * x + y * y) * 0.04);
  }
  screenGeom.computeVertexNormals();
  const screenMesh = new THREE.Mesh(
    screenGeom,
    new THREE.MeshBasicMaterial({ color: 0x111122 }),
  );
  screenMesh.position.set(0, 0.8, 0.83);
  monitorGroup.add(screenMesh);

  // Stand
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xb0a890,
    roughness: 0.85,
  });
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.6), standMat);
  standBase.position.set(0, -0.01, 0.2);
  monitorGroup.add(standBase);

  const standNeck = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.3), standMat);
  standNeck.position.set(0, 0.04, 0.1);
  monitorGroup.add(standNeck);

  scene.add(monitorGroup);

  // ===== Desk =====
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x3d2514,
    roughness: 0.75,
  });
  const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(5, 0.08, 3), deskMat);
  deskMesh.position.set(0, -0.04, 0);
  scene.add(deskMesh);

  // Desk legs
  const legGeom = new THREE.BoxGeometry(0.1, 0.8, 0.1);
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 });
  for (const [x, z] of [[-2.3, -1.3], [2.3, -1.3], [-2.3, 1.3], [2.3, 1.3]]) {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(x, -0.44, z);
    scene.add(leg);
  }

  // ===== Peripherals =====
  const peripheralMat = new THREE.MeshStandardMaterial({
    color: 0xd0c8b8,
    roughness: 0.8,
  });
  const kbMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.04, 0.35),
    peripheralMat,
  );
  kbMesh.position.set(0, 0.02, 1.3);
  scene.add(kbMesh);

  const mouseMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.04, 0.22),
    peripheralMat,
  );
  mouseMesh.position.set(0.7, 0.02, 1.3);
  scene.add(mouseMesh);

  // ===== Chair (simple) =====
  const chairMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a2a,
    roughness: 0.7,
  });
  // Seat
  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), chairMat);
  chairSeat.position.set(0, 0.5, 2.0);
  scene.add(chairSeat);
  // Back
  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.06), chairMat);
  chairBack.position.set(0, 0.85, 2.3);
  scene.add(chairBack);
  // Legs
  for (const [x, z] of [[-0.28, 1.75], [0.28, 1.75], [-0.28, 2.25], [0.28, 2.25]]) {
    const chairLeg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.5, 0.05), chairMat);
    chairLeg.position.set(x, 0.25, z);
    scene.add(chairLeg);
  }

  // ===== Invisible interaction target (for raycasting "sit down") =====
  // Large invisible interaction zone — covers desk, monitor, and space above
  // Generously sized so the look-ray hits it from any reasonable angle
  const interactionZone = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 4.0, 4.0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  interactionZone.position.set(0, 1.2, 0.5);
  interactionZone.name = 'interactionZone';
  scene.add(interactionZone);

  // ===== Lighting =====
  scene.add(new THREE.AmbientLight(0x303050, 0.12));

  // Screen glow
  const screenGlow = new THREE.PointLight(0xaaccff, 2.0, 6, 1.5);
  screenGlow.position.set(0, 0.9, 1.6);
  scene.add(screenGlow);

  // Overhead light
  const overheadLight = new THREE.PointLight(0xffeedd, 0.4, 10, 2);
  overheadLight.position.set(0, 2.8, 0);
  scene.add(overheadLight);

  // Fill from behind player
  const fillLight = new THREE.PointLight(0x8090a0, 0.2, 8, 2);
  fillLight.position.set(0, 2, 4);
  scene.add(fillLight);

  // Rim light
  const rimLight = new THREE.DirectionalLight(0x404060, 0.2);
  rimLight.position.set(-2, 2, -1);
  scene.add(rimLight);

  // ===== Resize =====
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, screenMesh, interactionZone, onResize };
}
