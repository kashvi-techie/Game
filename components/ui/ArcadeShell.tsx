"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Camera, CarFront, Flag, Gauge, Pause, Plane, Play, RotateCcw, SkipForward, Volume2, VolumeX } from "lucide-react";
import RaceViewport from "@/components/game/RaceViewport";
import { arcadeAudio } from "@/game/audio/ArcadeAudio";
import { RACE_LAPS } from "@/game/physics/racingPhysics";
import { useGameStore, type CameraPreset, type WorldMode } from "@/lib/state/gameStore";

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
        <div className="menu-top-meta"><span>INDEPENDENT ARCADE SYSTEMS</span><span className="topbar-divider" /><span>BUILD 002</span></div>
        <div className="connection-state"><span className="status-dot" />LOCAL INPUT</div>
        <button className="intro-replay" type="button" onClick={onReplayIntro} aria-label="Replay intro">
          <RotateCcw size={12} /> REPLAY INTRO
        </button>
      </header>

      <div className="menu-layout">
        <section className="menu-copy">
          <div className="eyebrow"><span className="eyebrow-line" />{worldMode === "society" ? "02" : "01"} <span>/</span> {worldMode === "society" ? "RESIDENTIAL SOCIETY" : "THREE-LAP SPRINT"}</div>
          <h1>ESP32<br /><span>ARCADE</span></h1>
          <p className="menu-intro">A living world. A fast line.<br />Select your mode and hit the throttle.</p>
          <button className="race-launch" onClick={onStart}>
            <span className="launch-icon"><Play size={17} fill="currentColor" /></span>
            <span><strong>{worldMode === "society" ? "EXPLORE SOCIETY" : "ENTER THE GRID"}</strong><small>{worldMode === "society" ? "FREE ROAM · COHERENT STREETS" : "CIRCUIT SPRINT · 3 LAPS"}</small></span>
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
          <div className="side-note-label"><span className="side-note-mark" /> {worldMode === "society" ? "CEDAR GROVE" : "CIRCUIT 01"}</div>
          <strong>{worldMode === "society" ? <>CEDAR<br />GROVE</> : <>GREEN<br />VALLEY</>}</strong>
          <span className="side-note-rule" />
          <span className="side-note-detail">{worldMode === "society" ? <>COHERENT STREET GRID<br />TOWERS · VILLAS · PARK · SHOPS</> : <>COASTAL LOOP<br />3 LAPS · SOLO SPRINT</>}</span>
          <div className="side-note-bottom"><span>CONTROLS</span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd><kbd>H</kbd><kbd>V</kbd><kbd>C</kbd></div>
        </aside>
      </div>

      <footer className="menu-footer"><span>DESIGNED TO PLAY · ZERO-ASSET PROCEDURAL WORLD</span><span>PRESS V TO CYCLE CAMERA <span className="footer-cross">✳</span></span></footer>
    </main>
  );
}

function RaceHud({ onPause, onMenu, exploring = false }: { onPause: () => void; onMenu: () => void; exploring?: boolean }) {
  const speed = useGameStore((state) => state.speed);
  const gear = useGameStore((state) => state.gear);
  const lap = useGameStore((state) => state.lap);
  const elapsed = useGameStore((state) => state.elapsed);
  const nitro = useGameStore((state) => state.nitro);
  const currentLapTime = useGameStore((state) => state.currentLapTime);
  const bestLapTime = useGameStore((state) => state.bestLapTime);
  const lapProgress = useGameStore((state) => state.lapProgress);
  const wrongWay = useGameStore((state) => state.wrongWay);
  const aircraftMode = useGameStore((state) => state.aircraftMode);
  const setAircraftMode = useGameStore((state) => state.setAircraftMode);
  const flight = useGameStore((state) => state.flightTelemetry);
  const cameraToast = useGameStore((state) => state.cameraToast);
  const clearCameraToast = useGameStore((state) => state.clearCameraToast);
  const [muted, setMuted] = useState(false);
  const TAU = Math.PI * 2;
  const displaySpeed = Math.max(0, Math.round(speed));
  const canSwitchToCar = flight.grounded && flight.gearDown && flight.altitude < 1 && speed < 10 && !flight.crashed;

  useEffect(() => {
    if (!cameraToast) return;
    const timer = window.setTimeout(clearCameraToast, 1600);
    return () => window.clearTimeout(timer);
  }, [cameraToast, clearCameraToast]);

  const toggleMute = () => {
    void arcadeAudio.resumeFromGesture();
    setMuted((current) => {
      arcadeAudio.setMuted(!current);
      return !current;
    });
  };

  return (
    <div className="race-hud">
      {/* Clean Uncluttered Top Bar */}
      <header className="race-topbar">
        <button className="hud-brand-button" aria-label="Return to menu" onClick={onMenu}>
          <BrandMark />
        </button>

        <div className="hud-top-right">
          <div className="race-status">
            <span className="status-dot" />
            <span>{exploring ? "SOCIETY FREE-ROAM" : "RACE IN PROGRESS"}</span>
          </div>

          {exploring && (
            <button
              className="hud-vehicle-switch"
              type="button"
              disabled={aircraftMode && !canSwitchToCar}
              title={aircraftMode && !canSwitchToCar ? "Land, extend the gear, and stop to switch back to the car" : aircraftMode ? "Switch to car" : "Switch to aircraft at your current location"}
              aria-label={aircraftMode ? "Switch to car" : "Switch to aircraft"}
              onClick={() => setAircraftMode(!aircraftMode)}
            >
              {aircraftMode ? <CarFront size={15} /> : <Plane size={15} />}
              <span>{aircraftMode ? "CAR" : "AIRCRAFT"}</span>
            </button>
          )}

          <button
            className="hud-quick-btn"
            type="button"
            title={muted ? "Unmute audio" : "Mute audio"}
            aria-label={muted ? "Unmute audio" : "Mute audio"}
            onClick={toggleMute}
          >
            {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          </button>

          <button className="hud-pause-btn" aria-label="Open pause and settings menu" onClick={onPause}>
            <Pause size={14} fill="currentColor" />
            <span>MENU</span>
            <kbd>ESC</kbd>
          </button>
        </div>
      </header>

      {/* Circuit Mode Only: Lap & Time Telemetry */}
      {!exploring && (
        <>
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
        </>
      )}

      {/* Subtle Toast Pill when V key cycles camera */}
      {cameraToast && (
        <div className="camera-toast-pill" role="status" aria-live="polite">
          <Camera size={14} />
          <span>{cameraToast}</span>
          <kbd>V</kbd>
        </div>
      )}

      {wrongWay && <div className="wrong-way-warning" role="status">WRONG WAY</div>}

      {exploring && aircraftMode ? (
        <section className="flight-hud" aria-label="Flight instruments">
          <div className="flight-hud-readouts">
            <div className="flight-readout flight-speed"><span>AIRSPEED</span><strong>{Math.round(displaySpeed)}<i> KM/H</i></strong></div>
            <div className="flight-readout"><span>ALTITUDE AGL</span><strong>{Math.round(flight.altitude)}<i> M</i></strong></div>
            <div className="flight-readout"><span>THROTTLE</span><strong>{Math.round(flight.throttle * 100)}<i>%</i></strong><div className="flight-throttle-track"><i style={{ width: `${flight.throttle * 100}%` }} /></div></div>
            <div className="flight-readout"><span>HEADING</span><strong>{Math.round(flight.heading).toString().padStart(3, "0")}<i>°</i></strong></div>
            <div className="flight-readout flight-attitude"><span>PITCH / ROLL</span><strong>{Math.round(flight.pitch)}° <i>/</i> {Math.round(flight.roll)}°</strong></div>
            <div className="flight-readout"><span>GEAR</span><strong>{flight.gearDown ? "DOWN" : "UP"}</strong></div>
          </div>
          <div className={`flight-status ${flight.crashed ? "flight-status-danger" : ""}`}>
            {flight.crashed ? "AIRCRAFT DAMAGED · R TO RECOVER" : flight.grounded && !flight.gearDown ? "GEAR RETRACTED · PRESS G TO EXTEND" : flight.grounded ? "ON RUNWAY · BUILD SPEED, THEN PULL UP" : "AIRBORNE · BANK TO TURN"}
          </div>
          <div className="flight-controls-hint">
            <span>THROTTLE <kbd>W</kbd>/<kbd>S</kbd></span>
            <span>PITCH <kbd>↑</kbd>/<kbd>↓</kbd></span>
            <span>BANK <kbd>A</kbd>/<kbd>D</kbd></span>
            <span>AIRBRAKE <kbd>SPACE</kbd></span>
            <span>GEAR <kbd>G</kbd></span>
            <span>EXIT ON GROUND <kbd>F</kbd></span>
            <span>VIEW <kbd>V</kbd> · LOOK <kbd>DRAG</kbd></span>
          </div>
        </section>
      ) : (
        <>
          {/* Streamlined Bottom Driving HUD */}
          <div className="race-bottom-hud">
            <section className="speed-readout" aria-label={`Speed ${displaySpeed} kilometers per hour, gear ${gear}`}>
              <div className="speed-title">
                <Gauge size={13} />
                <span>SPEED</span>
                <span className={`gear-badge gear-${gear.toLowerCase()}`}>{gear}</span>
                <i>KM/H</i>
              </div>
              <div className="speed-value">{displaySpeed.toString().padStart(3, "0")}</div>
              <div className="nitro-readout">
                <span>NITRO</span>
                <div className="nitro-track"><i style={{ width: `${nitro}%` }} /></div>
                <span>{Math.round(nitro)}%</span>
              </div>
            </section>
            <div className="bottom-camera-hint">
              <span>HORN</span><kbd>H</kbd>
              <span style={{ marginLeft: "6px" }}>VIEW</span><kbd>V</kbd>
              <span style={{ marginLeft: "6px" }}>LOOK</span><kbd>DRAG ↔↕</kbd>
              <span style={{ marginLeft: "6px" }}>RESET</span><kbd>C</kbd>
            </div>
          </div>
          {exploring && (
            <div className="aircraft-interaction-hint">
              <span className="aircraft-hint-dot" />
              VEHICLE SWITCHER · AVAILABLE ANYWHERE
            </div>
          )}
        </>
      )}
    </div>
  );
}

function PauseScreen({ onResume, onRestart, onMenu, finished, exploring }: {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  finished: boolean;
  exploring: boolean;
}) {
  const cameraPreset = useGameStore((state) => state.cameraPreset);
  const aircraftMode = useGameStore((state) => state.aircraftMode);
  const setCameraPreset = useGameStore((state) => state.setCameraPreset);
  const [volume, setVolume] = useState(0.45);
  const [muted, setMuted] = useState(false);

  const handleCameraChange = (preset: CameraPreset) => {
    void arcadeAudio.resumeFromGesture();
    setCameraPreset(preset);
  };

  const handleMuteChange = () => {
    void arcadeAudio.resumeFromGesture();
    setMuted((current) => {
      arcadeAudio.setMuted(!current);
      return !current;
    });
  };

  return (
    <div className="modal-scrim" role="dialog" aria-modal="true" aria-labelledby="pause-title">
      <section className="pause-panel">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          {finished ? "FINISH LINE" : exploring ? "CEDAR GROVE · SOCIETY CONTROL" : "CIRCUIT CONTROL"}
        </div>
        <h2 id="pause-title">
          {finished ? <>RUN<br /><span>COMPLETE</span></> : exploring ? <>SOCIETY<br /><span>EXPLORATION</span></> : <>SESSION<br /><span>PAUSED</span></>}
        </h2>
        <p>
          {finished
            ? "Three laps in the books. The circuit is yours."
            : exploring
            ? "Free roam across the high-rise towers, residential villas, market promenade, central park, and clubhouse."
            : "Circuit session paused. Catch your breath or adjust camera perspectives."}
        </p>

        {/* Camera Perspective Selector */}
        <div className="pause-section">
          <div className="pause-section-head">
            <Camera size={13} />
            <span>CAMERA PERSPECTIVE</span>
            <small>OR PRESS <kbd>V</kbd></small>
          </div>
          <div className="camera-preset-grid">
            {(["close", "standard", "far"] as const).map((preset) => (
              <button
                key={preset}
                type="button"
                className={`camera-preset-btn ${cameraPreset === preset ? "camera-preset-active" : ""}`}
                onClick={() => handleCameraChange(preset)}
              >
                <strong>{preset.toUpperCase()}</strong>
                <small>{preset === "close" ? "TIGHT FOLLOW" : preset === "standard" ? "BALANCED CHASE" : "WIDE PANORAMA"}</small>
              </button>
            ))}
          </div>
        </div>

        {/* Controls Quick Reference Card */}
        <div className="pause-section">
          <div className="pause-section-head"><span>CONTROLS REFERENCE</span></div>
          <div className="controls-reference-grid">
            {exploring && aircraftMode ? (
              <>
                <div><span>THROTTLE / REDUCE</span><kbd>W</kbd><kbd>S</kbd></div>
                <div><span>PITCH UP / DOWN</span><kbd>↑</kbd><kbd>↓</kbd></div>
                <div><span>BANK / TURN</span><kbd>A</kbd><kbd>D</kbd></div>
                <div><span>AIRBRAKE</span><kbd>SPACE</kbd></div>
                <div><span>LANDING GEAR</span><kbd>G</kbd></div>
                <div><span>RESET AIRCRAFT</span><kbd>R</kbd></div>
                <div><span>EXIT ON GROUND</span><kbd>F</kbd></div>
              </>
            ) : (
              <>
                <div><span>DRIVE</span><kbd>W</kbd><kbd>↑</kbd></div>
                <div><span>BRAKE / REV</span><kbd>S</kbd><kbd>↓</kbd></div>
                <div><span>STEER</span><kbd>A</kbd><kbd>D</kbd></div>
                <div><span>BOOST</span><kbd>SPACE</kbd></div>
                <div><span>DRIFT</span><kbd>SHIFT</kbd></div>
                <div><span>HORN</span><kbd>H</kbd></div>
                <div><span>RESET CAR</span><kbd>R</kbd></div>
                {exploring && <div><span>SWITCH TO AIRCRAFT ANYWHERE</span><kbd>F</kbd></div>}
              </>
            )}
            <div><span>CYCLE VIEW</span><kbd>V</kbd></div>
            <div><span>CAMERA LOOK</span><kbd>DRAG ↔↕</kbd></div>
            <div><span>RESET VIEW</span><kbd>C</kbd></div>
            <div><span>PAUSE / MENU</span><kbd>ESC</kbd></div>
          </div>
        </div>

        {/* Audio Volume Controls */}
        <div className="pause-section">
          <div className="pause-section-head">
            <span>AUDIO SETTINGS</span>
            <small>{Math.round(volume * 100)}%</small>
          </div>
          <div className="pause-audio-bar">
            <button className="audio-mute" type="button" onClick={handleMuteChange}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              aria-label="Master volume"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => {
                const next = Number(e.currentTarget.value);
                setVolume(next);
                arcadeAudio.setVolume(next);
              }}
            />
          </div>
        </div>

        {/* Primary Action Buttons */}
        <button className="race-launch modal-primary" onClick={finished ? onRestart : onResume}>
          <span className="launch-icon">{finished ? <RotateCcw size={17} /> : <Play size={17} fill="currentColor" />}</span>
          <span><strong>{finished ? "RUN IT BACK" : exploring && aircraftMode ? "RESUME FLIGHT" : "RESUME DRIVING"}</strong><small>{finished ? "RESTART THE CIRCUIT" : "RETURN TO VEHICLE [ESC]"}</small></span>
          <span className="launch-arrow">↗</span>
        </button>
        <button className="text-action" onClick={onRestart}><RotateCcw size={14} /> RESTART TO START GATE [R]</button>
        <button className="text-action" onClick={onMenu}><ArrowLeft size={14} /> RETURN TO MAIN MENU</button>
      </section>
    </div>
  );
}

const MemoizedViewport = memo(RaceViewport);

function CollisionFlashOverlay() {
  const collided = useGameStore((state) => state.collided);
  if (!collided) return null;
  return <div className="collision-flash-overlay" aria-hidden="true" />;
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
    <main className="arcade-root">
      <div className="world-viewport" aria-hidden="true">
        <MemoizedViewport
          introActive={introPlaying}
          introRunId={introRunId}
          motionEnabled={!reducedMotion}
          onIntroComplete={skipIntro}
        />
      </div>
      <CollisionFlashOverlay />
      <div className={`world-vignette ${phase === "racing" ? "vignette-race" : ""}`} />

      {introPlaying && (
        <button className="intro-skip" type="button" onClick={skipIntro}>
          <SkipForward size={13} /> SKIP INTRO <kbd>ESC</kbd>
        </button>
      )}

      {countdown !== null && (
        <div className="countdown-screen" role="status" aria-live="assertive">
          <span className="countdown-label">GET READY</span>
          <strong>{countdown === 0 ? "GO" : countdown}</strong>
          <button type="button" onClick={() => setCountdown(null)}>CANCEL <kbd>ESC</kbd></button>
        </div>
      )}

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
            exploring={worldMode === "society"}
          />
        </>
      )}
    </main>
  );
}
