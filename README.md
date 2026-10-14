# BingeLog 🍿

> A [MyAnimeList](https://myanimelist.net/)-inspired tracker for Movies & TV Shows, built with React Native and Expo SDK 57.

---

> Heya, this is my first ever attempt at publishing something on GitHub. I pretty much vibe-coded this media tracker Android app. Some may call it "AI slop", and maybe rightfully so, but I just don't have the time, energy, or motivation to learn Android app development from scratch. I am sharing this so that maybe someone else might find it useful—and if someone with more knowledge and skill comes across it, maybe they can refine it and turn it into something full-fledged.

> [!IMPORTANT]
> ### ⚠️ Personal Hobby Project / "Vibe-Coded" Disclaimer
> - **Zero Tech Support:** I am not an app developer and won't be providing technical support, troubleshooting, or fixing bugs for external users.
> - **Issues & Discussions Disabled:** GitHub Issues, Discussions, and Wiki are intentionally disabled.
> - **Provided "As-Is":** This project is released under the [MIT License](LICENSE) for educational, personal, and hobbyist enjoyment. If you choose to use or compile it, you do so at your own discretion. Feel free to fork and customize it however you like!

---

## ✨ Features

### Tracking & Library
- **Status Workflows:** Track Movies, TV Series, and Anime with familiar statuses: *Watching*, *Completed*, *On-Hold*, *Dropped*, and *Plan to Watch*.
- **Progress & Rewatches:** Granular episode counters, season breakdowns, rewatch tally, 1–10 score rating, and personal notes.
- **Rich Metadata:** Synopsis, genre tags, air dates, cast carousels, and trailer previews powered by TMDB.

### Interface & Customization
- **Responsive Layouts:** Custom-tailored layouts for phones and tablets, including adaptive multi-column grids and side-by-side inspection panes on large screens.
- **Theme Engine:** Supports system appearance, Dark, Light, true AMOLED Black, and custom color accents, paired with live preview cards.
- **Granular Sizing Controls:** Adjustable UI density presets and steppers for text, poster cards, episode thumbnails, and cast avatars.
- **Tactile Responses:** Native haptic feedback with selectable intensity levels (Off, Light, Medium, Heavy) using intuitive dot level indicators.
- **Customizable Date Formats:** Choose your preferred date display (`DD.MM.YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD/MM/YYYY`, `MMM D, YYYY`, or `D MMM YYYY`) with live previews.

### Data & Sync
- **Dual-Mode Device Sync:** Transfer and merge your library between phone and tablet seamlessly using either Instant Relay (6-digit PIN / QR) or Air-Gapped Offline Mode (animated camera QR code scanner)—no cloud accounts or signups required.
- **Local-First & Privacy-Focused:** All data remains stored directly on your device. Includes detailed storage diagnostics, image cache cleanup, and export/import of full JSON backups.

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
- **MyAnimeList Attribution:** BingeLog is an independent project inspired by the MAL status tracking workflow and is not affiliated with, endorsed by, or associated with [MyAnimeList](https://myanimelist.net/) (MyAnimeList Co., Ltd.).
- **License:** Released under the [MIT License](LICENSE).
