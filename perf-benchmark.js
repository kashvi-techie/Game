/*
 * ESP32 Arcade browser benchmark (paste into DevTools Console).
 * Standalone helper only; it does not change the game or its source files.
 *
 * Usage:
 *   await gamePerf.run("society-stationary")
 *   await gamePerf.run("society-driving")
 *   await gamePerf.run("society-camera-rotation")
 *   await gamePerf.run("circuit-racing")
 * Defaults: 10 s warm-up, then a 30 s measurement window.
 */
(() => {
  if (window.gamePerf) {
    console.info("gamePerf is already installed. Call gamePerf.run(label) or gamePerf.uninstall().");
    return;
  }

  const state = {
    active: false,
    drawCalls: 0,
    triangles: 0,
    patches: [],
    lastResult: null,
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
      if (state.active) {
        state.drawCalls += 1;
        state.triangles += countTriangles(this, args[modeIndex], args[countIndex], instancesIndex < 0 ? 1 : args[instancesIndex]);
      }
      return original.apply(this, args);
    }
    wrapped.__gamePerfWrapped = true;
    proto[name] = wrapped;
    state.patches.push(() => { proto[name] = original; });
  }

  // Patch the owning prototype method only, avoiding double-counting methods
  // inherited by WebGL2 from WebGL1.
  for (const proto of [
    window.WebGLRenderingContext && WebGLRenderingContext.prototype,
    window.WebGL2RenderingContext && WebGL2RenderingContext.prototype,
  ]) {
    patchDrawCalls(proto, "drawElements", -1, 1, 0);
    patchDrawCalls(proto, "drawArrays", -1, 2, 0);
    patchDrawCalls(proto, "drawElementsInstanced", 4, 1, 0);
    patchDrawCalls(proto, "drawArraysInstanced", 3, 2, 0);
  }

  const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] || 0;
  const mean = (values) => values.length ? values.reduce((sum, x) => sum + x, 0) / values.length : 0;

  async function run(label, options = {}) {
    if (state.active) throw new Error("A benchmark is already running.");
    if (document.hidden) throw new Error("Keep the game tab visible while measuring.");
    const warmupMs = options.warmupMs ?? 10000;
    const durationMs = options.durationMs ?? 30000;
    if (!Number.isFinite(warmupMs) || warmupMs < 0 || !Number.isFinite(durationMs) || durationMs < 1000) {
      throw new Error("Use warmupMs >= 0 and durationMs >= 1000.");
    }

    console.info(`[gamePerf] ${label}: warm-up ${warmupMs / 1000}s, measure ${durationMs / 1000}s. Keep this tab visible and avoid DevTools resizing.`);
    await new Promise((resolve) => setTimeout(resolve, warmupMs));
    if (document.hidden) throw new Error("Benchmark cancelled because the tab became hidden during warm-up.");

    const frameTimes = [];
    let frameDrawCalls = 0;
    let frameTriangles = 0;
    let lastFrameTime = 0;
    let pendingRaf = 0;
    const started = performance.now();
    const heapAtStart = performance.memory?.usedJSHeapSize;
    state.drawCalls = 0;
    state.triangles = 0;
    state.active = true;

    await new Promise((resolve, reject) => {
      const tick = (time) => {
        if (document.hidden) {
          state.active = false;
          reject(new Error("Benchmark cancelled because the tab became hidden."));
          return;
        }
        if (lastFrameTime) {
          frameTimes.push(time - lastFrameTime);
          frameDrawCalls += state.drawCalls;
          frameTriangles += state.triangles;
          state.drawCalls = 0;
          state.triangles = 0;
        }
        lastFrameTime = time;
        if (time - started >= durationMs) {
          state.active = false;
          resolve();
          return;
        }
        pendingRaf = requestAnimationFrame(tick);
      };
      pendingRaf = requestAnimationFrame(tick);
    }).catch((error) => {
      cancelAnimationFrame(pendingRaf);
      throw error;
    });

    const elapsedMs = performance.now() - started;
    const sorted = [...frameTimes].sort((a, b) => a - b);
    const slowestOnePercent = sorted.slice(Math.max(0, sorted.length - Math.max(1, Math.ceil(sorted.length * 0.01))));
    const averageFrameMs = mean(frameTimes);
    const result = {
      scenario: label,
      measuredSeconds: +(elapsedMs / 1000).toFixed(2),
      frames: frameTimes.length,
      averageFps: +(frameTimes.length * 1000 / elapsedMs).toFixed(2),
      onePercentLowFps: +(1000 / mean(slowestOnePercent)).toFixed(2),
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
        measuredDrawCalls: frameDrawCalls,
        averageDrawCallsPerFrame: +(frameDrawCalls / Math.max(1, frameTimes.length)).toFixed(1),
        measuredTriangles: frameTriangles,
        averageTrianglesPerFrame: +(frameTriangles / Math.max(1, frameTimes.length)).toFixed(0),
        geometries: "Unavailable: production build does not expose renderer.info",
        textures: "Unavailable: production build does not expose renderer.info",
      },
      jsHeap: performance.memory ? {
        startMB: +(heapAtStart / 1048576).toFixed(1),
        endMB: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1),
        limitMB: +(performance.memory.jsHeapSizeLimit / 1048576).toFixed(1),
      } : "Unavailable in this browser (performance.memory is Chromium-specific).",
      caveats: "WebGL draw counts/triangles include all instrumented draw calls during the window. Geometry/texture counts require Three.js renderer.info, which this production page does not expose publicly.",
    };
    state.lastResult = result;
    state.results.push(result);
    console.table({
      scenario: result.scenario,
      averageFps: result.averageFps,
      onePercentLowFps: result.onePercentLowFps,
      averageFrameMs: result.frameTimeMs.average,
      p95FrameMs: result.frameTimeMs.p95,
      maxFrameMs: result.frameTimeMs.max,
      stuttersOver33ms: result.stutters.over33ms,
      stuttersOver50ms: result.stutters.over50ms,
      averageDrawCallsPerFrame: result.webgl.averageDrawCallsPerFrame,
      averageTrianglesPerFrame: result.webgl.averageTrianglesPerFrame,
      heapEndMB: typeof result.jsHeap === "object" ? result.jsHeap.endMB : result.jsHeap,
    });
    console.log("Full result:", result);
    return result;
  }

  window.gamePerf = {
    run,
    results: () => [...state.results],
    clearResults() { state.results.length = 0; state.lastResult = null; },
    downloadResults() {
      const blob = new Blob([JSON.stringify(state.results, null, 2)], { type: "application/json" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "esp32-arcade-performance.json";
      link.click();
      URL.revokeObjectURL(link.href);
    },
    uninstall() {
      if (state.active) throw new Error("Wait for the active benchmark to finish before uninstalling.");
      state.patches.reverse().forEach((restore) => restore());
      delete window.gamePerf;
      console.info("[gamePerf] Instrumentation removed. Reload the page to clear remaining references.");
    },
  };
  console.info("[gamePerf] Installed. Run gamePerf.run(label); results use a 10 s warm-up and 30 s sample by default.");
})();
