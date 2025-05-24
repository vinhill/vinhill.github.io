// index.js – modularised & commented React 18 client (no build-step)
// -----------------------------------------------------------------
// • Fetches timetable.json
// • Normalises over-midnight sets so 01:00 appears after 23:00
// • Generates a 15-minute CSS-grid timetable
// • Stores selection in ?sel=0.3.42 numeric param (stable across reloads)
// -----------------------------------------------------------------

// --- helpers -----------------------------------------------------
const mins = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/**
 * Given raw timetable JSON, return a deep-cloned enhanced timetable
 *   – adds numeric start/end (absolute minutes since pivot)
 *   – adds stable numeric id per performance (natural order)
 *   – returns { days, minTime, maxTime }
 */
function preprocessTimetable(raw) {
  let id = 0;

  // find pivot (first daytime start >= 06:00) across ALL days
  const starts = raw.days.flatMap((d) =>
    d.stages.flatMap((s) => s.events.map((e) => mins(e.start)))
  );
  const pivot = Math.min(...starts.filter((m) => m >= 360));
  const adjust = (m) => (m < pivot ? m + 1440 : m);

  const days = raw.days.map((d) => ({
    ...d,
    stages: d.stages.map((s) => ({
      ...s,
      events: s.events.map((e) => {
        const startM = adjust(mins(e.start));
        const endM = adjust(mins(e.end));
        return { ...e, id: id++, startM, endM };
      }),
    })),
  }));

  const allMinutes = days.flatMap((d) =>
    d.stages.flatMap((s) => s.events.flatMap((e) => [e.startM, e.endM]))
  );

  return {
    days,
    minTime: Math.min(...allMinutes),
    maxTime: Math.max(...allMinutes),
  };
}

/** hook to keep a states array in sync with ?sel and ?sel2 URL params (backwards compatible with sel-b) */
function useUrlStates(maxId) {
  const [states, setStates] = React.useState(() => {
    const p = new URLSearchParams(location.search);
    const sel1raw = p.get("sel") || "";
    const sel2raw = p.get("sel2") || "";
    const sel1 = new Set(sel1raw ? sel1raw.split(".").map(Number) : []);
    const sel2 = new Set(sel2raw ? sel2raw.split(".").map(Number) : []);
    // states[id] = 0 (none), 1 (sel), 2 (sel2)
    const arr = Array(maxId + 1).fill(0);
    sel1.forEach(id => { if (id <= maxId) arr[id] = 1; });
    sel2.forEach(id => { if (id <= maxId) arr[id] = 2; });
    return arr;
  });

  React.useEffect(() => {
    const sel1 = [];
    const sel2 = [];
    states.forEach((v, i) => { if (v === 1) sel1.push(i); else if (v === 2) sel2.push(i); });
    const p = new URLSearchParams(location.search);
    p.set("sel", sel1.join("."));
    p.set("sel2", sel2.join("."));
    history.replaceState(null, "", "?" + p.toString());
  }, [states]);

  return [states, setStates];
}

// --- UI components ----------------------------------------------
function TimeAxis({ totalRows, minTime }) {
  return React.createElement(
    "div",
    {
      className: "time-col",
      style: { gridTemplateRows: `repeat(${totalRows}, var(--row-height))` },
    },
    Array.from({ length: totalRows }, (_, i) => {
      const m = minTime + i * 15;
      return m % 60 === 0
        ? React.createElement(
            "div",
            { className: "time-label", key: i },
            `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:00`
          )
        : React.createElement("div", { key: i });
    })
  );
}

function Event({ event, minTime, state, toggle }) {
  const rowStart = Math.floor((event.startM - minTime) / 15) + 1;
  const rowEnd   = Math.floor((event.endM   - minTime) / 15) + 1;
  const className = state === 1 ? "event sel1" : state === 2 ? "event sel2" : "event";
  return React.createElement(
    "div",
    {
      className,
      style: { gridRow: `${rowStart} / ${rowEnd}` },
      onClick: () => toggle(event.id, state),
    },
    [
      React.createElement("div", { key: "artist", className: "event-artist" }, event.artist),
      React.createElement(
        "div",
        { key: "time", className: "event-time" },
        `${event.start} – ${event.end}`
      ),
    ]
  );
}

function StageColumn({ stage, totalRows, minTime, states, toggle }) {
  return React.createElement(
    "div",
    {
      className: "stage-col",
      key: stage.name,
      style: { gridTemplateRows: `repeat(${totalRows}, var(--row-height))` },
    },
    stage.events.map(
      (ev) =>
        new Event({ event: ev, minTime, state: states[ev.id], toggle })
    )
  );
}

function Day({ day, totalRows, minTime, states, toggle }) {
  return React.createElement(
    "div",
    { className: "day", key: day.date, style: { "--rows": totalRows } },
    [
      React.createElement(
        "div",
        { className: "day-header", key: "h" },
        day.label
      ),
      React.createElement("div", { style: { display: "flex" }, key: "body" }, [
        React.createElement(TimeAxis, { totalRows, minTime, key: "axis" }),
        day.stages.map((s) =>
          React.createElement(StageColumn, {
            stage: s,
            totalRows,
            minTime,
            states,
            toggle,
            key: s.name,
          })
        ),
      ]),
    ]
  );
}

// --- main App ----------------------------------------------------
function App({ data }) {
  const { days, minTime, maxTime } = data;
  const totalRows = Math.ceil((maxTime - minTime) / 15);
  // Find max event id
  const maxId = Math.max(...days.flatMap(d => d.stages.flatMap(s => s.events.map(e => e.id))));
  const [states, setStates] = useUrlStates(maxId);
  const toggle = (id, state) => {
    setStates(arr => {
      const next = arr.slice();
      next[id] = (state + 1) % 3; // cycle through 0 → 1 → 2 → 0
      return next;
    });
  };
  return React.createElement(
    "div",
    { id: "grid" },
    days.map((d) =>
      React.createElement(Day, {
        day: d,
        totalRows,
        minTime,
        states,
        toggle,
        key: d.date,
      })
    )
  );
}

// --- bootstrap ---------------------------------------------------
(async () => {
  const raw = await fetch("timetable.json").then((r) => r.json());
  const data = preprocessTimetable(raw);
  ReactDOM.createRoot(document.getElementById("app")).render(
    React.createElement(App, { data })
  );
})();
