const TAG_COLORS = {
  production: "#e0a526",
  ai: "#3aa17e",
  weapons: "#c8453b",
  aerospace: "#3b7dd8",
};

const TAG_LABELS = {
  production: "Produktionsteknik",
  ai: "AI",
  weapons: "Vapen",
  aerospace: "Flyg",
};

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

const POPUP_OPTIONS = { minWidth: 320, maxWidth: 420 };
map.fitBounds(REGIONS.usa);

const markerLayer = L.layerGroup().addTo(map);
const countEl = document.getElementById("count");
const listEl = document.getElementById("list");
const adjacentEl = document.getElementById("adjacent");

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
  const color = TAG_COLORS[company.tags[0]];
  const adjacent = company.adjacent ? " adjacent" : "";
  return L.divIcon({
    className: "",
    html: `<div class="marker${adjacent}" style="background:${color};width:${size}px;height:${size}px"></div>`,
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
    html: '<div class="event-marker"></div>',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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

function render() {
  const tags = checkedValues(".tag");
  const bands = checkedValues(".band");
  const showAdjacent = adjacentEl.checked;

  visible = companies.filter(
    (c) =>
      c.tags.some((t) => tags.includes(t)) &&
      bands.includes(c.revenueBand) &&
      (showAdjacent || !c.adjacent)
  );

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

document.querySelectorAll(".tag, .band, #adjacent").forEach((el) => {
  el.addEventListener("change", render);
});
showEventsEl.addEventListener("change", renderEvents);
map.on("zoomend", updateSizes);

fetch("data/events.json")
  .then((res) => res.json())
  .then((data) => {
    events = data.sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
    events.forEach((e) => {
      const marker = L.marker([e.lat, e.lng], { icon: createEventIcon(), zIndexOffset: 1000 })
        .bindTooltip(createEventPopup(e), { direction: "top", className: "info-tooltip" })
        .bindPopup(createEventPopup(e), POPUP_OPTIONS);
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
      const marker = L.marker([c.lat, c.lng], { icon: createIcon(c, BAND_SIZES[c.revenueBand]) })
        .bindTooltip(createPopup(c), { direction: "top", className: "info-tooltip" })
        .bindPopup(createPopup(c), POPUP_OPTIONS);
      markers.set(c, marker);
    });
    render();
  })
  .catch(() => {
    countEl.textContent = "Kunde inte läsa data. Kör via lokal server, se README.";
  });
