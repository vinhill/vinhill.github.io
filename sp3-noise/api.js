const BASE = 'https://treeherder.mozilla.org';
const FRAMEWORK = 13;
const CACHE_TTL = 24 * 60 * 60 * 1000;

const ALL_INTERVALS_DAYS = Array.from(document.getElementById('days').options)
  .map(o => +o.value)
  .sort((a, b) => b - a);

// --- Cache ---

function cacheLoad(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (Date.now() - obj.fetchedAt > CACHE_TTL) return null;
    return obj.value;
  } catch {
    return null;
  }
}

function cacheSave(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify({ fetchedAt: Date.now(), value }));
  } catch {}
}

function seriesKey(repo, sig, secs) {
  return `nh_${repo}_${sig}_${secs}`;
}

function getCachedSeries(repo, sig, secs) {
  const exact = cacheLoad(seriesKey(repo, sig, secs));
  if (exact) return exact;
  for (const days of ALL_INTERVALS_DAYS) {
    const bigger = days * 86400;
    if (bigger <= secs) continue;
    const cached = cacheLoad(seriesKey(repo, sig, bigger));
    if (!cached) continue;
    const cutoff = new Date(Date.now() - secs * 1000);
    return { ...cached, data: cached.data.filter(d => new Date(d.push_timestamp) >= cutoff) };
  }
  return null;
}

// --- Fetch ---

async function fetchSeries(repo, sig, secs) {
  const cached = getCachedSeries(repo, sig, secs);
  if (cached) return cached;
  const url = `${BASE}/api/performance/summary/?repository=${repo}&signature=${sig}&framework=${FRAMEWORK}&interval=${secs}&all_data=true`;
  const resp = await fetch(url);
  const json = await resp.json();
  const series = json[0];
  if (series) cacheSave(seriesKey(repo, sig, secs), series);
  return series;
}

async function fetchPushByRevision(repo, revision) {
  const url = `${BASE}/api/project/${repo}/push/?revision=${revision}`;
  const resp = await fetch(url);
  const json = await resp.json();
  return json.results?.length ? json.results[0] : null;
}

function perfherderUrl(repo, sigHash) {
  return `https://treeherder.mozilla.org/perf.html#/graphs?series=${repo},${sigHash},1,${FRAMEWORK}`;
}
