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

export function createPlayerCar(initialColor: CarColorConfig): PlayerCarRig {
  const group = new THREE.Group();
  const bodyGroup = new THREE.Group();
  group.add(bodyGroup);

  const primaryMat = new THREE.MeshStandardMaterial({
    color: initialColor.primaryHex,
    metalness: 0.75,
    roughness: 0.22,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: initialColor.emissiveHex,
    emissive: initialColor.emissiveHex,
    emissiveIntensity: 2.2,
    roughness: 0.15,
  });

  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x101322,
    metalness: 0.6,
    roughness: 0.4,
  });

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x0b1224,
    metalness: 0.95,
    roughness: 0.08,
    emissive: 0x0a2540,
    emissiveIntensity: 0.4,
  });

  // Main lower chassis
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.52, 4.6), primaryMat);
  chassis.position.set(0, 0.56, 0);
  chassis.castShadow = true;
  bodyGroup.add(chassis);

  // Sloped front hood
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.28, 1.75), primaryMat);
  hood.position.set(0, 0.8, -1.2);
  hood.rotation.x = 0.14;
  bodyGroup.add(hood);

  // Front splitter
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.12, 0.5), darkMat);
  splitter.position.set(0, 0.34, -2.2);
  bodyGroup.add(splitter);

  // Cockpit canopy
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.52, 1.95), glassMat);
  cabin.position.set(0, 1.02, 0.18);
  bodyGroup.add(cabin);

  // Rear deck
  const rearDeck = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.3, 1.2), darkMat);
  rearDeck.position.set(0, 0.86, 1.48);
  bodyGroup.add(rearDeck);

  // Rear spoiler wing + struts
  const wing = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.1, 0.44), primaryMat);
  wing.position.set(0, 1.24, 2.02);
  wing.rotation.x = 0.1;
  bodyGroup.add(wing);

  const wingEdge = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.05, 0.08), accentMat);
  wingEdge.position.set(0, 1.28, 2.22);
  bodyGroup.add(wingEdge);

  for (const sx of [-0.72, 0.72]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.42, 0.26), darkMat);
    strut.position.set(sx, 1.0, 1.98);
    bodyGroup.add(strut);
  }

  // Side neon trim strips
  for (const sx of [-1.07, 1.07]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 3.9), accentMat);
    strip.position.set(sx, 0.45, 0);
    bodyGroup.add(strip);
  }

  // Headlight LED bar
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0faff,
    emissiveIntensity: 3.0,
  });
  const headlightBar = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.12, 0.1), headlightMat);
  headlightBar.position.set(0, 0.64, -2.31);
  bodyGroup.add(headlightBar);

  // Rear cyberpunk tail light bar
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1e56,
    emissive: 0xff0055,
    emissiveIntensity: 3.2,
  });
  const tailBar = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.16, 0.1), tailMat);
  tailBar.position.set(0, 0.7, 2.31);
  bodyGroup.add(tailBar);

  // Exhaust pipes & nitro flames
  const flames: THREE.Mesh[] = [];
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x00f5ff,
    transparent: true,
    opacity: 0.9,
  });

  for (const ex of [-0.52, 0.52]) {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.35, 10), darkMat);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(ex, 0.44, 2.32);
    bodyGroup.add(pipe);

    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.7, 10), flameMat);
    flame.rotation.x = Math.PI / 2;
    flame.position.set(ex, 0.44, 3.25);
    flame.visible = false;
    bodyGroup.add(flame);
    flames.push(flame);
  }

  // Underglow plane & light
  const underglowMat = new THREE.MeshBasicMaterial({
    color: initialColor.emissiveHex,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
  });
  const underglowPlane = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 5.1), underglowMat);
  underglowPlane.rotation.x = -Math.PI / 2;
  underglowPlane.position.y = 0.05;
  group.add(underglowPlane);

  const underglowLight = new THREE.PointLight(initialColor.emissiveHex, 4.5, 11);
  underglowLight.position.set(0, 0.65, 0);
  group.add(underglowLight);

  // Wheels
  const wheels: THREE.Object3D[] = [];
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.85 });
  const wheelPositions: [number, number, number][] = [
    [-1.08, 0.38, -1.42],
    [1.08, 0.38, -1.42],
    [-1.08, 0.38, 1.42],
    [1.08, 0.38, 1.42],
  ];

  for (const [wx, wy, wz] of wheelPositions) {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(wx, wy, wz);

    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.34, 16), tireMat);
    tire.rotation.z = Math.PI / 2;
    wheelGroup.add(tire);

    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.045, 8, 16), accentMat);
    rim.rotation.y = Math.PI / 2;
    rim.position.x = wx < 0 ? -0.17 : 0.17;
    wheelGroup.add(rim);

    group.add(wheelGroup);
    wheels.push(wheelGroup);
  }

  // Energy Shield bubble (hidden unless shield active)
  const shieldMesh = new THREE.Mesh(
    new THREE.IcosahedronGeometry(2.65, 1),
    new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.55,
    })
  );
  shieldMesh.position.set(0, 0.9, 0);
  shieldMesh.visible = false;
  group.add(shieldMesh);

  const applyColor = (color: CarColorConfig) => {
    primaryMat.color.setHex(color.primaryHex);
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

  const bodyMat = new THREE.MeshStandardMaterial({
    color: palette.body,
    metalness: 0.6,
    roughness: 0.35,
  });
  const glowMat = new THREE.MeshStandardMaterial({
    color: palette.glow,
    emissive: palette.glow,
    emissiveIntensity: 1.8,
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.5,
  });

  if (isTruck) {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.25, 1.65, 4.4), bodyMat);
    cargo.position.set(0, 1.25, 0.4);
    group.add(cargo);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.25, 1.6), darkMat);
    cab.position.set(0, 1.0, -2.2);
    group.add(cab);

    const neonBar = new THREE.Mesh(new THREE.BoxGeometry(2.28, 0.14, 0.12), glowMat);
    neonBar.position.set(0, 1.95, 2.62);
    group.add(neonBar);
  } else {
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.58, 4.2), bodyMat);
    chassis.position.set(0, 0.58, 0);
    group.add(chassis);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.55, 0.52, 1.9), darkMat);
    cabin.position.set(0, 1.05, 0.1);
    group.add(cabin);

    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.1, 3.6), glowMat);
    strip.position.set(0, 0.45, 0);
    group.add(strip);
  }

  // Rear red brake lights facing player
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff0044,
    emissive: 0xff0044,
    emissiveIntensity: 2.8,
  });
  const rearZ = isTruck ? 2.62 : 2.12;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.18, 0.1), tailMat);
  tail.position.set(0, 0.68, rearZ);
  group.add(tail);

  // Wheels
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.9 });
  const zPos = isTruck ? [-2.1, 1.6] : [-1.3, 1.3];
  for (const wz of zPos) {
    for (const wx of [-1.05, 1.05]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.position.set(wx, 0.38, wz);
      group.add(tire);
    }
  }

  return group;
}
