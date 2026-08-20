const COLORS = ['#7eb8f7','#ff6b6b','#6bcb77','#ffd93d','#c77dff',
                '#ff9f43','#48dbfb','#ff6b9d','#54a0ff'];

function shortPlatform(p) {
  return p
    .replace(/-shippable$/, '')
    .replace('windows11-64-24h2-hw-ref', 'win11-hw-ref')
    .replace('windows11-64-24h2', 'win11')
    .replace('macosx1500-aarch64', 'macos-arm64')
    .replace('macosx1400-aarch64', 'macos-arm64-14')
    .replace(/^linux1804-64-/, 'linux-')
    .replace(/^linux64-/, 'linux64-');
}

function buildChart(results) {
  const container = document.getElementById('chart');
  container.innerHTML = '';
  if (!results.length) return;

  const W = Math.max(container.clientWidth || 0, 600);
  const H = 280;
  const PAD = { top: 16, right: 148, bottom: 8, left: 8 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  let tMin = Infinity, tMax = -Infinity;
  for (const { series } of results) {
    for (const d of series.data) {
      const t = new Date(d.push_timestamp).getTime();
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  const tRange = tMax - tMin || 1;

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);
  svg.style.overflow = 'visible';

  const prepared = results.map(({ sig, series }, i) => {
    const color = COLORS[i % COLORS.length];
    const sorted = [...series.data].sort(
      (a, b) => new Date(a.push_timestamp) - new Date(b.push_timestamp)
    );
    const values = sorted.map(d => d.value);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const centered = values.map(v => v - mean);
    return { sig, series, color, sorted, centered };
  });

  let yMin = Infinity, yMax = -Infinity;
  for (const { centered } of prepared) {
    for (const v of centered) {
      if (v < yMin) yMin = v;
      if (v > yMax) yMax = v;
    }
  }
  const yRange = yMax - yMin || 1;

  const labelMeta = [];

  prepared.forEach(({ sig, series, color, sorted, centered }, i) => {
    const pts = sorted.map((d, j) => [
      PAD.left + ((new Date(d.push_timestamp).getTime() - tMin) / tRange) * iW,
      PAD.top + (1 - (centered[j] - yMin) / yRange) * iH,
    ]);

    const poly = document.createElementNS(NS, 'polyline');
    poly.setAttribute('points', pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' '));
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', color);
    poly.setAttribute('stroke-width', '1.5');
    poly.dataset.sig = String(sig);
    poly.style.cursor = 'pointer';
    svg.appendChild(poly);

    labelMeta.push({ sig: String(sig), label: shortPlatform(series.platform), color, lastY: pts[pts.length - 1][1] });
  });

  // Sort labels by where each line ends to minimise visual crossings,
  // then space them evenly so they never overlap
  const n = labelMeta.length;
  labelMeta
    .sort((a, b) => a.lastY - b.lastY)
    .forEach(({ sig, label, color }, i) => {
      const y = n > 1 ? PAD.top + (i / (n - 1)) * iH : PAD.top + iH / 2;
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', PAD.left + iW + 10);
      text.setAttribute('y', y);
      text.setAttribute('fill', color);
      text.setAttribute('font-size', '11');
      text.setAttribute('font-family', 'monospace');
      text.setAttribute('dominant-baseline', 'middle');
      text.dataset.sig = sig;
      text.textContent = label;
      svg.appendChild(text);
    });

  container.appendChild(svg);

  // Cross-highlight between table rows and SVG polylines
  const rows = document.querySelectorAll('#results tbody tr');
  const polylines = svg.querySelectorAll('polyline');
  const svgLabels = svg.querySelectorAll('text');

  function setHighlight(activeSig) {
    const dimmed = activeSig !== null;
    polylines.forEach(p => {
      const active = p.dataset.sig === activeSig;
      p.setAttribute('stroke-width', active ? '3' : '1.5');
      p.style.opacity = dimmed && !active ? '0.15' : '1';
    });
    svgLabels.forEach(t => {
      t.style.opacity = dimmed && t.dataset.sig !== activeSig ? '0.15' : '1';
    });
    rows.forEach(r => r.classList.toggle('chart-hl', r.dataset.sig === activeSig));
  }

  rows.forEach(row => {
    row.addEventListener('mouseover', () => setHighlight(row.dataset.sig));
    row.addEventListener('mouseout', () => setHighlight(null));
  });
  polylines.forEach(p => {
    p.addEventListener('mouseover', () => setHighlight(p.dataset.sig));
    p.addEventListener('mouseout', () => setHighlight(null));
  });
}

// Scatter plot of per-push CV% over time, with rolling median overlay.
// noiseResults: [{ sig, platform, color, perPush: [{cv, timestamp}] }]
function buildNoiseChart(noiseResults) {
  const container = document.getElementById('noise-chart');
  container.innerHTML = '';
  if (!noiseResults.length) return;

  const W = Math.max(container.clientWidth || 0, 600);
  const H = 220;
  const PAD = { top: 16, right: 148, bottom: 8, left: 48 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const allPoints = [];
  noiseResults.forEach(({ sig, color, perPush }) => {
    perPush.forEach(p => {
      allPoints.push({ t: new Date(p.timestamp).getTime(), cv: p.cv, color, sig });
    });
  });
  if (!allPoints.length) return;

  let tMin = Infinity, tMax = -Infinity, cvMax = 0;
  for (const p of allPoints) {
    if (p.t < tMin) tMin = p.t;
    if (p.t > tMax) tMax = p.t;
    if (p.cv > cvMax) cvMax = p.cv;
  }
  const tRange = tMax - tMin || 1;
  cvMax = Math.max(cvMax, 1);

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);

  // Y axis label + ticks
  const yLabel = document.createElementNS(NS, 'text');
  yLabel.setAttribute('x', 12);
  yLabel.setAttribute('y', PAD.top + iH / 2);
  yLabel.setAttribute('fill', '#888');
  yLabel.setAttribute('font-size', '11');
  yLabel.setAttribute('font-family', 'monospace');
  yLabel.setAttribute('transform', `rotate(-90, 12, ${PAD.top + iH / 2})`);
  yLabel.setAttribute('text-anchor', 'middle');
  yLabel.textContent = 'CV %';
  svg.appendChild(yLabel);

  const nTicks = 4;
  for (let i = 0; i <= nTicks; i++) {
    const v = (cvMax * i) / nTicks;
    const y = PAD.top + (1 - i / nTicks) * iH;
    const tick = document.createElementNS(NS, 'text');
    tick.setAttribute('x', PAD.left - 4);
    tick.setAttribute('y', y);
    tick.setAttribute('fill', '#666');
    tick.setAttribute('font-size', '10');
    tick.setAttribute('font-family', 'monospace');
    tick.setAttribute('text-anchor', 'end');
    tick.setAttribute('dominant-baseline', 'middle');
    tick.textContent = v.toFixed(1);
    svg.appendChild(tick);
    if (i > 0) {
      const gl = document.createElementNS(NS, 'line');
      gl.setAttribute('x1', PAD.left);
      gl.setAttribute('x2', PAD.left + iW);
      gl.setAttribute('y1', y);
      gl.setAttribute('y2', y);
      gl.setAttribute('stroke', '#333');
      gl.setAttribute('stroke-dasharray', '3,3');
      svg.appendChild(gl);
    }
  }

  // Scatter dots
  allPoints.forEach(p => {
    const cx = PAD.left + ((p.t - tMin) / tRange) * iW;
    const cy = PAD.top + (1 - p.cv / cvMax) * iH;
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('cx', cx.toFixed(1));
    dot.setAttribute('cy', cy.toFixed(1));
    dot.setAttribute('r', '2.5');
    dot.setAttribute('fill', p.color);
    dot.setAttribute('opacity', '0.5');
    dot.dataset.sig = p.sig;
    svg.appendChild(dot);
  });

  // Rolling median line (percentile is defined in app.js, available at call time)
  const sorted = [...allPoints].sort((a, b) => a.t - b.t);
  const win = Math.max(10, Math.floor(sorted.length / 15));
  const medLine = [];
  for (let i = 0; i < sorted.length; i++) {
    const lo = Math.max(0, i - Math.floor(win / 2));
    const hi = Math.min(sorted.length, lo + win);
    const wCVs = sorted.slice(lo, hi).map(p => p.cv).sort((a, b) => a - b);
    medLine.push({ t: sorted[i].t, cv: percentile(wCVs, 0.5) });
  }
  if (medLine.length > 1) {
    const pts = medLine.map(p => {
      const x = PAD.left + ((p.t - tMin) / tRange) * iW;
      const y = PAD.top + (1 - p.cv / cvMax) * iH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const poly = document.createElementNS(NS, 'polyline');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', 'none');
    poly.setAttribute('stroke', '#fff');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('opacity', '0.7');
    svg.appendChild(poly);
  }

  // Legend
  noiseResults.forEach(({ sig, platform, color }, idx) => {
    const y = PAD.top + (idx / Math.max(noiseResults.length - 1, 1)) * iH;
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', PAD.left + iW + 10);
    text.setAttribute('y', y);
    text.setAttribute('fill', color);
    text.setAttribute('font-size', '11');
    text.setAttribute('font-family', 'monospace');
    text.setAttribute('dominant-baseline', 'middle');
    text.dataset.sig = sig;
    text.textContent = platform;
    svg.appendChild(text);
  });

  container.appendChild(svg);

  // Cross-highlight between try table rows and noise chart
  const rows = document.querySelectorAll('#try-results tbody tr');
  const dots = svg.querySelectorAll('circle');
  const labels = svg.querySelectorAll('text[data-sig]');

  function setNoiseHighlight(activeSig) {
    const dimmed = activeSig !== null;
    dots.forEach(d => {
      d.setAttribute('opacity', dimmed && d.dataset.sig !== activeSig ? '0.08' : '0.5');
      d.setAttribute('r', d.dataset.sig === activeSig ? '4' : '2.5');
    });
    labels.forEach(t => {
      t.style.opacity = dimmed && t.dataset.sig !== activeSig ? '0.15' : '1';
    });
    rows.forEach(r => r.classList.toggle('chart-hl', r.dataset.sig === activeSig));
  }

  rows.forEach(r => {
    r.addEventListener('mouseover', () => setNoiseHighlight(r.dataset.sig));
    r.addEventListener('mouseout', () => setNoiseHighlight(null));
  });
  dots.forEach(d => {
    d.addEventListener('mouseover', () => setNoiseHighlight(d.dataset.sig));
    d.addEventListener('mouseout', () => setNoiseHighlight(null));
  });
}
