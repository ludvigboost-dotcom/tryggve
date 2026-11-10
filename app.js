const TAG_COLORS = {
  production: "#e0a526",
  ai: "#3aa17e",
  weapons: "#c8453b",
  aerospace: "#3b7dd8",
  energy: "#d6559a",
};

const TAG_LABELS = {
  production: "Produktionsteknik",
  ai: "AI",
  weapons: "Vapen",
  aerospace: "Flyg",
  energy: "Energi och råvaror",
};

// White glyphs drawn inside the markers, 24x24 viewBox.
const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true">${body}</svg>`;
const TAG_ICONS = {
  production: svg('<path fill="#fff" d="M2 21V11l5.5 3.5V11l5.5 3.5V4h3.5l1 6H22v11z"/>'),
  ai: svg(
    '<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">' +
      '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="10" y="10" width="4" height="4" fill="#fff" stroke="none"/>' +
      '<path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/></g>'
  ),
  weapons: svg(
    '<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">' +
      '<circle cx="12" cy="12" r="7"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/></g>' +
      '<circle cx="12" cy="12" r="1.8" fill="#fff"/>'
  ),
  aerospace: svg(
    '<path fill="#fff" d="M12 2c1 0 1.6 1 1.6 2.2V9l7.4 4.3v2.2l-7.4-2.2v4.3l2.2 1.6V21L12 20l-3.8 1v-1.8l2.2-1.6v-4.3L3 15.5v-2.2L10.4 9V4.2C10.4 3 11 2 12 2z"/>'
  ),
  energy: svg('<path fill="#fff" d="M13.5 2 4 14h7l-1.5 8L19 10h-7z"/>'),
};
const EVENT_ICON = svg(
  '<g fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round">' +
    '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></g>'
);
// Below this marker size the glyph is too small to read, so only the colour shows.
const MIN_ICON_SIZE = 16;

const BAND_LABELS = {
  "<10m": "<$10M",
  "10-100m": "$10–100M",
  "100m-1b": "$100M–1B",
  ">1b": ">$1B",
};

const REGIONS = {
  usa: [[24.5, -125], [49.5, -66.9]],
  west: [[32, -125], [49, -114]],
  south: [[25.8, -106.7], [36.5, -93.5]],
  midwest: [[36, -104], [49, -84]],
  east: [[38.5, -80.5], [47.5, -66.9]],
  southeast: [[24.5, -91], [36.5, -75]],
};

const map = L.map("map", {
  minZoom: 3,
  maxBounds: [[15, -180], [75, -60]],
});
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors",
  maxZoom: 19,
}).addTo(map);

const POPUP_OPTIONS = { minWidth: 320, maxWidth: 420, autoPan: false };
const HOVER_CLOSE_DELAY = 300;

// Opens the popup on hover and keeps it open while the cursor is over the
// marker or the popup itself, so links inside it can be clicked. A popup
// opened by clicking (or from the list) stays until closed normally.
function bindHoverPopup(marker, html) {
  let closeTimer;
  let hovering = false;
  let pinned = false;
  const cancelClose = () => clearTimeout(closeTimer);
  const scheduleClose = () => {
    cancelClose();
    if (!pinned) closeTimer = setTimeout(() => marker.closePopup(), HOVER_CLOSE_DELAY);
  };

  marker.bindPopup(html, POPUP_OPTIONS);
  marker.on("mouseover", () => {
    hovering = true;
    cancelClose();
    marker.openPopup();
  });
  marker.on("mouseout", () => {
    hovering = false;
    scheduleClose();
  });
  marker.on("click", () => {
    pinned = true;
    marker.openPopup();
  });
  marker.on("popupopen", (e) => {
    if (!hovering) pinned = true;
    const el = e.popup.getElement();
    if (!el.dataset.hoverBound) {
      el.dataset.hoverBound = "1";
      el.addEventListener("mouseenter", cancelClose);
      el.addEventListener("mouseleave", scheduleClose);
    }
  });
  marker.on("popupclose", () => {
    pinned = false;
    cancelClose();
  });
  return marker;
}
map.fitBounds(REGIONS.usa);

const markerLayer = L.layerGroup().addTo(map);
const countEl = document.getElementById("count");
const listEl = document.getElementById("list");
const bandMinEl = document.getElementById("band-min");
const bandMaxEl = document.getElementById("band-max");
const bandFillEl = document.getElementById("band-fill");
const bandLabelEls = [...document.querySelectorAll("#band-labels span")];
const BAND_ORDER = Object.keys(BAND_LABELS);

const BAND_SIZES = {
  "<10m": 12,
  "10-100m": 20,
  "100m-1b": 32,
  ">1b": 48,
};

const MIN_SIZE = 10;
const NEST_STEP = 8;

let companies = [];
let visible = [];
const markers = new Map();

function createIcon(company, size) {
  const tag = company.tags[0];
  const adjacent = company.adjacent ? " adjacent" : "";
  const icon = size >= MIN_ICON_SIZE ? TAG_ICONS[tag] : "";
  return L.divIcon({
    className: "",
    html: `<div class="marker${adjacent}" style="background:${TAG_COLORS[tag]};width:${size}px;height:${size}px">${icon}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function createPopup(company) {
  const tags = company.tags.map((t) => TAG_LABELS[t]).join(", ");
  const note = company.adjacent ? "<p><em>Näraliggande, inte strikt defense</em></p>" : "";
  return `
    <div class="popup">
      <h3>${company.name}</h3>
      <p>${company.city}</p>
      <p>${tags}</p>
      <p>Omsättning (est.): ${BAND_LABELS[company.revenueBand]}</p>
      <p>${company.description}</p>
      ${note}
      <p><a href="${company.url}" target="_blank" rel="noopener">Webbplats</a></p>
    </div>`;
}

const eventLayer = L.layerGroup().addTo(map);
const eventsEl = document.getElementById("events");
const showEventsEl = document.getElementById("show-events");

let events = [];
const eventMarkers = new Map();

function formatDates(event) {
  if (!event.startDate) return event.dateNote;
  const start = new Date(`${event.startDate}T00:00:00`);
  const end = new Date(`${event.endDate}T00:00:00`);
  const month = (d) => d.toLocaleDateString("sv-SE", { month: "long" });
  const range =
    start.getMonth() === end.getMonth()
      ? `${start.getDate()}–${end.getDate()} ${month(end)}`
      : `${start.getDate()} ${month(start)}–${end.getDate()} ${month(end)}`;
  const note = event.dateNote ? ` (${event.dateNote})` : "";
  return `${range} ${end.getFullYear()}${note}`;
}

function createEventIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="event-marker">${EVENT_ICON}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

function createEventPopup(event) {
  return `
    <div class="popup">
      <h3>${event.name}</h3>
      <p>${event.city}</p>
      <p>${formatDates(event)}</p>
      <p>${event.description}</p>
      <p><a href="${event.url}" target="_blank" rel="noopener">Webbplats</a></p>
    </div>`;
}

function renderEvents() {
  eventLayer.clearLayers();
  if (showEventsEl.checked) events.forEach((e) => eventLayer.addLayer(eventMarkers.get(e)));

  eventsEl.innerHTML = "";
  events.forEach((e) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="name">${e.name}</div><div class="meta">${e.city} · ${formatDates(e)}</div>`;
    li.addEventListener("click", () => focusEvent(e));
    eventsEl.appendChild(li);
  });
}

function focusEvent(event) {
  if (!showEventsEl.checked) {
    showEventsEl.checked = true;
    renderEvents();
  }
  flyToAndOpen(eventMarkers.get(event));
}

// Blobs whose centre lies inside a larger blob at the current zoom are shrunk
// and drawn on top, so nearby companies nest instead of merging into one.
function updateSizes() {
  const zoom = map.getZoom();
  const placed = [];
  const byBase = [...visible].sort((a, b) => BAND_SIZES[b.revenueBand] - BAND_SIZES[a.revenueBand]);

  byBase.forEach((c) => {
    const point = map.project([c.lat, c.lng], zoom);
    const parents = placed.filter((p) => p.point.distanceTo(point) < p.size / 2);
    let size = BAND_SIZES[c.revenueBand];
    if (parents.length) {
      const smallest = Math.min(...parents.map((p) => p.size));
      size = Math.max(MIN_SIZE, Math.min(size, smallest - NEST_STEP));
    }
    placed.push({ point, size });

    const marker = markers.get(c);
    marker.setIcon(createIcon(c, size));
    marker.setZIndexOffset(-size * 10);
  });
}

function flyToAndOpen(marker) {
  map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 8));
  map.once("moveend", () => marker.openPopup());
}

function checkedValues(selector) {
  return [...document.querySelectorAll(`${selector}:checked`)].map((el) => el.value);
}

function selectedBands() {
  return BAND_ORDER.slice(Number(bandMinEl.value), Number(bandMaxEl.value) + 1);
}

// Keeps the thumbs from crossing and redraws the highlighted part of the track.
function updateBandSlider(moved) {
  let min = Number(bandMinEl.value);
  let max = Number(bandMaxEl.value);
  if (min > max) {
    if (moved === bandMinEl) bandMinEl.value = min = max;
    else bandMaxEl.value = max = min;
  }
  const last = BAND_ORDER.length - 1;
  bandFillEl.style.left = `calc(8px + (100% - 16px) * ${min / last})`;
  bandFillEl.style.right = `calc(8px + (100% - 16px) * ${(last - max) / last})`;
  // With both thumbs at the right end the min thumb must be on top, or it can't be grabbed.
  bandMinEl.style.zIndex = min === last ? 2 : 0;
  bandLabelEls.forEach((el, i) => el.classList.toggle("active", i >= min && i <= max));
}

function render() {
  const tags = checkedValues(".tag");
  const bands = selectedBands();

  // Filter on the primary tag only, since that is the icon shown on the map.
  visible = companies.filter((c) => tags.includes(c.tags[0]) && bands.includes(c.revenueBand));

  markerLayer.clearLayers();
  visible.forEach((c) => markerLayer.addLayer(markers.get(c)));
  updateSizes();

  countEl.textContent = visible.length;
  listEl.innerHTML = "";
  visible.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `<div class="name">${c.name}</div><div class="meta">${c.city} · ${BAND_LABELS[c.revenueBand]}</div>`;
    li.addEventListener("click", () => focusCompany(c));
    listEl.appendChild(li);
  });
}

function focusCompany(company) {
  flyToAndOpen(markers.get(company));
}

document.querySelectorAll("[data-region]").forEach((button) => {
  button.addEventListener("click", () => map.fitBounds(REGIONS[button.dataset.region]));
});

// The category checkboxes double as the map legend.
document.querySelectorAll(".tag").forEach((el) => {
  el.insertAdjacentHTML(
    "afterend",
    `<span class="marker legend" style="background:${TAG_COLORS[el.value]}">${TAG_ICONS[el.value]}</span>`
  );
});

document.querySelectorAll(".tag").forEach((el) => {
  el.addEventListener("change", render);
});
[bandMinEl, bandMaxEl].forEach((el) => {
  el.addEventListener("input", () => {
    updateBandSlider(el);
    render();
  });
});
updateBandSlider();
showEventsEl.addEventListener("change", renderEvents);
map.on("zoomend", updateSizes);

fetch("data/events.json")
  .then((res) => res.json())
  .then((data) => {
    events = data.sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
    events.forEach((e) => {
      const marker = bindHoverPopup(
        L.marker([e.lat, e.lng], { icon: createEventIcon(), zIndexOffset: 1000 }),
        createEventPopup(e)
      );
      eventMarkers.set(e, marker);
    });
    renderEvents();
  })
  .catch(() => {
    eventsEl.textContent = "Kunde inte läsa mässdata.";
  });

fetch("data/companies.json")
  .then((res) => res.json())
  .then((data) => {
    companies = data;
    companies.forEach((c) => {
      const marker = bindHoverPopup(
        L.marker([c.lat, c.lng], { icon: createIcon(c, BAND_SIZES[c.revenueBand]) }),
        createPopup(c)
      );
      markers.set(c, marker);
    });
    render();
  })
  .catch(() => {
    countEl.textContent = "Kunde inte läsa data. Kör via lokal server, se README.";
  });
