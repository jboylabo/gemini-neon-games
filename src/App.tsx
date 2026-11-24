import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Flame,
  Gamepad2,
  Home,
  Music,
  Pause,
  Play,
  RotateCcw,
  Shield,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { soundEngine } from './audio/soundEngine';
import { NeonCarGame } from './game/NeonCarGame';
import {
  CAR_COLORS,
  CarColorId,
  GAME_MODES,
  GameModeId,
  HudSnapshot,
} from './game/types';

const INITIAL_HUD: HudSnapshot = {
  phase: 'menu',
  score: 0,
  highScore: 0,
  distance: 0,
  speedKmh: 0,
  combo: 1,
  maxCombo: 1,
  nitro: 45,
  isNitroActive: false,
  lives: 3,
  maxLives: 3,
  hasShield: false,
  nearMissCount: 0,
  smashCount: 0,
  topSpeedKmh: 0,
  cameraMode: 'chase',
  isAirborne: false,
  events: [],
};

const CONTROL_ITEMS = [
  { keys: ['← / →', 'A / D'], desc: '左右ステアリング（車線移動）' },
  { keys: ['↑ / ↓', 'W / S'], desc: 'アクセル加速 / ブレーキ減速' },
  { keys: ['SPACE', 'SHIFT'], desc: 'ニトロブースト（ゲージ25%以上）' },
  { keys: ['C'], desc: 'カメラ視点切替（チェイス / ダイナミック / ボンネット）' },
  { keys: ['P', 'ESC'], desc: 'ポーズ / 操作説明を表示' },
  { keys: ['M'], desc: 'BGM オン / オフ切替' },
];

export const App: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<NeonCarGame | null>(null);

  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [selectedMode, setSelectedMode] = useState<GameModeId>('neon_city');
  const [selectedColor, setSelectedColor] = useState<CarColorId>('cyan');
  const [bgmOn, setBgmOn] = useState<boolean>(true);
  const [sfxOn, setSfxOn] = useState<boolean>(true);

  useEffect(() => {
    if (!mountRef.current) return;
    const game = new NeonCarGame(mountRef.current, (snapshot) => {
      setHud(snapshot);
    });
    gameRef.current = game;

    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, []);

  // Global keyboard shortcut: M to toggle BGM
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyM') {
        setBgmOn((prev) => {
          const next = !prev;
          soundEngine.setBgmEnabled(next);
          return next;
        });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleToggleBgm = () => {
    const next = !bgmOn;
    setBgmOn(next);
    soundEngine.setBgmEnabled(next);
  };

  const handleToggleSfx = () => {
    const next = !sfxOn;
    setSfxOn(next);
    soundEngine.setSfxEnabled(next);
    if (next) soundEngine.playUiClick();
  };

  const handleSelectMode = (modeId: GameModeId) => {
    setSelectedMode(modeId);
    gameRef.current?.setMode(modeId);
  };

  const handleSelectColor = (colorId: CarColorId) => {
    setSelectedColor(colorId);
    gameRef.current?.setCarColor(colorId);
  };

  const handleStart = () => {
    gameRef.current?.startGame();
  };

  const isNewRecord = hud.phase === 'gameover' && hud.score > 0 && hud.score >= hud.highScore;

  return (
    <div className="game-shell">
      {/* Three.js WebGL Canvas */}
      <div ref={mountRef} className="canvas-mount" />

      {/* Always-accessible top-right audio & game controls */}
      <div className="top-controls">
        <button
          type="button"
          className={`ctrl-pill ${bgmOn ? 'bgm-on' : 'bgm-off'}`}
          onClick={handleToggleBgm}
          title="BGM オン/オフ切替 (M)"
          aria-pressed={bgmOn}
        >
          {bgmOn ? <Music size={15} /> : <VolumeX size={15} />}
          <span>BGM {bgmOn ? 'ON' : 'OFF'}</span>
          <span className="kbd-hint">M</span>
        </button>

        <button
          type="button"
          className="ctrl-pill"
          onClick={handleToggleSfx}
          title="効果音(SE) オン/オフ切替"
          aria-pressed={sfxOn}
        >
          {sfxOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          <span>SE {sfxOn ? 'ON' : 'OFF'}</span>
        </button>

        {hud.phase === 'playing' && (
          <>
            <button
              type="button"
              className="ctrl-pill"
              onClick={() => gameRef.current?.cycleCameraMode()}
              title="カメラ視点切替 (C)"
            >
              <Camera size={15} />
              <span>{hud.cameraMode.toUpperCase()}</span>
              <span className="kbd-hint">C</span>
            </button>
            <button
              type="button"
              className="ctrl-pill"
              onClick={() => gameRef.current?.togglePause()}
              title="ポーズ (P / Esc)"
            >
              <Pause size={15} />
              <span>PAUSE</span>
            </button>
          </>
        )}
      </div>

      {/* ==================== TITLE MENU ==================== */}
      {hud.phase === 'menu' && (
        <div className="overlay-center">
          <div className="menu-layout">
            {/* Left: Title, Mode Selection, Car Color, Start */}
            <div className="glass-panel">
              <div className="brand-badge">
                <Sparkles size={13} />
                THREE.JS 3D CYBER RACING
              </div>
              <h1 className="game-title">NEON OVERDRIVE</h1>
              <p className="game-subtitle">
                ネオン輝く未来都市のハイウェイを駆け抜けろ！オーブでコンボを繋ぎ、ニアミス＆ニトロスマッシュでハイスコアを狙おう。
              </p>

              <div className="section-label">
                <span>1. ゲームモードを選択</span>
                <span>{GAME_MODES[selectedMode].subtitle}</span>
              </div>
              <div className="mode-grid">
                {(Object.keys(GAME_MODES) as GameModeId[]).map((id) => {
                  const m = GAME_MODES[id];
                  const active = selectedMode === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`mode-card ${active ? 'active' : ''}`}
                      style={{ '--mode-accent': m.accentColor } as React.CSSProperties}
                      onClick={() => handleSelectMode(id)}
                    >
                      <div className="mode-name">{m.name}</div>
                      <div className="mode-sub">{m.subtitle}</div>
                      <div className="mode-desc">{m.description}</div>
                    </button>
                  );
                })}
              </div>

              <div className="section-label">
                <span>2. マシンカラー（背景の3D車両に即時反映）</span>
              </div>
              <div className="color-row">
                {CAR_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`color-chip ${selectedColor === c.id ? 'active' : ''}`}
                    onClick={() => handleSelectColor(c.id)}
                  >
                    <span
                      className="color-dot"
                      style={{ backgroundColor: c.cssColor, color: c.cssColor }}
                    />
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="start-row">
                <button type="button" className="btn-primary" onClick={handleStart}>
                  <Play size={19} fill="currentColor" />
                  DRIVE START
                </button>
                <div className="highscore-pill">
                  <span className="highscore-label">HIGH SCORE</span>
                  <span className="highscore-value">{hud.highScore.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Right: Controls & Entertainment Gimmicks Guide */}
            <div className="glass-panel">
              <div className="guide-title">
                <Gamepad2 size={18} color="#00f5ff" />
                <span>操作方法 / CONTROLS</span>
              </div>

              <div className="controls-list">
                {CONTROL_ITEMS.map((item) => (
                  <div className="control-row" key={item.desc}>
                    <div className="keycaps">
                      {item.keys.map((k) => (
                        <span className="keycap" key={k}>
                          {k}
                        </span>
                      ))}
                    </div>
                    <span className="control-desc">{item.desc}</span>
                  </div>
                ))}
              </div>

              <div className="section-label" style={{ marginTop: 16 }}>
                <span>エンタメギミック</span>
              </div>
              <div className="gimmick-grid">
                <div className="gimmick-item">
                  <div className="gimmick-name" style={{ color: '#00f5ff' }}>
                    ニトロスマッシュ
                  </div>
                  <div className="gimmick-text">
                    ニトロ発動中は無敵！ライバル車を弾き飛ばして大ボーナス
                  </div>
                </div>
                <div className="gimmick-item">
                  <div className="gimmick-name" style={{ color: '#facc15' }}>
                    ニアミスボーナス
                  </div>
                  <div className="gimmick-text">
                    対向/先行車のギリギリ横をすり抜けるとニトロ回復＆加点
                  </div>
                </div>
                <div className="gimmick-item">
                  <div className="gimmick-name" style={{ color: '#c084fc' }}>
                    ネオンジャンプ台
                  </div>
                  <div className="gimmick-text">
                    スロープに乗ると大ジャンプ！前方の車を豪快に飛び越える
                  </div>
                </div>
                <div className="gimmick-item">
                  <div className="gimmick-name" style={{ color: '#38bdf8' }}>
                    エネルギーシールド
                  </div>
                  <div className="gimmick-text">
                    青いコアを取得するとバリア展開！1回クラッシュを無効化
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== IN-GAME HUD ==================== */}
      {hud.phase === 'playing' && (
        <div className="hud-layer">
          <div className="hud-top-left">
            <div className="hud-score-box">
              <div className="hud-caption">SCORE</div>
              <div className="hud-score-num">{hud.score.toLocaleString()}</div>
              <div className="hud-sub-row">
                <span>BEST {hud.highScore.toLocaleString()}</span>
                {hud.combo > 1 && <span className="combo-badge">COMBO ×{hud.combo}</span>}
              </div>
            </div>

            <div className="hud-lives-row">
              {Array.from({ length: hud.maxLives }).map((_, i) => (
                <div key={i} className={`life-pip ${i < hud.lives ? 'active' : ''}`} />
              ))}
              {hud.hasShield && (
                <span className="shield-tag">
                  <Shield size={12} /> SHIELD
                </span>
              )}
            </div>
          </div>

          {/* Center Event Toasts */}
          <div className="event-feed">
            {hud.events.map((ev) => (
              <div key={ev.id} className="event-toast" style={{ color: ev.color }}>
                <div className="event-toast-title">{ev.label}</div>
                {ev.sublabel && <div className="event-toast-sub">{ev.sublabel}</div>}
              </div>
            ))}
          </div>

          {/* Bottom-left Distance & Touch Controls */}
          <div className="hud-bottom-left">
            <div className="mini-hint-bar">
              距離 <strong className="font-display">{hud.distance.toLocaleString()} m</strong>
              {' · '}
              <span>←→ / AD 移動 · SPACE ニトロ · C 視点 · M BGM</span>
            </div>

            <div className="touch-pad">
              <button
                type="button"
                className="touch-btn"
                onPointerDown={() => gameRef.current?.setTouchControl('left', true)}
                onPointerUp={() => gameRef.current?.setTouchControl('left', false)}
                onPointerLeave={() => gameRef.current?.setTouchControl('left', false)}
              >
                ◀
              </button>
              <button
                type="button"
                className="touch-btn"
                onPointerDown={() => gameRef.current?.setTouchControl('right', true)}
                onPointerUp={() => gameRef.current?.setTouchControl('right', false)}
                onPointerLeave={() => gameRef.current?.setTouchControl('right', false)}
              >
                ▶
              </button>
              <button
                type="button"
                className="touch-btn nitro-btn"
                onPointerDown={() => gameRef.current?.setTouchControl('nitro', true)}
                onPointerUp={() => gameRef.current?.setTouchControl('nitro', false)}
                onPointerLeave={() => gameRef.current?.setTouchControl('nitro', false)}
              >
                <Zap size={14} style={{ marginRight: 4 }} /> NITRO
              </button>
            </div>
          </div>

          {/* Bottom-right Speedometer & Nitro */}
          <div className="hud-bottom-right">
            <div className="speed-box">
              <div>
                <span className="speed-value">{hud.speedKmh}</span>
                <span className="speed-unit">KM/H</span>
              </div>
              <div className="nitro-header">
                <span
                  style={{
                    color: hud.isNitroActive
                      ? '#ff2e97'
                      : hud.nitro >= 25
                        ? '#00f5ff'
                        : '#94a3b8',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Flame size={13} />
                  {hud.isNitroActive
                    ? 'OVERDRIVE!'
                    : hud.nitro >= 25
                      ? 'NITRO READY [SPACE]'
                      : 'CHARGING...'}
                </span>
                <span className="font-display">{hud.nitro}%</span>
              </div>
              <div className="nitro-track">
                <div className="nitro-fill" style={{ width: `${hud.nitro}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== PAUSE MODAL ==================== */}
      {hud.phase === 'paused' && (
        <div className="overlay-center">
          <div className="glass-panel modal-card">
            <div className="guide-title" style={{ fontSize: 20 }}>
              <Pause size={20} color="#00f5ff" />
              <span className="font-display">PAUSED</span>
            </div>

            <div className="controls-list">
              {CONTROL_ITEMS.map((item) => (
                <div className="control-row" key={item.desc}>
                  <div className="keycaps">
                    {item.keys.map((k) => (
                      <span className="keycap" key={k}>
                        {k}
                      </span>
                    ))}
                  </div>
                  <span className="control-desc">{item.desc}</span>
                </div>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={() => gameRef.current?.togglePause()}
              >
                <Play size={16} fill="currentColor" /> 再開
              </button>
              <button type="button" className="btn-secondary" onClick={handleStart}>
                <RotateCcw size={15} /> リトライ
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => gameRef.current?.returnToMenu()}
              >
                <Home size={15} /> メニュー
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GAME OVER / RESULT ==================== */}
      {hud.phase === 'gameover' && (
        <div className="overlay-center">
          <div className="glass-panel modal-card">
            <div className="brand-badge" style={{ color: '#ff2e97', borderColor: 'rgba(255,46,151,0.5)' }}>
              <Trophy size={13} />
              {isNewRecord ? 'NEW HIGH SCORE!!' : 'RUN COMPLETE'}
            </div>
            <h2 className="game-title" style={{ fontSize: 32 }}>
              {hud.score.toLocaleString()} PTS
            </h2>
            <p className="game-subtitle">
              ハイスコア: <strong className="font-display">{hud.highScore.toLocaleString()}</strong>
            </p>

            <div className="stats-grid">
              <div className="stat-tile">
                <div className="stat-tile-label">走行距離</div>
                <div className="stat-tile-val">{hud.distance.toLocaleString()} m</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">最高速度</div>
                <div className="stat-tile-val">{hud.topSpeedKmh} km/h</div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">最大コンボ / ニアミス</div>
                <div className="stat-tile-val">
                  ×{hud.maxCombo} / {hud.nearMissCount}
                </div>
              </div>
              <div className="stat-tile">
                <div className="stat-tile-label">ニトロスマッシュ</div>
                <div className="stat-tile-val">{hud.smashCount} 台</div>
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-primary" onClick={handleStart}>
                <RotateCcw size={16} /> もう一度走る
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => gameRef.current?.returnToMenu()}
              >
                <Home size={16} /> メニューへ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
