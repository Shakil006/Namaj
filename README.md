# 🕌 Salah Pulse

A beautiful, installable Islamic prayer time PWA — built for Android, iOS, and the web.

## Features

- 📍 **Auto location** (GPS or city search)
- 🕰️ **Live prayer times** via Aladhan API (Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha)
- ⏳ **Live countdown** to next prayer
- 📅 **Day navigation** — browse any day's schedule
- 🧭 **Qibla direction** with compass UI + distance to Mecca
- ⚙️ **Settings** — calculation method, Asr madhab, reminders
- 🔔 **Browser notifications** for prayer reminders
- 📦 **PWA** — installable via "Add to Home Screen"
- ✈️ **Offline support** — works without internet using cached times

## Files

| File | Purpose |
|------|---------|
| `index.html` | App shell and UI structure |
| `style.css` | Mobile-first styling, CSS variables, animations |
| `app.js` | All app logic: prayer times, Qibla, notifications, tabs |
| `manifest.json` | PWA manifest for installability |
| `sw.js` | Service worker for offline caching |
| `icon-192.png` | App icon (192×192) |
| `icon-512.png` | App icon (512×512) |

## Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files to the root
3. Go to **Settings → Pages → Source: Deploy from branch (main / root)**
4. Your app will be live at `https://yourusername.github.io/your-repo/`

> ⚠️ GitHub Pages requires HTTPS, which is needed for geolocation and notifications. ✅

## Convert to Android App (Capacitor)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Salah Pulse" com.salahpulse.app --web-dir .
npx cap add android
npx cap sync
npx cap open android
```

Then build your APK/AAB from Android Studio.

## APIs Used

- **[Aladhan API](https://aladhan.com/prayer-times-api)** — Free prayer times (no key required)
- **[Nominatim](https://nominatim.openstreetmap.org/)** — Free geocoding (OpenStreetMap)

## Calculation Methods

| ID | Method |
|----|--------|
| 2 | ISNA (North America) |
| 3 | Muslim World League |
| 4 | Umm Al-Qura (Mecca) |
| 5 | Egyptian General Authority |
| 1 | University of Islamic Sciences, Karachi |

## License

MIT — free to use and modify.

---

*Made with ❤️ for the Muslim community.*
