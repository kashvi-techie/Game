"use client";

import { useEffect } from "react";
import { ArrowLeft, Cpu, Flag, Gauge, Pause, Play, RotateCcw, Wifi } from "lucide-react";
import RaceViewport from "@/components/game/RaceViewport";
import { RACE_LAPS } from "@/game/physics/racingPhysics";
import { useGameStore } from "@/lib/state/gameStore";

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

function MenuScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="menu-screen">
      <header className="topbar">
        <BrandMark />
        <div className="menu-top-meta"><span>INDEPENDENT ARCADE SYSTEMS</span><span className="topbar-divider" /><span>BUILD 001</span></div>
        <div className="connection-state"><span className="status-dot" />LOCAL INPUT</div>
      </header>

      <div className="menu-layout">
        <section className="menu-copy">
          <div className="eyebrow"><span className="eyebrow-line" />01 <span>/</span> THREE-LAP SPRINT</div>
          <h1>ESP32<br /><span>ARCADE</span></h1>
          <p className="menu-intro">A small world. A fast line.<br />Your next lap starts here.</p>
          <button className="race-launch" onClick={onStart}>
            <span className="launch-icon"><Play size={17} fill="currentColor" /></span>
            <span><strong>ENTER THE GRID</strong><small>RACING · AVAILABLE NOW</small></span>
            <span className="launch-arrow">↗</span>
          </button>
          <div className="mode-list" aria-label="Game modes">
            <div className="mode-item mode-active"><span className="mode-number">01</span><span>RACING</span><span className="mode-live">LIVE</span></div>
            <div className="mode-item mode-locked"><span className="mode-number">02</span><span>FLIGHT</span><span className="mode-soon">IN DEVELOPMENT</span></div>
            <div className="mode-item mode-locked"><span className="mode-number">03</span><span>SPACE</span><span className="mode-soon">IN DEVELOPMENT</span></div>
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

function RaceHud({ onPause, onMenu }: { onPause: () => void; onMenu: () => void }) {
  const speed = useGameStore((state) => state.speed);
  const lap = useGameStore((state) => state.lap);
  const elapsed = useGameStore((state) => state.elapsed);
  const nitro = useGameStore((state) => state.nitro);
  const currentLapTime = useGameStore((state) => state.currentLapTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const lapProgress = useGameStore((state) => state.lapProgress);
  const TAU = Math.PI * 2;

  return (
    <div className="race-hud">
      <header className="race-topbar">
        <button className="hud-brand-button" aria-label="Return to menu" onClick={onMenu}>
          <BrandMark />
        </button>
        <div className="race-status"><span className="status-dot" />RACE IN PROGRESS</div>
        <button className="icon-button pause-button" aria-label="Pause race" onClick={onPause}><Pause size={17} fill="currentColor" /></button>
      </header>

      <div className="race-top-readouts">
        <div className="readout-block"><span className="readout-label"><Flag size={12} /> LAP</span><strong>{String(Math.min(lap, RACE_LAPS)).padStart(2, "0")}<i> / {RACE_LAPS}</i></strong></div>
        <div className="readout-block"><span className="readout-label">POSITION</span><strong>01<i> / 01</i></strong></div>
        <div className="readout-block timer-readout"><span className="readout-label">RACE TIME</span><strong>{formatTime(elapsed)}</strong></div>
      </div>

      <div className="race-lap-times">
        <div className="lap-time-block"><span className="lap-time-label">CURRENT LAP</span><strong>{formatTime(currentLapTime)}</strong></div>
        <div className="lap-time-block"><span className="lap-time-label">BEST LAP</span><strong>{bestLapTime === Infinity ? "--:--" : formatTime(bestLapTime)}</strong></div>
      </div>

      <div className="track-progress-indicator">
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
      </div>

      <div className="race-bottom-hud">
        <section className="speed-readout" aria-label={`Speed ${Math.round(speed)} kilometers per hour`}>
          <div className="speed-title"><Gauge size={14} /><span>SPEED</span><i>KM/H</i></div>
          <div className="speed-value">{Math.round(speed).toString().padStart(3, "0")}</div>
          <div className="nitro-readout"><span>NITRO</span><div className="nitro-track"><i style={{ width: `${nitro}%` }} /></div><span>{Math.round(nitro)}%</span></div>
        </section>
        <div className="controller-badge"><span className="controller-icon"><Cpu size={17} /></span><span><strong>KEYBOARD</strong><small>CONNECTED · LOCAL</small></span><span className="controller-check">✓</span></div>
      </div>

      <div className="race-controls-hint"><span>STEER <kbd>A</kbd><kbd>D</kbd></span><span>THROTTLE <kbd>W</kbd></span><span>BRAKE <kbd>S</kbd></span><span>BOOST <kbd>SPACE</kbd></span><span>HANDBRAKE <kbd>SHIFT</kbd></span></div>
      <div className="track-label"><span>01</span><i /> GREEN VALLEY CIRCUIT</div>
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
  const startRace = useGameStore((state) => state.startRace);
  const pauseRace = useGameStore((state) => state.pauseRace);
  const resumeRace = useGameStore((state) => state.resumeRace);
  const returnToMenu = useGameStore((state) => state.returnToMenu);
  const restartRace = useGameStore((state) => state.restartRace);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape") return;
      if (phase === "racing") pauseRace();
      else if (phase === "paused") resumeRace();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, pauseRace, resumeRace]);

  return (
    <main className="arcade-root">
      <div className="world-viewport" aria-hidden="true"><RaceViewport /></div>
      <div className={`world-vignette ${phase === "racing" ? "vignette-race" : ""}`} />
      {phase === "menu" && <MenuScreen onStart={startRace} />}
      {phase === "racing" && <RaceHud onPause={pauseRace} onMenu={returnToMenu} />}
      {(phase === "paused" || phase === "finished") && (
        <>
          <RaceHud onPause={() => {}} onMenu={returnToMenu} />
          <PauseScreen onResume={resumeRace} onRestart={restartRace} onMenu={returnToMenu} finished={phase === "finished"} />
        </>
      )}
    </main>
  );
}