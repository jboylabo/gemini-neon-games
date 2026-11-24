import * as THREE from 'three';
import { CarColorConfig } from './types';

export interface PlayerCarRig {
  group: THREE.Group;
  bodyGroup: THREE.Group;
  wheels: THREE.Object3D[];
  flames: THREE.Mesh[];
  shieldMesh: THREE.Mesh;
  underglowLight: THREE.PointLight;
  applyColor: (color: CarColorConfig) => void;
}

function createRoundedRectShape(width: number, height: number, radius: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;
  const r = Math.min(radius, width / 2, height / 2);

  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + height - r);
  s.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  s.lineTo(x + r, y + height);
  s.quadraticCurveTo(x, y + height, x, y + height - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function createBeveledBox(
  width: number,
  height: number,
  depth: number,
  radius = 0.08,
  bevel = 0.045
): THREE.ExtrudeGeometry {
  const shape = createRoundedRectShape(width - bevel * 2, height - bevel * 2, radius);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.02, depth - bevel * 2),
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  });
  geo.center();
  return geo;
}

function createWheelArchFlare(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const outerR = 0.6;
  const innerR = 0.45;
  shape.absarc(0, 0, outerR, 0, Math.PI, false);
  shape.lineTo(-innerR, 0);
  shape.absarc(0, 0, innerR, Math.PI, 0, true);
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.24,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.03,
    bevelThickness: 0.03,
  });
  geo.center();
  return geo;
}

function createStarEmblem(radius: number, chromeMat: THREE.Material): THREE.Group {
  const emblem = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.11, 10, 24), chromeMat);
  emblem.add(ring);

  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3 + Math.PI / 2;
    const spoke = new THREE.Mesh(
      new THREE.BoxGeometry(radius * 0.92, radius * 0.11, radius * 0.08),
      chromeMat
    );
    spoke.position.set(Math.cos(angle) * radius * 0.44, Math.sin(angle) * radius * 0.44, 0);
    spoke.rotation.z = angle;
    emblem.add(spoke);
  }
  return emblem;
}

function createAmgWheel(isLeft: boolean, accentMat: THREE.Material): THREE.Group {
  const wheelGroup = new THREE.Group();
  const sideSign = isLeft ? -1 : 1;

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x0b0d13,
    roughness: 0.88,
    metalness: 0.08,
  });
  const rimDarkMat = new THREE.MeshStandardMaterial({
    color: 0x161922,
    metalness: 0.85,
    roughness: 0.22,
  });
  const alloyMat = new THREE.MeshStandardMaterial({
    color: 0xdbe4f0,
    metalness: 0.92,
    roughness: 0.18,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.5,
    roughness: 0.3,
  });

  // Main tire cylinder + rounded shoulder torus
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.34, 24), tireMat);
  tire.rotation.z = Math.PI / 2;
  wheelGroup.add(tire);

  const sidewall = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.065, 10, 24), tireMat);
  sidewall.rotation.y = Math.PI / 2;
  sidewall.position.x = sideSign * 0.135;
  wheelGroup.add(sidewall);

  // Inner barrel
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.35, 20), rimDarkMat);
  barrel.rotation.z = Math.PI / 2;
  wheelGroup.add(barrel);

  // Machined outer lip + subtle neon accent ring
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.022, 8, 24), alloyMat);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = sideSign * 0.178;
  wheelGroup.add(lip);

  const neonRim = new THREE.Mesh(new THREE.TorusGeometry(0.335, 0.014, 8, 24), accentMat);
  neonRim.rotation.y = Math.PI / 2;
  neonRim.position.x = sideSign * 0.172;
  wheelGroup.add(neonRim);

  // AMG 5 twin-spokes
  for (let i = 0; i < 5; i++) {
    const baseAngle = (i * Math.PI * 2) / 5;
    for (const offset of [-0.14, 0.14]) {
      const a = baseAngle + offset;
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.034), alloyMat);
      spoke.position.set(sideSign * 0.168, Math.sin(a) * 0.16, Math.cos(a) * 0.16);
      spoke.rotation.x = a;
      wheelGroup.add(spoke);
    }
  }

  // Center cap & red brake caliper
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.05, 14), alloyMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = sideSign * 0.175;
  wheelGroup.add(hub);

  const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.12), caliperMat);
  caliper.position.set(sideSign * 0.08, 0.05, -0.15);
  wheelGroup.add(caliper);

  return wheelGroup;
}

/**
 * Builds a high-detail Mercedes-Benz G-Class (AMG G63) 3D model
 * featuring rounded-bevel body panels, Panamericana grille, round LED DRLs,
 * hood turn-signal pods, wide fender flares, side-exit dual exhausts, and rear spare tire cover.
 */
export function createPlayerCar(initialColor: CarColorConfig): PlayerCarRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const primaryMat = new THREE.MeshPhysicalMaterial({
    color: initialColor.primaryHex,
    metalness: initialColor.isMatte ? 0.55 : 0.78,
    roughness: initialColor.isMatte ? 0.42 : 0.22,
    clearcoat: initialColor.isMatte ? 0.18 : 0.75,
    clearcoatRoughness: initialColor.isMatte ? 0.45 : 0.15,
  });

  const trimBlackMat = new THREE.MeshStandardMaterial({
    color: 0x0e1017,
    metalness: 0.45,
    roughness: 0.48,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe5ecf6,
    metalness: 0.96,
    roughness: 0.14,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x090f1d,
    metalness: 0.92,
    roughness: 0.06,
    clearcoat: 1.0,
    emissive: 0x0a1e38,
    emissiveIntensity: 0.35,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: initialColor.emissiveHex,
    emissive: initialColor.emissiveHex,
    emissiveIntensity: 2.0,
    roughness: 0.18,
  });

  // 1. Main lower body beltline (beveled, sleek G-Class proportions)
  const lowerBody = new THREE.Mesh(createBeveledBox(2.04, 0.78, 4.58, 0.12, 0.055), primaryMat);
  lowerBody.position.set(0, 0.88, 0.06);
  bodyGroup.add(lowerBody);

  // Raised center hood bulge (iconic G-Class stepped bonnet)
  const hood = new THREE.Mesh(createBeveledBox(1.56, 0.24, 1.62, 0.09, 0.045), primaryMat);
  hood.position.set(0, 1.3, -1.36);
  bodyGroup.add(hood);

  // Upright yet subtly beveled G-Class cabin greenhouse
  const cabin = new THREE.Mesh(createBeveledBox(1.94, 0.82, 2.74, 0.12, 0.06), primaryMat);
  cabin.position.set(0, 1.64, 0.88);
  bodyGroup.add(cabin);

  // Roof trim & subtle roof rails
  const roofCap = new THREE.Mesh(createBeveledBox(1.88, 0.08, 2.66, 0.1, 0.03), trimBlackMat);
  roofCap.position.set(0, 2.05, 0.88);
  bodyGroup.add(roofCap);

  // 2. Windows (Windshield, 3-bay side windows, rear window)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.74, 0.68, 0.08), glassMat);
  windshield.position.set(0, 1.64, -0.49);
  windshield.rotation.x = -0.14;
  bodyGroup.add(windshield);

  // Windshield wipers
  for (const wx of [-0.36, 0.24]) {
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.04), trimBlackMat);
    wiper.position.set(wx, 1.34, -0.54);
    wiper.rotation.z = 0.08;
    bodyGroup.add(wiper);
  }

  // Side windows (3 distinct G-Class glass panes on each side)
  const windowZSlices: [number, number][] = [
    [-0.04, 0.76], // Front door window
    [0.86, 0.74],  // Rear door window
    [1.72, 0.68],  // Rear cargo quarter window
  ];
  for (const side of [-1, 1]) {
    for (const [wz, wLen] of windowZSlices) {
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.58, wLen), glassMat);
      pane.position.set(side * 0.96, 1.64, wz);
      bodyGroup.add(pane);
    }

    // Side protective rub strip (iconic horizontal G-Class trim)
    const rubStrip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.075, 4.35), trimBlackMat);
    rubStrip.position.set(side * 1.03, 0.96, 0.04);
    bodyGroup.add(rubStrip);

    // Subtle neon accent line tucked under rub strip
    const neonTrim = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.025, 3.6), accentMat);
    neonTrim.position.set(side * 1.04, 0.54, 0.06);
    bodyGroup.add(neonTrim);

    // Door handles
    for (const hz of [0.16, 1.06]) {
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.2), trimBlackMat);
      handle.position.set(side * 1.05, 1.12, hz);
      bodyGroup.add(handle);
    }

    // Side mirrors with thin LED blinker
    const mirrorHousing = new THREE.Mesh(createBeveledBox(0.24, 0.16, 0.2, 0.05, 0.02), primaryMat);
    mirrorHousing.position.set(side * 1.12, 1.38, -0.34);
    bodyGroup.add(mirrorHousing);

    const mirrorArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), trimBlackMat);
    mirrorArm.position.set(side * 1.01, 1.35, -0.34);
    bodyGroup.add(mirrorArm);

    // Side running board (step)
    const step = new THREE.Mesh(createBeveledBox(0.22, 0.08, 2.05, 0.03, 0.015), chromeMat);
    step.position.set(side * 1.1, 0.44, 0.12);
    bodyGroup.add(step);

    // AMG Side-exit dual exhaust pipes!
    for (const ez of [0.76, 0.98]) {
      const sidePipe = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.28, 12), chromeMat);
      sidePipe.rotation.z = Math.PI / 2;
      sidePipe.position.set(side * 1.14, 0.36, ez);
      bodyGroup.add(sidePipe);
    }
  }

  // Rear window
  const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.62, 0.06), glassMat);
  rearGlass.position.set(0, 1.66, 2.25);
  bodyGroup.add(rearGlass);

  // 3. Wide AMG Wheel Arch Fender Flares (4 corners)
  const flareGeo = createWheelArchFlare();
  const wheelZFront = -1.42;
  const wheelZRear = 1.46;
  for (const side of [-1, 1]) {
    for (const wz of [wheelZFront, wheelZRear]) {
      const flare = new THREE.Mesh(flareGeo, primaryMat);
      flare.rotation.y = Math.PI / 2;
      flare.position.set(side * 1.08, 0.56, wz);
      bodyGroup.add(flare);
    }
  }

  // 4. FRONT FACE — Panamericana Grille, Star Emblem, Round LED DRL Headlights, Hood Blinkers
  const grilleFrame = new THREE.Mesh(createBeveledBox(1.16, 0.46, 0.12, 0.06, 0.02), trimBlackMat);
  grilleFrame.position.set(0, 0.98, -2.24);
  bodyGroup.add(grilleFrame);

  // Vertical AMG Panamericana grille slats
  for (let i = -5; i <= 5; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.38, 0.06), chromeMat);
    slat.position.set(i * 0.095, 0.98, -2.29);
    bodyGroup.add(slat);
  }

  // Center Three-Pointed Star Emblem
  const frontStar = createStarEmblem(0.18, chromeMat);
  frontStar.position.set(0, 0.98, -2.33);
  bodyGroup.add(frontStar);

  // Iconic Round LED DRL Headlights
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xfff8e7,
    emissiveIntensity: 3.6,
  });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xdbeafe,
    emissive: 0x93c5fd,
    emissiveIntensity: 1.5,
  });

  for (const hx of [-0.79, 0.79]) {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.14, 20), trimBlackMat);
    housing.rotation.x = Math.PI / 2;
    housing.position.set(hx, 0.98, -2.23);
    bodyGroup.add(housing);

    const drlRing = new THREE.Mesh(new THREE.TorusGeometry(0.165, 0.026, 10, 24), drlMat);
    drlRing.position.set(hx, 0.98, -2.31);
    bodyGroup.add(drlRing);

    const projector = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16), lensMat);
    projector.rotation.x = Math.PI / 2;
    projector.position.set(hx, 0.98, -2.29);
    bodyGroup.add(projector);

    // Hood-top turn signal indicator pods (signature G-Class detail!)
    const podBase = new THREE.Mesh(createBeveledBox(0.14, 0.09, 0.24, 0.03, 0.015), trimBlackMat);
    podBase.position.set(hx * 1.12, 1.32, -1.86);
    bodyGroup.add(podBase);

    const podLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.05, 0.18),
      new THREE.MeshStandardMaterial({
        color: 0xfef3c7,
        emissive: 0xfbbf24,
        emissiveIntensity: 2.2,
      })
    );
    podLens.position.set(hx * 1.12, 1.37, -1.86);
    bodyGroup.add(podLens);
  }

  // Aggressive AMG Front Bumper + 3 Air Intakes + Plate
  const frontBumper = new THREE.Mesh(createBeveledBox(2.2, 0.34, 0.34, 0.07, 0.035), primaryMat);
  frontBumper.position.set(0, 0.56, -2.26);
  bodyGroup.add(frontBumper);

  for (const ix of [-0.72, 0, 0.72]) {
    const intake = new THREE.Mesh(
      new THREE.BoxGeometry(ix === 0 ? 0.74 : 0.48, 0.2, 0.08),
      trimBlackMat
    );
    intake.position.set(ix, 0.54, -2.42);
    bodyGroup.add(intake);
  }

  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.15, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
  );
  plate.position.set(0, 0.62, -2.44);
  bodyGroup.add(plate);

  // 5. REAR FACE — Iconic Spare Tire Cover, LED Tail Lights, Bumper & Nitro Flames
  const spareGroup = new THREE.Group();
  spareGroup.position.set(0.08, 1.18, 2.48);

  const spareDrum = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.28, 28), primaryMat);
  spareDrum.rotation.x = Math.PI / 2;
  spareGroup.add(spareDrum);

  const spareRing = new THREE.Mesh(new THREE.TorusGeometry(0.485, 0.03, 10, 28), chromeMat);
  spareRing.position.z = 0.135;
  spareGroup.add(spareRing);

  const spareAccent = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.015, 8, 28), accentMat);
  spareAccent.position.z = 0.145;
  spareGroup.add(spareAccent);

  const rearStar = createStarEmblem(0.15, chromeMat);
  rearStar.position.z = 0.155;
  spareGroup.add(rearStar);

  bodyGroup.add(spareGroup);

  // Rear LED Tail Light Clusters
  const tailGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff1e56,
    emissive: 0xff0044,
    emissiveIntensity: 3.4,
  });
  for (const tx of [-0.76, 0.76]) {
    const tailBezel = new THREE.Mesh(createBeveledBox(0.42, 0.17, 0.08, 0.03, 0.012), trimBlackMat);
    tailBezel.position.set(tx, 0.78, 2.35);
    bodyGroup.add(tailBezel);

    const tailLight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.1, 0.06), tailGlowMat);
    tailLight.position.set(tx, 0.78, 2.38);
    bodyGroup.add(tailLight);
  }

  // High-mount roof brake LED
  const highBrake = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.06), tailGlowMat);
  highBrake.position.set(0, 2.02, 2.26);
  bodyGroup.add(highBrake);

  // Rear Bumper & Diffuser
  const rearBumper = new THREE.Mesh(createBeveledBox(2.18, 0.28, 0.26, 0.06, 0.03), trimBlackMat);
  rearBumper.position.set(0, 0.5, 2.36);
  bodyGroup.add(rearBumper);

  // Nitro Flames (dual rear under-bumper + side AMG flames)
  const flames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.9,
  });

  for (const fx of [-0.62, 0.62]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.24, 12), chromeMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(fx, 0.36, 2.44);
    bodyGroup.add(pipe);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.19, 1.8, 12), flameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(fx, 0.36, 3.35);
    flame.visible = false;
    bodyGroup.add(flame);
    flames.push(flame);
  }

  // 6. Underglow plane & light
  const underglowMat = new THREE.MeshBasicMaterial({
    color: initialColor.emissiveHex,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
  });
  const underglowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.75, 5.15), underglowMat);
  underglowPlane.rotation.x = -Math.PI / 2;
  underglowPlane.position.y = 0.04;
  group.add(underglowPlane);

  const underglowLight = new THREE.PointLight(initialColor.emissiveHex, 4.2, 12);
  underglowLight.position.set(0, 0.65, 0);
  group.add(underglowLight);

  // 7. Four AMG Multi-Spoke Wheels
  const wheels: THREE.Object3D[] = [];
  const wheelCoords: [number, number, number, boolean][] = [
    [-1.08, 0.45, wheelZFront, true],
    [1.08, 0.45, wheelZFront, false],
    [-1.08, 0.45, wheelZRear, true],
    [1.08, 0.45, wheelZRear, false],
  ];

  for (const [wx, wy, wz, isLeft] of wheelCoords) {
    const wheel = createAmgWheel(isLeft, accentMat);
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
    wheels.push(wheel);
  }

  // 8. Energy Shield Bubble
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.95, 1),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    })
  );
  shieldMesh.position.set(0, 1.15, 0);
  shieldMesh.visible = false;
  group.add(shieldMesh);

  const applyColor = (color: CarColorConfig) => {
    primaryMat.color.setHex(color.primaryHex);
    primaryMat.metalness = color.isMatte ? 0.55 : 0.78;
    primaryMat.roughness = color.isMatte ? 0.42 : 0.22;
    primaryMat.clearcoat = color.isMatte ? 0.18 : 0.75;
    primaryMat.clearcoatRoughness = color.isMatte ? 0.45 : 0.15;

    accentMat.color.setHex(color.emissiveHex);
    accentMat.emissive.setHex(color.emissiveHex);
    underglowMat.color.setHex(color.emissiveHex);
    underglowLight.color.setHex(color.emissiveHex);
  };

  return {
    group,
    bodyGroup,
    wheels,
    flames,
    shieldMesh,
    underglowLight,
    applyColor,
  };
}

const TRAFFIC_PALETTES = [
  { body: 0xff2e97, glow: 0xff6ec7 },
  { body: 0xf97316, glow: 0xfdba74 },
  { body: 0x8b5cf6, glow: 0xc084fc },
  { body: 0x10b981, glow: 0x34d399 },
  { body: 0xef4444, glow: 0xfca5a5 },
];

export function createTrafficCar(isTruck: boolean): THREE.Group {
  const palette = TRAFFIC_PALETTES[Math.floor(Math.random() * TRAFFIC_PALETTES.length)];
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: palette.body,
    metalness: 0.65,
    roughness: 0.28,
    clearcoat: 0.6,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: palette.glow,
    emissive: palette.glow,
    emissiveIntensity: 1.8,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.8,
    roughness: 0.2,
  });

  if (isTruck) {
    const cargo = new THREE.Mesh(createBeveledBox(2.25, 1.65, 4.4, 0.12, 0.05), bodyMat);
    cargo.position.set(0, 1.25, 0.4);
    group.add(cargo);

    const cab = new THREE.Mesh(createBeveledBox(2.08, 1.24, 1.6, 0.12, 0.05), darkMat);
    cab.position.set(0, 1.0, -2.2);
    group.add(cab);

    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.12, 0.12), glowMat);
    neonBar.position.set(0, 1.95, 2.62);
    group.add(neonBar);
  } else {
    const chassis = new THREE.Mesh(createBeveledBox(2.0, 0.6, 4.25, 0.12, 0.05), bodyMat);
    chassis.position.set(0, 0.58, 0);
    group.add(chassis);

    const cabin = new THREE.Mesh(createBeveledBox(1.56, 0.54, 2.0, 0.14, 0.06), darkMat);
    cabin.position.set(0, 1.05, 0.1);
    group.add(cabin);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.08, 3.5), glowMat);
    strip.position.set(0, 0.45, 0);
    group.add(strip);
  }

  // Rear red brake lights facing player
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff0044,
    emissive: 0xff0044,
    emissiveIntensity: 2.8,
  });
  const rearZ = isTruck ? 2.62 : 2.13;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.16, 0.08), tailMat);
  tail.position.set(0, 0.68, rearZ);
  group.add(tail);

  // Wheels
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.9 });
  const zPos = isTruck ? [-2.1, 1.6] : [-1.3, 1.3];
  for (const wz of zPos) {
    for (const wx of [-1.05, 1.05]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 14), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.4, wz);
      group.add(tire);
    }
  }

  return group;
}
