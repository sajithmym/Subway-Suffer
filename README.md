# 🏃 Subway Surfers - Web Edition

A fully-featured Subway Surfers clone built with HTML5 Canvas, JavaScript, and Tailwind CSS. Play directly in your browser — no installation required.

## 🎮 Features

- **3D Perspective Rendering** — Pseudo-3D chase camera view with perspective projection
- **Three-Lane System** — Switch between left, center, and right lanes
- **Jump & Slide** — Jump over barriers and slide under obstacles
- **Colorful Trains** — Dodge multi-colored subway trains of varying lengths
- **Coin Collection** — Collect gold coins in lines and arc patterns
- **Power-Ups** — Coin Magnet, 2x Score Multiplier, Jetpack
- **Progressive Difficulty** — Speed increases over time
- **Modern UI** — Home screen, HUD, pause menu, game over screen, character select
- **4 Playable Characters** — Jake, Tricky, Fresh, Spike
- **Sound Effects** — Procedural audio using Web Audio API
- **Particle Effects** — Coin sparkles, crash effects
- **Touch & Keyboard Controls** — Works on mobile and desktop
- **High Score & Coin Persistence** — Saved in localStorage
- **Responsive Design** — Adapts to any screen size

## 🕹️ Controls

### Desktop (Keyboard)
| Key | Action |
|-----|--------|
| ← / A | Move Left |
| → / D | Move Right |
| ↑ / W / Space | Jump |
| ↓ / S | Slide |
| P / Escape | Pause |

### Mobile (Touch)
| Gesture | Action |
|---------|--------|
| Swipe Left | Move Left |
| Swipe Right | Move Right |
| Swipe Up | Jump |
| Swipe Down | Slide |
| Tap Pause Button | Pause |

## 🚀 How to Run

1. Open `index.html` in any modern web browser
2. Or serve with any local server:
   ```bash
   # Python
   python3 -m http.server 8080

   # Node.js
   npx serve .
   ```
3. Navigate to `http://localhost:8080`

## 📁 Project Structure

```
Subway Suffer/
├── index.html          # Main HTML with all UI screens
├── css/
│   └── style.css       # Custom styles, animations, UI theming
├── js/
│   └── game.js         # Complete game engine (~2500 lines)
└── README.md           # This file
```

## 🛠️ Tech Stack

- **HTML5 Canvas** — Game rendering
- **Vanilla JavaScript** — Game engine, physics, input handling
- **Tailwind CSS (CDN)** — UI layout and styling
- **Web Audio API** — Procedural sound effects
- **localStorage** — Score and coin persistence

## 📋 Game Architecture

| Module | Responsibility |
|--------|---------------|
| `CONFIG` | All game constants and tuning parameters |
| `AudioManager` | Procedural sound effects via Web Audio API |
| `ParticleSystem` | Visual particle effects (coins, crashes) |
| `Player` | Movement, jumping, sliding, power-up states |
| `Train / Barrier / Coin / PowerUp` | World object classes |
| `WorldGenerator` | Procedural obstacle and collectible spawning |
| `Renderer` | 3D perspective projection and Canvas drawing |
| `InputHandler` | Keyboard + touch/swipe input |
| `Game` | Main game loop, collision detection, scoring |
| `UIController` | HTML screen management and HUD updates |

## 📜 License

This project is for educational purposes only. Subway Surfers is a trademark of SYBO Games.
