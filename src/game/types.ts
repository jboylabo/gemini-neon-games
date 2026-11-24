export type GamePhase = 'menu' | 'playing' | 'paused' | 'gameover';

export type GameModeId = 'neon_city' | 'cyber_rush' | 'endless_chill';

export type CameraMode = 'chase' | 'hood' | 'dynamic';

export type CarColorId = 'obsidian' | 'pearl' | 'cyan' | 'pink' | 'gold';

export interface GameModeConfig {
  id: GameModeId;
  name: string;
  subtitle: string;
  description: string;
  baseSpeed: number;
  maxSpeed: number;
  trafficDensity: number;
  scoreMultiplier: number;
  accentColor: string;
}

export interface CarColorConfig {
  id: CarColorId;
  name: string;
  primaryHex: number;
  emissiveHex: number;
  cssColor: string;
  isMatte?: boolean;
}

export interface FloatingEvent {
  id: number;
  label: string;
  sublabel?: string;
  color: string;
  createdAt: number;
}

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  highScore: number;
  distance: number;
  speedKmh: number;
  combo: number;
  maxCombo: number;
  nitro: number; // 0..100
  isNitroActive: boolean;
  lives: number;
  maxLives: number;
  hasShield: boolean;
  nearMissCount: number;
  smashCount: number;
  topSpeedKmh: number;
  cameraMode: CameraMode;
  isAirborne: boolean;
  events: FloatingEvent[];
}

export const GAME_MODES: Record<GameModeId, GameModeConfig> = {
  neon_city: {
    id: 'neon_city',
    name: 'NEON CITY',
    subtitle: 'STANDARD',
    description: 'ネオンハイウェイを駆け抜けるバランス重視の標準モード',
    baseSpeed: 54,
    maxSpeed: 108,
    trafficDensity: 1.0,
    scoreMultiplier: 1.0,
    accentColor: '#00f5ff',
  },
  cyber_rush: {
    id: 'cyber_rush',
    name: 'CYBER RUSH',
    subtitle: 'HIGH SPEED ×1.5',
    description: '超高速＆高密度トラフィック！ハイリスク・ハイリターン',
    baseSpeed: 72,
    maxSpeed: 136,
    trafficDensity: 1.45,
    scoreMultiplier: 1.5,
    accentColor: '#ff2e97',
  },
  endless_chill: {
    id: 'endless_chill',
    name: 'ENDLESS CHILL',
    subtitle: 'CRUISE',
    description: '障害物少なめで爽快にネオン夜景をドライブ',
    baseSpeed: 42,
    maxSpeed: 88,
    trafficDensity: 0.62,
    scoreMultiplier: 0.75,
    accentColor: '#a855f7',
  },
};

export const CAR_COLORS: CarColorConfig[] = [
  {
    id: 'obsidian',
    name: 'G63 Matte Black',
    primaryHex: 0x1b1e26,
    emissiveHex: 0x00f5ff,
    cssColor: '#272c38',
    isMatte: true,
  },
  {
    id: 'pearl',
    name: 'Polar White',
    primaryHex: 0xe8eef7,
    emissiveHex: 0x38bdf8,
    cssColor: '#e2e8f0',
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    primaryHex: 0x0284c7,
    emissiveHex: 0x00f5ff,
    cssColor: '#00f5ff',
  },
  {
    id: 'pink',
    name: 'Plasma Pink',
    primaryHex: 0xbe185d,
    emissiveHex: 0xff2e97,
    cssColor: '#ff2e97',
  },
  {
    id: 'gold',
    name: 'Solar Gold',
    primaryHex: 0xb45309,
    emissiveHex: 0xffc800,
    cssColor: '#ffc800',
  },
];
