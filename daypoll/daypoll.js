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


/* Optional backend */

class Backend {
    static baseUrl() {
        return $('meta[name="daypoll-api-url"]')
            ?.content.trim().replace(/\/$/, '');
    }

    static async request(path, options = {}) {
        const baseUrl = this.baseUrl();

        if (!baseUrl) {
            throw new Error(
                'Daypoll backend is not configured; using URL-only mode.'
            );
        }

        const response = await fetch(`${baseUrl}${path}`, {
            ...options,
            headers: options.headers
        });

        if (!response.ok) {
            throw new Error(`Daypoll backend returned ${response.status}`);
        }

        return response.json();
    }

    static submitVote(poll, name, votes) {
        return this.request('/api/votes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ poll, name, votes })
        });
    }

    static results(poll) {
        return this.request(
            `/api/results?poll=${encodeURIComponent(poll)}`
        );
    }
}


/* Dates */

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
    for (let d = fromISO(a), end = fromISO(b); d <= end; d = addDays(d, 1)) {
        out.push(toISO(d));
    }
    return out;
}

function monthsBetween(dates) {
    if (!dates.length) return [];

    const start = fromISO(dates[0]);
    const end = fromISO(dates[dates.length - 1]);
    const out = [];

    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();

    while (
        y < end.getUTCFullYear() ||
        (y === end.getUTCFullYear() && m <= end.getUTCMonth())
    ) {
        out.push([y, m]);

        m++;
        if (m === 12) {
            m = 0;
            y++;
        }
    }

    return out;
}


/* URL encoding */

const ALPHABET =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

const EPOCH = Date.UTC(2000, 0, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(iso) {
    return (fromISO(iso).getTime() - EPOCH) / DAY_MS;
}

function fromDayNumber(n) {
    return toISO(new Date(EPOCH + n * DAY_MS));
}

// URL-safe varint.
// Each character carries 5 value bits plus 1 continuation bit.
function encodeUint(n) {
    if (!Number.isSafeInteger(n) || n < 0) {
        throw new Error(`Bad unsigned integer: ${n}`);
    }

    let out = '';

    do {
        const value = n % 32;
        n = Math.floor(n / 32);

        out += ALPHABET[value + (n ? 32 : 0)];
    } while (n);

    return out;
}

function decodeUint(text, offset = 0) {
    let value = 0;
    let multiplier = 1;

    while (offset < text.length) {
        const digit = ALPHABET.indexOf(text[offset++]);

        if (digit < 0) {
            throw new Error('Bad packed integer');
        }

        value += (digit % 32) * multiplier;

        if (!Number.isSafeInteger(value)) {
            throw new Error('Packed integer too large');
        }

        if (digit < 32) {
            return [value, offset];
        }

        multiplier *= 32;

        if (!Number.isSafeInteger(multiplier)) {
            throw new Error('Packed integer too large');
        }
    }

    throw new Error('Truncated packed integer');
}

/* Human-readable / editable representation */

const TextCodec = {
    encodeDay(iso) {
        const [y, m, d] = iso.split('-');
        return `${d}${m}${y.slice(-2)}`;
    },

    decodeDay(raw) {
        if (!/^\d{6}$/.test(raw)) {
            throw new Error(`Bad date: ${raw}`);
        }

        const d = Number(raw.slice(0, 2));
        const m = Number(raw.slice(2, 4));
        const y = 2000 + Number(raw.slice(4, 6));

        const date = new Date(Date.UTC(y, m - 1, d));

        if (
            date.getUTCFullYear() !== y ||
            date.getUTCMonth() !== m - 1 ||
            date.getUTCDate() !== d
        ) {
            throw new Error(`Bad date: ${raw}`);
        }

        return toISO(date);
    },

    parseDateToken(token) {
        if (!token.includes('-')) {
            return [this.decodeDay(token)];
        }

        const [a, b] = token.split('-');
        return eachDay(this.decodeDay(a), this.decodeDay(b));
    },

    compressDates(dates) {
        const sorted = [...new Set(dates)].sort();

        if (!sorted.length) {
            return [];
        }

        const out = [];
        let start = sorted[0];
        let prev = sorted[0];

        const flush = () => {
            out.push(
                start === prev
                    ? this.encodeDay(start)
                    : `${this.encodeDay(start)}-${this.encodeDay(prev)}`
            );
        };

        for (const current of sorted.slice(1)) {
            if (toISO(addDays(fromISO(prev), 1)) === current) {
                prev = current;
            } else {
                flush();
                start = prev = current;
            }
        }

        flush();
        return out;
    },

    encodePoll(dates) {
        const selected = [...new Set(dates)].sort();

        if (!selected.length) {
            return '';
        }

        const direct =
            `y,${this.compressDates(selected).join(',')}`;

        const all =
            eachDay(selected[0], selected[selected.length - 1]);

        const selectedSet = new Set(selected);
        const holes = all.filter(d => !selectedSet.has(d));

        const range =
            `y,${this.encodeDay(selected[0])}-${this.encodeDay(selected.at(-1))}` +
            (holes.length
                ? `,n,${this.compressDates(holes).join(',')}`
                : '');

        return direct.length <= range.length
            ? direct
            : range;
    },

    parsePoll(code) {
        if (!code) {
            return [];
        }

        const selected = new Set();
        let mode = 'y';

        for (const token of code.split(',').map(x => x.trim()).filter(Boolean)) {
            if (token === 'y' || token === 'n') {
                mode = token;
                continue;
            }

            for (const iso of this.parseDateToken(token)) {
                if (mode === 'y') {
                    selected.add(iso);
                } else {
                    selected.delete(iso);
                }
            }
        }

        return [...selected].sort();
    },

    encodeVotes(votes, pollDates) {
        const states = ['y', 'm', 'n'];

        const candidates = states.map(defaultVote => {
            let code = defaultVote;

            for (const state of states) {
                if (state === defaultVote) {
                    continue;
                }

                const dates = pollDates.filter(
                    date => votes[date] === state
                );

                if (dates.length) {
                    code +=
                        `,${state},${this.compressDates(dates).join(',')}`;
                }
            }

            return code;
        });

        return candidates.sort(
            (a, b) =>
                a.length - b.length ||
                a.localeCompare(b)
        )[0];
    },

    parseVotes(code, pollDates) {
        const tokens =
            code.split(',').map(x => x.trim()).filter(Boolean);

        if (!['y', 'm', 'n'].includes(tokens[0])) {
            throw new Error('A response must start with y, m, or n');
        }

        const votes =
            Object.fromEntries(
                pollDates.map(date => [date, tokens[0]])
            );

        let mode = tokens[0];

        for (const token of tokens.slice(1)) {
            if (['y', 'm', 'n'].includes(token)) {
                mode = token;
                continue;
            }

            for (const iso of this.parseDateToken(token)) {
                if (iso in votes) {
                    votes[iso] = mode;
                }
            }
        }

        return votes;
    }
};


/* Compact representation */

const PackedCodec = {
    /*
     * Poll format:
     *
     *   start, runLength-1, gap-1, runLength-1, gap-1, runLength-1, ...
     *
     * Only the first date is absolute. Everything afterwards is relative.
     */
    encodePoll(dates) {
        const days = [...new Set(dates)]
            .sort()
            .map(dayNumber);

        if (!days.length) {
            return '';
        }

        const runs = [];
        let start = days[0];
        let prev = start;

        for (const day of days.slice(1)) {
            if (day === prev + 1) {
                prev = day;
                continue;
            }

            runs.push([start, prev - start + 1]);
            start = prev = day;
        }

        runs.push([start, prev - start + 1]);

        let out =
            encodeUint(runs[0][0]) +
            encodeUint(runs[0][1] - 1);

        for (let i = 1; i < runs.length; i++) {
            const [prevStart, prevLength] = runs[i - 1];
            const [start, length] = runs[i];

            const prevEnd = prevStart + prevLength - 1;
            const gap = start - prevEnd - 1;

            out +=
                encodeUint(gap - 1) +
                encodeUint(length - 1);
        }

        return out;
    },

    parsePoll(code) {
        if (!code) {
            return [];
        }

        let offset = 0;

        let start;
        [start, offset] = decodeUint(code, offset);

        let length;
        [length, offset] = decodeUint(code, offset);
        length++;

        const dates = [];

        const addRun = () => {
            for (let i = 0; i < length; i++) {
                dates.push(fromDayNumber(start + i));
            }
        };

        addRun();

        let previousEnd = start + length - 1;

        while (offset < code.length) {
            let gap;

            [gap, offset] = decodeUint(code, offset);
            gap++;

            [length, offset] = decodeUint(code, offset);
            length++;

            start = previousEnd + gap + 1;

            addRun();

            previousEnd = start + length - 1;
        }

        return dates;
    },

    /*
     * Vote format:
     *
     *   <default>
     *   <state><count><first index><delta-1>...
     *   <state><count><first index><delta-1>...
     *
     * Dates aren't encoded at all. Overrides refer to indices in pollDates.
     *
     * Example:
     *
     *   default = y
     *   n at indices 5, 15, 25
     *
     * becomes approximately:
     *
     *   y C D F J J
     *     │ │ │ └─ delta 10 => store 9
     *     │ │ └─── first index 5
     *     │ └───── 3 entries
     *     └─────── n
     */
    encodeVotes(votes, pollDates) {
        const states = ['y', 'm', 'n'];

        const candidates = states.map(defaultVote => {
            let out = defaultVote;

            for (const state of states) {
                if (state === defaultVote) {
                    continue;
                }

                const indices = [];

                for (let i = 0; i < pollDates.length; i++) {
                    if (votes[pollDates[i]] === state) {
                        indices.push(i);
                    }
                }

                if (!indices.length) {
                    continue;
                }

                out += state;
                out += encodeUint(indices.length);
                out += encodeUint(indices[0]);

                for (let i = 1; i < indices.length; i++) {
                    out += encodeUint(
                        indices[i] - indices[i - 1] - 1
                    );
                }
            }

            return out;
        });

        return candidates.sort(
            (a, b) =>
                a.length - b.length ||
                a.localeCompare(b)
        )[0];
    },

    parseVotes(code, pollDates) {
        if (!code) {
            throw new Error('Empty packed response');
        }

        const states = ['y', 'm', 'n'];
        const defaultVote = code[0];

        if (!states.includes(defaultVote)) {
            throw new Error('Bad packed default vote');
        }

        const votes = Object.fromEntries(
            pollDates.map(date => [date, defaultVote])
        );

        let offset = 1;

        while (offset < code.length) {
            const state = code[offset++];

            if (!states.includes(state) || state === defaultVote) {
                throw new Error('Bad packed vote state');
            }

            let count;
            [count, offset] = decodeUint(code, offset);

            if (!count) {
                throw new Error('Empty packed vote group');
            }

            let index;
            [index, offset] = decodeUint(code, offset);

            if (index >= pollDates.length) {
                throw new Error('Packed vote index out of range');
            }

            votes[pollDates[index]] = state;

            for (let i = 1; i < count; i++) {
                let delta;
                [delta, offset] = decodeUint(code, offset);

                // We stored delta - 1.
                index += delta + 1;

                if (index >= pollDates.length) {
                    throw new Error('Packed vote index out of range');
                }

                votes[pollDates[index]] = state;
            }
        }

        return votes;
    }
};

/* Public codec */

const Codec = {
    packedPrefix: '1',

    choose(text, packed, mode) {
        if (mode === 'text') {
            return text;
        }

        if (mode === 'packed') {
            return packed;
        }

        if (mode !== 'auto') {
            throw new Error(`Unknown codec mode: ${mode}`);
        }

        return packed.length < text.length
            ? packed
            : text;
    },

    encodePoll(dates, mode = 'auto') {
        const text =
            TextCodec.encodePoll(dates);

        if (!text) {
            return '';
        }

        const packed =
            this.packedPrefix +
            PackedCodec.encodePoll(dates);

        return this.choose(
            text,
            packed,
            mode
        );
    },

    parsePoll(code) {
        const raw =
            code.replace(/^poll=/, '').trim();

        if (!raw) {
            return [];
        }

        if (raw.startsWith(this.packedPrefix)) {
            return PackedCodec.parsePoll(
                raw.slice(this.packedPrefix.length)
            );
        }

        return TextCodec.parsePoll(raw);
    },

    encodeUser(votes, pollDates, name, mode = 'auto') {
        const text =
            TextCodec.encodeVotes(
                votes,
                pollDates
            );

        const packed =
            this.packedPrefix +
            PackedCodec.encodeVotes(
                votes,
                pollDates
            );

        const payload =
            this.choose(
                text,
                packed,
                mode
            );

        return `${name}=${payload}`;
    },

    parseUser(code, pollDates) {
        const raw = code.trim();

        if (!raw) {
            throw new Error('Empty response');
        }

        if (raw.startsWith(this.packedPrefix)) {
            return PackedCodec.parseVotes(
                raw.slice(this.packedPrefix.length),
                pollDates
            );
        }

        return TextCodec.parseVotes(
            raw,
            pollDates
        );
    }
};

/* URL storage */

class Storage {
    static params() {
        return new URLSearchParams(location.search);
    }

    static queryString(params) {
        return params.toString().replace(/%2C/gi, ',');
    }

    static baseUrl() {
        const url = new URL(location.href);
        url.search = '';
        url.hash = '';
        return url.toString();
    }

    static loadPoll() {
        const params = this.params();

        return params.has('poll')
            ? Codec.parsePoll(params.get('poll'))
            : [];
    }

    static savePoll(code) {
        const params = new URLSearchParams();
        params.set('poll', code);

        const query = this.queryString(params);

        history.replaceState(
            null,
            '',
            `${location.pathname}?${query}`
        );

        return `${this.baseUrl()}?${query}`;
    }

    static users() {
        return [...this.params()].filter(([name]) => name !== 'poll');
    }

    static async replaceUsers(users) {
        const current = this.params();
        const params = new URLSearchParams();

        if (current.has('poll')) {
            params.set('poll', current.get('poll'));
        }

        for (const [name, votes] of users) {
            params.append(name, votes);
        }

        const query = this.queryString(params);

        history.replaceState(
            null,
            '',
            `${location.pathname}${query ? `?${query}` : ''}`
        );
    }

    static parseUsers(text) {
        const users = [];

        // Each line/semicolon may itself contain several &-separated users.
        for (let chunk of text.split(/\n|;/).map(x => x.trim()).filter(Boolean)) {
            // Also accept an entire results URL.
            try {
                chunk = new URL(chunk).search.slice(1);
            } catch {
                if (chunk.startsWith('?')) {
                    chunk = chunk.slice(1);
                }
            }

            const entries = [...new URLSearchParams(chunk)]
                .map(([name, votes]) => [name.trim(), votes.trim()])
                .filter(([name]) => name && name !== 'poll');

            if (!entries.length) {
                throw new Error(`Expected a response like name=y,...: ${chunk}`);
            }

            users.push(...entries);
        }

        return users;
    }
}

/* Calendar */

function renderCalendar(container, dates, cellFn, {
    showAllDays = true
} = {}) {
    container.innerHTML = '';

    if (!dates.length) return;

    const inner = document.createElement('div');
    inner.className = 'months mt';

    const min = dates[0];
    const max = dates[dates.length - 1];
    const dateSet = new Set(dates);

    for (const [year, month] of monthsBetween(dates)) {
        const box = document.createElement('div');
        box.className = 'month';

        const title = document.createElement('h3');
        title.textContent = monthFmt.format(new Date(Date.UTC(year, month, 1)));
        box.appendChild(title);

        const wh = document.createElement('div');
        wh.className = 'weekdays';

        weekdays.forEach(label => {
            const day = document.createElement('div');
            day.textContent = label;
            wh.appendChild(day);
        });

        box.appendChild(wh);

        const grid = document.createElement('div');
        grid.className = 'days';

        const first = new Date(Date.UTC(year, month, 1));
        const offset = (first.getUTCDay() + 6) % 7;

        for (let i = 0; i < offset; i++) {
            const blank = document.createElement('div');
            blank.className = 'day blank';
            grid.appendChild(blank);
        }

        const daysInMonth =
            new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const iso = toISO(new Date(Date.UTC(year, month, day)));
            const candidate = dateSet.has(iso);

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'day';
            btn.dataset.date = iso;
            btn.innerHTML =
                `<span class="num">${day}</span><span class="mini"></span>`;

            if (candidate) {
                btn.classList.add('candidate');
            } else if (!showAllDays || iso < min || iso > max) {
                btn.classList.add('outside');
            }

            cellFn(btn, iso, candidate);
            grid.appendChild(btn);
        }

        box.appendChild(grid);
        inner.appendChild(box);
    }

    container.appendChild(inner);
}


/* Small UI helpers */

function copyText(text) {
    if (navigator.clipboard?.writeText) {
        return navigator.clipboard.writeText(text);
    }

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

    setTimeout(() => {
        button.textContent = old;
    }, 900);
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


/* State */

let pollDates = [];

let createDates = new Set();
let createBounds = null;
let draggingCreate = false;
let createPaintAdd = true;

let voteMap = {};
let paint = 'y';
let voteAnchor = null;
let draggingVote = false;

let backendUsers = [];
let backendPoll = null;
let backendLoadPromise = null;


/* App */

function loadFromUrl() {
    try {
        pollDates = Storage.loadPoll();
    } catch (e) {
        console.error(e);
        pollDates = [];
    }

    voteMap = Object.fromEntries(
        pollDates.map(d => [d, 'y'])
    );

    backendUsers = [];
    backendPoll = null;
    backendLoadPromise = null;
}

function setTab(name) {
    $$('.tabpage').forEach(page =>
        page.classList.toggle('hidden', page.id !== name)
    );

    $$('.tabs button').forEach(button =>
        button.classList.toggle('active', button.dataset.tab === name)
    );

    if (name === 'vote') renderVote();
    if (name === 'results') {
        renderResults();
        loadBackendResults();
    }
}


/* Create */

function renderCreate() {
    const dates = createBounds
        ? eachDay(createBounds[0], createBounds[1])
        : [...createDates].sort();

    const displayDates = [...new Set([...dates, ...createDates])].sort();

    if (!displayDates.length) {
        $('#createCalendar').innerHTML = '';
        return;
    }

    renderCalendar(
        $('#createCalendar'),
        displayDates,
        (btn, iso, inDisplaySet) => {
            if (!inDisplaySet) {
                btn.disabled = true;
                return;
            }

            btn.classList.add('candidate');

            const selected = createDates.has(iso);

            btn.classList.toggle('excluded', !selected);
            $('.mini', btn).textContent =
                selected ? 'included' : 'excluded';

            btn.addEventListener('mousedown', e => {
                if (e.button !== 0) return;

                e.preventDefault();

                draggingCreate = true;
                createPaintAdd = !createDates.has(iso);

                paintCreateDate(iso, createPaintAdd);
            });

            btn.addEventListener('mouseenter', () => {
                if (draggingCreate) {
                    paintCreateDate(iso, createPaintAdd);
                }
            });
        }
    );
}

function paintCreateDate(iso, add) {
    if (add) {
        createDates.add(iso);
    } else {
        createDates.delete(iso);
    }

    renderCreate();
}


/* Vote */

function renderVote() {
    const hasPoll = pollDates.length > 0;

    $('#noPollVote').classList.toggle('hidden', hasPoll);
    $('#voteControls').classList.toggle('hidden', !hasPoll);
    $('#finishVote').disabled = !hasPoll;

    if (!hasPoll) {
        $('#voteCalendar').innerHTML = '';
        return;
    }

    renderCalendar(
        $('#voteCalendar'),
        pollDates,
        (btn, iso, candidate) => {
            if (!candidate) {
                btn.disabled = true;
                return;
            }

            const vote = voteMap[iso] || 'y';
            const label =
                vote === 'y' ? 'yes' :
                vote === 'm' ? 'meh' :
                'no';

            btn.classList.add(`vote-${vote}`);
            $('.mini', btn).textContent = label;
            btn.title = `${fullFmt.format(fromISO(iso))}: ${label}`;

            btn.addEventListener('mousedown', e => {
                if (e.button !== 0) return;

                e.preventDefault();

                if (e.shiftKey && voteAnchor) {
                    paintRange(voteAnchor, iso, paint);
                } else {
                    voteMap[iso] = paint;
                    voteAnchor = iso;
                    draggingVote = true;
                    renderVote();
                }
            });

            btn.addEventListener('mouseenter', () => {
                if (!draggingVote) return;

                voteMap[iso] = paint;
                renderVote();
            });
        },
        {
            showAllDays: false
        }
    );
}

function paintRange(a, b, value) {
    const ia = pollDates.indexOf(a);
    const ib = pollDates.indexOf(b);

    if (ia < 0 || ib < 0) return;

    const [lo, hi] = ia < ib
        ? [ia, ib]
        : [ib, ia];

    for (let i = lo; i <= hi; i++) {
        voteMap[pollDates[i]] = value;
    }

    voteAnchor = b;
    renderVote();
}


/* Results */

function renderResults() {
    const hasPoll = pollDates.length > 0;

    $('#noPollResults').classList.toggle('hidden', hasPoll);
    $('#resultsControls').classList.toggle('hidden', !hasPoll);
    $('#usersPanel').classList.toggle('hidden', !hasPoll);

    if (!hasPoll) {
        $('#resultsCalendar').innerHTML = '';
        return;
    }

    const localCodes = Storage.users();
    const localKeys = new Set(
        localCodes.map(([name, votes]) => `${name}\0${votes}`)
    );
    const codes = [
        ...localCodes.map(code => ({ code, local: true })),
        ...backendUsers
            .filter(([name, votes]) => !localKeys.has(`${name}\0${votes}`))
            .map(code => ({ code, local: false }))
    ];
    const parsed = [];
    const validCodes = [];
    const names = [];

    for (const { code: [name, votes], local } of codes) {
        try {
            parsed.push(Codec.parseUser(votes, pollDates));
            names.push(name);
            validCodes.push({ code: [name, votes], local });
        } catch (e) {
            console.warn(
                'Skipping invalid user code',
                `${name}=${votes}`,
                e
            );
        }
    }

    // Also removes malformed users from the URL.
    const validLocalCodes = validCodes
        .filter(entry => entry.local)
        .map(entry => entry.code);

    if (validLocalCodes.length !== localCodes.length) {
        Storage.replaceUsers(validLocalCodes);
    }

    const list = $('#userList');
    list.innerHTML = '';

    if (!validCodes.length) {
        list.textContent = 'No responses yet.';
    }

    validCodes.forEach(({ code: [name, code], local }) => {
        const row = document.createElement('div');
        row.className = 'userrow';
		
		const textCode = TextCodec.encodeVotes(parsed[i], pollDates);

        row.innerHTML =
            `<strong>${escapeHtml(name)}</strong>` +
            `<code>${escapeHtml(textCode)}</code>` +
            (local
                ? '<button class="btn danger">Remove</button>'
                : '<span class="muted">Synced</span>');

        if (local) $('button', row).addEventListener('click', () => {
            const next = [...validLocalCodes];
            const localIndex = next.findIndex(
                ([localName, localCode]) =>
                    localName === name && localCode === code
            );

            if (localIndex >= 0) next.splice(localIndex, 1);

            Storage.replaceUsers(next);
            renderResults();
        });

        list.appendChild(row);
    });

    renderCalendar(
        $('#resultsCalendar'),
        pollDates,
        (btn, iso, candidate) => {
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

            $('.mini', btn).textContent = parsed.length
                ? `✓${counts.y}  ~${counts.m}  ×${counts.n}`
                : 'no votes';

            const total = Math.max(1, parsed.length);
            const bars = document.createElement('div');
            bars.className = 'bars';

            for (const state of ['y', 'm', 'n']) {
                const span = document.createElement('span');

                span.className = state;
                span.style.flex = String(counts[state] / total);

                if (!counts[state]) {
                    span.style.display = 'none';
                }

                bars.appendChild(span);
            }

            btn.appendChild(bars);

            const labels = parsed.map((votes, i) => {
                const vote = votes[iso];
                const label =
                    vote === 'y' ? 'yes' :
                    vote === 'm' ? 'meh' :
                    'no';

                return `${escapeHtml(names[i])}: ${label}`;
            });

            btn.title =
                `${fullFmt.format(fromISO(iso))}\n` +
                (labels.length
                    ? labels.join('\n')
                    : 'No responses');
        },
        {
            showAllDays: false
        }
    );
}

async function loadBackendResults() {
    const poll = Storage.params().get('poll');

    if (!poll || backendPoll === poll || backendLoadPromise) return;

    const request = Backend.results(poll);
    backendLoadPromise = request;

    try {
        const data = await request;

        if (Storage.params().get('poll') !== poll) return;

        if (!Array.isArray(data.votes)) {
            throw new Error('Daypoll backend returned invalid results');
        }

        backendUsers = data.votes
            .filter(vote =>
                vote &&
                typeof vote.name === 'string' &&
                typeof vote.votes === 'string'
            )
            .map(vote => [vote.name, vote.votes]);
        backendPoll = poll;
        renderResults();
    } catch (e) {
        console.warn('Could not load votes from the Daypoll backend.', e);
    } finally {
        if (backendLoadPromise === request) {
            backendLoadPromise = null;
        }
    }
}


/* Events */

$$('.tabs button').forEach(button =>
    button.addEventListener('click', () =>
        setTab(button.dataset.tab)
    )
);

document.addEventListener('mouseup', () => {
    draggingVote = false;
    draggingCreate = false;
});


$('#loadRange').addEventListener('click', () => {
    const start = $('#startDate').value;
    const end = $('#endDate').value;

    if (!start || !end || start > end) {
        $('#createHint').textContent =
            'Choose a valid start and end date.';
        return;
    }

    createBounds = [start, end];
    createDates = new Set(eachDay(start, end));

    $('#createHint').textContent =
        'Click or drag to exclude days.';

    renderCreate();
});


$('#createPoll').addEventListener('click', () => {
    const code = Codec.encodePoll([...createDates]);

    if (!code) {
        $('#createHint').textContent =
            'Include at least one candidate day.';
        return;
    }

    const url = Storage.savePoll(code);

    $('#pollUrl').textContent = url;
    $('#pollOutputWrap').classList.remove('hidden');

    loadFromUrl();
});


$('#copyPollUrl').addEventListener('click', async e => {
	const btn = e.currentTarget;
	await copyText($('#pollUrl').textContent);
    flash(btn);
});


$$('.paint').forEach(button =>
    button.addEventListener('click', () => {
        paint = button.dataset.v;

        $$('.paint').forEach(other =>
            other.classList.toggle('active', other === button)
        );
    })
);


$('#setAllYes').addEventListener('click', () => {
    pollDates.forEach(d => {
        voteMap[d] = 'y';
    });

    renderVote();
});


$('#setAllMeh').addEventListener('click', () => {
    pollDates.forEach(d => {
        voteMap[d] = 'm';
    });

    renderVote();
});


$('#setAllNo').addEventListener('click', () => {
    pollDates.forEach(d => {
        voteMap[d] = 'n';
    });

    renderVote();
});


$('#finishVote').addEventListener('click', () => {
    if (!pollDates.length) return;

    const name = $('#username').value.trim() || 'anonymous';
    const code = Codec.encodeUser(voteMap, pollDates, name);

    $('#voteCode').textContent = code;
    $('#voteOutputWrap').classList.remove('hidden');

    const poll = Storage.params().get('poll');
    const votes = code.slice(name.length + 1);

    if (poll) {
        Backend.submitVote(poll, name, votes)
            .then(() => {
                backendUsers = [
                    ...backendUsers.filter(([savedName]) => savedName !== name),
                    [name, votes]
                ];
                backendPoll = poll;

                if (!$('#results').classList.contains('hidden')) {
                    renderResults();
                }
            })
            .catch(e => {
                console.warn('Could not save vote to the Daypoll backend.', e);
            });
    }
});


$('#copyVoteCode').addEventListener('click', async e => {
	const btn = e.currentTarget;
    await copyText($('#voteCode').textContent);
    flash(btn);
});


$('#addUsers').addEventListener('click', () => {
    const input = $('#addUsersText');
    const text = input.value.trim();

    if (!text) return;

    let additions;

    try {
        additions = Storage.parseUsers(text);
    } catch (e) {
        alert(e.message);
        return;
    }

    const valid = [];

    for (const [name, votes] of additions) {
        try {
            Codec.parseUser(votes, pollDates);
            valid.push([name, votes]);
        } catch (e) {
            alert(
                `Could not parse: ${name}=${votes}\n${e.message}`
            );
        }
    }

    if (!valid.length) return;

    Storage.replaceUsers([
        ...Storage.users(),
        ...valid
    ]);

    input.value = '';
    renderResults();
});


$('#copyResultsUrl').addEventListener('click', async e => {
	const btn = e.currentTarget;
    await copyText(location.href);
    flash(btn);
});


/* Initialize */

const today = new Date();

const localToday =
    `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const inSixWeeks = new Date(today);
inSixWeeks.setDate(inSixWeeks.getDate() + 42);

const localEnd =
    `${inSixWeeks.getFullYear()}-${pad(inSixWeeks.getMonth() + 1)}-${pad(inSixWeeks.getDate())}`;

$('#startDate').value = localToday;
$('#endDate').value = localEnd;

loadFromUrl();

setTab(
    Storage.users().length
        ? 'results'
        : pollDates.length
            ? 'vote'
            : 'create'
);
