/* ============================================================
   SALAH PULSE – app.js
   Prayer times, Qibla, Notifications, Settings
   Uses Aladhan API for prayer times (free, no key needed)
   ============================================================ */

'use strict';

// ─── Constants ──────────────────────────────────────────────
const MECCA = { lat: 21.4225, lng: 39.8262 };
const ALADHAN_API = 'https://api.aladhan.com/v1/timings';

// Prayer display config
const PRAYERS = [
  { key: 'Fajr',    label: 'Fajr',    arabic: 'الفجر',   icon: '🌙' },
  { key: 'Sunrise', label: 'Sunrise', arabic: 'الشروق',  icon: '🌅' },
  { key: 'Dhuhr',   label: 'Dhuhr',   arabic: 'الظهر',   icon: '☀️' },
  { key: 'Asr',     label: 'Asr',     arabic: 'العصر',   icon: '🌤️' },
  { key: 'Sunset',  label: 'Sunset',  arabic: 'الغروب',  icon: '🌇' },
  { key: 'Maghrib', label: 'Maghrib', arabic: 'المغرب',  icon: '🌆' },
  { key: 'Isha',    label: 'Isha',    arabic: 'العشاء',  icon: '🌃' },
];

// Prayer windows (the ones that "activate")
const ACTIVE_PRAYERS = ['Fajr','Dhuhr','Asr','Maghrib','Isha'];

// ─── State ──────────────────────────────────────────────────
let state = {
  lat: null,
  lng: null,
  locationName: 'Unknown',
  todayTimings: null,
  daysOffset: 0,
  offsetTimings: null,
  countdownTimer: null,
  clockTimer: null,
  notifTimers: [],
  settings: {
    method: '2',
    madhab: '1',
    reminder: 'ontime',
    notifications: false,
  }
};

// ─── DOM Refs ────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const splash         = $('splash');
const locationPrompt = $('location-prompt');
const app            = $('app');
const btnGeo         = $('btn-geo');
const btnCity        = $('btn-city');
const cityInput      = $('city-input');
const cityError      = $('city-error');
const liveClock      = $('live-clock');
const heroDay        = $('hero-day');
const heroDate       = $('hero-date');
const heroLocation   = $('loc-name');
const nextPrayerName = $('next-prayer-name');
const nextCountdown  = $('next-countdown');
const prayerStatus   = $('prayer-status');
const prayerList     = $('prayer-list');
const daysDayName    = $('days-day-name');
const daysDateStr    = $('days-date-str');
const daysPrayerList = $('days-prayer-list');
const qiblaNeedle    = $('qibla-needle');
const qiblaDeg       = $('qibla-deg');
const qiblaNote      = $('qibla-note');
const qiblaCoords    = $('qibla-coords');
const qiblaDistance  = $('qibla-distance');
const selMethod      = $('sel-method');
const selMadhab      = $('sel-madhab');
const selReminder    = $('sel-reminder');
const togNotif       = $('tog-notif');
const settingsLoc    = $('settings-loc');
const btnSaveSettings= $('btn-save-settings');
const saveMsg        = $('save-msg');
const btnChangeLoc   = $('btn-change-loc');
const prevDayBtn     = $('prev-day');
const nextDayBtn     = $('next-day');
const backToTodayBtn = $('back-to-today');
const navItems       = document.querySelectorAll('.nav-item');

// ─── Init ────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  registerServiceWorker();

  // After splash animation (≈2.4s), show next step
  setTimeout(bootstrap, 2400);
});

function bootstrap() {
  const saved = localStorage.getItem('sp_location');
  if (saved) {
    const loc = JSON.parse(saved);
    state.lat = loc.lat;
    state.lng = loc.lng;
    state.locationName = loc.name;
    showApp();
    loadAndRender();
  } else {
    showLocationPrompt();
  }
}

// ─── Settings ────────────────────────────────────────────────
function loadSettings() {
  const saved = localStorage.getItem('sp_settings');
  if (saved) {
    state.settings = { ...state.settings, ...JSON.parse(saved) };
  }
  // Apply to UI
  selMethod.value = state.settings.method;
  selMadhab.value = state.settings.madhab;
  selReminder.value = state.settings.reminder;
  togNotif.checked = state.settings.notifications;
}

function saveSettings() {
  state.settings.method = selMethod.value;
  state.settings.madhab = selMadhab.value;
  state.settings.reminder = selReminder.value;
  state.settings.notifications = togNotif.checked;
  localStorage.setItem('sp_settings', JSON.stringify(state.settings));

  // Re-fetch with new settings
  loadAndRender();

  // Show saved message
  saveMsg.classList.remove('hidden');
  setTimeout(() => saveMsg.classList.add('hidden'), 2000);

  // Request notification permission if toggled on
  if (state.settings.notifications) {
    requestNotifPermission();
  }
}

btnSaveSettings.addEventListener('click', saveSettings);

// ─── Location Prompt ─────────────────────────────────────────
function showLocationPrompt() {
  locationPrompt.classList.remove('hidden');
}

function hideLocationPrompt() {
  locationPrompt.classList.add('hidden');
}

btnGeo.addEventListener('click', () => {
  btnGeo.textContent = 'Detecting…';
  btnGeo.disabled = true;

  if (!navigator.geolocation) {
    alert('Geolocation is not supported by your browser.');
    btnGeo.textContent = 'Use My Location';
    btnGeo.disabled = false;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async pos => {
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      state.locationName = await reverseGeocode(state.lat, state.lng);
      saveLocation();
      hideLocationPrompt();
      showApp();
      loadAndRender();
    },
    err => {
      console.warn('Geo error:', err);
      alert('Could not detect location. Please enter your city manually.');
      btnGeo.textContent = 'Use My Location';
      btnGeo.disabled = false;
    },
    { timeout: 10000 }
  );
});

btnCity.addEventListener('click', searchCity);
cityInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchCity(); });

async function searchCity() {
  const q = cityInput.value.trim();
  if (!q) return;
  btnCity.textContent = 'Searching…';
  btnCity.disabled = true;
  cityError.classList.add('hidden');

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    if (!data.length) throw new Error('Not found');

    state.lat = parseFloat(data[0].lat);
    state.lng = parseFloat(data[0].lon);
    state.locationName = data[0].display_name.split(',').slice(0, 2).join(', ');
    saveLocation();
    hideLocationPrompt();
    showApp();
    loadAndRender();
  } catch {
    cityError.classList.remove('hidden');
  } finally {
    btnCity.textContent = 'Search City';
    btnCity.disabled = false;
  }
}

function saveLocation() {
  localStorage.setItem('sp_location', JSON.stringify({
    lat: state.lat, lng: state.lng, name: state.locationName
  }));
}

btnChangeLoc.addEventListener('click', () => {
  localStorage.removeItem('sp_location');
  showLocationPrompt();
});

// Nominatim reverse geocode
async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const d = await res.json();
    const a = d.address;
    return [a.city || a.town || a.village || a.county, a.country]
      .filter(Boolean).join(', ') || 'Your Location';
  } catch {
    return 'Your Location';
  }
}

// ─── App Display ─────────────────────────────────────────────
function showApp() {
  app.classList.remove('hidden');
}

// ─── Prayer Time Fetching ─────────────────────────────────────
async function fetchTimings(date, lat, lng) {
  // date: Date object
  const d = `${String(date.getDate()).padStart(2,'0')}-${String(date.getMonth()+1).padStart(2,'0')}-${date.getFullYear()}`;
  const url = `${ALADHAN_API}/${d}?latitude=${lat}&longitude=${lng}&method=${state.settings.method}&school=${state.settings.madhab}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json.code !== 200) throw new Error('API error');
  return json.data.timings;
}

async function loadAndRender() {
  try {
    const today = new Date();
    state.todayTimings = await fetchTimings(today, state.lat, state.lng);
    renderToday();
    renderDaysTab();
    renderQibla();
    updateSettingsUI();
    startClock();
    startCountdown();
    scheduleNotifications();
  } catch (err) {
    console.error('Failed to load prayer times:', err);
    // Offline fallback: use cached times if available
    const cached = localStorage.getItem('sp_cached_timings');
    if (cached) {
      state.todayTimings = JSON.parse(cached);
      renderToday();
    }
  }

  if (state.todayTimings) {
    localStorage.setItem('sp_cached_timings', JSON.stringify(state.todayTimings));
  }
}

// ─── Render: Today Tab ───────────────────────────────────────
function renderToday() {
  const now = new Date();
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  heroDay.textContent = days[now.getDay()];
  heroDate.textContent = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  heroLocation.textContent = state.locationName;
  settingsLoc.textContent = state.locationName;

  prayerList.innerHTML = buildPrayerRows(state.todayTimings, true);
  updateNextPrayer();
}

function buildPrayerRows(timings, isToday) {
  const now = new Date();
  let html = '';

  for (const p of PRAYERS) {
    const timeStr = timings[p.key];
    if (!timeStr) continue;

    const prayerDate = parseTimeToday(timeStr);
    const isPast = isToday && now > prayerDate;
    const isCurrent = isToday && isCurrentPrayer(p.key, timings);

    let rowClass = 'prayer-row';
    if (isCurrent) rowClass += ' current';
    else if (isPast) rowClass += ' passed';

    let badge = '';
    if (isCurrent) badge = '<span class="prayer-badge">Now</span>';
    const bar = isCurrent ? '<div class="current-bar"></div>' : '';

    html += `
      <div class="${rowClass}">
        ${bar}
        <div class="prayer-icon">${p.icon}</div>
        <div class="prayer-info">
          <div class="prayer-name">${p.label}${badge}</div>
          <div class="prayer-arabic">${p.arabic}</div>
        </div>
        <div class="prayer-time">${formatTime(timeStr)}</div>
      </div>
    `;
  }
  return html;
}

// ─── Render: Days Tab ─────────────────────────────────────────
prevDayBtn.addEventListener('click', () => changeDay(-1));
nextDayBtn.addEventListener('click', () => changeDay(1));
backToTodayBtn.addEventListener('click', () => {
  state.daysOffset = 0;
  renderDaysTab();
  switchTab('today');
});

async function changeDay(delta) {
  state.daysOffset += delta;
  await renderDaysTab();
}

async function renderDaysTab() {
  const target = new Date();
  target.setDate(target.getDate() + state.daysOffset);

  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  daysDayName.textContent = days[target.getDay()];
  daysDateStr.textContent = `${target.getDate()} ${months[target.getMonth()]} ${target.getFullYear()}`;

  daysPrayerList.innerHTML = '<div class="prayer-row"><div class="prayer-info"><div class="prayer-name">Loading…</div></div></div>';

  try {
    state.offsetTimings = await fetchTimings(target, state.lat, state.lng);
    daysPrayerList.innerHTML = buildPrayerRows(state.offsetTimings, state.daysOffset === 0);
  } catch {
    daysPrayerList.innerHTML = '<div class="prayer-row"><div class="prayer-info"><div class="prayer-name">Could not load times</div></div></div>';
  }
}

// ─── Next Prayer & Countdown ─────────────────────────────────
function updateNextPrayer() {
  if (!state.todayTimings) return;
  const { next, current } = getNextAndCurrent(state.todayTimings);

  if (next) {
    nextPrayerName.textContent = next.label;
    const diff = parseTimeToday(state.todayTimings[next.key]) - new Date();
    nextCountdown.textContent = msToHMS(Math.max(0, diff));
  } else {
    nextPrayerName.textContent = 'Fajr';
    nextCountdown.textContent = '--:--:--';
  }

  if (current) {
    prayerStatus.textContent = `🟢 ${current.label} time is now`;
  } else if (next) {
    prayerStatus.textContent = `⏳ ${next.label} coming up`;
  } else {
    prayerStatus.textContent = `🌙 Isha time – Night prayer`;
  }
}

function startCountdown() {
  if (state.countdownTimer) clearInterval(state.countdownTimer);
  state.countdownTimer = setInterval(() => {
    updateNextPrayer();
    // Refresh prayer list highlights every minute
  }, 1000);
}

function startClock() {
  if (state.clockTimer) clearInterval(state.clockTimer);
  const tick = () => {
    const now = new Date();
    liveClock.textContent = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };
  tick();
  state.clockTimer = setInterval(tick, 1000);
}

// ─── Prayer Logic Helpers ─────────────────────────────────────
function parseTimeToday(hhmm) {
  // hhmm: "05:30" → today's Date at that time
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return `${hr}:${String(m).padStart(2,'0')} ${suffix}`;
}

function getNextAndCurrent(timings) {
  const now = new Date();
  let next = null, current = null;

  for (let i = 0; i < ACTIVE_PRAYERS.length; i++) {
    const key = ACTIVE_PRAYERS[i];
    const t = parseTimeToday(timings[key]);
    const nextKey = ACTIVE_PRAYERS[i + 1];
    const nextT = nextKey ? parseTimeToday(timings[nextKey]) : null;

    if (now >= t && (!nextT || now < nextT)) {
      current = PRAYERS.find(p => p.key === key);
    }
    if (now < t && !next) {
      next = PRAYERS.find(p => p.key === key);
    }
  }
  return { next, current };
}

function isCurrentPrayer(key, timings) {
  if (!ACTIVE_PRAYERS.includes(key)) return false;
  const now = new Date();
  const t = parseTimeToday(timings[key]);
  const idx = ACTIVE_PRAYERS.indexOf(key);
  const nextKey = ACTIVE_PRAYERS[idx + 1];
  const nextT = nextKey ? parseTimeToday(timings[nextKey]) : null;
  return now >= t && (!nextT || now < nextT);
}

function msToHMS(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

// ─── Qibla ────────────────────────────────────────────────────
function renderQibla() {
  if (!state.lat) return;

  const bearing = calcQiblaBearing(state.lat, state.lng);
  const dist = calcDistance(state.lat, state.lng, MECCA.lat, MECCA.lng);

  qiblaDeg.textContent = `${Math.round(bearing)}°`;
  qiblaNote.textContent = 'from North (clockwise)';
  qiblaCoords.textContent = `${state.lat.toFixed(4)}°, ${state.lng.toFixed(4)}°`;
  qiblaDistance.textContent = `${Math.round(dist).toLocaleString()} km`;
  qiblaNeedle.style.transform = `rotate(${bearing}deg)`;
}

function calcQiblaBearing(lat1, lng1) {
  const toRad = x => x * Math.PI / 180;
  const φ1 = toRad(lat1), φ2 = toRad(MECCA.lat);
  const Δλ = toRad(MECCA.lng - lng1);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1)*Math.sin(φ2) - Math.sin(φ1)*Math.cos(φ2)*Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function calcDistance(lat1, lng1, lat2, lng2) {
  // Haversine formula, returns km
  const R = 6371;
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ─── Settings UI ─────────────────────────────────────────────
function updateSettingsUI() {
  settingsLoc.textContent = state.locationName;
}

// ─── Notifications ───────────────────────────────────────────
async function requestNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
}

function scheduleNotifications() {
  // Clear old timers
  state.notifTimers.forEach(t => clearTimeout(t));
  state.notifTimers = [];

  if (!state.settings.notifications) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (!state.todayTimings) return;

  const offsetMs = {
    ontime:  0,
    '5min':  5 * 60 * 1000,
    '10min': 10 * 60 * 1000,
    '15min': 15 * 60 * 1000,
  }[state.settings.reminder] || 0;

  const now = Date.now();

  for (const key of ACTIVE_PRAYERS) {
    const t = parseTimeToday(state.todayTimings[key]);
    const fireAt = t.getTime() - offsetMs;
    if (fireAt > now) {
      const delay = fireAt - now;
      const label = PRAYERS.find(p => p.key === key)?.label || key;
      const timer = setTimeout(() => {
        new Notification('🕌 Salah Pulse', {
          body: offsetMs === 0
            ? `${label} time has arrived.`
            : `${label} prayer in ${offsetMs / 60000} minutes.`,
          icon: 'icon-192.png',
          badge: 'icon-192.png',
        });
      }, delay);
      state.notifTimers.push(timer);
    }
  }
}

// ─── Tab Navigation ──────────────────────────────────────────
navItems.forEach(item => {
  item.addEventListener('click', () => {
    const tab = item.dataset.tab;
    switchTab(tab);
  });
});

function switchTab(tab) {
  // Update nav
  navItems.forEach(i => i.classList.toggle('active', i.dataset.tab === tab));

  // Update content
  document.querySelectorAll('.tab-content').forEach(el => {
    const id = el.id.replace('tab-', '');
    el.classList.toggle('active', id === tab);
    el.classList.toggle('hidden', id !== tab);
  });

  // Trigger Qibla render when switching to it
  if (tab === 'qibla') renderQibla();
  if (tab === 'days') renderDaysTab();
}

// ─── Service Worker / PWA ────────────────────────────────────
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  }
}
