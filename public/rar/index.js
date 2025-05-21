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

/** hook to keep Set<number> synced with ?sel URL param */
function useUrlSelection() {
  const [sel, setSel] = React.useState(() => {
    const p = new URLSearchParams(location.search).get("sel");
    return new Set(p ? p.split(".").map(Number) : []);
  });

  React.useEffect(() => {
    const p = new URLSearchParams(location.search);
    sel.size ? p.set("sel", [...sel].join(".")) : p.delete("sel");
    history.replaceState(null, "", "?" + p.toString());
  }, [sel]);

  return [sel, setSel];
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

function Event({ event, minTime, selected, onToggle }) {
  const rowStart = Math.floor((event.startM - minTime) / 15) + 1;
  const rowEnd   = Math.floor((event.endM   - minTime) / 15) + 1;

  return React.createElement(
    "div",
    {
      className: selected ? "event selected" : "event",
      style: { gridRow: `${rowStart} / ${rowEnd}` },
      onClick: () => onToggle(event.id),
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

function StageColumn({ stage, totalRows, minTime, sel, toggle }) {
  return React.createElement(
    "div",
    {
      className: "stage-col",
      key: stage.name,
      style: { gridTemplateRows: `repeat(${totalRows}, var(--row-height))` },
    },
    stage.events.map(
      (ev) =>
        new Event({ event: ev, minTime, selected: sel.has(ev.id), toggle })
    )
  );
}

function Day({ day, totalRows, minTime, sel, toggle }) {
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
            sel,
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
  const [sel, setSel] = useUrlSelection();
  const toggle = (id) =>
    setSel((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  return React.createElement(
    "div",
    { id: "grid" },
    days.map((d) =>
      React.createElement(Day, {
        day: d,
        totalRows,
        minTime,
        sel,
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
