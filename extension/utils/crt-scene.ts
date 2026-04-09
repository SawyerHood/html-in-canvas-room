import * as THREE from 'three';
import { CITY_BACKDROP_URL } from './skybox-data';
import { NEON_DRIFT_URL, LAST_SIGNAL_URL } from './poster-data';
import { ROOM_SIZE, ROOM_HEIGHT, DESK_TOP, SCR_W, SCR_H } from './scene/constants';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 3.0;

  const scene = new THREE.Scene();

  // Dark night sky background
  scene.background = new THREE.Color(0x1c1d4a); // matches the sky in the city photo
  scene.fog = new THREE.FogExp2(0x1a1a28, 0.015);

  // City backdrop — large plane placed outside the open left wall
  const cityImg = new Image();
  cityImg.onload = () => {
    const tex = new THREE.Texture(cityImg);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    tex.needsUpdate = true;

    // City backdrop — curved cylinder with vertical curvature (dome-like)
    const backdropDist = 100;
    const backdropH = 120;
    const backdropArc = Math.PI * 1.2; // 216° arc — wide panorama wraps around
    const backdropGeom = new THREE.CylinderGeometry(
      backdropDist, backdropDist, backdropH, 64, 16, true,
      -Math.PI / 2 - backdropArc / 2,
      backdropArc,
    );
    // Flip UVs horizontally so texture isn't mirrored
    const uvs = backdropGeom.attributes.uv;
    for (let i = 0; i < uvs.count; i++) uvs.setX(i, 1 - uvs.getX(i));
    const backdrop = new THREE.Mesh(
      backdropGeom,
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }),
    );
    backdrop.position.set(-ROOM_SIZE / 2, backdropH / 2 - 68, 0);
    scene.add(backdrop);
    console.log('[CRTWorld] Backdrop added, dist:', backdropDist, 'height:', backdropH);


    console.log('[CRTWorld] City backdrop loaded');
  };
  cityImg.src = CITY_BACKDROP_URL;


  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    500,
  );
  camera.position.set(0, 1.6, 3);
  camera.lookAt(0, 0.5, 0);
  scene.add(camera); // camera must be in scene for children (held items) to render

  // ROOM_SIZE, ROOM_HEIGHT imported from scene/constants

  // Collision boxes — furniture pushes colliders here as it's built
  const PLAYER_RADIUS = 0.25;
  const colliders: { minX: number; maxX: number; minZ: number; maxZ: number; cx: number; cz: number }[] = [];
  function addCollider(cx: number, cz: number, hw: number, hd: number) {
    colliders.push({
      minX: cx - hw - PLAYER_RADIUS, maxX: cx + hw + PLAYER_RADIUS,
      minZ: cz - hd - PLAYER_RADIUS, maxZ: cz + hd + PLAYER_RADIUS,
      cx, cz,
    });
  }

  // ===== Floor — dark carpet =====
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x1a1208, roughness: 0.92 }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ===== Rug under desk =====
  const rug = new THREE.Mesh(
    new THREE.PlaneGeometry(4, 3.5),
    new THREE.MeshStandardMaterial({ color: 0x2a1520, roughness: 0.95 }),
  );
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(0, 0.005, 0.5);
  scene.add(rug);

  // ===== Ceiling — dark with drop tile grid =====
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x121218, roughness: 0.9 }),
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = ROOM_HEIGHT;
  scene.add(ceiling);

  // Drop ceiling tile grid lines
  const tileLineMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.8 });
  for (let i = -3; i <= 3; i++) {
    const hLine = new THREE.Mesh(new THREE.BoxGeometry(ROOM_SIZE, 0.02, 0.03), tileLineMat);
    hLine.position.set(0, ROOM_HEIGHT - 0.01, i * 1.14);
    scene.add(hLine);
    const vLine = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, ROOM_SIZE), tileLineMat);
    vLine.position.set(i * 1.14, ROOM_HEIGHT - 0.01, 0);
    scene.add(vLine);
  }

  // ===== Walls =====
  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.85 });

  // Right wall — solid
  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), sideWallMat);
  rightWall.position.set(ROOM_SIZE / 2, ROOM_HEIGHT / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Front wall (behind player) — solid
  const frontWallMat = new THREE.MeshStandardMaterial({ color: 0x242430, roughness: 0.85 });
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), frontWallMat);
  frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_SIZE / 2);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

  // Door (decorative, mounted on the wall)
  const doorX = -1.5;
  const doorW = 0.9;
  const doorH = 2.2;
  const wallZ = ROOM_SIZE / 2 - 0.01;

  // Door frame
  const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.6 });
  const dfTop = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.12, 0.06, 0.06), doorFrameMat);
  dfTop.position.set(doorX, doorH + 0.03, wallZ);
  scene.add(dfTop);
  const dfLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH, 0.06), doorFrameMat);
  dfLeft.position.set(doorX - doorW / 2 - 0.03, doorH / 2, wallZ);
  scene.add(dfLeft);
  const dfRight = new THREE.Mesh(new THREE.BoxGeometry(0.06, doorH, 0.06), doorFrameMat);
  dfRight.position.set(doorX + doorW / 2 + 0.03, doorH / 2, wallZ);
  scene.add(dfRight);

  // Door panel
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.75 });
  const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 0.04), doorMat);
  doorPanel.position.set(doorX, doorH / 2, wallZ - 0.01);
  scene.add(doorPanel);

  // Decorative inset panels
  const panelMat = new THREE.MeshStandardMaterial({ color: 0x2e2010, roughness: 0.8 });
  for (const [py, ph] of [[0.55, 0.7], [1.55, 0.7]] as [number, number][]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.6, ph, 0.005), panelMat);
    panel.position.set(doorX, py, wallZ - 0.035);
    scene.add(panel);
  }

  // Door handle
  const knobMat = new THREE.MeshStandardMaterial({ color: 0xaa8844, roughness: 0.3, metalness: 0.6 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), knobMat);
  knob.position.set(doorX + doorW / 2 - 0.08, 1.0, wallZ - 0.045);
  scene.add(knob);
  const knobPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.015, 12), knobMat);
  knobPlate.rotation.x = Math.PI / 2;
  knobPlate.position.set(doorX + doorW / 2 - 0.08, 1.0, wallZ - 0.035);
  scene.add(knobPlate);

  // Peephole
  const peephole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.05, 8),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.5 }),
  );
  peephole.rotation.x = Math.PI / 2;
  peephole.position.set(doorX, 1.6, wallZ - 0.03);
  scene.add(peephole);

  // ===== Low-poly palm tree in pot — right of door =====
  const plantX = doorX - doorW / 2 - 0.7;
  const plantZ = wallZ - 0.5;
  // Pot
  const plantPotMat = new THREE.MeshStandardMaterial({ color: 0xb0703a, roughness: 0.8 });
  const floorPot = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.11, 0.28, 8), plantPotMat);
  floorPot.position.set(plantX, 0.14, plantZ);
  scene.add(floorPot);
  // Dirt
  const floorDirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.02, 8),
    new THREE.MeshStandardMaterial({ color: 0x2a3a15, roughness: 0.95 }),
  );
  floorDirt.position.set(plantX, 0.29, plantZ);
  scene.add(floorDirt);
  // Chunky segmented trunk
  const trunkDarkMat = new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 0.9 });
  const trunkLightMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.85 });
  const segments = 8;
  const trunkHeight = 1.4;
  const segH = trunkHeight / segments;
  for (let si = 0; si < segments; si++) {
    const t = si / segments;
    const radius = 0.04 - t * 0.015; // taper from 0.04 to 0.025
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius - 0.005, radius, segH * 0.95, 6),
      si % 2 === 0 ? trunkDarkMat : trunkLightMat,
    );
    seg.position.set(plantX, 0.30 + si * segH + segH / 2, plantZ);
    scene.add(seg);
  }
  // Coconut-like bulge at very top
  const topBulge = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 4),
    new THREE.MeshStandardMaterial({ color: 0x3a6a1a, roughness: 0.7 }),
  );
  const palmTopY = 0.30 + trunkHeight + 0.02;
  topBulge.position.set(plantX, palmTopY, plantZ);
  scene.add(topBulge);

  // Fronds — each is 3 triangles (stem + left leaf + right leaf) for a fuller look
  const frondMat = new THREE.MeshStandardMaterial({ color: 0x3a8a22, roughness: 0.7, side: THREE.DoubleSide });
  const frondDarkMat = new THREE.MeshStandardMaterial({ color: 0x2a6a18, roughness: 0.7, side: THREE.DoubleSide });
  const frondCount = 7;
  for (let fi = 0; fi < frondCount; fi++) {
    const angle = (fi / frondCount) * Math.PI * 2 + 0.2;
    const frondLen = 0.45 + Math.random() * 0.1;
    const droop = 0.3 + Math.random() * 0.25;
    const mat = fi % 2 === 0 ? frondMat : frondDarkMat;
    const frondGroup = new THREE.Group();
    frondGroup.position.set(plantX, palmTopY + 0.02, plantZ);
    frondGroup.rotation.y = angle;

    // Center stem triangle
    const stemGeo = new THREE.BufferGeometry();
    stemGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, 0,
      -0.01, -frondLen * droop, frondLen,
      0.01, -frondLen * droop, frondLen,
    ]), 3));
    stemGeo.computeVertexNormals();
    frondGroup.add(new THREE.Mesh(stemGeo, mat));

    // Left leaflets
    const leftGeo = new THREE.BufferGeometry();
    leftGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, frondLen * 0.15,
      -0.12, -frondLen * droop * 0.6, frondLen * 0.5,
      -0.02, -frondLen * droop * 0.8, frondLen * 0.75,
    ]), 3));
    leftGeo.computeVertexNormals();
    frondGroup.add(new THREE.Mesh(leftGeo, mat));

    // Right leaflets
    const rightGeo = new THREE.BufferGeometry();
    rightGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      0, 0, frondLen * 0.15,
      0.12, -frondLen * droop * 0.6, frondLen * 0.5,
      0.02, -frondLen * droop * 0.8, frondLen * 0.75,
    ]), 3));
    rightGeo.computeVertexNormals();
    frondGroup.add(new THREE.Mesh(rightGeo, mat));

    scene.add(frondGroup);
  }
  addCollider(plantX, plantZ, 0.25, 0.25); // palm tree

  // Left wall — open to city view with window frame/ledge for depth
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x222230, roughness: 0.7 });
  const wallX = -ROOM_SIZE / 2;

  // Top beam + exterior overhang (blocks view of sky above)
  const topBeam = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, ROOM_SIZE), frameMat);
  topBeam.position.set(wallX, ROOM_HEIGHT - 0.075, 0);
  scene.add(topBeam);
  const topOverhang = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.08, ROOM_SIZE + 6),
    new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.9 }),
  );
  topOverhang.position.set(wallX - 1.5, ROOM_HEIGHT - 0.04, 0);
  scene.add(topOverhang);

  // Bottom ledge + exterior lip (blocks view of ground below)
  const ledgeMat = new THREE.MeshStandardMaterial({ color: 0x2a2a35, roughness: 0.6 });
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, ROOM_SIZE), ledgeMat);
  ledge.position.set(wallX + 0.1, 0.8, 0);
  scene.add(ledge);
  const bottomOverhang = new THREE.Mesh(
    new THREE.BoxGeometry(3, 0.08, ROOM_SIZE + 6),
    new THREE.MeshStandardMaterial({ color: 0x181820, roughness: 0.9 }),
  );
  bottomOverhang.position.set(wallX - 1.5, 0.0, 0);
  scene.add(bottomOverhang);

  // Bottom wall section (below the window line)
  const bottomWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, 0.8),
    sideWallMat,
  );
  bottomWall.position.set(wallX, 0.4, 0);
  bottomWall.rotation.y = Math.PI / 2;
  scene.add(bottomWall);

  // Vertical mullions (3 pillars dividing the window)
  for (const mz of [-ROOM_SIZE / 4, 0, ROOM_SIZE / 4]) {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.08, ROOM_HEIGHT - 0.8, 0.06), frameMat);
    mullion.position.set(wallX, 0.8 + (ROOM_HEIGHT - 0.8) / 2, mz);
    scene.add(mullion);
  }

  // Baseboard under window wall
  const windowBaseboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.12, ROOM_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.7 }),
  );
  windowBaseboard.position.set(wallX + 0.02, 0.06, 0);
  scene.add(windowBaseboard);

  // Add window light from the left side
  const windowLight1 = new THREE.SpotLight(0x8899bb, 3, 10, Math.PI / 3, 0.5, 1.2);
  windowLight1.position.set(-ROOM_SIZE / 2, 2, -1.5);
  windowLight1.target.position.set(0, 0, -1.5);
  scene.add(windowLight1);
  scene.add(windowLight1.target);

  const windowLight2 = new THREE.SpotLight(0x8899bb, 3, 10, Math.PI / 3, 0.5, 1.2);
  windowLight2.position.set(-ROOM_SIZE / 2, 2, 1.5);
  windowLight2.target.position.set(0, 0, 1.5);
  scene.add(windowLight2);
  scene.add(windowLight2.target);

  // ===== Back wall — exposed brick accent =====
  const backWallBase = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ color: 0x2a1818, roughness: 0.9 }),
  );
  backWallBase.position.set(0, ROOM_HEIGHT / 2, -ROOM_SIZE / 2);
  scene.add(backWallBase);

  // Brick rows
  const brickW = 0.28, brickH = 0.1, brickD = 0.04, mortarGap = 0.03;
  const brickColors = [0x3a2020, 0x4a2a2a, 0x3d2525, 0x452828, 0x382020];
  for (let row = 0; row < 24; row++) {
    const y = row * (brickH + mortarGap) + brickH / 2 + 0.05;
    if (y > ROOM_HEIGHT) break;
    const offset = row % 2 === 0 ? 0 : (brickW + mortarGap) / 2;
    for (let col = -14; col < 14; col++) {
      const x = col * (brickW + mortarGap) + offset;
      if (Math.abs(x) > ROOM_SIZE / 2) continue;
      const color = brickColors[Math.floor(Math.random() * brickColors.length)];
      const brick = new THREE.Mesh(
        new THREE.BoxGeometry(brickW, brickH, brickD),
        new THREE.MeshStandardMaterial({ color, roughness: 0.95 }),
      );
      brick.position.set(x, y, -ROOM_SIZE / 2 + brickD / 2 + 0.01);
      scene.add(brick);
    }
  }

  // Vertical corner trim where brick wall meets side walls
  const cornerTrimMat = new THREE.MeshStandardMaterial({ color: 0x1a1a20, roughness: 0.7 });
  const cornerTrimR = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, ROOM_HEIGHT, 0.06),
    cornerTrimMat,
  );
  cornerTrimR.position.set(ROOM_SIZE / 2 - 0.03, ROOM_HEIGHT / 2, -ROOM_SIZE / 2 + 0.03);
  scene.add(cornerTrimR);
  // Left corner (where brick wall meets open left wall area)
  const cornerTrimL = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, ROOM_HEIGHT, 0.06),
    cornerTrimMat,
  );
  cornerTrimL.position.set(-ROOM_SIZE / 2 + 0.03, ROOM_HEIGHT / 2, -ROOM_SIZE / 2 + 0.03);
  scene.add(cornerTrimL);

  // Baseboard trim
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.7 });
  // Back wall
  const trimBack = new THREE.Mesh(new THREE.BoxGeometry(ROOM_SIZE, 0.12, 0.04), trimMat);
  trimBack.position.set(0, 0.06, -ROOM_SIZE / 2 + 0.02);
  scene.add(trimBack);
  // Right wall
  const trimRight = new THREE.Mesh(new THREE.BoxGeometry(ROOM_SIZE, 0.12, 0.04), trimMat);
  trimRight.position.set(ROOM_SIZE / 2 - 0.02, 0.06, 0);
  trimRight.rotation.y = Math.PI / 2;
  scene.add(trimRight);
  // Front wall — split around door (doorX=-1.5, doorW=0.9)
  const doorLeft = -1.5 - 0.9 / 2 - 0.03; // left edge of door frame
  const doorRight = -1.5 + 0.9 / 2 + 0.03; // right edge of door frame
  const trimFrontLeftW = ROOM_SIZE / 2 + doorLeft;
  const trimFrontLeft = new THREE.Mesh(new THREE.BoxGeometry(trimFrontLeftW, 0.12, 0.04), trimMat);
  trimFrontLeft.position.set(-ROOM_SIZE / 2 + trimFrontLeftW / 2, 0.06, ROOM_SIZE / 2 - 0.02);
  scene.add(trimFrontLeft);
  const trimFrontRightW = ROOM_SIZE / 2 - doorRight;
  const trimFrontRight = new THREE.Mesh(new THREE.BoxGeometry(trimFrontRightW, 0.12, 0.04), trimMat);
  trimFrontRight.position.set(ROOM_SIZE / 2 - trimFrontRightW / 2, 0.06, ROOM_SIZE / 2 - 0.02);
  scene.add(trimFrontRight);

  // ===== CRT Monitor — scaled to match chair proportions =====
  const monitorGroup = new THREE.Group();

  // Body — ~0.7 wide, proportional to chair
  const bodyGeom = new THREE.BoxGeometry(0.7, 0.55, 0.55);
  const bodyPos = bodyGeom.attributes.position;
  for (let i = 0; i < bodyPos.count; i++) {
    if (bodyPos.getZ(i) < 0) {
      bodyPos.setX(i, bodyPos.getX(i) * 0.85);
      bodyPos.setY(i, bodyPos.getY(i) * 0.85);
    }
  }
  bodyGeom.computeVertexNormals();
  const bodyMesh = new THREE.Mesh(
    bodyGeom,
    new THREE.MeshStandardMaterial({ color: 0xc8c0a8, roughness: 0.85 }),
  );
  bodyMesh.position.set(0, 0.3, 0);
  monitorGroup.add(bodyMesh);

  // Bezel
  const bezelMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.47, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.9 }),
  );
  bezelMesh.position.set(0, 0.3, 0.28);
  monitorGroup.add(bezelMesh);

  // Screen — curved plane
  // SCR_W, SCR_H imported from scene/constants
  const screenGeom = new THREE.PlaneGeometry(SCR_W, SCR_H, 40, 40);
  const screenPos = screenGeom.attributes.position;
  for (let i = 0; i < screenPos.count; i++) {
    const nx = screenPos.getX(i) / (SCR_W / 2);
    const ny = screenPos.getY(i) / (SCR_H / 2);
    screenPos.setZ(i, (nx * nx + ny * ny) * 0.015);
  }
  screenGeom.computeVertexNormals();
  const screenMesh = new THREE.Mesh(
    screenGeom,
    new THREE.MeshBasicMaterial({ color: 0x111122 }),
  );
  screenMesh.position.set(0, 0.3, 0.295);
  monitorGroup.add(screenMesh);

  // Stand
  const standMat = new THREE.MeshStandardMaterial({ color: 0xb0a890, roughness: 0.85 });
  const standBase = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.25), standMat);
  standBase.position.set(0, 0.01, 0.08);
  monitorGroup.add(standBase);
  const standNeck = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.12), standMat);
  standNeck.position.set(0, 0.03, 0.04);
  monitorGroup.add(standNeck);

  // Position group so stand sits on desk surface
  // DESK_TOP imported from scene/constants
  monitorGroup.position.set(0, DESK_TOP, -3.2);
  scene.add(monitorGroup);

  // ===== Gaming Desk — black =====
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.1 });
  const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 1.5), deskMat);
  deskMesh.position.set(0, DESK_TOP, -3.25);
  scene.add(deskMesh);
  addCollider(0, -3.25, 1.7, 0.95); // desk

  const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.3 });
  const legGeom = new THREE.BoxGeometry(0.06, DESK_TOP, 0.06);
  for (const [x, z] of [[-1.4, -3.9], [1.4, -3.9], [-1.4, -2.6], [1.4, -2.6]]) {
    const leg = new THREE.Mesh(legGeom, legMat);
    leg.position.set(x, DESK_TOP / 2, z);
    scene.add(leg);
  }

  // ===== LED strip along back edge of desk =====
  const ledStrip = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.02, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 2.0, roughness: 0.2,
    }),
  );
  ledStrip.position.set(0, DESK_TOP - 0.02, -3.95);
  scene.add(ledStrip);

  const ledGlow = new THREE.PointLight(0x00ddbb, 1.5, 4, 2);
  ledGlow.position.set(0, DESK_TOP - 0.3, -3.75);
  scene.add(ledGlow);

  // Second LED strip under desk front edge
  const ledStrip2 = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.02, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x8800ff, emissive: 0x8800ff, emissiveIntensity: 1.5, roughness: 0.2,
    }),
  );
  ledStrip2.position.set(0, DESK_TOP - 0.02, -2.55);
  scene.add(ledStrip2);

  const ledGlow2 = new THREE.PointLight(0x7700dd, 0.8, 3, 2);
  ledGlow2.position.set(0, DESK_TOP - 0.3, -2.45);
  scene.add(ledGlow2);

  // ===== Peripherals — dark to match gaming desk =====
  const peripheralMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const kbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18), peripheralMat);
  kbMesh.position.set(0, DESK_TOP + 0.04, -2.7);
  scene.add(kbMesh);

  const mouseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), peripheralMat);
  mouseMesh.position.set(0.4, DESK_TOP + 0.04, -2.65);
  scene.add(mouseMesh);

  // ===== Gaming Chair — black with red accents =====
  const chairBlack = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.65 });
  const chairRed = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });

  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), chairBlack);
  chairSeat.position.set(0, 0.5, -1.6);
  scene.add(chairSeat);
  addCollider(0, -1.45, 0.5, 0.45); // chair
  // Red trim on seat edges
  const seatTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.6), chairRed);
  seatTrimL.position.set(-0.35, 0.5, -1.6);
  scene.add(seatTrimL);
  const seatTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.6), chairRed);
  seatTrimR.position.set(0.35, 0.5, -1.6);
  scene.add(seatTrimR);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.06), chairBlack);
  chairBack.position.set(0, 0.92, -1.3);
  scene.add(chairBack);
  // Red stripe on chair back
  const backStripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.07), chairRed);
  backStripe.position.set(0, 0.92, -1.29);
  scene.add(backStripe);

  // Chair base — star base with cylinder
  const chairPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.7 }),
  );
  chairPole.position.set(0, 0.25, -1.45);
  scene.add(chairPole);
  // Star base arms
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.03, 0.35),
      new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.5 }),
    );
    arm.position.set(
      Math.sin(angle) * 0.15,
      0.03,
      -1.45 + Math.cos(angle) * 0.15,
    );
    arm.rotation.y = -angle;
    scene.add(arm);
  }

  // ===== Bookshelf — left wall =====
  const shelfWood = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 });
  const shelfGroup = new THREE.Group();

  // Frame
  const shelfBack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.04), shelfWood);
  shelfBack.position.set(0, 1.1, 0);
  shelfGroup.add(shelfBack);
  const shelfSideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 0.4), shelfWood);
  shelfSideL.position.set(-0.6, 1.1, 0.2);
  shelfGroup.add(shelfSideL);
  const shelfSideR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.2, 0.4), shelfWood);
  shelfSideR.position.set(0.6, 1.1, 0.2);
  shelfGroup.add(shelfSideR);

  // Shelves
  for (let i = 0; i < 5; i++) {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.03, 0.38), shelfWood);
    shelf.position.set(0, i * 0.44 + 0.22, 0.2);
    shelfGroup.add(shelf);
  }

  // Books — colored boxes on shelves
  const bookColors = [0x8b2020, 0x204080, 0x208040, 0x806020, 0x602080, 0x208080, 0x804020];
  for (let shelf = 0; shelf < 4; shelf++) {
    const shelfY = shelf * 0.44 + 0.24;
    const numBooks = 3 + Math.floor(Math.random() * 4);
    let bx = -0.45;
    for (let b = 0; b < numBooks && bx < 0.45; b++) {
      const bw = 0.06 + Math.random() * 0.08;
      const bh = 0.2 + Math.random() * 0.18;
      const book = new THREE.Mesh(
        new THREE.BoxGeometry(bw, bh, 0.2),
        new THREE.MeshStandardMaterial({
          color: bookColors[Math.floor(Math.random() * bookColors.length)],
          roughness: 0.8,
        }),
      );
      book.position.set(bx + bw / 2, shelfY + bh / 2, 0.2);
      shelfGroup.add(book);
      bx += bw + 0.02;
    }
  }

  // Lava lamp on top shelf
  const lavaBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.05, 0.06, 12),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.5 }),
  );
  lavaBase.position.set(0.3, 1.13, 0.25);
  shelfGroup.add(lavaBase);
  const lavaBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.04, 0.2, 12),
    new THREE.MeshStandardMaterial({
      color: 0xff6020,
      emissive: 0xff4010,
      emissiveIntensity: 1.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.85,
    }),
  );
  lavaBody.position.set(0.3, 1.27, 0.25);
  shelfGroup.add(lavaBody);
  const lavaCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.5 }),
  );
  lavaCap.position.set(0.3, 1.39, 0.25);
  shelfGroup.add(lavaCap);

  // Plant on top shelf
  const potMat = new THREE.MeshStandardMaterial({ color: 0x884430, roughness: 0.8 });
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.08, 12), potMat);
  pot.position.set(-0.3, 1.98 + 0.04, 0.25);
  shelfGroup.add(pot);
  // Dirt
  const dirt = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.02, 12),
    new THREE.MeshStandardMaterial({ color: 0x3a2a15, roughness: 0.95 }),
  );
  dirt.position.set(-0.3, 1.98 + 0.09, 0.25);
  shelfGroup.add(dirt);
  // Leaves — small green spheres
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2d6a1e, roughness: 0.8 });
  for (const [lx, ly, lz, ls] of [
    [0, 0.12, 0, 0.06],
    [-0.04, 0.09, 0.03, 0.04],
    [0.03, 0.10, -0.02, 0.045],
    [-0.02, 0.14, -0.01, 0.035],
    [0.02, 0.08, 0.02, 0.038],
  ] as [number, number, number, number][]) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(ls, 8, 6), leafMat);
    leaf.position.set(-0.3 + lx, 1.98 + ly, 0.25 + lz);
    shelfGroup.add(leaf);
  }

  shelfGroup.position.set(2.2, 0, -ROOM_SIZE / 2 + 0.25);
  shelfGroup.rotation.y = 0;
  scene.add(shelfGroup);
  addCollider(2.2, -ROOM_SIZE / 2 + 0.25, 0.7, 0.3); // bookshelf

  // Lava lamp glow light
  const lavaGlow = new THREE.PointLight(0xff5010, 0.8, 3, 2);
  lavaGlow.position.set(2.5, 1.3, -ROOM_SIZE / 2 + 0.5);
  scene.add(lavaGlow);

  // ===== Mini fridge — right of desk =====
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.4, metalness: 0.2 });
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.45), fridgeMat);
  fridge.position.set(1.0, 0.35, -3.3);
  scene.add(fridge);
  addCollider(1.0, -3.3, 0.35, 0.35); // mini fridge
  // Door line
  const fridgeDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.01, 0.43),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 }),
  );
  fridgeDoor.position.set(1.0, 0.55, -3.3);
  scene.add(fridgeDoor);
  // Handle
  const fridgeHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.15, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.6 }),
  );
  fridgeHandle.position.set(1.0, 0.55, -3.08);
  scene.add(fridgeHandle);

  // ===== Pizza box on desk =====
  const pizzaBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.04, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xc4a060, roughness: 0.9 }),
  );
  pizzaBox.position.set(-1.0, DESK_TOP + 0.04, -3.1);
  scene.add(pizzaBox);

  // ===== Beer cans on desk =====
  const canMat = new THREE.MeshStandardMaterial({ color: 0xc8a84e, roughness: 0.3, metalness: 0.5 });
  for (const [cx, cz] of [[-0.8, -2.9], [-0.6, -3.05], [0.9, -3.0]]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), canMat);
    can.position.set(cx, DESK_TOP + 0.08, cz);
    scene.add(can);
  }
  // Knocked over can
  const knockedCan = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), canMat);
  knockedCan.position.set(-0.5, DESK_TOP + 0.04, -2.85);
  knockedCan.rotation.z = Math.PI / 2;
  scene.add(knockedCan);

  // ===== Headphones on desk =====

  // ===== Poster frames on walls =====
  const posterFrame = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const posterDefs = [
    { pos: [ROOM_SIZE / 2 - 0.03, 1.6, -1.0], ry: -Math.PI / 2, url: NEON_DRIFT_URL },
    { pos: [0, 1.6, ROOM_SIZE / 2 - 0.03], ry: Math.PI, url: LAST_SIGNAL_URL },
  ];
  for (const p of posterDefs) {
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.03), posterFrame);
    frame.position.set(p.pos[0], p.pos[1], p.pos[2]);
    frame.rotation.y = p.ry;
    scene.add(frame);
    // Poster face with texture
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
    const posterImg = new Image();
    posterImg.onload = () => {
      const tex = new THREE.Texture(posterImg);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.75, 1.05),
        new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }),
      );
      face.position.set(p.pos[0], p.pos[1], p.pos[2]);
      face.rotation.y = p.ry;
      face.position.addScaledVector(normal, 0.02);
      scene.add(face);
    };
    posterImg.src = p.url;
  }

  // ===== Trash can — near desk =====
  const trashMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7, side: THREE.DoubleSide });
  const trashCan = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.15, 0.4, 16, 1, true), trashMat);
  trashCan.position.set(-1.3, 0.2, -2.0);
  scene.add(trashCan);
  addCollider(-1.3, -2.0, 0.25, 0.25); // trash can
  // Bottom
  const trashBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 16), trashMat);
  trashBottom.position.set(-1.3, 0.01, -2.0);
  scene.add(trashBottom);
  // Crumpled paper balls
  const paperMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.95 });
  for (const [px, py, pz, ps] of [
    [-1.3, 0.32, -2.0, 0.05], [-1.25, 0.28, -1.95, 0.04], [-1.35, 0.35, -2.05, 0.045],
    [-1.15, 0.03, -1.85, 0.04], [-1.4, 0.04, -2.15, 0.035], // missed shots on floor
  ] as [number, number, number, number][]) {
    const paper = new THREE.Mesh(new THREE.IcosahedronGeometry(ps, 0), paperMat);
    paper.position.set(px, py, pz);
    paper.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    scene.add(paper);
  }

  // ===== String lights along ceiling edge (back wall) =====
  const stringLightCount = 12;
  const stringY = ROOM_HEIGHT - 0.1;
  const stringZ = -ROOM_SIZE / 2 + 0.15;
  // Wire
  const wireMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
  const wire = new THREE.Mesh(
    new THREE.BoxGeometry(ROOM_SIZE * 0.8, 0.008, 0.008), wireMat,
  );
  wire.position.set(0, stringY, stringZ);
  scene.add(wire);
  // Bulbs
  const bulbColors = [0xff4444, 0x44ff44, 0x4488ff, 0xffaa22, 0xff44aa, 0x44ffdd];
  const stringBulbs: THREE.Mesh[] = [];
  for (let idx = 0; idx < stringLightCount; idx++) {
    const bx = -ROOM_SIZE * 0.38 + idx * (ROOM_SIZE * 0.76 / (stringLightCount - 1));
    const droop = Math.sin((idx / (stringLightCount - 1)) * Math.PI) * 0.08;
    const bulbColor = bulbColors[idx % bulbColors.length];
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.025, 8, 6),
      new THREE.MeshStandardMaterial({
        color: bulbColor, emissive: bulbColor, emissiveIntensity: 1.5,
        roughness: 0.3, transparent: true, opacity: 0.9,
      }),
    );
    bulb.position.set(bx, stringY - 0.04 - droop, stringZ);
    scene.add(bulb);
    stringBulbs.push(bulb);
  }

  // ===== Wall clock (right wall) =====
  const clockFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.22, 0.03, 32),
    new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5 }),
  );
  clockFace.rotation.z = Math.PI / 2;
  clockFace.position.set(ROOM_SIZE / 2 - 0.02, 2.0, 1.5);
  scene.add(clockFace);
  // Clock rim
  const clockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.22, 0.015, 8, 32),
    new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.4, metalness: 0.5 }),
  );
  clockRim.rotation.y = Math.PI / 2;
  clockRim.position.set(ROOM_SIZE / 2 - 0.02, 2.0, 1.5);
  scene.add(clockRim);
  // Hour marks
  for (let h = 0; h < 12; h++) {
    const angle = (h / 12) * Math.PI * 2;
    const mark = new THREE.Mesh(
      new THREE.BoxGeometry(0.01, 0.03, 0.005),
      new THREE.MeshStandardMaterial({ color: 0x222222 }),
    );
    mark.position.set(
      ROOM_SIZE / 2 - 0.01,
      2.0 + Math.cos(angle) * 0.18,
      1.5 + Math.sin(angle) * 0.18,
    );
    mark.rotation.x = -angle;
    scene.add(mark);
  }
  // Hands (will be animated) — pivoted at center of clock face
  const handMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const clockCenter = new THREE.Vector3(ROOM_SIZE / 2 - 0.03, 2.0, 1.5);
  const hourHand = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.12), handMat);
  hourHand.geometry.translate(0, 0, 0.06);
  hourHand.position.copy(clockCenter);
  scene.add(hourHand);
  const minuteHand = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.16), handMat);
  minuteHand.geometry.translate(0, 0, 0.08);
  minuteHand.position.copy(clockCenter);
  scene.add(minuteHand);

  // ===== Stacked game cases near bookshelf =====
  const caseColors = [0x1a3a6a, 0x2a5a2a, 0x5a1a3a, 0x4a3a1a, 0x1a4a4a, 0x3a1a5a];
  let caseY = 0;
  for (let gc = 0; gc < 6; gc++) {
    const gameCase = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.02, 0.19),
      new THREE.MeshStandardMaterial({ color: caseColors[gc], roughness: 0.7 }),
    );
    caseY += 0.02;
    gameCase.position.set(3.0, caseY, -ROOM_SIZE / 2 + 0.3);
    // Slight random rotation for messy stack
    gameCase.rotation.y = (Math.random() - 0.5) * 0.15;
    scene.add(gameCase);
  }
  addCollider(3.0, -ROOM_SIZE / 2 + 0.3, 0.2, 0.2); // game cases

  // ===== Bean bag chair in far corner =====
  const beanBag = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshStandardMaterial({ color: 0x3a2050, roughness: 0.95 }),
  );
  beanBag.scale.set(1, 0.6, 1);
  beanBag.position.set(3.0, 0.27, 2.8);
  scene.add(beanBag);
  addCollider(3.0, 2.8, 0.55, 0.55); // bean bag

  // ===== Record cabinet + player =====
  // Everything in a group so we can position/rotate it once
  const rpGroup = new THREE.Group();
  rpGroup.position.set(0, 0, ROOM_SIZE / 2 - 0.3); // under poster, against front wall
  rpGroup.rotation.y = Math.PI; // face into the room

  const rpWoodMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 });
  // Cabinet body
  const cabinetBody = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.55, 0.45), rpWoodMat);
  cabinetBody.position.y = 0.275;
  rpGroup.add(cabinetBody);
  // Cabinet top surface
  const cabinetTop = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.03, 0.48), rpWoodMat);
  cabinetTop.position.y = 0.565;
  rpGroup.add(cabinetTop);
  // Cabinet legs
  const cabinetLegMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.7 });
  for (const [lx, lz] of [[-0.35, 0.18], [0.35, 0.18], [-0.35, -0.18], [0.35, -0.18]]) {
    const cleg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.08, 8), cabinetLegMat);
    cleg.position.set(lx, 0.0, lz);
    rpGroup.add(cleg);
  }
  // Open front compartment
  const compartment = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.35, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x0a0804, roughness: 0.9 }),
  );
  compartment.position.set(0, 0.22, 0.23);
  rpGroup.add(compartment);

  // Record crate — records standing vertically in compartment
  const RECORDS = [
    { color: 0xcc4422, label: 0xffdd44, name: 'lofi hip hop', url: 'jfKfPfyJRdk' },
    { color: 0xddaa22, label: 0x442200, name: 'jazz fusion', url: 'r8d4bCeTcQE' },
    { color: 0x22cc44, label: 0x111111, name: 'drum and bass', url: 'hgA0TKQeNI0' },
    { color: 0xcc22aa, label: 0xffccff, name: 'garage', url: 'U8YCbEcmlfM' },
    { color: 0x2244cc, label: 0xffffff, name: 'house', url: 'ECYvgWPsfSo' },
  ];
  const recordMeshes: THREE.Mesh[] = [];
  const selectedIndicator = new THREE.Mesh(
    new THREE.BoxGeometry(0.005, 0.22, 0.22),
    new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }),
  );
  selectedIndicator.visible = false;
  rpGroup.add(selectedIndicator);

  for (let ri = 0; ri < RECORDS.length; ri++) {
    const rec = RECORDS[ri];
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.005, 20),
      new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.1 }),
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.set(-0.25 + ri * 0.1, 0.2, 0.15);
    rpGroup.add(disc);
    const discLabel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.035, 0.035, 0.006, 12),
      new THREE.MeshStandardMaterial({ color: rec.color, roughness: 0.7 }),
    );
    discLabel.rotation.z = Math.PI / 2;
    discLabel.position.set(-0.25 + ri * 0.1, 0.2, 0.15);
    rpGroup.add(discLabel);
    recordMeshes.push(disc);
  }

  // Record player base (on top of cabinet)
  const rpBaseMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 });
  const rpBase = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.32), rpBaseMat);
  rpBase.position.y = 0.60;
  rpGroup.add(rpBase);

  // Platter
  const platterMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.2 });
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 24), platterMat);
  platter.position.set(-0.05, 0.625, 0);
  rpGroup.add(platter);

  // Vinyl record group (spins together)
  const vinyl = new THREE.Group();
  vinyl.position.set(-0.05, 0.635, 0);
  const vinylMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.3, metalness: 0.1 });
  const vinylDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.005, 24), vinylMat);
  vinyl.add(vinylDisc);
  const labelMat = new THREE.MeshStandardMaterial({ color: 0xcc4422, roughness: 0.7 });
  const labelDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), labelMat);
  labelDisc.position.y = 0.003;
  vinyl.add(labelDisc);
  const labelDot = new THREE.Mesh(
    new THREE.CylinderGeometry(0.005, 0.005, 0.002, 8),
    new THREE.MeshStandardMaterial({ color: 0xffdd44, roughness: 0.6 }),
  );
  labelDot.position.set(0.015, 0.007, 0.01);
  vinyl.add(labelDot);
  const labelMark = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.002, 0.004),
    new THREE.MeshStandardMaterial({ color: 0x331100, roughness: 0.8 }),
  );
  labelMark.position.set(-0.008, 0.007, -0.005);
  vinyl.add(labelMark);
  rpGroup.add(vinyl);

  // Tonearm (pivots from base)
  const armMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.6 });
  const tonearmBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.03, 8), armMat);
  tonearmBase.position.set(0.15, 0.635, -0.15);
  rpGroup.add(tonearmBase);
  const tonearmGroup = new THREE.Group();
  tonearmGroup.position.set(0.15, 0.65, -0.15);
  const tonearmBar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, 0.25), armMat);
  tonearmBar.position.set(0, 0, 0.125);
  tonearmGroup.add(tonearmBar);
  const headshell = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.006, 0.02), armMat);
  headshell.position.set(0, -0.003, 0.255);
  tonearmGroup.add(headshell);
  tonearmGroup.rotation.y = 0.4;
  rpGroup.add(tonearmGroup);

  // Speakers flanking the cabinet
  const speakerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7 });
  const coneMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5 });
  for (const sx of [-0.6, 0.6]) {
    // Cabinet
    const spkBox = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.35, 0.2), speakerMat);
    spkBox.position.set(sx, 0.175, 0);
    rpGroup.add(spkBox);
    // Woofer
    const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.02, 16), coneMat);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(sx, 0.14, 0.11);
    rpGroup.add(woofer);
    // Tweeter
    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.015, 12), coneMat);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(sx, 0.26, 0.11);
    rpGroup.add(tweeter);
  }

  scene.add(rpGroup);
  addCollider(0, ROOM_SIZE / 2 - 0.3, 0.75, 0.35); // cabinet + speakers

  // ===== Floor lamp near bean bag =====
  const lampBaseMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.3 });
  // Base
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.03, 16), lampBaseMat);
  lampBase.position.set(3.5, 0.015, 3.5);
  scene.add(lampBase);
  addCollider(3.5, 3.5, 0.2, 0.2); // floor lamp
  // Pole
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), lampBaseMat);
  lampPole.position.set(3.5, 0.73, 3.5);
  scene.add(lampPole);
  // Shade (cone, open bottom)
  const shadeMat = new THREE.MeshStandardMaterial({
    color: 0xddc8a0, roughness: 0.8, side: THREE.DoubleSide,
  });
  const lampShade = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.22, 0.28, 16, 1, true),
    shadeMat,
  );
  lampShade.position.set(3.5, 1.57, 3.5);
  scene.add(lampShade);
  // Warm light
  const lampLight = new THREE.PointLight(0xffcc88, 2.0, 6, 1.5);
  lampLight.position.set(3.5, 1.45, 3.5);
  scene.add(lampLight);

  // ===== Wall shelf with figurines (right wall, above game cases) =====
  const wallShelf = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.03, 0.8),
    new THREE.MeshStandardMaterial({ color: 0x2a1a0a, roughness: 0.8 }),
  );
  wallShelf.position.set(ROOM_SIZE / 2 - 0.02, 1.2, -2.5);
  wallShelf.rotation.y = 0;
  scene.add(wallShelf);
  // Figurines: simple body + head combos
  const figColors = [0x4488ff, 0xff4444, 0x44dd44, 0xffaa00];
  for (let fi = 0; fi < 4; fi++) {
    const fz = -2.8 + fi * 0.2;
    const figBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.025, 0.07, 8),
      new THREE.MeshStandardMaterial({ color: figColors[fi], roughness: 0.6 }),
    );
    figBody.position.set(ROOM_SIZE / 2 - 0.02, 1.25, fz);
    scene.add(figBody);
    const figHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xf0d0b0, roughness: 0.7 }),
    );
    figHead.position.set(ROOM_SIZE / 2 - 0.02, 1.31, fz);
    scene.add(figHead);
  }

  // ===== Sneakers by the front wall =====
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.6 });
  const soleMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
  const laceMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.7 });
  for (const [sx, rot] of [[1.8, -0.1], [1.97, 0.2]] as [number, number][]) {
    const shoeGroup = new THREE.Group();
    shoeGroup.position.set(sx, 0, ROOM_SIZE / 2 - 0.2);
    shoeGroup.rotation.y = rot;
    // Sole — slightly wider at front
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.26), soleMat);
    sole.position.y = 0.01;
    shoeGroup.add(sole);
    // Midsole stripe
    const midsole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.012, 0.26), shoeMat);
    midsole.position.y = 0.026;
    shoeGroup.add(midsole);
    // Upper — back half (ankle area, taller)
    const upperBack = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.06, 0.12), shoeMat);
    upperBack.position.set(0, 0.062, -0.06);
    shoeGroup.add(upperBack);
    // Upper — front half (toe box, lower)
    const upperFront = new THREE.Mesh(new THREE.BoxGeometry(0.088, 0.04, 0.12), shoeMat);
    upperFront.position.set(0, 0.052, 0.06);
    shoeGroup.add(upperFront);
    // Toe cap — rounded front
    const toeCap = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      shoeMat,
    );
    toeCap.rotation.x = -Math.PI / 2;
    toeCap.position.set(0, 0.04, 0.12);
    shoeGroup.add(toeCap);
    // Tongue
    const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.08), laceMat);
    tongue.position.set(0, 0.085, 0.0);
    tongue.rotation.x = 0.2;
    shoeGroup.add(tongue);
    // Swoosh / accent stripe on each side
    for (const side of [-1, 1]) {
      const swoosh = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.02, 0.12), accentMat);
      swoosh.position.set(side * 0.047, 0.05, 0.0);
      shoeGroup.add(swoosh);
    }
    // Lace holes (small dots)
    for (let li = 0; li < 3; li++) {
      const lace = new THREE.Mesh(new THREE.SphereGeometry(0.004, 4, 4), laceMat);
      lace.position.set(0.015, 0.08, -0.02 + li * 0.035);
      shoeGroup.add(lace);
      const lace2 = new THREE.Mesh(new THREE.SphereGeometry(0.004, 4, 4), laceMat);
      lace2.position.set(-0.015, 0.08, -0.02 + li * 0.035);
      shoeGroup.add(lace2);
    }
    scene.add(shoeGroup);
  }

  // ===== Interaction Zone (unchanged) =====
  const interactionZone = new THREE.Mesh(
    new THREE.BoxGeometry(4.0, 4.0, 4.0),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  interactionZone.position.set(0, 1.2, -3.0);
  interactionZone.name = 'interactionZone';
  scene.add(interactionZone);

  // ===== Lighting — well-lit gamer basement =====

  // Strong ambient so nothing is pitch black
  scene.add(new THREE.AmbientLight(0x606070, 2.0));

  // CRT screen glow
  const screenGlow = new THREE.PointLight(0x88aadd, 5.0, 8, 1);
  screenGlow.position.set(0, 0.9, -2.5);
  scene.add(screenGlow);

  // Overhead ceiling light fixture (center of room)
  const fixtureMat = new THREE.MeshStandardMaterial({ color: 0x222228, roughness: 0.5, metalness: 0.3 });
  // Circular base plate flush with ceiling
  const fixtureBase = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 24), fixtureMat);
  fixtureBase.position.set(0, ROOM_HEIGHT - 0.03, 0);
  scene.add(fixtureBase);
  // Frosted glass cylinder (emissive so it glows)
  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xeeddcc, emissive: 0xeeddcc, emissiveIntensity: 0.4, roughness: 0.8,
  });
  const fixtureDome = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 0.06, 24),
    domeMat,
  );
  fixtureDome.position.set(0, ROOM_HEIGHT - 0.05, 0);
  scene.add(fixtureDome);
  // Light source inside the fixture
  const overheadLight = new THREE.PointLight(0xeeddcc, 1.5, 12, 1);
  overheadLight.position.set(0, ROOM_HEIGHT - 0.1, 0);
  scene.add(overheadLight);

  // City glow from open left wall
  const moonLight = new THREE.DirectionalLight(0x8899bb, 1.5);
  moonLight.position.set(-5, 3, 0);
  scene.add(moonLight);

  // Hemisphere light for natural fill
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x333320, 0.8));

  // ===== Dust particles — floating motes catching the light =====
  const DUST_COUNT = 60;
  const dustGeom = new THREE.BufferGeometry();
  const dustPositions = new Float32Array(DUST_COUNT * 3);
  const dustVelocities = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * ROOM_SIZE * 0.9;
    dustPositions[i * 3 + 1] = Math.random() * ROOM_HEIGHT;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * ROOM_SIZE * 0.9;
    dustVelocities[i * 3] = (Math.random() - 0.5) * 0.03;
    dustVelocities[i * 3 + 1] = 0.01 + Math.random() * 0.02;
    dustVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.03;
  }
  dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustMat = new THREE.PointsMaterial({
    color: 0x887766, size: 0.006, transparent: true, opacity: 0.12,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const dustPoints = new THREE.Points(dustGeom, dustMat);
  scene.add(dustPoints);

  // ===== Rain outside — falls on 3 sides of the overhang =====
  // Overhang: x from wallX to wallX-3, z from -7 to +7, y ≈ ROOM_HEIGHT
  const overhangOuterX = -ROOM_SIZE / 2 - 3;
  const overhangZMin = -(ROOM_SIZE + 6) / 2;
  const overhangZMax = (ROOM_SIZE + 6) / 2;
  const RAIN_COUNT = 500;
  const rainGeom = new THREE.BufferGeometry();
  const rainPositions = new Float32Array(RAIN_COUNT * 6); // 2 verts per line
  const rainSpeeds = new Float32Array(RAIN_COUNT);
  const rainTop = ROOM_HEIGHT + 8, rainBottom = -5;
  for (let i = 0; i < RAIN_COUNT; i++) {
    let x: number, z: number;
    const side = Math.random();
    if (side < 0.5) {
      // Outer edge (left side) — most rain here
      x = overhangOuterX - Math.random() * 15;
      z = overhangZMin + Math.random() * (overhangZMax - overhangZMin);
    } else if (side < 0.75) {
      // Front Z edge
      x = -ROOM_SIZE / 2 - Math.random() * 3;
      z = overhangZMax + Math.random() * 3;
    } else {
      // Back Z edge
      x = -ROOM_SIZE / 2 - Math.random() * 3;
      z = overhangZMin - Math.random() * 3;
    }
    const y = rainBottom + Math.random() * (rainTop - rainBottom);
    const len = 0.3 + Math.random() * 0.4;
    rainPositions[i * 6] = x;
    rainPositions[i * 6 + 1] = y;
    rainPositions[i * 6 + 2] = z;
    rainPositions[i * 6 + 3] = x + 0.02;
    rainPositions[i * 6 + 4] = y - len;
    rainPositions[i * 6 + 5] = z;
    rainSpeeds[i] = 8 + Math.random() * 6;
  }
  rainGeom.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.LineBasicMaterial({
    color: 0x8899bb, transparent: true, opacity: 0.25,
  });
  const rainLines = new THREE.LineSegments(rainGeom, rainMat);
  scene.add(rainLines);

  // Lightning light (off by default)
  const lightningLight = new THREE.DirectionalLight(0xddeeff, 0);
  lightningLight.position.set(-8, 5, 0);
  scene.add(lightningLight);
  let lightningTimer = 5 + Math.random() * 10;
  let lightningFlash = 0;

  // ===== Animate function — called each frame =====
  function animate(time: number, dt: number) {
    // --- Dust drift ---
    const posAttr = dustGeom.attributes.position as THREE.BufferAttribute;
    const pos = posAttr.array as Float32Array;
    for (let i = 0; i < DUST_COUNT; i++) {
      pos[i * 3] += dustVelocities[i * 3] * dt;
      pos[i * 3 + 1] += dustVelocities[i * 3 + 1] * dt;
      pos[i * 3 + 2] += dustVelocities[i * 3 + 2] * dt;
      // Gentle sway
      pos[i * 3] += Math.sin(time * 0.5 + i) * 0.002 * dt;
      // Wrap around room
      if (pos[i * 3 + 1] > ROOM_HEIGHT) {
        pos[i * 3 + 1] = 0.1;
        pos[i * 3] = (Math.random() - 0.5) * ROOM_SIZE * 0.9;
        pos[i * 3 + 2] = (Math.random() - 0.5) * ROOM_SIZE * 0.9;
      }
    }
    posAttr.needsUpdate = true;

    // --- Rain fall ---
    const rainPos = (rainGeom.attributes.position as THREE.BufferAttribute).array as Float32Array;
    for (let i = 0; i < RAIN_COUNT; i++) {
      const fall = rainSpeeds[i] * dt;
      rainPos[i * 6 + 1] -= fall;
      rainPos[i * 6 + 4] -= fall;
      if (rainPos[i * 6 + 1] < rainBottom) {
        const reset = rainTop - rainBottom;
        rainPos[i * 6 + 1] += reset;
        rainPos[i * 6 + 4] += reset;
      }
    }
    (rainGeom.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // --- Lightning ---
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      lightningFlash = 1.0;
      lightningTimer = 6 + Math.random() * 15;
    }
    if (lightningFlash > 0) {
      lightningFlash -= dt * 4;
      lightningLight.intensity = Math.max(0, lightningFlash) * 12;
      rainMat.opacity = 0.25 + Math.max(0, lightningFlash) * 0.4;
    } else {
      lightningLight.intensity = 0;
      rainMat.opacity = 0.25;
    }

    // --- Lava lamp pulse ---
    const lavaGlow2 = lavaBody.material as THREE.MeshStandardMaterial;
    const pulse = 1.0 + 0.5 * Math.sin(time * 1.2);
    lavaGlow2.emissiveIntensity = pulse;
    lavaGlow.intensity = 0.5 + 0.4 * Math.sin(time * 1.2);
    // Shift hue slightly
    const hue = (time * 0.02) % 1;
    const lavaColor = new THREE.Color().setHSL(hue * 0.1 + 0.02, 0.9, 0.5);
    lavaGlow2.emissive.copy(lavaColor);
    lavaGlow.color.copy(lavaColor);

    // --- LED strip color cycling ---
    const ledHue1 = (time * 0.03) % 1;
    const ledHue2 = (time * 0.03 + 0.5) % 1;
    const ledColor1 = new THREE.Color().setHSL(ledHue1, 1, 0.5);
    const ledColor2 = new THREE.Color().setHSL(ledHue2, 1, 0.5);
    (ledStrip.material as THREE.MeshStandardMaterial).color.copy(ledColor1);
    (ledStrip.material as THREE.MeshStandardMaterial).emissive.copy(ledColor1);
    ledGlow.color.copy(ledColor1);
    (ledStrip2.material as THREE.MeshStandardMaterial).color.copy(ledColor2);
    (ledStrip2.material as THREE.MeshStandardMaterial).emissive.copy(ledColor2);
    ledGlow2.color.copy(ledColor2);

    // --- Overhead light subtle flicker ---
    const flicker = 1.5 + Math.sin(time * 8.3) * 0.06 + Math.sin(time * 13.7) * 0.04;
    overheadLight.intensity = flicker;

    // --- Wall clock — real time ---
    const now = new Date();
    const hours = now.getHours() % 12 + now.getMinutes() / 60;
    const minutes = now.getMinutes() + now.getSeconds() / 60;
    // Hands extend in +Z, rotate around X to sweep through Y/Z (clock on right wall)
    // 12 o'clock = pointing up (+Y) = rotation.x = -PI/2
    const hourAngle = -Math.PI / 2 - (hours / 12) * Math.PI * 2;
    const minuteAngle = -Math.PI / 2 - (minutes / 60) * Math.PI * 2;
    hourHand.rotation.set(hourAngle, 0, 0);
    minuteHand.rotation.set(minuteAngle, 0, 0);

    // --- String lights twinkle ---
    for (let si = 0; si < stringBulbs.length; si++) {
      const mat = stringBulbs[si].material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 1.2 + 0.5 * Math.sin(time * 2.0 + si * 1.7);
    }
  }

  // ===== Resize =====
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  // Record player position for interaction
  const recordPlayerPos = new THREE.Vector3(0, 0.5, ROOM_SIZE / 2 - 0.3);

  return {
    renderer, scene, camera, screenMesh, interactionZone, onResize, animate, colliders,
    vinyl, tonearmGroup, recordPlayerPos, labelDisc,
    records: RECORDS, recordMeshes, selectedIndicator,
  };
}
