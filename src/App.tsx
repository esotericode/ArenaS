import { Scene } from './game/Scene';
import { HUD } from './ui/HUD';
import { Menus } from './ui/Menus';
import { useGame } from './game/store';

export default function App() {
  const status = useGame((s) => s.status);
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-white">
      <Scene />
      {status !== 'menu' && <HUD />}
      <Menus />
    </div>
  );
}
