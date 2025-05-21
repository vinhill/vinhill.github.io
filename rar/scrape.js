(() => {
  /* Rock am Ring 2025 timetable scraper – works with the 2025-05 markup
     Paste this on https://www.rock-am-ring.com/timetable & hit Enter. */

  // Helper – return array version of NodeList
  const $all = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  // Map day-number ("6","7","8") to a proper ISO date string
  const makeDate = (num) => `2025-06-${String(num).padStart(2, "0")}`;

  const days = $all(".timetable_day").map((dayEl) => {
    const dayNum = dayEl.dataset.day; // "6", "7", "8"
    const date = makeDate(dayNum);
    const label =
      document
        .querySelector(`button[data-date="${dayNum}"]`)
        ?.textContent.trim() || date;

    // Performance stages live ONLY in timetable_content (not header) and have .timetable_stage_performances inside.
    const stages = $all(".timetable_stage", dayEl)
      .filter((s) => s.querySelector(".timetable_stage_performances"))
      .map((stageEl) => {
        const name = stageEl
          .querySelector(".timetable_stage_name span")
          ?.textContent.trim();

        const events = $all(
          ".timetable_stage_performancegrid_performance",
          stageEl
        ).map((evEl) => {
          const artist = evEl
            .querySelector(".timetable_stage_performance_label")
            ?.textContent.trim();
          const [start, end] = (
            evEl
              .querySelector(".timetable_stage_performance_time")
              ?.textContent.trim() || ""
          )
            .split(" - ")
            .map((t) => t.trim());
          return { artist, start, end };
        });
        return { name, events };
      });
    return { date, label, stages };
  });

  const json = JSON.stringify({ days }, null, 2);
  console.log(json);
  navigator.clipboard?.writeText(json);
})();
