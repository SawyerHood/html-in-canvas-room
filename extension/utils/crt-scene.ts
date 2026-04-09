import * as THREE from 'three';
import { CITY_BACKDROP_URL } from './skybox-data';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 3.0;

  const scene = new THREE.Scene();

  // Dark night sky background
  scene.background = new THREE.Color(0x1c1d4a); // matches the sky in the city photo

  // City backdrop — large plane placed outside the open left wall
  const cityImg = new Image();
  cityImg.onload = () => {
    const tex = new THREE.Texture(cityImg);
    tex.colorSpace = THREE.SRGBColorSpace;
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

  const ROOM_SIZE = 8;
  const ROOM_HEIGHT = 3;

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

  // Front wall (behind player)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ color: 0x242430, roughness: 0.85 }),
  );
  frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_SIZE / 2);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

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
  const trimGeom = new THREE.BoxGeometry(ROOM_SIZE, 0.12, 0.04);
  for (const [x, z, ry] of [
    [0, -ROOM_SIZE / 2 + 0.02, 0],
    [0, ROOM_SIZE / 2 - 0.02, 0],
    [ROOM_SIZE / 2 - 0.02, 0, Math.PI / 2],
  ] as [number, number, number][]) {
    const trim = new THREE.Mesh(trimGeom, trimMat);
    trim.position.set(x, 0.06, z);
    trim.rotation.y = ry;
    scene.add(trim);
  }

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
  const SCR_W = 0.54, SCR_H = 0.40;
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
  const DESK_TOP = 0.75; // desk surface height
  monitorGroup.position.set(0, DESK_TOP, -3.2);
  scene.add(monitorGroup);

  // ===== Gaming Desk — black =====
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.1 });
  const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 1.5), deskMat);
  deskMesh.position.set(0, DESK_TOP, -3.25);
  scene.add(deskMesh);

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

  // Lava lamp glow light
  const lavaGlow = new THREE.PointLight(0xff5010, 0.8, 3, 2);
  lavaGlow.position.set(2.5, 1.3, -ROOM_SIZE / 2 + 0.5);
  scene.add(lavaGlow);

  // ===== Mini fridge — right of desk =====
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.4, metalness: 0.2 });
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.45), fridgeMat);
  fridge.position.set(1.0, 0.35, -3.3);
  scene.add(fridge);
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
  const posters = [
    { pos: [ROOM_SIZE / 2 - 0.03, 1.6, -1.0], ry: -Math.PI / 2, color: 0xff4060 },
    { pos: [0, 2.2, ROOM_SIZE / 2 - 0.03], ry: Math.PI, color: 0x40ff60 },
  ];
  for (const p of posters) {
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.15, 0.03), posterFrame);
    frame.position.set(p.pos[0], p.pos[1], p.pos[2]);
    frame.rotation.y = p.ry;
    scene.add(frame);
    // Poster face
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 1.05),
      new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.8 }),
    );
    face.position.set(p.pos[0], p.pos[1], p.pos[2]);
    face.rotation.y = p.ry;
    // Offset forward slightly
    const normal = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), p.ry);
    face.position.addScaledVector(normal, 0.02);
    scene.add(face);
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

  // Overhead — bright warm bulb
  const overheadLight = new THREE.PointLight(0xffeedd, 5.0, 16, 1);
  overheadLight.position.set(0, 2.85, -2.0);
  scene.add(overheadLight);

  // Second overhead for the other half of the room
  const overheadLight2 = new THREE.PointLight(0xffeedd, 3.0, 14, 1);
  overheadLight2.position.set(0, 2.85, 2.0);
  scene.add(overheadLight2);

  // Fill from behind player
  const fillLight = new THREE.PointLight(0x9099aa, 2.0, 12, 1);
  fillLight.position.set(0, 2, 3.5);
  scene.add(fillLight);

  // Fill from the right
  const sideLight = new THREE.PointLight(0x908070, 1.5, 12, 1);
  sideLight.position.set(3, 1.5, -1);
  scene.add(sideLight);

  // City glow from open left wall
  const moonLight = new THREE.DirectionalLight(0x8899bb, 1.5);
  moonLight.position.set(-5, 3, 0);
  scene.add(moonLight);

  // Hemisphere light for natural fill
  scene.add(new THREE.HemisphereLight(0x8899bb, 0x333320, 0.8));

  // ===== Resize =====
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, screenMesh, interactionZone, onResize };
}
