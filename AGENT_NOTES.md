# Agent Notes — Aerocade Project
## Quick Reference for Session Continuity

---

## What Is This Project?
A multi-console retro emulator web app (NES, SNES, N64, Game Boy, Sega Genesis, PS1, PSP) styled after the SUMEE! app with Frutiger Aero aesthetics and Wii-themed UI.

## Repository
- GitHub: `https://github.com/McTooter/aerocade`
- Branches: `main` (dev) and `gh-pages` (deployment)
- Deployed at: `https://mctooter.github.io/aerocade/`
- To deploy: commit to main, merge into gh-pages, push both

## Key Files
| File | Purpose |
|------|---------|
| `index.html` | Main HTML — Wii Disc Channel, Profile view (no auth forms), loading screen, Wii cursor SVG |
| `style.css` | All CSS — Frutiger Aero, Wii Shop, Disc Channel, Profile, mobile media queries |
| `main.js` | All JS — 2131 lines, account system (jsonbin.io), emulator launch, Wii Shop, Mii editor |
| `coi-serviceworker.js` | Enables SharedArrayBuffer for EmulatorJS (cross-origin isolation) |
| `n64-player.html` | EmulatorJS iframe wrapper for N64 games |
| `ps1.js` | PS1 emulator (browser-compatible) |
| `n64.js` | Custom N64 core (dead code ~1700 lines, all N64 uses EmulatorJS iframe) |
| `avatar-creator/` | Standalone React+TS+Tailwind+Framer Motion avatar creator (AeroAvatar) |

## Account System (jsonbin.io)
- **Combined with Mii Maker** — accounts are a horizontal scrollable strip at the top of the Mii Maker view
- **No Firebase, no auth forms, no login/register UI** — profile goes straight to editor
- Admin name: `Zant` (constant `ADMIN_NAME`)
- Admin role is ALWAYS forced — check `name === ADMIN_NAME` as fallback everywhere
- jsonbin.io credentials:
  - Master key: `$2a$10$i3xGZbqAs5UpGSQXldRSXOB5Q60hXiHvvaqXyrC/UZ0WoR8KkbTiC`
  - Bin ID: `6a5fa6a1da38895dfe7bec5a`
  - Bin content: `{"Zant":{"role":"admin","miiStudio":"000b1259...","created":1753113873268}}`
- localStorage fallback when jsonbin is unreachable
- `getAccounts()` fetches jsonbin and merges with localStorage
- `saveAccount()` saves to both localStorage and jsonbin (for ADMIN_NAME only)
- `deleteAccount()` removes from both, sets jsonbin value to `null`
- Session stored in localStorage key `aerocade_session`
- Accounts stored in localStorage key `aerocade_accounts`
- User may need to clear stuck data: `localStorage.removeItem('aerocade_accounts'); location.reload();`
- The "+" button at the end of the account strip creates a new Mii (clears editor)
- Clicking an account card loads that Mii into the editor

## Mii Studio API
- URL: `https://studio.mii.nintendo.com/miis/image.png?data=<94charhex>&width={96|128|270|512}&type=face`
- Data format: 46 bytes raw, XOR+7 obfuscation producing 94-char hex string
- **The API works** (confirmed 200 OK, ~85KB PNG) — CORS is the challenge
- CORS fix: `coi-serviceworker.js` intercepts all fetches, adds `Cross-Origin-Resource-Policy: cross-origin` header
- Config: `coepCredentialless: false` (require-corp mode, NOT credentialless)
- Known good Mii codes:
  - Default: `000b1259616c6f72707d7e848788939aa3b0bac1c8cfd2d9e0ebf2ff0209470e161d19141e19243a3e4148474a4751`
  - Matt: `000f145b5f5e646e49546169687477858e878a87878e969d9c9fa6b3b9c0e5acafb6bbb6bcb6b9b8bebfc3cfd1d9da`

## EmulatorJS
- N64 uses EmulatorJS via CDN iframe (`cdn.emulatorjs.org/stable/data/`)
- `n64-player.html` loads in iframe, uses `EJS_threads=true` for SharedArrayBuffer
- Controls: WASD=analog stick, X=A, Z=B, Q/E=L/R
- Other emulators (NES, SNES, GB, Genesis, PS1) use custom JS in main bundle
- PSP GPU is a stub (renders nothing)

## Keyboard Fix
- Emulator key handlers check `e.target.tagName` — skips capture when INPUT or TEXTAREA focused
- Allows typing "z" in name fields without triggering N64 B button

## Wii Features
- **Wii Shop Channel**: 32 games across 7 consoles, all with real YouTube video URLs
- **Wii Disc Channel**: Full-screen spinning disc, Start/Stop video toggle, lazy YouTube embed
- **Wii Remote cursor**: SVG hand/pointer with blue glow filter

## Current Bugs / Known Issues
1. ~~coi-serviceworker.js catch handler returned undefined~~ (FIXED — now returns Response 503)
2. ~~Mii Studio images broken due to CORS~~ (FIXED — switched to require-corp + CORP headers)
3. ~~Zant shows as 'Member' on new browser~~ (FIXED — admin role forced via ADMIN_NAME fallback)
4. ~~switchView bug~~ (FIXED — was calling nonexistent function, now calls showView)
5. N64 custom core (`n64.js`) is dead code — all N64 routes to EmulatorJS iframe
6. PSP GPU is a stub — renders nothing

## Design Decisions
- Frutiger Aero = MAXIMUM effects — glassmorphism, bubbles, aurora, water shimmer, fish, parallax
- Wii menu channel zoom animation on all cards
- Mobile responsive with media queries (profile stacks vertically, cursor hidden on touch)
- No login/register forms — admin auto-syncs from jsonbin on startup
- `coi-serviceworker.js` is loaded as readable (not minified) for easier debugging
- **Mii Maker + Account System are combined** — horizontal account strip at top, editor below
- Account strip has a "+" button to create new Miis, each card shows Mii + name + role

## Deploy Checklist
1. Make changes to files in working directory
2. `git add . && git commit -m "description"`
3. `git push origin main`
4. `git checkout gh-pages && git merge main --no-edit && git push origin gh-pages && git checkout main`
5. Wait ~1 min for GitHub Pages to deploy
6. Hard-refresh (`Ctrl+Shift+R`) to test — service worker may need unregistering from DevTools > Application
