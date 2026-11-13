/*
 * ESP32 Arcade production-build benchmark. Run this as a Chrome DevTools
 * Snippet in the game page, then call gamePerf.run(label, options).
 *
 * Defaults: 10 seconds of visible, active warm-up, then 30 seconds measured.
 * Example:
 *   gamePerf.run("society-driving", { preset: "medium" }).catch(console.warn)
 *   gamePerf.stop() // cancels without saving a partial result
 */
(() => {
  if (window.gamePerf) {
    console.info("[gamePerf] Already installed. Use gamePerf.run(), gamePerf.stop(), or gamePerf.uninstall().");
    return;
  }

  const state = {
    running: false,
    measuring: false,
    stopRequested: false,
    drawCalls: 0,
    triangles: 0,
    patches: [],
    patchedMethods: [],
    cancelRun: null,
    results: [],
  };

  function countTriangles(gl, mode, count, instances = 1) {
    let perInstance = 0;
    if (mode === gl.TRIANGLES) perInstance = Math.floor(count / 3);
    else if (mode === gl.TRIANGLE_STRIP || mode === gl.TRIANGLE_FAN) perInstance = Math.max(0, count - 2);
    return perInstance * instances;
  }

  function patchDrawCalls(proto, name, instancesIndex, countIndex, modeIndex) {
    if (!proto || !Object.prototype.hasOwnProperty.call(proto, name)) return;
    const original = proto[name];
    if (typeof original !== "function" || original.__gamePerfWrapped) return;
    function wrapped(...args) {
      if (state.measuring) {
        state.drawCalls += 1;
        const instances = instancesIndex < 0 ? 1 : Math.max(1, Number(args[instancesIndex]) || 1);
        state.triangles += countTriangles(this, args[modeIndex], args[countIndex], instances);
      }
      return original.apply(this, args);
    }
    wrapped.__gamePerfWrapped = true;
    try {
      proto[name] = wrapped;
      if (proto[name] !== wrapped) return;
    } catch {
      return;
    }
    state.patches.push(() => { proto[name] = original; });
    state.patchedMethods.push(name);
  }

  // Patch owning prototypes only, avoiding duplicate wraps of inherited methods.
  for (const proto of [
    window.WebGLRenderingContext && WebGLRenderingContext.prototype,
    window.WebGL2RenderingContext && WebGL2RenderingContext.prototype,
  ]) {
    patchDrawCalls(proto, "drawElements", -1, 1, 0);
    patchDrawCalls(proto, "drawArrays", -1, 2, 0);
    patchDrawCalls(proto, "drawElementsInstanced", 4, 1, 0);
    patchDrawCalls(proto, "drawArraysInstanced", 3, 2, 0);
  }

  const percentile = (sorted, p) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))]
    : 0;
  const mean = (values) => values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : 0;

  function getInactiveReason() {
    const hud = document.querySelector(".race-hud");
    if (!hud || hud.getClientRects().length === 0) return "The game is not in an active Society or Circuit session.";
    if (document.querySelector('.modal-scrim[role="dialog"][aria-modal="true"]')) {
      return "The game is paused or finished. Resume gameplay before starting a benchmark.";
    }
    return null;
  }

  function waitForFrames(durationMs, { collect = false, startedAt = performance.now(), frameTimes = [] } = {}) {
    return new Promise((resolve, reject) => {
      let previousTime = startedAt;
      let rafId = 0;
      let settled = false;

      const cleanup = () => {
        if (rafId) cancelAnimationFrame(rafId);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        if (state.cancelRun === cancel) state.cancelRun = null;
      };
      const finish = (error) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (error) reject(error);
        else resolve(performance.now() - startedAt);
      };
      const cancel = (reason) => finish(new Error(`[gamePerf] ${reason} No result was saved.`));
      const onVisibilityChange = () => {
        if (document.hidden) cancel("The game tab became hidden; the run was cancelled.");
      };
      const tick = (time) => {
        if (document.hidden) return cancel("The game tab became hidden; the run was cancelled.");
        const inactiveReason = getInactiveReason();
        if (inactiveReason) return cancel(inactiveReason);

        if (collect) {
          const frameMs = Math.max(0, time - previousTime);
          if (frameMs > 0) frameTimes.push(frameMs);
          previousTime = time;
          state.sampleDrawCalls = (state.sampleDrawCalls || 0) + state.drawCalls;
          state.sampleTriangles = (state.sampleTriangles || 0) + state.triangles;
          state.drawCalls = 0;
          state.triangles = 0;
        }

        if (time - startedAt >= durationMs) return finish();
        rafId = requestAnimationFrame(tick);
      };

      document.addEventListener("visibilitychange", onVisibilityChange);
      state.cancelRun = cancel;
      rafId = requestAnimationFrame(tick);
    });
  }

  function getEnvironment(preset) {
    const canvas = document.querySelector("canvas");
    const effectiveDpr = canvas && canvas.clientWidth > 0
      ? canvas.width / canvas.clientWidth
      : null;
    return {
      capturedAt: new Date().toISOString(),
      preset: preset || "unspecified (pass { preset: \"low|medium|high|ultra\" })",
      url: `${location.origin}${location.pathname}`,
      browser: {
        userAgent: navigator.userAgent || "Unavailable",
        platform: navigator.platform || "Unavailable",
        language: navigator.language || "Unavailable",
        hardwareConcurrency: navigator.hardwareConcurrency || "Unavailable",
        deviceMemoryGiB: navigator.deviceMemory || "Unavailable",
      },
      display: {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || "Unavailable",
        canvasWidth: canvas?.width ?? "Unavailable",
        canvasHeight: canvas?.height ?? "Unavailable",
        canvasEffectivePixelRatio: effectiveDpr ? +effectiveDpr.toFixed(2) : "Unavailable",
        screenWidth: screen.width || "Unavailable",
        screenHeight: screen.height || "Unavailable",
      },
    };
  }

  async function run(label, options = {}) {
    if (state.running) throw new Error("[gamePerf] A benchmark is already running.");
    if (document.hidden) throw new Error("[gamePerf] Keep the game tab visible before starting.");
    const inactiveReason = getInactiveReason();
    if (inactiveReason) throw new Error(`[gamePerf] ${inactiveReason}`);

    const warmupMs = options.warmupMs ?? 10000;
    const durationMs = options.durationMs ?? 30000;
    if (!Number.isFinite(warmupMs) || warmupMs < 0 || !Number.isFinite(durationMs) || durationMs < 1000) {
      throw new Error("[gamePerf] Use warmupMs >= 0 and durationMs >= 1000.");
    }
    if (typeof label !== "string" || !label.trim()) throw new Error("[gamePerf] Provide a scenario label.");
    if (options.preset && !["low", "medium", "high", "ultra"].includes(options.preset)) {
      throw new Error('[gamePerf] preset must be "low", "medium", "high", or "ultra".');
    }

    state.running = true;
    state.stopRequested = false;
    state.sampleDrawCalls = 0;
    state.sampleTriangles = 0;
    const frameTimes = [];
    let heapAtStart;
    let measuredMs = 0;

    try {
      console.info(`[gamePerf] ${label}: visible active warm-up ${warmupMs / 1000}s. Keep the game unpaused. Movement may start now; warm-up frames are excluded.`);
      await waitForFrames(warmupMs);
      if (state.stopRequested) throw new Error("[gamePerf] Stopped by the user. No result was saved.");
      if (document.hidden) throw new Error("[gamePerf] The game tab became hidden before measurement. No result was saved.");
      const afterWarmupReason = getInactiveReason();
      if (afterWarmupReason) throw new Error(`[gamePerf] ${afterWarmupReason} No result was saved.`);

      const environment = getEnvironment(options.preset);
      const startedAt = performance.now();
      heapAtStart = performance.memory?.usedJSHeapSize;
      state.sampleDrawCalls = 0;
      state.sampleTriangles = 0;
      state.drawCalls = 0;
      state.triangles = 0;
      state.measuring = true;
      console.info(`[gamePerf] WARM-UP COMPLETE — MEASUREMENT STARTED (${durationMs / 1000}s). Continue the same movement until completion.`);
      measuredMs = await waitForFrames(durationMs, { collect: true, startedAt, frameTimes });
      state.measuring = false;

      const sorted = [...frameTimes].sort((a, b) => a - b);
      const slowestOnePercent = sorted.slice(Math.max(0, sorted.length - Math.max(1, Math.ceil(sorted.length * 0.01))));
      const averageFrameMs = mean(frameTimes);
      const drawMetricsAvailable = state.patchedMethods.length > 0 && state.sampleDrawCalls > 0;
      const drawMetricsUnavailableReason = state.patchedMethods.length === 0
        ? "Unavailable: no patchable WebGL draw methods were found."
        : "Unavailable: no WebGL draw calls were observed during the measurement.";
      const result = {
        scenario: label.trim(),
        environment,
        measuredSeconds: +(measuredMs / 1000).toFixed(2),
        frames: frameTimes.length,
        averageFps: frameTimes.length ? +(frameTimes.length * 1000 / measuredMs).toFixed(2) : "Unavailable",
        onePercentLowFps: slowestOnePercent.length ? +(1000 / mean(slowestOnePercent)).toFixed(2) : "Unavailable",
        frameTimeMs: {
          average: +averageFrameMs.toFixed(2),
          p50: +percentile(sorted, 0.50).toFixed(2),
          p95: +percentile(sorted, 0.95).toFixed(2),
          max: +(sorted[sorted.length - 1] || 0).toFixed(2),
        },
        stutters: {
          over33ms: frameTimes.filter((x) => x > 33.33).length,
          over50ms: frameTimes.filter((x) => x > 50).length,
          over100ms: frameTimes.filter((x) => x > 100).length,
        },
        webgl: {
          drawCalls: drawMetricsAvailable ? {
            measured: state.sampleDrawCalls,
            averagePerFrame: +(state.sampleDrawCalls / Math.max(1, frameTimes.length)).toFixed(1),
            instrumentedMethods: [...new Set(state.patchedMethods)],
          } : drawMetricsUnavailableReason,
          triangles: drawMetricsAvailable ? {
            measured: state.sampleTriangles,
            averagePerFrame: +(state.sampleTriangles / Math.max(1, frameTimes.length)).toFixed(0),
          } : drawMetricsUnavailableReason,
          geometries: "Unavailable: the production page does not expose Three.js renderer.info.",
          textures: "Unavailable: the production page does not expose Three.js renderer.info.",
        },
        jsHeap: performance.memory ? {
          startMB: Number.isFinite(heapAtStart) ? +(heapAtStart / 1048576).toFixed(1) : "Unavailable",
          endMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
          limitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(1),
        } : "Unavailable: performance.memory is not supported by this browser.",
        caveats: "Drive or rotate manually during the run. Draw calls and triangle counts cover instrumented WebGL draw calls; geometry and texture counts are unavailable without renderer.info.",
      };

      state.results.push(result);
      console.table({
        scenario: result.scenario,
        preset: result.environment.preset,
        viewport: `${result.environment.display.viewportWidth}x${result.environment.display.viewportHeight}`,
        devicePixelRatio: result.environment.display.devicePixelRatio,
        averageFps: result.averageFps,
        onePercentLowFps: result.onePercentLowFps,
        averageFrameMs: result.frameTimeMs.average,
        worstFrameMs: result.frameTimeMs.max,
        stuttersOver33ms: result.stutters.over33ms,
        averageDrawCallsPerFrame: drawMetricsAvailable ? result.webgl.drawCalls.averagePerFrame : "Unavailable",
        averageTrianglesPerFrame: drawMetricsAvailable ? result.webgl.triangles.averagePerFrame : "Unavailable",
      });
      console.info("[gamePerf] Measurement complete. Full result:", result);
      return result;
    } finally {
      state.measuring = false;
      state.running = false;
      state.stopRequested = false;
      state.cancelRun = null;
    }
  }

  window.gamePerf = {
    run,
    stop() {
      if (!state.running) {
        console.info("[gamePerf] No active run to stop.");
        return false;
      }
      state.stopRequested = true;
      if (state.cancelRun) state.cancelRun("Stopped by the user.");
      return true;
    },
    results: () => [...state.results],
    clearResults() {
      if (state.running) throw new Error("[gamePerf] Stop the active run before clearing results.");
      state.results.length = 0;
    },
    downloadResults() {
      if (!state.results.length) throw new Error("[gamePerf] There are no completed results to export.");
      const blob = new Blob([JSON.stringify(state.results, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "esp32-arcade-performance.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
    uninstall() {
      if (state.running) throw new Error("[gamePerf] Stop or finish the active run before uninstalling.");
      state.patches.reverse().forEach((restore) => restore());
      delete window.gamePerf;
      console.info("[gamePerf] Instrumentation removed. Results are no longer available here; export first if needed.");
    },
  };
  console.info("[gamePerf] Installed. Use gamePerf.run(label, { preset: \"medium\" }) and gamePerf.stop() to cancel.");
})();
