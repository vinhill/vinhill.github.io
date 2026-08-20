const SIGS = {
  "mozilla-central": [5273367, 5276630, 5353482, 5153754, 5703647, 274646, 275091, 5836747, 270490],
  "try": [5196337, 285171, 5599637, 5156235, 5237631, 272213, 5277737, 5351289]
}
const REPO = 'mozilla-central';
const TRY_REPO = 'try';
const MIN_RUNS_PER_PUSH = 3;

// --- Stats ---

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function calcStats(values) {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const pctChanges = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0)
      pctChanges.push(Math.abs((values[i] - values[i - 1]) / values[i - 1]) * 100);
  }
  pctChanges.sort((a, b) => a - b);
  return {
    n,
    mean,
    p25: percentile(pctChanges, 0.25),
    p50: percentile(pctChanges, 0.50),
    p75: percentile(pctChanges, 0.75),
  };
}

// Groups try data by push_id, keeps pushes with enough runs,
// filters outlier medians via IQR, returns per-push CV stats.
function analyzeNoise(data) {
  const byPush = new Map();
  for (const d of data) {
    if (d.push_id == null) continue;
    if (!byPush.has(d.push_id)) byPush.set(d.push_id, []);
    byPush.get(d.push_id).push(d);
  }

  const groups = [];
  for (const [pid, points] of byPush) {
    if (points.length < MIN_RUNS_PER_PUSH) continue;
    const values = points.map(p => p.value).sort((a, b) => a - b);
    groups.push({
      pid,
      values,
      median: percentile(values, 0.5),
      timestamp: points[0].push_timestamp,
    });
  }
  if (!groups.length) return null;

  const medians = groups.map(g => g.median).sort((a, b) => a - b);
  const q1 = percentile(medians, 0.25);
  const q3 = percentile(medians, 0.75);
  const iqr = q3 - q1;
  const lo = q1 - 1.5 * iqr;
  const hi = q3 + 1.5 * iqr;
  const kept = groups.filter(g => g.median >= lo && g.median <= hi);
  if (!kept.length) return null;

  const perPush = kept.map(g => {
    const mean = g.values.reduce((a, b) => a + b, 0) / g.values.length;
    const variance = g.values.reduce((s, v) => s + (v - mean) ** 2, 0) / (g.values.length - 1);
    return { cv: (Math.sqrt(variance) / mean) * 100, timestamp: g.timestamp };
  });
  perPush.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const sortedCVs = perPush.map(p => p.cv).sort((a, b) => a - b);
  return {
    nPushes: kept.length,
    nExcluded: groups.length - kept.length,
    nRuns: kept.reduce((s, g) => s + g.values.length, 0),
    medianCV: percentile(sortedCVs, 0.5),
    p75CV: percentile(sortedCVs, 0.75),
    p90CV: percentile(sortedCVs, 0.9),
    runsPerPush: percentile(kept.map(g => g.values.length).sort((a, b) => a - b), 0.5),
    perPush,
  };
}

function meanOf(values) {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function recentNoise(trySeries) {
  const cutoff = new Date(Date.now() - 7 * 86400000);
  const recent = trySeries.data.filter(d => new Date(d.push_timestamp) >= cutoff);
  return analyzeNoise(recent);
}

// --- State ---

let mcResults = [];   // [{ sig, series, stats }]
let tryState = null;  // Map<trySig, { trySeries, noise }>

// --- mozilla-central ---

async function load(days) {
  const intervalSecs = days * 86400;
  const status = document.getElementById('status');
  const table = document.getElementById('results');
  const tbody = table.querySelector('tbody');

  table.hidden = true;
  document.getElementById('chart').innerHTML = '';
  tbody.innerHTML = '';
  const mcSigs = SIGS[REPO];
  const cacheHits = mcSigs.filter(sig => getCachedSeries(REPO, sig, intervalSecs) !== null).length;
  status.textContent = `Fetching ${days}d data (${mcSigs.length} series, ${cacheHits} cached)…`;

  const responses = await Promise.all(mcSigs.map(sig => fetchSeries(REPO, sig, intervalSecs)));

  mcResults = [];
  for (let i = 0; i < mcSigs.length; i++) {
    const series = responses[i];
    if (!series || !series.data.length) continue;
    const stats = calcStats(series.data.map(d => d.value));
    mcResults.push({ sig: mcSigs[i], series, stats });
  }

  mcResults.sort((a, b) => b.stats.p50 - a.stats.p50);

  mcResults.forEach(({ sig, series, stats }, i) => {
    const p50Class = stats.p50 > 5 ? 'high' : stats.p50 > 2 ? 'medium' : 'low';
    const color = COLORS[i % COLORS.length];
    const tr = document.createElement('tr');
    tr.dataset.sig = String(sig);
    tr.innerHTML = `
      <td><span style="color:${color}">■</span> ${series.platform}</td>
      <td><a href="${perfherderUrl(REPO, series.signature_hash)}" target="_blank">${sig}</a></td>
      <td>${stats.n}</td>
      <td>${stats.mean.toFixed(2)}</td>
      <td>${stats.p25.toFixed(2)}%</td>
      <td class="${p50Class}">${stats.p50.toFixed(2)}%</td>
      <td>${stats.p75.toFixed(2)}%</td>`;
    tbody.appendChild(tr);
  });

  status.textContent = `${mcResults.length} series · ${days}d · run-to-run % change (absolute), sorted by P50 noisiest first.`;
  table.hidden = false;
  buildChart(mcResults);

  loadTryNoise(days);
}

// --- try noise ---

async function loadTryNoise(days) {
  const intervalSecs = days * 86400;
  const trySigs = SIGS[TRY_REPO];
  const tryStatus = document.getElementById('try-status');
  const tryTable = document.getElementById('try-results');
  const tryTbody = tryTable.querySelector('tbody');

  tryTable.hidden = true;
  tryTbody.innerHTML = '';
  document.getElementById('noise-chart').innerHTML = '';
  tryStatus.textContent = `Fetching try data (${trySigs.length} signatures)…`;
  tryState = new Map();

  const tryResponses = await Promise.all(
    trySigs.map(sig => fetchSeries(TRY_REPO, sig, intervalSecs).catch(() => null))
  );

  const noiseRows = [];
  for (let i = 0; i < trySigs.length; i++) {
    const trySeries = tryResponses[i];
    if (!trySeries || !trySeries.data.length) continue;
    const noise = analyzeNoise(trySeries.data);
    if (!noise) continue;
    tryState.set(trySigs[i], { trySeries, noise });
    noiseRows.push({ trySig: trySigs[i], trySeries, noise });
  }

  if (!noiseRows.length) {
    tryStatus.textContent = `No try pushes with ≥${MIN_RUNS_PER_PUSH} runs found in ${days}d window.`;
    return;
  }

  noiseRows.sort((a, b) => b.noise.medianCV - a.noise.medianCV);
  noiseRows.forEach(({ trySig, trySeries, noise }) => {
    const cvClass = noise.medianCV > 2 ? 'high' : noise.medianCV > 1 ? 'medium' : 'low';
    const tr = document.createElement('tr');
    tr.dataset.sig = String(trySig);
    tr.innerHTML = `
      <td>${shortPlatform(trySeries.platform)}</td>
      <td><a href="${perfherderUrl(TRY_REPO, trySeries.signature_hash)}" target="_blank">${trySig}</a></td>
      <td>${noise.nPushes} (${noise.nExcluded} filtered)</td>
      <td>${noise.nRuns}</td>
      <td>${noise.runsPerPush.toFixed(0)}</td>
      <td class="${cvClass}">${noise.medianCV.toFixed(2)}%</td>
      <td>${noise.p75CV.toFixed(2)}%</td>
      <td>${noise.p90CV.toFixed(2)}%</td>`;
    tryTbody.appendChild(tr);
  });

  tryStatus.textContent =
    `${noiseRows.length} signatures · ${days}d · within-push CV% (stddev/mean) · ` +
    `pushes with ≥${MIN_RUNS_PER_PUSH} runs, outlier medians filtered by IQR.`;
  tryTable.hidden = false;

  buildNoiseChart(noiseRows.map(({ trySig, trySeries, noise }, i) => ({
    sig: String(trySig),
    platform: shortPlatform(trySeries.platform),
    color: COLORS[i % COLORS.length],
    perPush: noise.perPush,
  })));
}

// --- Push compare ---

function parseRevision(input) {
  const m = input.match(/[?&]revision=([a-f0-9]+)/i);
  return m ? m[1] : input;
}

async function checkPush() {
  const baseInput = document.getElementById('base-rev').value.trim();
  const testInput = document.getElementById('test-rev').value.trim();
  if (!baseInput) return;

  const calcStatus = document.getElementById('calc-status');
  const calcTable = document.getElementById('calc-results');
  const calcTbody = calcTable.querySelector('tbody');
  calcTable.hidden = true;
  calcTbody.innerHTML = '';

  if (!tryState) {
    calcStatus.textContent = 'Noise data not loaded yet — wait for try data above to finish.';
    return;
  }

  const baseRev = parseRevision(baseInput);
  const testRev = testInput ? parseRevision(testInput) : null;

  calcStatus.textContent = `Looking up push${testRev ? 'es' : ''}…`;

  let basePush, testPush;
  try {
    basePush = await fetchPushByRevision(TRY_REPO, baseRev);
    if (testRev) testPush = await fetchPushByRevision(TRY_REPO, testRev);
  } catch (e) {
    calcStatus.textContent = `Error: ${e.message}`;
    return;
  }
  if (!basePush) {
    calcStatus.textContent = `Base push not found for ${baseRev.slice(0, 12)}.`;
    return;
  }
  if (testRev && !testPush) {
    calcStatus.textContent = `Test push not found for ${testRev.slice(0, 12)}.`;
    return;
  }

  let found = 0;
  for (const [trySig, { trySeries, noise }] of tryState) {
    const baseValues = trySeries.data.filter(d => d.push_id === basePush.id).map(d => d.value);
    if (!baseValues.length) continue;

    const baseline = recentNoise(trySeries) || noise;
    const baseMean = meanOf(baseValues);

    let testStr = '—';
    if (testPush) {
      const testValues = trySeries.data.filter(d => d.push_id === testPush.id).map(d => d.value);
      if (testValues.length) {
        testStr = `${meanOf(testValues).toFixed(2)} (${testValues.length})`;
      }
    }

    found++;
    const cvClass = baseline.medianCV > 2 ? 'high' : baseline.medianCV > 1 ? 'medium' : 'low';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${shortPlatform(trySeries.platform)}</td>
      <td>${baseMean.toFixed(2)} (${baseValues.length})</td>
      <td>${testStr}</td>
      <td class="${cvClass}">${baseline.medianCV.toFixed(2)}%</td>`;
    calcTbody.appendChild(tr);
  }

  if (!found) {
    calcStatus.textContent = `No SP3 results for ${baseRev.slice(0, 12)} in loaded data. Try a wider time range.`;
    return;
  }

  const label = testRev
    ? `${baseRev.slice(0, 12)} vs ${testRev.slice(0, 12)}`
    : baseRev.slice(0, 12);
  calcStatus.textContent = `${found} signatures · ${label} · mean (n).`;
  calcTable.hidden = false;
}

// --- Init ---

document.getElementById('days').addEventListener('change', e => load(+e.target.value));
document.getElementById('calc-btn').addEventListener('click', checkPush);
document.querySelectorAll('#base-rev, #test-rev').forEach(el => {
  el.addEventListener('keydown', e => { if (e.key === 'Enter') checkPush(); });
});
load(30);
