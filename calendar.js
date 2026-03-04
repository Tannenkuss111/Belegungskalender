
// Sprache automatisch (DE/EN)
const LANG = navigator.language && navigator.language.startsWith("de") ? "de-DE" : "en-US";
const WEEKDAYS = LANG === "de-DE"
  ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
  : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Einstellungen
const MIN_NIGHTS = 2;

// Hilfsfunktionen
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const pad2 = (n) => String(n).padStart(2, "0");
const toISO = (date) => `${date.getFullYear()}-${pad2(date.getMonth()+1)}-${pad2(date.getDate())}`;
function parseISO(iso){ const [y,m,d]=iso.split("-").map(Number); return new Date(y, m-1, d); }
function daysDiff(a,b){ const a0=new Date(a.getFullYear(),a.getMonth(),a.getDate()); const b0=new Date(b.getFullYear(),b.getMonth(),b.getDate()); return Math.round((b0-a0)/MS_PER_DAY); }
function enumerateDates(start,end){ const out=[]; let cur=new Date(start.getFullYear(),start.getMonth(),start.getDate()); const last=new Date(end.getFullYear(),end.getMonth(),end.getDate()); while(cur<=last){ out.push(new Date(cur)); cur.setDate(cur.getDate()+1);} return out; }

// Blocked-Ranges laden (immer frisch, mit Cache-Bust)
async function loadBlocked() {
  const res = await fetch("blocked.json?v=7", { cache: "no-store" });
  const data = await res.json(); // { ranges: [{start,end}, ...] }
  return data.ranges.map(r => [parseISO(r.start), parseISO(r.end)]);
}
function isBlocked(date, blocks) { return blocks.some(([s,e]) => date >= s && date <= e); }
function pathHasBlocked(start, end, blocks) { return enumerateDates(start,end).some(d => isBlocked(d, blocks)); }

// Rendering
function renderMonth(container, year, month, blocks, onDayClick) {
  const section = document.createElement("section");
  section.className = "month";
  section.id = `${year}-${pad2(month+1)}`; // für Jump-Link

  const title = document.createElement("h2");
  title.textContent = new Date(year, month).toLocaleString(LANG, { month: "long", year: "numeric" });
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
  const last  = new Date(year, month+1, 0);
  const offset = (first.getDay() + 6) % 7; // Montag=0

  for (let i=0;i<offset;i++) grid.appendChild(document.createElement("div"));

  for (let d=1; d<=last.getDate(); d++) {
    const date = new Date(year, month, d);
    const cell = document.createElement("div");
    const blocked = isBlocked(date, blocks);
    cell.className = "day " + (blocked ? "blocked" : "free");
    cell.textContent = d;
    cell.dataset.date = toISO(date);

    if (!blocked) {
      cell.tabIndex = 0;
      cell.setAttribute("role", "button");
      cell.setAttribute("aria-label", (LANG==="de-DE" ? "Datum auswählen " : "Select date ") + cell.dataset.date);
      cell.addEventListener("click", () => onDayClick(cell.dataset.date));
      cell.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDayClick(cell.dataset.date); }
      });
    } else {
      cell.setAttribute("aria-disabled", "true");
    }
    grid.appendChild(cell);
  }

  section.appendChild(grid);
  container.appendChild(section);
}

// Auswahl-Visualisierung
function clearSelectionVisual() {
  document.querySelectorAll(".day.sel-start, .day.sel-end, .day.sel-inrange").forEach(el => {
    el.classList.remove("sel-start","sel-end","sel-inrange");
    el.removeAttribute("data-badge");
  });
}
function applySelectionVisual(startISO, endISO) {
  clearSelectionVisual();
  if (!startISO) return;

  const allDays = Array.from(document.querySelectorAll(".day.free, .day.blocked"));
  const start = parseISO(startISO);
  const end = endISO ? parseISO(endISO) : null;

  const startCell = allDays.find(c => c.dataset.date === startISO);
  if (startCell) { startCell.classList.add("sel-start"); startCell.setAttribute("data-badge", LANG==="de-DE" ? "A" : "CI"); }

  if (!end) return;

  const endCell = allDays.find(c => c.dataset.date === endISO);
  if (endCell) { endCell.classList.add("sel-end"); endCell.setAttribute("data-badge", LANG==="de-DE" ? "E" : "CO"); }

  const [from, to] = start <= end ? [start, end] : [end, start];
  allDays.forEach(c => {
    const d = parseISO(c.dataset.date);
    if (d > from && d < to) c.classList.add("sel-inrange");
  });
}

function setMessage(msg, type="info") {
  const el = document.getElementById("selection-message");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("error", "info");
  el.classList.add(type);
}

function fillForm(arrivalISO, departureISO) {
  const inArrival = document.querySelector('input[name="arrival"]');
  const inDeparture = document.querySelector('input[name="departure"]');
  if (!inArrival || !inDeparture) return;
  inArrival.value = arrivalISO || "";
  inDeparture.value = departureISO || "";
}

// Hauptlogik
(async function init(){
  const blocks = await loadBlocked();
  const container = document.getElementById("calendar");

  // Monate rendern (rollend 18)
  const today = new Date();
  const months = 18;
  const handleClick = (iso) => onDayClick(iso, blocks);
  for (let i = 0; i < months; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    renderMonth(container, d.getFullYear(), d.getMonth(), blocks, handleClick);
  }

  // Jump-Link auf aktuellen Monat setzen
  const jump = document.getElementById("jumpCurrent");
  if (jump) {
    const id = `${today.getFullYear()}-${pad2(today.getMonth()+1)}`;
    jump.href = `#${id}`;
  }

  // Sichtbarkeits-Animation
  const monthsEls = document.querySelectorAll('.month');
  if (!('IntersectionObserver' in window) || monthsEls.length === 0) {
    monthsEls.forEach(m => m.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('is-visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    monthsEls.forEach(m => io.observe(m));
  }

  // Auswahlstatus
  let startISO = null;
  let endISO = null;

  // Reset-Button
  const resetBtn = document.getElementById("resetSelection");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    startISO = null; endISO = null;
    clearSelectionVisual();
    fillForm("", "");
    setMessage(LANG==="de-DE" ? "Bitte Anreisetag wählen." : "Please select check-in date.", "info");
  });

  // Start-Hinweis
  setMessage(LANG==="de-DE" ? "Bitte Anreisetag wählen." : "Please select check-in date.", "info");

  // Klick-Handler
  function onDayClick(iso, blocks) {
    const clicked = parseISO(iso);

    // Falls keine Auswahl oder bereits abgeschlossen -> Start neu setzen
    if (!startISO || (startISO && endISO)) {
      startISO = iso; endISO = null;
      applySelectionVisual(startISO, null);
      fillForm(startISO, "");
      setMessage(LANG==="de-DE"
        ? `Anreise gewählt. Bitte Abreisetag wählen (mind. ${MIN_NIGHTS} Nächte).`
        : `Check-in chosen. Please pick check-out (min ${MIN_NIGHTS} nights).`, "info");
      return;
    }

    const start = parseISO(startISO);
    if (clicked <= start) {
      // Vor Start geklickt -> Auswahl neu beginnen
      startISO = iso; endISO = null;
      applySelectionVisual(startISO, null);
      fillForm(startISO, "");
      setMessage(LANG==="de-DE"
        ? `Anreise geändert. Bitte Abreisetag wählen (mind. ${MIN_NIGHTS} Nächte).`
        : `Check-in changed. Please select check-out (min ${MIN_NIGHTS} nights).`, "info");
      return;
    }

    const nights = daysDiff(start, clicked);
    if (nights < MIN_NIGHTS) {
      setMessage(
        LANG==="de-DE"
          ? `Mindestens ${MIN_NIGHTS} Nächte. Bitte ein späteres Abreisedatum wählen.`
          : `Minimum ${MIN_NIGHTS} nights. Please choose a later check-out.`,
        "error"
      );
      return;
    }

    if (pathHasBlocked(start, clicked, blocks)) {
      setMessage(
        LANG==="de-DE"
          ? "Dieser Zeitraum enthält belegte Tage. Bitte anderen Abreisetag wählen."
          : "This range includes booked days. Please choose a different check-out.",
        "error"
      );
      return;
    }

    endISO = iso;
    applySelectionVisual(startISO, endISO);
    fillForm(startISO, endISO);
    setMessage(
      LANG==="de-DE"
        ? `Auswahl: ${startISO} bis ${endISO} (${nights} Nächte).`
        : `Selected: ${startISO} to ${endISO} (${nights} nights).`,
      "info"
    );

    const form = document.querySelector("form");
    if (form && form.scrollIntoView) form.scrollIntoView({ behavior: "smooth", block: "start" });
  }
})();
