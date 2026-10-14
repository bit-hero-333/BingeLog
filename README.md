# BingeLog 🍿

> A MyAnimeList-inspired tracker for Movies & TV Shows, built with React Native and Expo SDK 57.

---

> Heya, this is my first ever attempt at publishing something on GitHub. I pretty much vibe-coded this media tracker Android app. Some may call it "AI slop", and maybe rightfully so, but I just don't have the time, energy, or motivation to learn Android app development from scratch. I am sharing this so that maybe someone else might find it useful—and if someone with more knowledge and skill comes across it, maybe they can refine it and turn it into something full-fledged.

> [!IMPORTANT]
> ### ⚠️ Personal Hobby Project / "Vibe-Coded" Disclaimer
> - **Zero Tech Support:** I am not an app developer and won't be providing technical support, troubleshooting, or fixing bugs for external users.
> - **Issues & Discussions Disabled:** GitHub Issues, Discussions, and Wiki are intentionally disabled.
> - **Provided "As-Is":** This project is released under the [MIT License](LICENSE) for educational, personal, and hobbyist enjoyment. If you choose to use or compile it, you do so at your own discretion. Feel free to fork and customize it however you like!

---

## ✨ Features

- **🎬 MAL-Style Media Tracking:** Track Movies, TV Series, and Anime with familiar statuses: *Watching*, *Completed*, *On-Hold*, *Dropped*, and *Plan to Watch*.
- **📺 Episode Progress & Rewatching:** Granular episode counters, season breakdowns, rewatch counters, 1–10 score rating, and personal notes.
- **📱 Responsive Layout & Tablet Split-Pane:** Custom-tailored layouts for both mobile phones and tablets (including large screens like the Galaxy Tab S9 FE+ with adaptive 2–3 column grids and side-by-side inspection panes).
- **📳 Customizable Haptic Feedback:** Native tactile responses with selectable intensity levels (*Light*, *Medium*, *Heavy*, or *Disabled*).
- **🎨 Theme Engine & Live Preview:** Supports system appearance, Dark, Light, true AMOLED Black, and custom TMDB-inspired color schemes, paired with customizable UI scale settings.
- **📅 Customizable Date Formats:** Choose your preferred date display (`DD.MM.YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MM/YYYY`, `MMM D, YYYY`, or `D MMM YYYY`) with live previews.
- **💾 Local-First & Privacy-Focused:** All data remains stored directly on your device. Includes detailed storage diagnostics, image cache cleanup, and export/import of full JSON backups.
- **🛜 Dual-Mode Device Sync:** Transfer and merge your library between phone and tablet seamlessly using either **Instant Relay** (`🛜🔄` 6-digit PIN / QR) or **Air-Gapped Offline Mode** (`🛜🚫` animated camera QR flipbook)—no cloud servers, logins, or accounts required.

---

## 🛠️ Tech Stack

- **Framework:** [React Native](https://reactnative.dev/) & [Expo SDK 57](https://expo.dev/)
- **Navigation:** [Expo Router](https://docs.expo.dev/router/introduction/) (file-based routing)
- **Language:** TypeScript
- **Storage:** Local storage via `@react-native-async-storage/async-storage` & `expo-file-system`
- **Metadata:** [The Movie Database (TMDB)](https://www.themoviedb.org/) API

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or bun
- A free API Read Access Token or API Key from [The Movie Database (TMDB)](https://www.themoviedb.org/)

### Installation

1. Clone your fork of the repository:
   ```bash
   git clone https://github.com/<your-username>/BingeLog.git
   cd BingeLog
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure TMDB API Key:
   - Create a `.env` file in the project root:
     ```env
     EXPO_PUBLIC_TMDB_API_KEY=your_tmdb_api_key_or_token_here
     ```
   - *Alternatively, enter your TMDB key directly in the app's Settings screen.*

4. Start the development server:
   ```bash
   npx expo start
   ```

---

## 📱 Building Standalone APK (Android)

To build a standalone APK without requiring local Android Studio or SDK configuration, use Expo Application Services (EAS):

```bash
# Log in to your Expo account
npx eas-cli login

# Build a standalone preview APK
npx eas-cli build -p android --profile preview
```

---

## ⚖️ Attribution & Disclaimers

- **TMDB Attribution:** This product uses the TMDB API but is not endorsed or certified by [TMDB](https://www.themoviedb.org/). All movie and TV metadata, posters, backdrops, and cast information are provided courtesy of The Movie Database.
- **MyAnimeList:** BingeLog is an independent project inspired by the MAL status tracking workflow and is not affiliated with, endorsed by, or associated with MyAnimeList Co., Ltd.
- **License:** Released under the [MIT License](LICENSE).
