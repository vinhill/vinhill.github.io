'use strict';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const monthFmt = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric'
});
const fullFmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
});

function fromISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date) {
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(date, n) {
    const d = new Date(date);
    d.setUTCDate(d.getUTCDate() + n);
    return d;
}

function eachDay(a, b) {
    const out = [];
    for (let d = fromISO(a), end = fromISO(b); d <= end; d = addDays(d, 1)) out.push(toISO(d));
    return out;
}

function encodeDay(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}${m}${y.slice(-2)}`;
}

function decodeDay(raw) {
    if (!/^\d{6}$/.test(raw)) throw new Error(`Bad date: ${raw}`);
    const d = Number(raw.slice(0, 2));
    const m = Number(raw.slice(2, 4));
    const y = 2000 + Number(raw.slice(4, 6));
    const date = new Date(Date.UTC(y, m - 1, d));
    if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error(`Bad date: ${raw}`);
    return toISO(date);
}

function parseDateToken(token) {
    if (token.includes('-')) {
        const [a, b] = token.split('-');
        return eachDay(decodeDay(a), decodeDay(b));
    }
    return [decodeDay(token)];
}

function compressDates(dates) {
    const a = [...new Set(dates)].sort();
    if (!a.length) return [];
    const out = [];
    let start = a[0],
        prev = a[0];
    const flush = () => out.push(start === prev ? encodeDay(start) : `${encodeDay(start)}-${encodeDay(prev)}`);
    for (let i = 1; i < a.length; i++) {
        if (toISO(addDays(fromISO(prev), 1)) === a[i]) prev = a[i];
        else {
            flush();
            start = prev = a[i];
        }
    }
    flush();
    return out;
}

function parsePoll(code) {
    const raw = code.replace(/^poll=/, '').trim();
    if (!raw) return [];
    const tokens = raw.split(',').map(x => x.trim()).filter(Boolean);
    let mode = 'y';
    const set = new Set();
    for (const token of tokens) {
        if (token === 'y' || token === 'n') {
            mode = token;
            continue;
        }
        for (const iso of parseDateToken(token)) {
            if (mode === 'y') set.add(iso);
            else set.delete(iso);
        }
    }
    return [...set].sort();
}

function encodePoll(dates) {
    const selected = [...new Set(dates)].sort();
    if (!selected.length) return '';
    const direct = `y,${compressDates(selected).join(',')}`;
    const all = eachDay(selected[0], selected[selected.length - 1]);
    const selectedSet = new Set(selected);
    const holes = all.filter(d => !selectedSet.has(d));
    const range = `y,${encodeDay(selected[0])}-${encodeDay(selected[selected.length - 1])}${holes.length ? `,n,${compressDates(holes).join(',')}` : ''}`;
    return direct.length <= range.length ? direct : range;
}

function parseUser(code, pollDates) {
    let raw = code.trim();
    if (!raw) throw new Error('Empty response');
    const tokens = raw.split(',').map(x => x.trim()).filter(Boolean);
    if (!['y', 'm', 'n'].includes(tokens[0])) throw new Error('A response must start with y, m, or n');
    const defaultVote = tokens[0];
    const votes = Object.fromEntries(pollDates.map(d => [d, defaultVote]));
    let mode = defaultVote;
    for (const token of tokens.slice(1)) {
        if (['y', 'm', 'n'].includes(token)) {
            mode = token;
            continue;
        }
        for (const iso of parseDateToken(token))
            if (iso in votes) votes[iso] = mode;
    }
    return votes;
}

function encodeUser(votes, pollDates, name) {
    const states = ['y', 'm', 'n'];
    const candidates = states.map(def => {
        let code = def;
        for (const s of states) {
            if (s === def) continue;
            const dates = pollDates.filter(d => votes[d] === s);
            if (dates.length) code += `,${s},${compressDates(dates).join(',')}`;
        }
        return code;
    });
    candidates.sort((a, b) => a.length - b.length || a.localeCompare(b));
    return `${name}=${candidates[0]}`;
}

function monthsBetween(dates) {
    if (!dates.length) return [];
    const start = fromISO(dates[0]);
    const end = fromISO(dates[dates.length - 1]);
    const out = [];
    let y = start.getUTCFullYear(),
        m = start.getUTCMonth();
    while (y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth())) {
        out.push([y, m]);
        m++;
        if (m === 12) {
            m = 0;
            y++;
        }
    }
    return out;
}

function renderCalendar(container, dates, cellFn, {
    showAllDays = true
} = {}) {
    container.innerHTML = '';
    const inner = document.createElement('div');
    inner.className = 'months mt';
    if (!dates.length) return;
    const min = dates[0],
        max = dates[dates.length - 1];
    const dateSet = new Set(dates);
    for (const [year, month] of monthsBetween(dates)) {
        const box = document.createElement('div');
        box.className = 'month';
        const title = document.createElement('h3');
        title.textContent = monthFmt.format(new Date(Date.UTC(year, month, 1)));
        box.appendChild(title);
        const wh = document.createElement('div');
        wh.className = 'weekdays';
        weekdays.forEach(w => {
            const d = document.createElement('div');
            d.textContent = w;
            wh.appendChild(d);
        });
        box.appendChild(wh);
        const grid = document.createElement('div');
        grid.className = 'days';
        const first = new Date(Date.UTC(year, month, 1));
        const offset = (first.getUTCDay() + 6) % 7;
        for (let i = 0; i < offset; i++) {
            const b = document.createElement('div');
            b.className = 'day blank';
            grid.appendChild(b);
        }
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const iso = toISO(new Date(Date.UTC(year, month, day)));
            const candidate = dateSet.has(iso);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'day';
            btn.dataset.date = iso;
            btn.innerHTML = `<span class="num">${day}</span><span class="mini"></span>`;
            if (candidate) btn.classList.add('candidate');
            else if (!showAllDays || iso < min || iso > max) btn.classList.add('outside');
            cellFn(btn, iso, candidate);
            grid.appendChild(btn);
        }
        box.appendChild(grid);
        inner.appendChild(box);
    }
    container.appendChild(inner);
}

function currentBaseUrl() {
    const u = new URL(location.href);
    u.search = '';
    u.hash = '';
    return u.toString();
}

function queryString(p) {
    return p.toString().replace(/%2C/gi, ',');
}

function copyText(text) {
    if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return Promise.resolve();
}

function flash(button, text = 'Copied') {
    const old = button.textContent;
    button.textContent = text;
    setTimeout(() => button.textContent = old, 900);
}

let pollDates = [];
let createDates = new Set();
let createBounds = null;
let voteMap = {};
let paint = 'y';
let voteAnchor = null;
let draggingVote = false;
let draggingCreate = false;
let createPaintAdd = true;

function params() {
    return new URLSearchParams(location.search);
}

function loadFromUrl() {
    const p = params();
    try {
        pollDates = p.has('poll') ? parsePoll(p.get('poll')) : [];
    } catch (e) {
        console.error(e);
        pollDates = [];
    }
    voteMap = Object.fromEntries(pollDates.map(d => [d, 'y']));
}

function setTab(name) {
    $$('.tabpage').forEach(x => x.classList.toggle('hidden', x.id !== name));
    $$('.tabs button').forEach(x => x.classList.toggle('active', x.dataset.tab === name));
    if (name === 'vote') renderVote();
    if (name === 'results') renderResults();
}

function renderCreate() {
    const dates = createBounds ? eachDay(createBounds[0], createBounds[1]) : [...createDates].sort();
    const displayDates = [...new Set([...dates, ...createDates])].sort();
    if (!displayDates.length) {
        $('#createCalendar').innerHTML = '';
        return;
    }
    renderCalendar($('#createCalendar'), displayDates, (btn, iso, inDisplaySet) => {
        if (!inDisplaySet) {
            btn.disabled = true;
            return;
        }
        btn.classList.add('candidate');
        const selected = createDates.has(iso);
        btn.classList.toggle('excluded', !selected);
        $('.mini', btn).textContent = selected ? 'included' : 'excluded';
        btn.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            draggingCreate = true;
            createPaintAdd = !createDates.has(iso);
            paintCreateDate(iso, createPaintAdd);
        });
        btn.addEventListener('mouseenter', () => {
            if (draggingCreate) paintCreateDate(iso, createPaintAdd);
        });
    });
}

function paintCreateDate(iso, add) {
    if (add) createDates.add(iso);
    else createDates.delete(iso);
    renderCreate();
}

function renderVote() {
    const has = pollDates.length > 0;
    $('#noPollVote').classList.toggle('hidden', has);
    $('#voteControls').classList.toggle('hidden', !has);
    $('#finishVote').disabled = !has;
    if (!has) {
        $('#voteCalendar').innerHTML = '';
        return;
    }
    renderCalendar($('#voteCalendar'), pollDates, (btn, iso, candidate) => {
        if (!candidate) {
            btn.disabled = true;
            return;
        }
        const v = voteMap[iso] || 'y';
        btn.classList.add(`vote-${v}`);
        $('.mini', btn).textContent = v === 'y' ? 'yes' : v === 'm' ? 'meh' : 'no';
        btn.title = `${fullFmt.format(fromISO(iso))}: ${$('.mini', btn).textContent}`;
        btn.addEventListener('mousedown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            if (e.shiftKey && voteAnchor) paintRange(voteAnchor, iso, paint);
            else {
                voteMap[iso] = paint;
                voteAnchor = iso;
                renderVote();
                draggingVote = true;
            }
        });
        btn.addEventListener('mouseenter', () => {
            if (draggingVote) {
                voteMap[iso] = paint;
                renderVote();
            }
        });
    }, {
        showAllDays: false
    });
}

function paintRange(a, b, v) {
    const ia = pollDates.indexOf(a),
        ib = pollDates.indexOf(b);
    if (ia < 0 || ib < 0) return;
    const [lo, hi] = ia < ib ? [ia, ib] : [ib, ia];
    for (let i = lo; i <= hi; i++) voteMap[pollDates[i]] = v;
    voteAnchor = b;
    renderVote();
}

function userCodesFromUrl() {
    return [...params()].filter(param => param[0] != 'poll').filter(Boolean);
}

function replaceUsers(codes) {
    const p = params();
    for (const [user, votes] of codes) {
        p.delete(user);
        p.append(user, votes);
    }
    history.replaceState(null, '', `${location.pathname}?${queryString(p)}`);
}

function renderResults() {
    const has = pollDates.length > 0;
    $('#noPollResults').classList.toggle('hidden', has);
    $('#resultsControls').classList.toggle('hidden', !has);
    $('#usersPanel').classList.toggle('hidden', !has);
    if (!has) {
        $('#resultsCalendar').innerHTML = '';
        return;
    }

    const codes = userCodesFromUrl();
    const parsed = [];
    const validCodes = [];
    const names = [];
    for (const [name, votes] of codes) {
        try {
            parsed.push(parseUser(votes, pollDates));
            names.push(name);
            validCodes.push([name, votes]);
        } catch (e) {
            console.warn('Skipping invalid user code', code, e);
        }
    }
    if (validCodes.length !== codes.length) replaceUsers(validCodes);

    const list = $('#userList');
    list.innerHTML = '';
    if (!validCodes.length) list.textContent = 'No responses yet.';
    validCodes.forEach((code, i) => {
        const row = document.createElement('div');
        row.className = 'userrow';
        row.innerHTML = `<strong>${escapeHtml(code[0])}</strong><code>${escapeHtml(code[1])}</code><button class="btn danger">Remove</button>`;
        $('button', row).addEventListener('click', () => {
            const next = [...validCodes];
            next.splice(i, 1);
            replaceUsers(next);
            renderResults();
        });
        list.appendChild(row);
    });

    renderCalendar($('#resultsCalendar'), pollDates, (btn, iso, candidate) => {
        if (!candidate) {
            btn.disabled = true;
            return;
        }
        btn.classList.add('aggregate');
        const counts = {
            y: 0,
            m: 0,
            n: 0
        };
        parsed.forEach(v => counts[v[iso]]++);
        $('.mini', btn).textContent = parsed.length ? `✓${counts.y}  ~${counts.m}  ×${counts.n}` : 'no votes';
        const total = Math.max(1, parsed.length);
        const bars = document.createElement('div');
        bars.className = 'bars';
        for (const s of ['y', 'm', 'n']) {
            const span = document.createElement('span');
            span.className = s;
            span.style.flex = String(counts[s] / total);
            if (!counts[s]) span.style.display = 'none';
            bars.appendChild(span);
        }
        btn.appendChild(bars);
        const labels = parsed.map((v, i) => `${escapeHtml(names[i])}: ${v[iso] === 'y' ? 'yes' : v[iso] === 'm' ? 'meh' : 'no'}`);
        btn.title = `${fullFmt.format(fromISO(iso))}\n${labels.length ? labels.join('\n') : 'No responses'}`;
    }, {
        showAllDays: false
    });
}

function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

$$('.tabs button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
document.addEventListener('mouseup', () => {
    draggingVote = false;
    draggingCreate = false;
});

$('#loadRange').addEventListener('click', () => {
    const a = $('#startDate').value,
        b = $('#endDate').value;
    if (!a || !b || a > b) {
        $('#createHint').textContent = 'Choose a valid start and end date.';
        return;
    }
    createBounds = [a, b];
    createDates = new Set(eachDay(a, b));
    $('#createHint').textContent = 'Click or drag to exclude days.';
    renderCreate();
});
$('#createPoll').addEventListener('click', () => {
    const code = encodePoll([...createDates]);
    if (!code) {
        $('#createHint').textContent = 'Include at least one candidate day.';
        return;
    }
    const p = new URLSearchParams();
    p.set('poll', code);
    const url = `${currentBaseUrl()}?${queryString(p)}`;
    $('#pollUrl').textContent = url;
    $('#pollOutputWrap').classList.remove('hidden');
    history.replaceState(null, '', `${location.pathname}?${queryString(p)}`);
    loadFromUrl();
});
$('#copyPollUrl').addEventListener('click', async e => {
    await copyText($('#pollUrl').textContent);
    flash(e.target);
});

$$('.paint').forEach(b => b.addEventListener('click', () => {
    paint = b.dataset.v;
    $$('.paint').forEach(x => x.classList.toggle('active', x === b));
}));
$('#setAllYes').addEventListener('click', () => {
    pollDates.forEach(d => voteMap[d] = 'y');
    renderVote();
});
$('#setAllMeh').addEventListener('click', () => {
    pollDates.forEach(d => voteMap[d] = 'm');
    renderVote();
});
$('#setAllNo').addEventListener('click', () => {
    pollDates.forEach(d => voteMap[d] = 'n');
    renderVote();
});
$('#finishVote').addEventListener('click', () => {
    if (!pollDates.length) return;
    const name = $('#username').value || 'anonymous';
    const code = encodeUser(voteMap, pollDates, name);
    $('#voteCode').textContent = code;
    $('#voteOutputWrap').classList.remove('hidden');
});
$('#copyVoteCode').addEventListener('click', async e => {
    await copyText($('#voteCode').textContent);
    flash(e.target);
});

$('#addUsers').addEventListener('click', () => {
    const text = $('#addUsersText').value.trim();
    if (!text) return;
    const additions = [];
    // Accept codes separated by &, newline or semicolon
    const parts = text.split(/\n|;|&/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
        const m = part.match(/(?:^|\s)[^=]=([^\s]+)/);
        additions.push((m ? m[1] : part).trim());
    }
    const valid = [];
    for (const code of additions) {
        try {
            const [name, votes] = code.split('=');
            parseUser(name, votes, pollDates);
            valid.push([name, votes]);
        } catch (e) {
            alert(`Could not parse: ${code}\n${e.message}`);
        }
    }
    if (!valid.length) return;
    replaceUsers([...userCodesFromUrl(), ...valid]);
    $('#addUsersText').value = '';
    renderResults();
});
$('#copyResultsUrl').addEventListener('click', async e => {
    await copyText(location.href);
    flash(e.target);
});

// Initialize sensible creator defaults.
const today = new Date();
const localToday = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
const inSixWeeks = new Date(today);
inSixWeeks.setDate(inSixWeeks.getDate() + 42);
const localEnd = `${inSixWeeks.getFullYear()}-${pad(inSixWeeks.getMonth() + 1)}-${pad(inSixWeeks.getDate())}`;
$('#startDate').value = localToday;
$('#endDate').value = localEnd;

loadFromUrl();
const p = params();
setTab(p.getAll('user').length ? 'results' : pollDates.length ? 'vote' : 'create');
