# NEBULA STRIKE

NEBULA STRIKE is a playable 2D space survival game built with HTML5 Canvas, CSS, and JavaScript. It runs in a modern browser and is suitable for GitHub Pages publishing.

## Features
- Smooth arcade movement and shooting
- Enemy waves and asteroid hazards
- Health, shields, lives, score, and wave progression
- collectible credits and pickups
- multiple ship selection and upgrades
- mission objectives with rewards
- persistent save data using LocalStorage
- touch controls for mobile devices
- optional Web Audio sound effects generated without external files

## Files
- `index.html`
- `style.css`
- `script.js`

## Local run
1. Open the project folder in a terminal.
2. Start a simple static server:

   ```bash
   python3 -m http.server 8000
   ```

3. Open this URL in your browser:

   ```text
   http://localhost:8000
   ```

## GitHub Pages
1. Push the project to a GitHub repository.
2. Open the repository on GitHub.
3. Go to `Settings` → `Pages`.
4. Set the source to the default branch (for example `main`) and the root directory `/`.
5. Save the settings and wait for the deployment to finish.
6. The site will be published at:

   ```text
   https://<your-username>.github.io/<repository-name>/
   ```

## Controls
- Move: `W`, `A`, `S`, `D` or arrow keys
- Fire: `Space`
- Pause: `ESC` or the on-screen pause button
- Touch controls: left pad for movement, right button for firing

## Save system
Progress is saved in the browser with `localStorage`:
- best score
- unlocked ships
- selected ship
- upgrades
- credits
- missions
- settings

If storage is unavailable, the game continues without crashing.

## Checklist of implemented features
- [x] Main menu and navigation
- [x] Playable core game loop
- [x] Smooth movement and shooting
- [x] Enemy waves and asteroid hazards
- [x] Health, shields, lives, and score
- [x] Credits and rewards
- [x] Missions and progression
- [x] Ship selection and upgrade system
- [x] Save/load using LocalStorage
- [x] Mobile touch controls
- [x] Audio with Web Audio API
- [x] Responsive HUD and menus
