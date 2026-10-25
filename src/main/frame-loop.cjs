'use strict';

// Let Chromium's display clock drive visible movement. Windows timers can round
// a 16 ms timeout up to roughly 31 ms; the timer is only a recovery heartbeat.
function createFrameLoop({tick, isActive, idleDelay, now = () => performance.now(), setTimer = setTimeout, clearTimer = clearTimeout}) {
  let running = false, timer = null, lastFrame = -Infinity;
  function watchdog() {
    if (!running) return;
    const active = isActive();
    if (!active || now() - lastFrame >= 100) tick();
    if (running) timer = setTimer(watchdog, active ? 100 : idleDelay());
  }
  return {
    start() { if (!running) { running = true; lastFrame = -Infinity; watchdog(); } },
    frame() {
      if (!running || !isActive()) return;
      const at = now();
      if (at - lastFrame < 4) return;
      lastFrame = at;
      tick();
    },
    stop() { running = false; clearTimer(timer); timer = null; },
  };
}

module.exports = {createFrameLoop};
