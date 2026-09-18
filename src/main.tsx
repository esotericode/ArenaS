import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { useGame } from "./game/store";
import { runtime } from "./game/runtime";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Debug handles — poke at the game from the browser console, e.g.
//   __game.setState({ health: 999 })   __runtime.mods.damageMul = 10
// Also used by the automated smoke test in scripts/.
declare global {
  interface Window {
    __game: typeof useGame;
    __runtime: typeof runtime;
  }
}
window.__game = useGame;
window.__runtime = runtime;
