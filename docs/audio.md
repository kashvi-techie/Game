# Arcade audio

The game currently uses procedural audio generated at runtime by the Web Audio API. The engine, tyre skid, brake, nitro, intro ambience, and short race cues are synthesized in `game/audio/ArcadeAudio.ts` with oscillators, filters, gains, and generated noise. No recorded audio assets or third-party audio library are included, so there are no external sample licences or asset paths to maintain.

Audio is initialized and resumed only from user gestures. Continuous sources are created once and reused; their gains and frequencies are smoothed from race telemetry. Mute and master volume are available from the arcade interface.
