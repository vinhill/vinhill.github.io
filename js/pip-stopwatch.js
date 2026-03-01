// pip-stopwatch.js
(() => {
  const doc = document;

  // ----- UI -----
  const root = doc.createElement('div');
  root.style.cssText =
    'font-family:system-ui,sans-serif;text-align:center;padding:12px';

  const timeEl = doc.createElement('h2');
  timeEl.textContent = '00:00:00.000';

  const btnStart = doc.createElement('button');
  btnStart.textContent = 'Start';

  const btnStop = doc.createElement('button');
  btnStop.textContent = 'Stop';

  const btnReset = doc.createElement('button');
  btnReset.textContent = 'Reset';

  root.append(timeEl, btnStart, btnStop, btnReset);
  doc.body.appendChild(root);

  // ----- timing (high resolution + rAF) -----
  let startPerf = 0;
  let elapsed = 0;
  let running = false;
  let rafId = 0;

  const format = ms => {
    const total = Math.floor(ms);
    const msPart = String(total % 1000).padStart(3, '0');
    const sAll = Math.floor(total / 1000);
    const s = sAll % 60;
    const m = Math.floor(sAll / 60) % 60;
    const h = Math.floor(sAll / 3600);
    return `${String(h).padStart(2,'0')}:` +
           `${String(m).padStart(2,'0')}:` +
           `${String(s).padStart(2,'0')}.` +
           msPart;
  };

  function render(now) {
    const current = running
      ? elapsed + (now - startPerf)
      : elapsed;
    timeEl.textContent = format(current);
  }

  function loop(now) {
    render(now);
    rafId = requestAnimationFrame(loop);
  }

  btnStart.onclick = () => {
    if (running) return;
    startPerf = performance.now();
    running = true;
    if (!rafId) rafId = requestAnimationFrame(loop);
  };

  btnStop.onclick = () => {
    if (!running) return;
    elapsed += performance.now() - startPerf;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    render(performance.now());
  };

  btnReset.onclick = () => {
    elapsed = 0;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = 0;
    render(0);
  };

  render(0);
  btnStart.click();
})();