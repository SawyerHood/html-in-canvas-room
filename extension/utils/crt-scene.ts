import * as THREE from 'three';

export function createScene(canvas: HTMLCanvasElement) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.8;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a14);

  const camera = new THREE.PerspectiveCamera(
    65,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1.6, 3);
  camera.lookAt(0, 0.5, 0);

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
  // Side walls — dark blue-gray
  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.85 });
  const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), sideWallMat);
  leftWall.position.set(-ROOM_SIZE / 2, ROOM_HEIGHT / 2, 0);
  leftWall.rotation.y = Math.PI / 2;
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT), sideWallMat);
  rightWall.position.set(ROOM_SIZE / 2, ROOM_HEIGHT / 2, 0);
  rightWall.rotation.y = -Math.PI / 2;
  scene.add(rightWall);

  // Front wall (behind player)
  const frontWall = new THREE.Mesh(
    new THREE.PlaneGeometry(ROOM_SIZE, ROOM_HEIGHT),
    new THREE.MeshStandardMaterial({ color: 0x181822, roughness: 0.85 }),
  );
  frontWall.position.set(0, ROOM_HEIGHT / 2, ROOM_SIZE / 2);
  frontWall.rotation.y = Math.PI;
  scene.add(frontWall);

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
  for (let row = 0; row < 18; row++) {
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

  // Baseboard trim
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.7 });
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
  monitorGroup.position.set(0, DESK_TOP, 0.1);
  scene.add(monitorGroup);

  // ===== Gaming Desk — black =====
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.1 });
  const deskMesh = new THREE.Mesh(new THREE.BoxGeometry(3, 0.06, 1.5), deskMat);
  deskMesh.position.set(0, DESK_TOP, 0.4);
  scene.add(deskMesh);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5, metalness: 0.3 });
  const legGeom = new THREE.BoxGeometry(0.06, DESK_TOP, 0.06);
  for (const [x, z] of [[-1.4, -0.25], [1.4, -0.25], [-1.4, 1.05], [1.4, 1.05]]) {
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
  ledStrip.position.set(0, DESK_TOP - 0.02, -0.3);
  scene.add(ledStrip);

  const ledGlow = new THREE.PointLight(0x00ddbb, 1.5, 4, 2);
  ledGlow.position.set(0, DESK_TOP - 0.3, -0.1);
  scene.add(ledGlow);

  // Second LED strip under desk front edge
  const ledStrip2 = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.02, 0.04),
    new THREE.MeshStandardMaterial({
      color: 0x8800ff, emissive: 0x8800ff, emissiveIntensity: 1.5, roughness: 0.2,
    }),
  );
  ledStrip2.position.set(0, DESK_TOP - 0.02, 1.1);
  scene.add(ledStrip2);

  const ledGlow2 = new THREE.PointLight(0x7700dd, 0.8, 3, 2);
  ledGlow2.position.set(0, DESK_TOP - 0.3, 1.2);
  scene.add(ledGlow2);

  // ===== Peripherals — dark to match gaming desk =====
  const peripheralMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.7 });
  const kbMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.18), peripheralMat);
  kbMesh.position.set(0, DESK_TOP + 0.04, 0.7);
  scene.add(kbMesh);

  const mouseMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.12), peripheralMat);
  mouseMesh.position.set(0.4, DESK_TOP + 0.04, 0.7);
  scene.add(mouseMesh);

  // ===== Gaming Chair — black with red accents =====
  const chairBlack = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.65 });
  const chairRed = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });

  const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.6), chairBlack);
  chairSeat.position.set(0, 0.5, 2.0);
  scene.add(chairSeat);
  // Red trim on seat edges
  const seatTrimL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.6), chairRed);
  seatTrimL.position.set(-0.35, 0.5, 2.0);
  scene.add(seatTrimL);
  const seatTrimR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.08, 0.6), chairRed);
  seatTrimR.position.set(0.35, 0.5, 2.0);
  scene.add(seatTrimR);

  const chairBack = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.06), chairBlack);
  chairBack.position.set(0, 0.92, 2.3);
  scene.add(chairBack);
  // Red stripe on chair back
  const backStripe = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.6, 0.07), chairRed);
  backStripe.position.set(0, 0.92, 2.31);
  scene.add(backStripe);

  // Chair base — star base with cylinder
  const chairPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8),
    new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.7 }),
  );
  chairPole.position.set(0, 0.25, 2.15);
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
      2.15 + Math.cos(angle) * 0.15,
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
  lavaBase.position.set(0.3, 1.78, 0.25);
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
  lavaBody.position.set(0.3, 1.92, 0.25);
  shelfGroup.add(lavaBody);
  const lavaCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.03, 0.04, 12),
    new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.5 }),
  );
  lavaCap.position.set(0.3, 2.04, 0.25);
  shelfGroup.add(lavaCap);

  shelfGroup.position.set(-ROOM_SIZE / 2 + 0.7, 0, -1.5);
  scene.add(shelfGroup);

  // Lava lamp glow light
  const lavaGlow = new THREE.PointLight(0xff5010, 0.8, 3, 2);
  lavaGlow.position.set(-ROOM_SIZE / 2 + 1.0, 1.9, -1.25);
  scene.add(lavaGlow);

  // ===== Mini fridge — right of desk =====
  const fridgeMat = new THREE.MeshStandardMaterial({ color: 0xa0a0a0, roughness: 0.4, metalness: 0.2 });
  const fridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.45), fridgeMat);
  fridge.position.set(2.8, 0.35, 0.5);
  scene.add(fridge);
  // Door line
  const fridgeDoor = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.01, 0.43),
    new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.5 }),
  );
  fridgeDoor.position.set(2.8, 0.55, 0.5);
  scene.add(fridgeDoor);
  // Handle
  const fridgeHandle = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.15, 0.03),
    new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.3, metalness: 0.6 }),
  );
  fridgeHandle.position.set(3.02, 0.55, 0.5);
  scene.add(fridgeHandle);

  // ===== Pizza box on desk =====
  const pizzaBox = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.04, 0.35),
    new THREE.MeshStandardMaterial({ color: 0xc4a060, roughness: 0.9 }),
  );
  pizzaBox.position.set(-1.0, DESK_TOP + 0.04, 0.5);
  scene.add(pizzaBox);

  // ===== Soda cans on desk =====
  const canMat = new THREE.MeshStandardMaterial({ color: 0xdd2222, roughness: 0.3, metalness: 0.5 });
  for (const [cx, cz] of [[-0.8, 0.7], [-0.6, 0.55], [0.9, 0.6]]) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), canMat);
    can.position.set(cx, DESK_TOP + 0.08, cz);
    scene.add(can);
  }
  // Knocked over can
  const knockedCan = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), canMat);
  knockedCan.position.set(-0.5, DESK_TOP + 0.04, 0.75);
  knockedCan.rotation.z = Math.PI / 2;
  scene.add(knockedCan);

  // ===== Headphones on desk =====
  const hpMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.6 });
  const hpBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.08, 0.01, 8, 24, Math.PI),
    hpMat,
  );
  hpBand.position.set(0.9, DESK_TOP + 0.12, 0.3);
  hpBand.rotation.x = Math.PI;
  scene.add(hpBand);
  const hpCupL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), hpMat);
  hpCupL.position.set(0.82, DESK_TOP + 0.04, 0.3);
  hpCupL.rotation.z = Math.PI / 2;
  scene.add(hpCupL);
  const hpCupR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 12), hpMat);
  hpCupR.position.set(0.98, DESK_TOP + 0.04, 0.3);
  hpCupR.rotation.z = Math.PI / 2;
  scene.add(hpCupR);

  // ===== Poster frames on walls =====
  const posterFrame = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.5 });
  const posters = [
    { pos: [-ROOM_SIZE / 2 + 0.03, 1.8, 1.5], ry: Math.PI / 2, color: 0x4060ff },
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
  interactionZone.position.set(0, 1.2, 0.5);
  interactionZone.name = 'interactionZone';
  scene.add(interactionZone);

  // ===== Lighting — gamer basement, visible but atmospheric =====

  // Ambient — warm fill so nothing is pitch black
  scene.add(new THREE.AmbientLight(0x404050, 0.8));

  // CRT screen glow
  const screenGlow = new THREE.PointLight(0x88aadd, 3.0, 6, 1.2);
  screenGlow.position.set(0, 0.5, 0.8);
  scene.add(screenGlow);

  // Overhead — warm basement bulb, brighter
  const overheadLight = new THREE.PointLight(0xffe8cc, 1.5, 12, 1.5);
  overheadLight.position.set(0, 2.85, 0);
  scene.add(overheadLight);

  // Fill from behind player
  const fillLight = new THREE.PointLight(0x8090a0, 0.6, 8, 1.5);
  fillLight.position.set(0, 2, 3.5);
  scene.add(fillLight);

  // Secondary fill from the side
  const sideLight = new THREE.PointLight(0x908070, 0.4, 8, 2);
  sideLight.position.set(3, 1.5, 0);
  scene.add(sideLight);

  // ===== Resize =====
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { renderer, scene, camera, screenMesh, interactionZone, onResize };
}
