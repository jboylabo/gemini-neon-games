import * as THREE from 'three';
import { soundEngine } from '../audio/soundEngine';
import { createPlayerCar, createTrafficCar, PlayerCarRig } from './carFactory';
import {
  CameraMode,
  CAR_COLORS,
  CarColorId,
  FloatingEvent,
  GAME_MODES,
  GameModeId,
  GamePhase,
  HudSnapshot,
} from './types';

const ROAD_WIDTH = 16.4;
const LANE_CENTERS = [-5.4, -1.8, 1.8, 5.4];
const HIGH_SCORE_KEY = 'neon_overdrive_highscore_v1';

interface TrafficEntity {
  mesh: THREE.Group;
  lane: number;
  speed: number;
  width: number;
  length: number;
  nearMissed: boolean;
  smashed: boolean;
  velX: number;
  velY: number;
  velZ: number;
  rotSpeedX: number;
  rotSpeedY: number;
}

interface OrbEntity {
  mesh: THREE.Mesh;
  baseY: number;
  collected: boolean;
}

interface RampEntity {
  mesh: THREE.Group;
  triggered: boolean;
}

interface ShieldEntity {
  mesh: THREE.Mesh;
  collected: boolean;
}

interface Particle {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

export class NeonCarGame {
  private container: HTMLElement;
  private onHudUpdate: (snapshot: HudSnapshot) => void;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;

  private playerCar: PlayerCarRig;
  private roadTexture: THREE.CanvasTexture;
  private arches: THREE.Group[] = [];
  private buildings: THREE.Group[] = [];
  private speedLines: THREE.Mesh[] = [];

  private traffic: TrafficEntity[] = [];
  private orbs: OrbEntity[] = [];
  private ramps: RampEntity[] = [];
  private shields: ShieldEntity[] = [];
  private particles: Particle[] = [];

  // Shared geometries/materials for collectibles & particles
  private orbGeo = new THREE.OctahedronGeometry(0.62, 0);
  private orbMat = new THREE.MeshStandardMaterial({
    color: 0xffe600,
    emissive: 0xffb800,
    emissiveIntensity: 2.4,
    metalness: 0.4,
    roughness: 0.2,
  });
  private shieldGeo = new THREE.IcosahedronGeometry(0.75, 0);
  private shieldMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x00f5ff,
    emissiveIntensity: 2.6,
    wireframe: false,
  });
  private particleGeo = new THREE.BoxGeometry(0.24, 0.24, 0.24);

  // Game state
  private phase: GamePhase = 'menu';
  private modeId: GameModeId = 'neon_city';
  private colorId: CarColorId = 'cyan';
  private cameraMode: CameraMode = 'chase';

  private playerX = 0;
  private playerY = 0;
  private playerVelX = 0;
  private playerVelY = 0;
  private currentSpeed = 48;
  private invulnerableTimer = 0;
  private shakeTimer = 0;
  private shakeMagnitude = 0;
  private menuOrbitAngle = 0;

  private score = 0;
  private highScore = 0;
  private distance = 0;
  private combo = 1;
  private maxCombo = 1;
  private comboTimer = 0;
  private nitro = 45;
  private isNitroActive = false;
  private lives = 3;
  private readonly maxLives = 3;
  private hasShield = false;
  private nearMissCount = 0;
  private smashCount = 0;
  private topSpeedKmh = 0;

  private spawnTrafficTimer = 0;
  private spawnOrbTimer = 0;
  private spawnRampTimer = 4.5;
  private spawnShieldTimer = 11;

  private events: FloatingEvent[] = [];
  private nextEventId = 1;

  // Controls
  private keys = new Set<string>();
  private touchControls = {
    left: false,
    right: false,
    accel: false,
    brake: false,
    nitro: false,
  };

  private animFrameId = 0;
  private lastTime = 0;
  private hudEmitAccum = 0;
  private disposed = false;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.highScore = this.loadHighScore();

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070415);
    this.scene.fog = new THREE.FogExp2(0x0c0622, 0.0082);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(64, width / height, 0.1, 360);
    this.camera.position.set(0, 4.4, 9.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.roadTexture = this.createRoadTexture();
    this.buildEnvironment();

    const initialColor = CAR_COLORS.find((c) => c.id === this.colorId) ?? CAR_COLORS[0];
    this.playerCar = createPlayerCar(initialColor);
    this.scene.add(this.playerCar.group);

    this.bindEvents();
    this.emitHud();

    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  private loadHighScore(): number {
    try {
      const saved = window.localStorage.getItem(HIGH_SCORE_KEY);
      return saved ? Math.max(0, parseInt(saved, 10) || 0) : 0;
    } catch {
      return 0;
    }
  }

  private saveHighScore(val: number): void {
    try {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(Math.floor(val)));
    } catch {
      // ignore storage errors
    }
  }

  private setupLighting(): void {
    const ambient = new THREE.AmbientLight(0x8b5cf6, 0.9);
    this.scene.add(ambient);

    const hemi = new THREE.HemisphereLight(0x38bdf8, 0xff2e97, 0.85);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 1.35);
    dir.position.set(14, 28, 16);
    this.scene.add(dir);

    const backLight = new THREE.DirectionalLight(0xff2e97, 0.9);
    backLight.position.set(-10, 12, -30);
    this.scene.add(backLight);
  }

  private createRoadTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark cyber asphalt
    ctx.fillStyle = '#0d0b1e';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle horizontal grid lines
    ctx.strokeStyle = 'rgba(0, 245, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }

    // Outer neon border lines
    ctx.fillStyle = '#00f5ff';
    ctx.fillRect(10, 0, 10, 512);
    ctx.fillRect(492, 0, 10, 512);

    // Dashed lane dividers (3 inner dividers for 4 lanes)
    ctx.fillStyle = 'rgba(255, 46, 151, 0.85)';
    const dividerXs = [132, 256, 380];
    for (const dx of dividerXs) {
      for (let y = 16; y < 512; y += 96) {
        ctx.fillRect(dx - 3, y, 6, 48);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 14);
    texture.anisotropy = 8;
    return texture;
  }

  private createSunTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#ffe600');
    grad.addColorStop(0.48, '#ff5e62');
    grad.addColorStop(1, '#ff0099');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.fill();

    // Retro synthwave horizontal cutouts
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const y = 265 + i * 32;
      const h = 4 + i * 2.4;
      ctx.fillRect(0, y, 512, h);
    }

    return new THREE.CanvasTexture(canvas);
  }

  private buildEnvironment(): void {
    // Highway surface
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, 320);
    const roadMat = new THREE.MeshStandardMaterial({
      map: this.roadTexture,
      roughness: 0.45,
      metalness: 0.35,
    });
    const road = new THREE.Mesh(roadGeo, roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -110);
    this.scene.add(road);

    // Outer neon grid ground plane
    const groundGeo = new THREE.PlaneGeometry(360, 360, 36, 36);
    const groundMat = new THREE.MeshBasicMaterial({
      color: 0x3b0764,
      wireframe: true,
      transparent: true,
      opacity: 0.32,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.06, -110);
    this.scene.add(ground);

    // Guardrails on both sides
    const railMat = new THREE.MeshStandardMaterial({
      color: 0x00f5ff,
      emissive: 0x00f5ff,
      emissiveIntensity: 1.5,
    });
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.55, 320), railMat);
      rail.position.set(side * (ROAD_WIDTH / 2 + 0.35), 0.35, -110);
      this.scene.add(rail);
    }

    // Synthwave giant sun in the distance
    const sunTex = this.createSunTexture();
    const sun = new THREE.Mesh(
      new THREE.PlaneGeometry(92, 92),
      new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false })
    );
    sun.position.set(0, 32, -260);
    this.scene.add(sun);

    // Starfield
    const starPositions = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 320;
      starPositions[i * 3 + 1] = 14 + Math.random() * 110;
      starPositions[i * 3 + 2] = -40 - Math.random() * 240;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xe0f2fe, size: 0.7, fog: false })
    );
    this.scene.add(stars);

    // Neon Highway Arches
    const archColors = [0x00f5ff, 0xff2e97, 0xa855f7];
    for (let i = 0; i < 8; i++) {
      const arch = new THREE.Group();
      const color = archColors[i % archColors.length];
      const mat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 2.0,
      });

      const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 9.5, 0.45), mat);
      leftPillar.position.set(-(ROAD_WIDTH / 2 + 0.8), 4.75, 0);
      arch.add(leftPillar);

      const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.45, 9.5, 0.45), mat);
      rightPillar.position.set(ROAD_WIDTH / 2 + 0.8, 4.75, 0);
      arch.add(rightPillar);

      const topBeam = new THREE.Mesh(new THREE.BoxGeometry(ROAD_WIDTH + 2.05, 0.45, 0.45), mat);
      topBeam.position.set(0, 9.5, 0);
      arch.add(topBeam);

      arch.position.z = -i * 34;
      this.scene.add(arch);
      this.arches.push(arch);
    }

    // Cyber City Skyscrapers along both sides
    const buildingNeonColors = [0x00f5ff, 0xff2e97, 0xa855f7, 0xfacc15];
    for (let i = 0; i < 40; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const bGroup = new THREE.Group();
      const w = 5 + Math.random() * 8;
      const h = 14 + Math.random() * 44;
      const d = 6 + Math.random() * 8;

      const body = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0x0b0f26,
          metalness: 0.4,
          roughness: 0.65,
        })
      );
      body.position.y = h / 2;
      bGroup.add(body);

      const neonColor = buildingNeonColors[i % buildingNeonColors.length];
      const trimMat = new THREE.MeshStandardMaterial({
        color: neonColor,
        emissive: neonColor,
        emissiveIntensity: 2.2,
      });

      // Roof rim
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.25, 0.35, d + 0.25), trimMat);
      roof.position.y = h + 0.1;
      bGroup.add(roof);

      // Vertical neon accent stripe facing highway
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.32, h * 0.85, 0.32), trimMat);
      stripe.position.set(-side * (w / 2 + 0.08), h * 0.46, 0);
      bGroup.add(stripe);

      const xOffset = ROAD_WIDTH / 2 + 6 + w / 2 + Math.random() * 14;
      bGroup.position.set(side * xOffset, 0, -Math.floor(i / 2) * 14 - Math.random() * 6);
      this.scene.add(bGroup);
      this.buildings.push(bGroup);
    }

    // Speed lines for nitro visual flair
    const lineMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 24; i++) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 6.5), lineMat);
      line.position.set(
        (Math.random() - 0.5) * 20,
        0.6 + Math.random() * 6.5,
        -10 - Math.random() * 60
      );
      line.visible = false;
      this.scene.add(line);
      this.speedLines.push(line);
    }
  }

  private bindEvents(): void {
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) &&
      this.phase === 'playing'
    ) {
      e.preventDefault();
    }

    this.keys.add(code);

    if (code === 'KeyC' && this.phase === 'playing') {
      this.cycleCameraMode();
    }
    if (
      (code === 'Space' || code === 'ShiftLeft' || code === 'ShiftRight') &&
      this.phase === 'playing' &&
      !this.isNitroActive &&
      this.nitro >= 25
    ) {
      this.activateNitro();
    }
    if ((code === 'KeyP' || code === 'Escape') && (this.phase === 'playing' || this.phase === 'paused')) {
      this.togglePause();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  // ==================== Public API for React UI ====================

  public setMode(modeId: GameModeId): void {
    this.modeId = modeId;
    soundEngine.playUiClick();
  }

  public setCarColor(colorId: CarColorId): void {
    this.colorId = colorId;
    const cfg = CAR_COLORS.find((c) => c.id === colorId) ?? CAR_COLORS[0];
    this.playerCar.applyColor(cfg);
    soundEngine.playUiClick();
  }

  public setTouchControl(control: keyof NeonCarGame['touchControls'], active: boolean): void {
    this.touchControls[control] = active;
  }

  public cycleCameraMode(): void {
    const order: CameraMode[] = ['chase', 'dynamic', 'hood'];
    const idx = order.indexOf(this.cameraMode);
    this.cameraMode = order[(idx + 1) % order.length];
    soundEngine.playUiClick();
    this.pushEvent(`CAMERA: ${this.cameraMode.toUpperCase()}`, undefined, '#38bdf8');
    this.emitHud();
  }

  public startGame(): void {
    soundEngine.unlockAndStartBgm();
    soundEngine.playUiClick();
    this.clearDynamicEntities();

    const mode = GAME_MODES[this.modeId];
    this.phase = 'playing';
    this.playerX = 0;
    this.playerY = 0;
    this.playerVelX = 0;
    this.playerVelY = 0;
    this.currentSpeed = mode.baseSpeed;
    this.invulnerableTimer = 0;
    this.shakeTimer = 0;

    this.score = 0;
    this.distance = 0;
    this.combo = 1;
    this.maxCombo = 1;
    this.comboTimer = 0;
    this.nitro = 45;
    this.isNitroActive = false;
    this.lives = this.maxLives;
    this.hasShield = false;
    this.nearMissCount = 0;
    this.smashCount = 0;
    this.topSpeedKmh = Math.round(mode.baseSpeed * 3.1);
    this.events = [];

    this.spawnTrafficTimer = 0.8;
    this.spawnOrbTimer = 1.2;
    this.spawnRampTimer = 5.5;
    this.spawnShieldTimer = 12;

    this.playerCar.group.position.set(0, 0, 0);
    this.playerCar.bodyGroup.rotation.set(0, 0, 0);
    this.playerCar.shieldMesh.visible = false;

    this.pushEvent('GO! NEON OVERDRIVE', mode.name, mode.accentColor);
    this.emitHud();
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      soundEngine.setIntensity(0.15);
      soundEngine.playUiClick();
      this.emitHud();
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      soundEngine.playUiClick();
      this.lastTime = performance.now();
      this.emitHud();
    }
  }

  public returnToMenu(): void {
    soundEngine.playUiClick();
    soundEngine.setIntensity(0.28);
    this.clearDynamicEntities();
    this.phase = 'menu';
    this.playerX = 0;
    this.playerY = 0;
    this.playerCar.group.position.set(0, 0, 0);
    this.playerCar.bodyGroup.rotation.set(0, 0, 0);
    this.playerCar.shieldMesh.visible = false;
    this.isNitroActive = false;
    this.emitHud();
  }

  private clearDynamicEntities(): void {
    for (const t of this.traffic) this.scene.remove(t.mesh);
    for (const o of this.orbs) this.scene.remove(o.mesh);
    for (const r of this.ramps) this.scene.remove(r.mesh);
    for (const s of this.shields) this.scene.remove(s.mesh);
    for (const p of this.particles) this.scene.remove(p.mesh);

    this.traffic = [];
    this.orbs = [];
    this.ramps = [];
    this.shields = [];
    this.particles = [];
  }

  private activateNitro(): void {
    this.isNitroActive = true;
    soundEngine.playNitroStart();
    this.pushEvent('NITRO OVERDRIVE!', 'SMASH TRAFFIC FOR BONUS', '#00f5ff');
  }

  private pushEvent(label: string, sublabel: string | undefined, color: string): void {
    const now = performance.now();
    this.events.push({
      id: this.nextEventId++,
      label,
      sublabel,
      color,
      createdAt: now,
    });
    if (this.events.length > 4) {
      this.events.shift();
    }
  }

  // ==================== Spawners ====================

  private spawnTraffic(): void {
    const lane = Math.floor(Math.random() * LANE_CENTERS.length);
    const x = LANE_CENTERS[lane];
    const z = -185 - Math.random() * 25;

    // Avoid overlapping existing traffic in the same lane
    for (const t of this.traffic) {
      if (t.lane === lane && Math.abs(t.mesh.position.z - z) < 22) {
        return;
      }
    }

    const isTruck = Math.random() < 0.24;
    const mesh = createTrafficCar(isTruck);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);

    const mode = GAME_MODES[this.modeId];
    this.traffic.push({
      mesh,
      lane,
      speed: mode.baseSpeed * (0.38 + Math.random() * 0.25),
      width: isTruck ? 2.25 : 2.0,
      length: isTruck ? 5.6 : 4.2,
      nearMissed: false,
      smashed: false,
      velX: 0,
      velY: 0,
      velZ: 0,
      rotSpeedX: 0,
      rotSpeedY: 0,
    });
  }

  private spawnOrbLine(): void {
    const lane = Math.floor(Math.random() * LANE_CENTERS.length);
    const x = LANE_CENTERS[lane];
    const count = 3 + Math.floor(Math.random() * 3);
    const startZ = -175;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.orbGeo, this.orbMat);
      const baseY = 1.05;
      mesh.position.set(x, baseY, startZ - i * 5.2);
      this.scene.add(mesh);
      this.orbs.push({ mesh, baseY, collected: false });
    }
  }

  private spawnRamp(): void {
    const lane = Math.floor(Math.random() * LANE_CENTERS.length);
    const x = LANE_CENTERS[lane];
    const group = new THREE.Group();

    const wedgeGeo = new THREE.BoxGeometry(2.7, 0.22, 5.2);
    const wedgeMat = new THREE.MeshStandardMaterial({
      color: 0xa855f7,
      emissive: 0xc026d3,
      emissiveIntensity: 1.9,
    });
    const wedge = new THREE.Mesh(wedgeGeo, wedgeMat);
    wedge.rotation.x = 0.23;
    wedge.position.set(0, 0.55, 0);
    group.add(wedge);

    const chevronMat = new THREE.MeshBasicMaterial({ color: 0x00f5ff });
    for (let i = -1; i <= 1; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.08, 0.35), chevronMat);
      bar.rotation.x = 0.23;
      bar.position.set(0, 0.68 - i * 0.3, i * 1.3);
      group.add(bar);
    }

    group.position.set(x, 0, -185);
    this.scene.add(group);
    this.ramps.push({ mesh: group, triggered: false });
  }

  private spawnShieldItem(): void {
    if (this.hasShield) return;
    const lane = Math.floor(Math.random() * LANE_CENTERS.length);
    const mesh = new THREE.Mesh(this.shieldGeo, this.shieldMat);
    mesh.position.set(LANE_CENTERS[lane], 1.25, -185);
    this.scene.add(mesh);
    this.shields.push({ mesh, collected: false });
  }

  private spawnBurst(pos: THREE.Vector3, colorHex: number, count: number, speedScale = 1): void {
    const mat = new THREE.MeshBasicMaterial({ color: colorHex });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 14 * speedScale,
          (2 + Math.random() * 9) * speedScale,
          (Math.random() - 0.5) * 14 * speedScale
        ),
        life: 0.45 + Math.random() * 0.35,
        maxLife: 0.8,
      });
    }
  }

  // ==================== Main Loop ====================

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.animFrameId = requestAnimationFrame(this.loop);

    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.phase === 'menu' || this.phase === 'gameover') {
      this.updateShowcase(dt);
    } else if (this.phase === 'playing') {
      this.updateGameplay(dt, now);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateShowcase(dt: number): void {
    this.menuOrbitAngle += dt * 0.38;
    const cruiseSpeed = 32;
    this.scrollEnvironment(dt, cruiseSpeed);

    // Gentle auto-weaving in showcase
    this.playerCar.group.position.x = Math.sin(this.menuOrbitAngle * 1.4) * 1.6;
    this.playerCar.group.position.y = 0;
    this.playerCar.bodyGroup.rotation.z = -Math.cos(this.menuOrbitAngle * 1.4) * 0.06;
    this.playerCar.bodyGroup.rotation.y = 0;

    for (const w of this.playerCar.wheels) {
      w.rotation.x -= dt * 14;
    }
    for (const f of this.playerCar.flames) {
      f.visible = false;
    }
    for (const l of this.speedLines) {
      l.visible = false;
    }

    // Orbit camera around car
    const radius = 8.4;
    const camX = Math.sin(this.menuOrbitAngle) * radius;
    const camZ = Math.cos(this.menuOrbitAngle) * radius + 1.2;
    this.camera.position.lerp(new THREE.Vector3(camX, 3.4, camZ), dt * 3);
    this.camera.lookAt(this.playerCar.group.position.x, 1.0, -1.5);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 60, dt * 4);
    this.camera.updateProjectionMatrix();
  }

  private scrollEnvironment(dt: number, speed: number): void {
    this.roadTexture.offset.y += dt * speed * 0.145;

    for (const arch of this.arches) {
      arch.position.z += speed * dt;
      if (arch.position.z > 24) {
        arch.position.z -= 8 * 34;
      }
    }

    for (const b of this.buildings) {
      b.position.z += speed * dt;
      if (b.position.z > 28) {
        b.position.z -= 280;
      }
    }
  }

  private updateGameplay(dt: number, now: number): void {
    const mode = GAME_MODES[this.modeId];

    // 1. Read player input
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA') || this.touchControls.left;
    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD') || this.touchControls.right;
    const accel = this.keys.has('ArrowUp') || this.keys.has('KeyW') || this.touchControls.accel;
    const brake = this.keys.has('ArrowDown') || this.keys.has('KeyS') || this.touchControls.brake;
    const nitroPressed =
      this.keys.has('Space') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touchControls.nitro;

    // 2. Nitro activation & drain
    if (nitroPressed && !this.isNitroActive && this.nitro >= 25) {
      this.activateNitro();
    }

    if (this.isNitroActive) {
      this.nitro = Math.max(0, this.nitro - dt * 26);
      if (this.nitro <= 0) {
        this.isNitroActive = false;
      }
    } else {
      // Passive slow recharge
      this.nitro = Math.min(100, this.nitro + dt * 3.8);
    }

    // 3. Speed calculation (gradual ramp with distance + accel/brake + nitro)
    const progressionBonus = Math.min(26, this.distance * 0.008);
    let targetSpeed = mode.baseSpeed + progressionBonus;
    if (accel) targetSpeed += 18;
    if (brake) targetSpeed -= 20;
    if (this.isNitroActive) targetSpeed += 42;
    targetSpeed = THREE.MathUtils.clamp(targetSpeed, 28, mode.maxSpeed + (this.isNitroActive ? 38 : 0));

    this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, dt * (this.isNitroActive ? 5 : 2.8));

    const speedKmh = Math.round(this.currentSpeed * 3.1);
    if (speedKmh > this.topSpeedKmh) this.topSpeedKmh = speedKmh;

    // Update dynamic BGM filter intensity
    const normSpeed = THREE.MathUtils.clamp((this.currentSpeed - 30) / 110, 0, 1);
    soundEngine.setIntensity(this.isNitroActive ? 1.0 : 0.25 + normSpeed * 0.6);

    // 4. Steering physics
    const steerInput = (right ? 1 : 0) - (left ? 1 : 0);
    const maxLatSpeed = 16.5;
    this.playerVelX = THREE.MathUtils.lerp(this.playerVelX, steerInput * maxLatSpeed, dt * 11);
    this.playerX += this.playerVelX * dt;
    const maxRoadX = ROAD_WIDTH / 2 - 1.35;
    if (this.playerX < -maxRoadX) {
      this.playerX = -maxRoadX;
      this.playerVelX = 0;
    } else if (this.playerX > maxRoadX) {
      this.playerX = maxRoadX;
      this.playerVelX = 0;
    }

    // 5. Vertical jump physics
    if (this.playerY > 0 || this.playerVelY > 0) {
      this.playerY += this.playerVelY * dt;
      this.playerVelY -= 32 * dt; // Gravity
      if (this.playerY <= 0) {
        this.playerY = 0;
        this.playerVelY = 0;
        this.spawnBurst(new THREE.Vector3(this.playerX, 0.2, 0.5), 0x00f5ff, 10, 0.65);
      }
    }

    // Apply transforms to player car
    this.playerCar.group.position.set(this.playerX, this.playerY, 0);
    this.playerCar.bodyGroup.rotation.z = THREE.MathUtils.lerp(
      this.playerCar.bodyGroup.rotation.z,
      -this.playerVelX * 0.015,
      dt * 12
    );
    this.playerCar.bodyGroup.rotation.y = THREE.MathUtils.lerp(
      this.playerCar.bodyGroup.rotation.y,
      -this.playerVelX * 0.008,
      dt * 12
    );
    this.playerCar.bodyGroup.rotation.x = THREE.MathUtils.lerp(
      this.playerCar.bodyGroup.rotation.x,
      this.playerY > 0.1 ? Math.min(0.28, this.playerVelY * 0.025) : 0,
      dt * 10
    );

    // Wheel rotation
    for (const w of this.playerCar.wheels) {
      w.rotation.x -= dt * this.currentSpeed * 0.45;
    }

    // Invulnerability blink
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.playerCar.bodyGroup.visible = Math.floor(this.invulnerableTimer * 18) % 2 === 0;
    } else {
      this.playerCar.bodyGroup.visible = true;
    }

    // Shield visual
    this.playerCar.shieldMesh.visible = this.hasShield;
    if (this.hasShield) {
      this.playerCar.shieldMesh.rotation.y += dt * 1.8;
      this.playerCar.shieldMesh.rotation.x += dt * 0.9;
    }

    // Nitro flames & speed lines
    for (const f of this.playerCar.flames) {
      f.visible = this.isNitroActive;
      if (this.isNitroActive) {
        f.scale.set(1, 0.8 + Math.random() * 0.65, 1);
      }
    }
    for (const line of this.speedLines) {
      line.visible = this.isNitroActive || this.currentSpeed > 95;
      if (line.visible) {
        line.position.z += dt * this.currentSpeed * 2.4;
        if (line.position.z > 12) {
          line.position.z = -50 - Math.random() * 40;
          line.position.x = (Math.random() - 0.5) * 20;
        }
      }
    }

    // 6. Scroll world & accumulate distance/score
    this.scrollEnvironment(dt, this.currentSpeed);
    const deltaDist = this.currentSpeed * dt;
    this.distance += deltaDist;
    this.score += deltaDist * 0.95 * this.combo * mode.scoreMultiplier;

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 1;
      }
    }

    // 7. Spawning logic
    this.spawnTrafficTimer -= dt;
    if (this.spawnTrafficTimer <= 0) {
      this.spawnTraffic();
      const baseInterval = Math.max(0.32, 1.08 / mode.trafficDensity - this.distance * 0.00005);
      this.spawnTrafficTimer = baseInterval * (0.7 + Math.random() * 0.6);
    }

    this.spawnOrbTimer -= dt;
    if (this.spawnOrbTimer <= 0) {
      this.spawnOrbLine();
      this.spawnOrbTimer = 2.2 + Math.random() * 1.8;
    }

    this.spawnRampTimer -= dt;
    if (this.spawnRampTimer <= 0) {
      this.spawnRamp();
      this.spawnRampTimer = 7.5 + Math.random() * 5.5;
    }

    this.spawnShieldTimer -= dt;
    if (this.spawnShieldTimer <= 0) {
      this.spawnShieldItem();
      this.spawnShieldTimer = 16 + Math.random() * 10;
    }

    // 8. Update entities & collisions
    this.updateTraffic(dt);
    this.updateOrbs(dt, now);
    this.updateRamps(dt);
    this.updateShields(dt);
    this.updateParticles(dt);

    // Prune expired floating events
    this.events = this.events.filter((ev) => now - ev.createdAt < 1850);

    // 9. Update Camera
    this.updateCamera(dt);

    // 10. Emit HUD at ~20Hz
    this.hudEmitAccum += dt;
    if (this.hudEmitAccum >= 0.05) {
      this.hudEmitAccum = 0;
      this.emitHud();
    }
  }

  private updateTraffic(dt: number): void {
    const mode = GAME_MODES[this.modeId];
    for (let i = this.traffic.length - 1; i >= 0; i--) {
      const t = this.traffic[i];

      if (t.smashed) {
        t.mesh.position.x += t.velX * dt;
        t.mesh.position.y += t.velY * dt;
        t.mesh.position.z += t.velZ * dt;
        t.velY -= 26 * dt;
        t.mesh.rotation.x += t.rotSpeedX * dt;
        t.mesh.rotation.y += t.rotSpeedY * dt;
        if (t.mesh.position.y < -10 || t.mesh.position.z > 40) {
          this.scene.remove(t.mesh);
          this.traffic.splice(i, 1);
        }
        continue;
      }

      const relSpeed = this.currentSpeed - t.speed;
      t.mesh.position.z += relSpeed * dt;

      const dx = Math.abs(t.mesh.position.x - this.playerX);
      const dz = Math.abs(t.mesh.position.z);
      const hitHalfW = (t.width + 1.85) * 0.45;
      const hitHalfL = (t.length + 4.1) * 0.45;

      // Player jumps clean over traffic when high enough
      const isAirborneAbove = this.playerY > 2.05;

      if (!isAirborneAbove && dx < hitHalfW && dz < hitHalfL) {
        if (this.isNitroActive) {
          // SMASH! Send rival flying!
          t.smashed = true;
          t.velX = (t.mesh.position.x >= this.playerX ? 1 : -1) * (16 + Math.random() * 10);
          t.velY = 14 + Math.random() * 8;
          t.velZ = -22;
          t.rotSpeedX = (Math.random() - 0.5) * 10;
          t.rotSpeedY = (Math.random() - 0.5) * 12;
          this.smashCount += 1;
          this.incrementCombo();
          const bonus = Math.round(300 * this.combo * mode.scoreMultiplier);
          this.score += bonus;
          this.triggerShake(0.22, 0.35);
          soundEngine.playSmash();
          this.spawnBurst(t.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)), 0xff2e97, 22, 1.4);
          this.pushEvent('NITRO SMASH!', `+${bonus}`, '#ff2e97');
          continue;
        } else if (this.invulnerableTimer <= 0) {
          this.handleCrash(t.mesh.position);
          // Remove crashed car so player doesn't get stuck in it
          this.scene.remove(t.mesh);
          this.traffic.splice(i, 1);
          continue;
        }
      }

      // Near miss detection
      if (
        !t.nearMissed &&
        t.mesh.position.z > 1.8 &&
        t.mesh.position.z < 6.5 &&
        dx < hitHalfW + 1.55 &&
        dx >= hitHalfW * 0.85
      ) {
        t.nearMissed = true;
        this.nearMissCount += 1;
        this.incrementCombo();
        const bonus = Math.round(150 * this.combo * mode.scoreMultiplier);
        this.score += bonus;
        this.nitro = Math.min(100, this.nitro + 12);
        soundEngine.playNearMiss();
        this.pushEvent('NEAR MISS!', `+${bonus}  NITRO +12%`, '#facc15');
      }

      if (t.mesh.position.z > 28) {
        this.scene.remove(t.mesh);
        this.traffic.splice(i, 1);
      }
    }
  }

  private updateOrbs(dt: number, now: number): void {
    const mode = GAME_MODES[this.modeId];
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.mesh.position.z += this.currentSpeed * dt;
      o.mesh.rotation.y += dt * 3.2;
      o.mesh.position.y = o.baseY + Math.sin(now * 0.005 + i) * 0.22;

      const dx = Math.abs(o.mesh.position.x - this.playerX);
      const dz = Math.abs(o.mesh.position.z);
      const dy = Math.abs(o.mesh.position.y - (this.playerY + 0.8));

      if (!o.collected && dx < 1.75 && dz < 2.4 && dy < 2.2) {
        o.collected = true;
        this.incrementCombo();
        const pts = Math.round(75 * this.combo * mode.scoreMultiplier);
        this.score += pts;
        this.nitro = Math.min(100, this.nitro + 7);
        soundEngine.playOrb(this.combo);
        this.spawnBurst(o.mesh.position.clone(), 0xffe600, 10, 0.8);
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
        continue;
      }

      if (o.mesh.position.z > 18) {
        this.scene.remove(o.mesh);
        this.orbs.splice(i, 1);
      }
    }
  }

  private updateRamps(dt: number): void {
    const mode = GAME_MODES[this.modeId];
    for (let i = this.ramps.length - 1; i >= 0; i--) {
      const r = this.ramps[i];
      r.mesh.position.z += this.currentSpeed * dt;

      const dx = Math.abs(r.mesh.position.x - this.playerX);
      const dz = Math.abs(r.mesh.position.z);

      if (!r.triggered && this.playerY < 0.8 && dx < 1.8 && dz < 2.8) {
        r.triggered = true;
        this.playerVelY = 16.2;
        this.nitro = Math.min(100, this.nitro + 18);
        this.incrementCombo();
        const bonus = Math.round(220 * this.combo * mode.scoreMultiplier);
        this.score += bonus;
        soundEngine.playJump();
        this.spawnBurst(new THREE.Vector3(this.playerX, 0.5, 0), 0xc026d3, 18, 1.1);
        this.pushEvent('BIG AIR JUMP!', `+${bonus}  NITRO +18%`, '#c084fc');
      }

      if (r.mesh.position.z > 20) {
        this.scene.remove(r.mesh);
        this.ramps.splice(i, 1);
      }
    }
  }

  private updateShields(dt: number): void {
    for (let i = this.shields.length - 1; i >= 0; i--) {
      const s = this.shields[i];
      s.mesh.position.z += this.currentSpeed * dt;
      s.mesh.rotation.y += dt * 2.5;
      s.mesh.rotation.x += dt * 1.4;

      const dx = Math.abs(s.mesh.position.x - this.playerX);
      const dz = Math.abs(s.mesh.position.z);

      if (!s.collected && dx < 1.9 && dz < 2.6) {
        s.collected = true;
        this.hasShield = true;
        soundEngine.playShieldPickup();
        this.spawnBurst(s.mesh.position.clone(), 0x38bdf8, 16, 1.0);
        this.pushEvent('ENERGY SHIELD ON!', '1回衝突を無効化', '#38bdf8');
        this.scene.remove(s.mesh);
        this.shields.splice(i, 1);
        continue;
      }

      if (s.mesh.position.z > 18) {
        this.scene.remove(s.mesh);
        this.shields.splice(i, 1);
      }
    }
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 18 * dt;
      const scale = Math.max(0.05, p.life / p.maxLife);
      p.mesh.scale.setScalar(scale);
    }
  }

  private incrementCombo(): void {
    this.combo = Math.min(10, this.combo + 1);
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    this.comboTimer = 4.2;
  }

  private handleCrash(hitPos: THREE.Vector3): void {
    if (this.hasShield) {
      this.hasShield = false;
      this.invulnerableTimer = 1.4;
      this.triggerShake(0.28, 0.45);
      soundEngine.playCrash(true);
      this.spawnBurst(hitPos.clone().add(new THREE.Vector3(0, 1, 0)), 0x38bdf8, 24, 1.3);
      this.pushEvent('SHIELD SAVED!', 'バリアで衝突を防御', '#38bdf8');
      this.emitHud();
      return;
    }

    this.lives -= 1;
    this.combo = 1;
    this.comboTimer = 0;
    this.currentSpeed = Math.max(32, this.currentSpeed * 0.65);
    this.invulnerableTimer = 1.8;
    this.triggerShake(0.45, 0.8);
    soundEngine.playCrash(false);
    this.spawnBurst(hitPos.clone().add(new THREE.Vector3(0, 1, 0)), 0xff2e97, 30, 1.5);

    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.isNitroActive = false;
      soundEngine.setIntensity(0.2);
      if (this.score > this.highScore) {
        this.highScore = Math.floor(this.score);
        this.saveHighScore(this.highScore);
      }
      this.pushEvent('SYSTEM CRITICAL', 'GAME OVER', '#ff2e97');
    } else {
      this.pushEvent('IMPACT!', `残ライフ: ${this.lives}`, '#fb7185');
    }
    this.emitHud();
  }

  private triggerShake(duration: number, magnitude: number): void {
    this.shakeTimer = Math.max(this.shakeTimer, duration);
    this.shakeMagnitude = Math.max(this.shakeMagnitude, magnitude);
  }

  private updateCamera(dt: number): void {
    let targetPos = new THREE.Vector3();
    let lookTarget = new THREE.Vector3();
    let targetFov = 64;

    if (this.cameraMode === 'chase') {
      targetPos.set(this.playerX * 0.72, 4.1 + this.playerY * 0.55, 9.2);
      lookTarget.set(this.playerX * 0.5, 1.3 + this.playerY * 0.45, -18);
      targetFov = this.isNitroActive ? 80 : 65 + Math.max(0, this.currentSpeed - 50) * 0.12;
    } else if (this.cameraMode === 'dynamic') {
      targetPos.set(this.playerX * 0.92 - this.playerVelX * 0.08, 3.5 + this.playerY * 0.65, 8.2);
      lookTarget.set(this.playerX * 0.7 + this.playerVelX * 0.14, 1.4 + this.playerY * 0.5, -24);
      targetFov = this.isNitroActive ? 84 : 68 + Math.max(0, this.currentSpeed - 50) * 0.14;
    } else {
      // Hood view
      targetPos.set(this.playerX, 1.42 + this.playerY, -0.45);
      lookTarget.set(this.playerX + this.playerVelX * 0.06, 1.15 + this.playerY, -35);
      targetFov = this.isNitroActive ? 88 : 74;
    }

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      targetPos.x += (Math.random() - 0.5) * this.shakeMagnitude;
      targetPos.y += (Math.random() - 0.5) * this.shakeMagnitude;
    } else {
      this.shakeMagnitude = 0;
    }

    const lerpRate = this.cameraMode === 'hood' ? 24 : 9;
    this.camera.position.lerp(targetPos, Math.min(1, dt * lerpRate));
    this.camera.lookAt(lookTarget);

    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, dt * 6);
    this.camera.updateProjectionMatrix();
  }

  private emitHud(): void {
    const scoreInt = Math.floor(this.score);
    const highScoreInt = Math.max(this.highScore, scoreInt);
    this.onHudUpdate({
      phase: this.phase,
      score: scoreInt,
      highScore: highScoreInt,
      distance: Math.floor(this.distance),
      speedKmh: Math.round(this.currentSpeed * 3.1),
      combo: this.combo,
      maxCombo: this.maxCombo,
      nitro: Math.round(this.nitro),
      isNitroActive: this.isNitroActive,
      lives: this.lives,
      maxLives: this.maxLives,
      hasShield: this.hasShield,
      nearMissCount: this.nearMissCount,
      smashCount: this.smashCount,
      topSpeedKmh: this.topSpeedKmh,
      cameraMode: this.cameraMode,
      isAirborne: this.playerY > 0.3,
      events: [...this.events],
    });
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.animFrameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
