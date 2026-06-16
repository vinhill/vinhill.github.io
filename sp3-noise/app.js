const BASE = 'https://treeherder.mozilla.org';
const SIGS = [5273367, 5276630, 5353482, 5153754, 5703647, 274646, 275091, 5836747, 270490];
const REPO = 'mozilla-central';
const FRAMEWORK = 13;

const ALL_INTERVALS_DAYS = Array.from(document.getElementById('days').options)
  .map(o => +o.value)
  .sort((a, b) => b - a); // descending so derivation finds nearest-larger first

// --- Cache ---

const CACHE_PREFIX = 'nh_series_';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheLoad(sig, intervalSecs) {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${sig}_${intervalSecs}`);
    if (!raw) return null;
    const { fetchedAt, series } = JSON.parse(raw);
    if (Date.now() - fetchedAt > CACHE_TTL) return null;
    return series;
  } catch {
    return null;
  }
}

function cacheSave(sig, intervalSecs, series) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${sig}_${intervalSecs}`,
      JSON.stringify({ fetchedAt: Date.now(), series })
    );
  } catch {} // ignore quota errors
}

function getCachedSeries(sig, intervalSecs) {
  const exact = cacheLoad(sig, intervalSecs);
  if (exact) return exact;

  // Derive from the nearest larger cached range
  for (const days of ALL_INTERVALS_DAYS) {
    const bigger = days * 86400;
    if (bigger <= intervalSecs) continue;
    const cached = cacheLoad(sig, bigger);
    if (!cached) continue;
    const cutoff = new Date(Date.now() - intervalSecs * 1000);
    return { ...cached, data: cached.data.filter(d => new Date(d.push_timestamp) >= cutoff) };
  }
  return null;
}

// --- Stats ---

function percentile(sorted, p) {
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

// --- Fetch ---

async function fetchSeries(sig, intervalSecs) {
  const cached = getCachedSeries(sig, intervalSecs);
  if (cached) return cached;

  const url = `${BASE}/api/performance/summary/?repository=${REPO}&signature=${sig}&framework=${FRAMEWORK}&interval=${intervalSecs}&all_data=true`;
  const resp = await fetch(url);
  const json = await resp.json();
  const series = json[0];
  if (series) cacheSave(sig, intervalSecs, series);
  return series;
}

function perfherderUrl(series) {
  return `https://treeherder.mozilla.org/perf.html#/graphs?series=${REPO},${series.signature_hash},1,${FRAMEWORK}`;
}

// --- Main ---

async function load(days) {
  const intervalSecs = days * 86400;
  const status = document.getElementById('status');
  const table = document.getElementById('results');
  const tbody = table.querySelector('tbody');

  table.hidden = true;
  document.getElementById('chart').innerHTML = '';
  tbody.innerHTML = '';
  const cacheHits = SIGS.filter(sig => getCachedSeries(sig, intervalSecs) !== null).length;
  status.textContent = `Fetching ${days}d data (${SIGS.length} series, ${cacheHits} cached)…`;

  const responses = await Promise.all(SIGS.map(sig => fetchSeries(sig, intervalSecs)));

  const results = [];
  for (let i = 0; i < SIGS.length; i++) {
    const series = responses[i];
    if (!series || !series.data.length) continue;
    const stats = calcStats(series.data.map(d => d.value));
    results.push({ sig: SIGS[i], series, stats });
  }

  results.sort((a, b) => b.stats.p50 - a.stats.p50);

  results.forEach(({ sig, series, stats }, i) => {
    const p50Class = stats.p50 > 5 ? 'high' : stats.p50 > 2 ? 'medium' : 'low';
    const color = COLORS[i % COLORS.length];
    const tr = document.createElement('tr');
    tr.dataset.sig = String(sig);
    tr.innerHTML = `
      <td><span style="color:${color}">■</span> ${series.platform}</td>
      <td><a href="${perfherderUrl(series)}" target="_blank">${sig}</a></td>
      <td>${stats.n}</td>
      <td>${stats.mean.toFixed(2)}</td>
      <td>${stats.p25.toFixed(2)}%</td>
      <td class="${p50Class}">${stats.p50.toFixed(2)}%</td>
      <td>${stats.p75.toFixed(2)}%</td>`;
    tbody.appendChild(tr);
  });

  status.textContent = `${results.length} series · ${days}d · run-to-run % change (absolute), sorted by P50 noisiest first.`;
  table.hidden = false;
  buildChart(results);
}

document.getElementById('days').addEventListener('change', e => load(+e.target.value));
load(30);
