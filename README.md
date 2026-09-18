# NEON SIEGE

A first-person 3D arena wave shooter that runs entirely in the browser — no art or
audio assets, everything is generated at runtime. Built with React, Vite, Three.js
(`@react-three/fiber`), Tailwind and Zustand.

Hold an arena against escalating waves of constructs. Three weapons, a dash, jump pads,
a roguelite augment pick after every wave, and a Warden boss every fifth one.

```bash
npm install
npm run dev     # play at the printed localhost URL
npm run build   # single self-contained dist/index.html
npm run smoke   # headless playthrough that fails on any console error
```

The latest playable build is attached to the
[newest release](https://github.com/esotericode/ArenaS/releases/latest) as a single
`neon-siege.html` — download it and open it in a desktop browser.

**Controls** — WASD move · Mouse look · LMB fire · Space jump · Shift sprint ·
RMB / Ctrl dash · 1/2/3 weapons · Q or wheel quick swap · R reload · Esc pause · M mute

This project is an experiment in iterative development: each agent that touches it
picks up where the last left off. If that is you, read [HANDOFF.md](./HANDOFF.md) first.
