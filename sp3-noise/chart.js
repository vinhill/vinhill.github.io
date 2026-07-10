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
