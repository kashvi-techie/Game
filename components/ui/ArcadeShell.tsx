"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Cpu, Flag, Gauge, Pause, Play, RotateCcw, SkipForward, Volume2, VolumeX, Wifi } from "lucide-react";
import RaceViewport from "@/components/game/RaceViewport";
import { arcadeAudio } from "@/game/audio/ArcadeAudio";
import { RACE_LAPS } from "@/game/physics/racingPhysics";
import { useGameStore, type WorldMode } from "@/lib/state/gameStore";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder.toFixed(2).padStart(5, "0")}`;
}

function BrandMark() {
  return (
    <div className="brand-mark" aria-label="ESP32 Arcade">
      <span className="brand-symbol" aria-hidden="true"><i /><i /><i /></span>
      <span className="brand-type">ESP32 <b>ARCADE</b></span>
    </div>
  );
}

function AudioControls() {
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const resumeAudio = () => { void arcadeAudio.resumeFromGesture(); };

  return (
    <div className="audio-controls" aria-label="Audio settings">
      <button
        className="audio-mute"
        type="button"
        aria-label={muted ? "Unmute audio" : "Mute audio"}
        title={muted ? "Unmute audio" : "Mute audio"}
        onClick={() => {
          resumeAudio();
          setMuted((current) => {
            arcadeAudio.setMuted(!current);
            return !current;
          });
        }}
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
      <label className="audio-volume-label" htmlFor="arcade-volume">VOLUME</label>
      <input
        id="arcade-volume"
        aria-label="Volume"
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={volume}
        onPointerDown={resumeAudio}
        onChange={(event) => {
          resumeAudio();
          const nextVolume = Number(event.currentTarget.value);
          setVolume(nextVolume);
          arcadeAudio.setVolume(nextVolume);
        }}
      />
    </div>
  );
}

function CountdownScreen({ value, onCancel }: { value: number; onCancel: () => void }) {
  return (
    <div className="countdown-screen" role="status" aria-live="assertive">
      <span className="countdown-label">GET READY</span>
      <strong>{value === 0 ? "GO" : value}</strong>
      <button type="button" onClick={onCancel}>CANCEL <kbd>ESC</kbd></button>
    </div>
  );
}

function MenuScreen({ onStart, onReplayIntro, worldMode, onSelectWorldMode }: {
  onStart: () => void;
  onReplayIntro: () => void;
  worldMode: WorldMode;
  onSelectWorldMode: (mode: WorldMode) => void;
}) {
  return (
    <main className="menu-screen menu-arrive">
      <header className="topbar">
        <BrandMark />
        <div className="menu-top-meta"><span>INDEPENDENT ARCADE SYSTEMS</span><span className="topbar-divider" /><span>BUILD 001</span></div>
        <div className="connection-state"><span className="status-dot" />LOCAL INPUT</div>
        <button className="intro-replay" type="button" onClick={onReplayIntro} aria-label="Replay intro">
          <RotateCcw size={12} /> REPLAY INTRO
        </button>
      </header>

      <div className="menu-layout">
        <section className="menu-copy">
          <div className="eyebrow"><span className="eyebrow-line" />01 <span>/</span> THREE-LAP SPRINT</div>
          <h1>ESP32<br /><span>ARCADE</span></h1>
          <p className="menu-intro">A small world. A fast line.<br />Your next lap starts here.</p>
          <button className="race-launch" onClick={onStart}>
            <span className="launch-icon"><Play size={17} fill="currentColor" /></span>
            <span><strong>{worldMode === "society" ? "EXPLORE SOCIETY" : "ENTER THE GRID"}</strong><small>{worldMode === "society" ? "FREE ROAM · AVAILABLE NOW" : "CIRCUIT SPRINT · 3 LAPS"}</small></span>
            <span className="launch-arrow">↗</span>
          </button>
          <div className="mode-list" role="radiogroup" aria-label="World mode">
            <button className={`mode-item ${worldMode === "circuit" ? "mode-active" : "mode-locked"}`} role="radio" aria-checked={worldMode === "circuit"} onClick={() => onSelectWorldMode("circuit")}>
              <span className="mode-number">01</span><span>CIRCUIT SPRINT</span><span className={worldMode === "circuit" ? "mode-live" : "mode-soon"}>{worldMode === "circuit" ? "SELECTED" : "3 LAPS"}</span>
            </button>
            <button className={`mode-item ${worldMode === "society" ? "mode-active" : "mode-locked"}`} role="radio" aria-checked={worldMode === "society"} onClick={() => onSelectWorldMode("society")}>
              <span className="mode-number">02</span><span>RESIDENTIAL SOCIETY</span><span className={worldMode === "society" ? "mode-live" : "mode-soon"}>{worldMode === "society" ? "SELECTED" : "FREE ROAM"}</span>
            </button>
          </div>
        </section>

        <aside className="menu-side-note">
          <div className="side-note-label"><span className="side-note-mark" /> CIRCUIT 01</div>
          <strong>GREEN<br />VALLEY</strong>
          <span className="side-note-rule" />
          <span className="side-note-detail">COASTAL LOOP<br />3 LAPS · SOLO RUN</span>
          <div className="side-note-bottom"><span>DRIVE</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></div>
        </aside>
      </div>

      <footer className="menu-footer"><span>DESIGNED TO PLAY · BUILT TO EXPAND</span><span>NO SIGNAL REQUIRED <span className="footer-cross">✳</span></span></footer>
    </main>
  );
}

function RaceHud({ onPause, onMenu, exploring = false }: { onPause: () => void; onMenu: () => void; exploring?: boolean }) {
  const speed = useGameStore((state) => state.speed);
  const lap = useGameStore((state) => state.lap);
  const elapsed = useGameStore((state) => state.elapsed);
  const nitro = useGameStore((state) => state.nitro);
  const currentLapTime = useGameStore((state) => state.currentLapTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const lapProgress = useGameStore((state) => state.lapProgress);
  const wrongWay = useGameStore((state) => state.wrongWay);
  const TAU = Math.PI * 2;

  return (
    <div className="race-hud">
      <header className="race-topbar">
        <button className="hud-brand-button" aria-label="Return to menu" onClick={onMenu}>
          <BrandMark />
        </button>
        <div className="race-status"><span className="status-dot" />{exploring ? "SOCIETY EXPLORATION" : "RACE IN PROGRESS"}</div>
        <button className="icon-button pause-button" aria-label="Pause race" onClick={onPause}><Pause size={17} fill="currentColor" /></button>
      </header>

      {!exploring && <div className="race-top-readouts">
        <div className="readout-block"><span className="readout-label"><Flag size={12} /> LAP</span><strong>{String(Math.min(lap, RACE_LAPS)).padStart(2, "0")}<i> / {RACE_LAPS}</i></strong></div>
        <div className="readout-block"><span className="readout-label">POSITION</span><strong>01<i> / 01</i></strong></div>
        <div className="readout-block timer-readout"><span className="readout-label">RACE TIME</span><strong>{formatTime(elapsed)}</strong></div>
      </div>}

      {!exploring && <div className="race-lap-times">
        <div className="lap-time-block"><span className="lap-time-label">CURRENT LAP</span><strong>{formatTime(currentLapTime)}</strong></div>
        <div className="lap-time-block"><span className="lap-time-label">BEST LAP</span><strong>{bestLapTime === Infinity ? "--:--" : formatTime(bestLapTime)}</strong></div>
      </div>}

      {!exploring && <div className="track-progress-indicator">
        <svg className="track-progress-svg" viewBox="0 0 100 100">
          <circle className="track-progress-bg" cx="50" cy="50" r="42" fill="none" />
          <circle
            className="track-progress-fill"
            cx="50"
            cy="50"
            r="42"
            fill="none"
            strokeDasharray={`${(lapProgress / TAU) * 264} 264`}
            transform="rotate(-90 50 50)"
          />
        </svg>
        <div className="track-progress-text">{Math.round((lapProgress / TAU) * 100)}%</div>
      </div>}

      <div className="race-bottom-hud">
        <section className="speed-readout" aria-label={`Speed ${Math.round(speed)} kilometers per hour`}>
          <div className="speed-title"><Gauge size={14} /><span>SPEED</span><i>KM/H</i></div>
          <div className="speed-value">{Math.round(speed).toString().padStart(3, "0")}</div>
          <div className="nitro-readout"><span>NITRO</span><div className="nitro-track"><i style={{ width: `${nitro}%` }} /></div><span>{Math.round(nitro)}%</span></div>
        </section>
        <div className="controller-badge"><span className="controller-icon"><Cpu size={17} /></span><span><strong>KEYBOARD</strong><small>CONNECTED · LOCAL</small></span><span className="controller-check">✓</span></div>
      </div>

      {wrongWay && <div className="wrong-way-warning" role="status">WRONG WAY</div>}
      <div className="race-controls-hint"><span>STEER <kbd>A</kbd><kbd>D</kbd></span><span>THROTTLE <kbd>W</kbd></span><span>BRAKE <kbd>S</kbd></span><span>BOOST <kbd>SPACE</kbd></span><span>HANDBRAKE <kbd>SHIFT</kbd></span><span>RESET <kbd>R</kbd></span></div>
      <div className="track-label"><span>01</span><i /> {exploring ? "RESIDENTIAL SOCIETY" : "GREEN VALLEY CIRCUIT"}</div>
    </div>
  );
}

function PauseScreen({ onResume, onRestart, onMenu, finished }: { onResume: () => void; onRestart: () => void; onMenu: () => void; finished: boolean }) {
  return (
    <div className="modal-scrim">
      <section className="pause-panel" aria-labelledby="pause-title">
        <div className="eyebrow"><span className="eyebrow-line" />{finished ? "FINISH LINE" : "RACE CONTROL"}</div>
        <h2 id="pause-title">{finished ? <>RUN<br /><span>COMPLETE</span></> : <>TAKE A<br /><span>BREATHER</span></>}</h2>
        <p>{finished ? "Three laps in the books. The circuit is yours." : "Your session is paused. Catch your breath, then get back out there."}</p>
        <button className="race-launch modal-primary" onClick={finished ? onRestart : onResume}>
          <span className="launch-icon">{finished ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}</span>
          <span><strong>{finished ? "RUN IT BACK" : "RESUME RACE"}</strong><small>{finished ? "RESTART THE CIRCUIT" : "PICK UP WHERE YOU LEFT OFF"}</small></span>
          <span className="launch-arrow">↗</span>
        </button>
        <button className="text-action" onClick={onRestart}><RotateCcw size={14} /> RESTART RACE</button>
        <button className="text-action" onClick={onMenu}><ArrowLeft size={14} /> RETURN TO ARCADE</button>
      </section>
      <div className="modal-controller"><Wifi size={14} /><span>KEYBOARD INPUT ACTIVE</span></div>
    </div>
  );
}

export default function ArcadeShell() {
  const phase = useGameStore((state) => state.phase);
  const worldMode = useGameStore((state) => state.worldMode);
  const startRace = useGameStore((state) => state.startRace);
  const startExploration = useGameStore((state) => state.startExploration);
  const setWorldMode = useGameStore((state) => state.setWorldMode);
  const pauseRace = useGameStore((state) => state.pauseRace);
  const resumeRace = useGameStore((state) => state.resumeRace);
  const resumeExploration = useGameStore((state) => state.resumeExploration);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const restartRace = useGameStore((state) => state.restartRace);
  const [introPlaying, setIntroPlaying] = useState(true);
  const [introRunId, setIntroRunId] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const collided = useGameStore((state) => state.collided);

  const skipIntro = useCallback(() => {
    setIntroPlaying(false);
    setWorldMode("society");
  }, [setWorldMode]);
  const replayIntro = useCallback(() => {
    void arcadeAudio.resumeFromGesture();
    setWorldMode("circuit");
    setIntroRunId((current) => current + 1);
    setIntroPlaying(true);
  }, [setWorldMode]);
  const beginRace = () => {
    void arcadeAudio.resumeFromGesture();
    if (worldMode === "society") startExploration();
    else setCountdown(3);
  };
  const launchRace = useCallback(() => {
    arcadeAudio.playCue("start");
    setCountdown(null);
    startRace();
  }, [startRace]);
  const continueRace = () => {
    void arcadeAudio.resumeFromGesture();
    if (worldMode === "society") resumeExploration();
    else resumeRace();
  };
  const restartRaceWithAudio = () => {
    void arcadeAudio.resumeFromGesture();
    if (worldMode === "society") startExploration();
    else restartRace();
  };

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const timer = window.setTimeout(launchRace, 480);
      return () => window.clearTimeout(timer);
    }

    arcadeAudio.playCue("countdown");
    const timer = window.setTimeout(() => setCountdown((current) => current === null ? null : current - 1), 720);
    return () => window.clearTimeout(timer);
  }, [countdown, launchRace]);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = window.requestAnimationFrame(() => {
      setReducedMotion(preference.matches);
      if (preference.matches) skipIntro();
    });
    const onPreferenceChange = (event: MediaQueryListEvent) => {
      setReducedMotion(event.matches);
      if (event.matches) skipIntro();
    };
    preference.addEventListener("change", onPreferenceChange);
    return () => {
      window.cancelAnimationFrame(frame);
      preference.removeEventListener("change", onPreferenceChange);
    };
  }, [skipIntro]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (countdown !== null && event.code === "Escape") {
        setCountdown(null);
        return;
      }
      if (introPlaying && (event.code === "Escape" || event.code === "KeyI")) {
        skipIntro();
        return;
      }
      if (event.code !== "Escape") return;
      if (phase === "racing" || phase === "exploring") pauseRace();
      else if (phase === "paused") {
        if (worldMode === "society") resumeExploration();
        else resumeRace();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [countdown, introPlaying, phase, pauseRace, resumeExploration, resumeRace, skipIntro, worldMode]);

  return (
    <main className={`arcade-root ${collided ? "collision-flash" : ""}`}>
      <div className="world-viewport" aria-hidden="true">
        <RaceViewport
          introActive={introPlaying}
          introRunId={introRunId}
          motionEnabled={!reducedMotion}
          onIntroComplete={skipIntro}
        />
      </div>
      <div className={`world-vignette ${phase === "racing" ? "vignette-race" : ""}`} />
      <AudioControls />
      {introPlaying && (
        <button className="intro-skip" type="button" onClick={skipIntro}>
          <SkipForward size={13} /> SKIP INTRO <kbd>ESC</kbd>
        </button>
      )}
      {countdown !== null && <CountdownScreen value={countdown} onCancel={() => setCountdown(null)} />}
      {phase === "menu" && !introPlaying && (
        <MenuScreen
          onStart={beginRace}
          onReplayIntro={replayIntro}
          worldMode={worldMode}
          onSelectWorldMode={setWorldMode}
        />
      )}
      {phase === "racing" && <RaceHud onPause={pauseRace} onMenu={returnToMenu} />}
      {phase === "exploring" && <RaceHud exploring onPause={pauseRace} onMenu={returnToMenu} />}
      {(phase === "paused" || phase === "finished") && (
        <>
          <RaceHud exploring={worldMode === "society"} onPause={() => {}} onMenu={returnToMenu} />
          <PauseScreen
            onResume={continueRace}
            onRestart={restartRaceWithAudio}
            onMenu={returnToMenu}
            finished={phase === "finished"}
          />
        </>
      )}
    </main>
  );
}