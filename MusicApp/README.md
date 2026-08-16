# Melodix — Multi-Provider Music Player for iOS

A fully customizable music player for iOS that streams from **YouTube Music**, **Qobuz**, **Tidal**, your own custom service, and local files — with app-wide theming and pro audio DSP (EQ, reverb, delay, distortion, reversing, time-stretch, pitch-shift).

## Features

### Music Providers
- **YouTube Music** (search, playlists, library, streams, lyrics)
- **Qobuz** (hi-res lossless 24-bit/192kHz)
- **Tidal** (Master quality hi-res)
- **Custom** — plug in your own backend API (the recommended way to get started; can even wrap other services)
- **Local files** import

### Audio Engine (AVAudioEngine + Accelerate)
- 10-band parametric EQ (32 Hz – 16 kHz) with preset library and custom presets
- Reverb (12 factory presets: room/hall/chamber/cathedral/plate)
- Delay/Echo with feedback control
- Distortion (22 factory presets)
- **Reverse playback** (Accelerate `vDSP_vrvrs`)
- Playback speed 0.25×–4× and pitch shift (±2400 cents)
- Volume, balance/pan, normalization, gapless, crossfade
- Real-time FFT for visualizers

### Themes
- Preset themes (Midnight, Ocean, Sunset, Forest, Cyber, Royal)
- Full custom theme editor: every color, font (SF Pro/Rounded/Serif/Monospaced), corner radius, blur intensity, font size scaling, light/dark/custom scheme
- Themes are stored per-profile in the database

### Profiles & Accounts (Netflix-style)
- Account sign-up / sign-in with password strength meter
- Multiple profiles per account ("Who's listening?")
- Colored/photo avatars, kid profiles, profile switching
- Face ID / Touch ID sign-in (Keychain + LocalAuthentication)

### Database (DBMS — SwiftData/SQLite)
Per-profile persistence of: preferences, playlists, play history, EQ presets, themes, provider credentials, downloaded tracks.

### iOS Integration
- Background audio (lock screen & Control Center controls, play/pause/next/seek/shuffle/repeat)
- Queue management, shuffle, repeat all/one
- Mini player + full-screen Now Playing

## Requirements

- **macOS 14+** with **Xcode 15+** (iOS development cannot be done on Windows — this is Apple's restriction; use any Intel/Apple-silicon Mac or a cloud Mac service such as MacStadium, AWS EC2 Mac, or GitHub Actions macOS runners)
- iOS 17+ device or simulator
- Free Apple ID works for personal device testing

## Setup

1. Open `MusicApp/` in Xcode by creating a new iOS App project (SwiftUI, iOS 17):
   - `File → New → Project → iOS → App` — name it `Melodix`, interface *SwiftUI*, storage *None*
   - Delete the generated `MelodixApp.swift` and `ContentView.swift`
   - Drag all files from the `MusicApp/` folders into the Xcode project (check *Copy items if needed*, *Create groups*)
2. In the project target:
   - **Signing & Capabilities** → add your Team for device installs
   - **Background Modes** → enable *Audio, AirPlay & Picture in Picture* (also *Remote notifications* for future features)
   - Copy `MusicApp/Resources/Info.plist` keys (UIBackgroundModes, FaceID usage description) — Xcode templates include most already
3. Replace placeholder API credentials:
   - `Providers/YouTubeMusicProvider.swift` → `YOUR_CLIENT_ID`, `YOUR_REDIRECT_URI`
   - `Providers/QobuzProvider.swift` → `appId`, `appSecret`
   - `Providers/TidalProvider.swift` → `clientId`, `clientSecret`
   - `Providers/CustomProvider.swift` → set your backend base URL + API key
   - The **Custom** provider is the one that works day one with zero approvals: point it at any server implementing the JSON API in `CustomProvider.swift` (register/login, search, tracks, stream URLs, lyrics). Use it to wrap YouTube Music via `yt-dlp` or `pytubefix` on your server, or any other service.
4. Run: `⌘R`

TCA was intentionally dropped from the scaffold — state is plain `ObservableObject` + Combine for easier learning. Architecture notes are below.

## Architecture

```
MusicApp/
├── App/                    MusicAppApp.swift (@main), model container schema
├── Models/                 SwiftData @Model classes (profiles, playlists, history, EQ, themes…)
├── AudioEngine/            AVAudioEngine chain: player → EQ → reverb → time-pitch → distortion → delay → mixer
├── Providers/              MusicService protocol + YouTubeMusic/Qobuz/Tidal/Custom/Local implementations
├── Database/               DatabaseManager (DBMS facade over SwiftData), AppConfig
├── Theme/                  ThemeManager (colors/fonts/radii), preset themes, custom theme editor
├── ViewModels/             PlaybackViewModel, AudioEffectsViewModel, LoginViewModel, AuthViewModel
├── Views/                  Login, profile picker, home, library, search, settings, now playing, effects
└── Resources/Info.plist    background audio, FaceID, ATS exception for dev streams
```

Audio graph (see `AudioEngine/AudioEngine.swift`):

```
playerNode → eqNode(10-band) → reverbNode → timePitchNode → distortionNode → delayNode → mainMixer → output
```

## Getting provider API access (the honest part)

| Provider | What's needed | Notes |
|---|---|---|
| YouTube Music | OAuth 2.0 via Google Cloud Console + `youtubei` innerTube endpoints | Google approves `youtube.readonly` scopes for music apps; innerTube is the unofficial-but-ubiquitous bridge used by every open-source YT Music client |
| Qobuz | Partner developer access (app_id/app_secret via Qobuz Labs) | Requires partnership approval; stream URLs need the signed `format_id` handshake |
| Tidal | Tidal API partner program | Requires formal approval/partnership |
| Custom | Nothing | Your own backend = full control. Wraps anything |

## Roadmap

- [ ] Real provider auth UX (OAuth web-view) instead of placeholder URLs
- [ ] Offline downloads per profile with expiry (SwiftData `DownloadedTrack` is modeled)
- [ ] Lyrics (synced) playback
- [ ] Audio visualizer using `AudioEngine.getFFTData()`
- [ ] Convolution reverb (impulse response loader)
- [ ] Smart playlists (rules are modeled) + recommendations
- [ ] iCloud sync of profiles/preferences across devices
- [ ] macOS / iPadOS targets

## Building an IPA (from Windows, no Mac needed)

An IPA is built by Apple's Xcode toolchain, which requires macOS. **The free pipeline below builds `Melodix.ipa` in the cloud on GitHub Actions (macOS runners) and you sideload it onto your iPhone from Windows with your Apple ID — no paid developer account required.**

1. Push this repo to GitHub (`gh repo create` or via the GitHub website)
2. Go to **Actions → "Build IPA" → Run workflow** (or just push a commit that touches `MusicApp/**`)
3. When the run finishes, download **`Melodix-unsigned.ipa`** from the run's artifacts
4. Install **Sideloadly** (Windows/Mac, free) — connect your iPhone, drag the IPA in, enter your Apple ID, click Start
   - AltStore (needs AltServer) is an alternative
5. On the iPhone: **Settings → General → VPN & Device Management** → trust your developer profile
6. Free Apple IDs re-sign every **7 days** — re-run the sideload to keep the app alive

### Trying changes faster

You don't need the cloud for every tweak if you have any Mac (or cloud Mac): clone the repo, run `brew install xcodegen && xcodegen generate`, open `Melodix.xcodeproj`, and use Xcode's automatic signing with your Apple ID to run directly on a device or simulator.

The workflow (`../.github/workflows/build-ipa.yml`) runs `xcodegen generate` (project spec: `../project.yml`) then `xcodebuild` with code signing disabled — sideloading tools re-sign the IPA with your Apple ID.

## Tests

`MusicAppTests/` — run with `⌘U`. Covers formatting, validation, bitrates, defaults.