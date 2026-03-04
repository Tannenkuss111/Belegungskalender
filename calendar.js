
// Sprache automatisch (DE/EN)
const LANG = navigator.language && navigator.language.startsWith("de") ? "de-DE" : "en-US";
const WEEKDAYS = LANG === "de-DE"
  ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
  : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Belegte Zeiträume laden (immer frisch, mit Cache-Bust)
async function loadBlocked() {
  const res = await fetch("blocked.json?v=3", { cache: "no-store" });
  const data = await res.json();
  return data.ranges.map(r => [new Date(r.start), new Date(r.end)]);
}

function isBlocked(date, blocks) {
  return blocks.some(([s, e]) => date >= s && date <= e);
}

function renderMonth(container, year, month, blocks) {
  const section = document.createElement("section");
  section.className = "month";

  const title = document.createElement("h2");
  title.textContent = new Date(year, month).toLocaleString(LANG, {
    month: "long", year: "numeric"
  });
  section.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  WEEKDAYS.forEach(w => {
    const wd = document.createElement("div");
    wd.className = "weekday";
    wd.textContent = w;
    grid.appendChild(wd);
  });

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const offset = (first.getDay() + 6) % 7; // Mo=0 ... So=6

  for (let i = 0; i < offset; i++) {
    grid.appendChild(document.createElement("div"));
  }

  for (let d = 1; d <= last.getDate(); d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement("div");
    cell.className = "day " + (isBlocked(date, blocks) ? "blocked" : "free");
    cell.textContent = d;
    grid.appendChild(cell);
  }

  section.appendChild(grid);
  container.appendChild(section);
}

(async function init(){
  const blocks = await loadBlocked();
  const container = document.getElementById("calendar");

  const today = new Date();
  const months = 12; // rollend 12 Monate anzeigen

  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    renderMonth(container, d.getFullYear(), d.getMonth(), blocks);
  }

  // --- Sanfte Sichtbarkeits-Animation der Monatsblöcke ---
  const monthsEls = document.querySelectorAll('.month');
  if (!('IntersectionObserver' in window) || monthsEls.length === 0) {
    monthsEls.forEach(m => m.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  monthsEls.forEach(m => io.observe(m));
})();
