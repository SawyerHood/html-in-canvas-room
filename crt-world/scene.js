import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createScene(sceneCanvas) {
  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({
    canvas: sceneCanvas,
    antialias: true,
  });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // --- Scene ---
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06060e);

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1.2, 3.2);
  camera.lookAt(0, 0.4, 0);

  // --- Controls ---
  const controls = new OrbitControls(camera, sceneCanvas);
  controls.target.set(0, 0.4, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 1.5;
  controls.maxDistance = 8;
  controls.maxPolarAngle = Math.PI * 0.58;
  controls.minPolarAngle = Math.PI * 0.15;
  controls.update();

  // --- CRT Monitor ---
  const monitorGroup = new THREE.Group();

  // Monitor body — slightly tapered box
  const bodyGeom = new THREE.BoxGeometry(2.0, 1.6, 1.6, 1, 1, 1);
  // Taper the back vertices to simulate CRT bulge
  const bodyPos = bodyGeom.attributes.position;
  for (let i = 0; i < bodyPos.count; i++) {
    const z = bodyPos.getZ(i);
    if (z < 0) {
      // Back face — shrink slightly
      bodyPos.setX(i, bodyPos.getX(i) * 0.85);
      bodyPos.setY(i, bodyPos.getY(i) * 0.85);
    }
  }
  bodyGeom.computeVertexNormals();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xc8c0a8,
    roughness: 0.85,
    metalness: 0.0,
  });
  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.position.set(0, 0.8, 0);
  monitorGroup.add(bodyMesh);

  // Screen bezel — dark inset frame
  const bezelGeom = new THREE.BoxGeometry(1.75, 1.35, 0.06);
  const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x2a2a2a,
    roughness: 0.9,
  });
  const bezelMesh = new THREE.Mesh(bezelGeom, bezelMat);
  bezelMesh.position.set(0, 0.8, 0.8);
  monitorGroup.add(bezelMesh);

  // Screen — curved plane (will get CRT material)
  const screenGeom = new THREE.PlaneGeometry(1.55, 1.16, 40, 40);
  // Apply barrel curvature to screen
  const screenPos = screenGeom.attributes.position;
  for (let i = 0; i < screenPos.count; i++) {
    const x = screenPos.getX(i);
    const y = screenPos.getY(i);
    const nx = x / 0.775; // normalize to -1..1
    const ny = y / 0.58;
    const dist = nx * nx + ny * ny;
    screenPos.setZ(i, dist * 0.04); // subtle forward curvature
  }
  screenGeom.computeVertexNormals();

  // Placeholder material — main.js will replace with CRT material
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
  const screenMesh = new THREE.Mesh(screenGeom, screenMat);
  screenMesh.position.set(0, 0.8, 0.83);
  monitorGroup.add(screenMesh);

  // Monitor stand — rectangular base
  const standGeom = new THREE.BoxGeometry(0.8, 0.08, 0.6);
  const standMat = new THREE.MeshStandardMaterial({
    color: 0xb0a890,
    roughness: 0.85,
  });
  const standMesh = new THREE.Mesh(standGeom, standMat);
  standMesh.position.set(0, -0.01, 0.2);
  monitorGroup.add(standMesh);

  // Stand neck
  const neckGeom = new THREE.BoxGeometry(0.3, 0.1, 0.3);
  const neckMesh = new THREE.Mesh(neckGeom, standMat);
  neckMesh.position.set(0, 0.04, 0.1);
  monitorGroup.add(neckMesh);

  scene.add(monitorGroup);

  // --- Desk ---
  const deskGeom = new THREE.BoxGeometry(5, 0.08, 3);
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x3d2514,
    roughness: 0.75,
    metalness: 0.0,
  });
  const deskMesh = new THREE.Mesh(deskGeom, deskMat);
  deskMesh.position.set(0, -0.04, 0);
  scene.add(deskMesh);

  // --- Keyboard (simple) ---
  const kbGeom = new THREE.BoxGeometry(0.9, 0.04, 0.35);
  const kbMat = new THREE.MeshStandardMaterial({
    color: 0xd0c8b8,
    roughness: 0.8,
  });
  const kbMesh = new THREE.Mesh(kbGeom, kbMat);
  kbMesh.position.set(0, 0.02, 1.3);
  scene.add(kbMesh);

  // --- Mouse (simple) ---
  const mouseGeom = new THREE.BoxGeometry(0.15, 0.04, 0.22);
  const mouseMat = new THREE.MeshStandardMaterial({
    color: 0xd0c8b8,
    roughness: 0.8,
  });
  const mouseMesh = new THREE.Mesh(mouseGeom, mouseMat);
  mouseMesh.position.set(0.7, 0.02, 1.3);
  scene.add(mouseMesh);

  // --- Lighting ---

  // Ambient — very dim cool fill
  const ambient = new THREE.AmbientLight(0x303050, 0.15);
  scene.add(ambient);

  // Screen glow — warm point light in front of the CRT
  const screenGlow = new THREE.PointLight(0xaaccff, 2.5, 6, 1.5);
  screenGlow.position.set(0, 0.9, 1.6);
  scene.add(screenGlow);

  // Secondary glow — softer fill from above
  const topLight = new THREE.PointLight(0x8090a0, 0.5, 8, 2);
  topLight.position.set(0, 3, 1);
  scene.add(topLight);

  // Subtle rim light on the monitor
  const rimLight = new THREE.DirectionalLight(0x404060, 0.3);
  rimLight.position.set(-2, 2, -1);
  scene.add(rimLight);

  // --- Resize handler ---
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, controls, screenMesh };
}
