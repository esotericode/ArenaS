import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { World } from './World';
import { Player } from './Player';
import { Weapon } from './Weapon';
import { Enemies } from './Enemies';
import { Pickups } from './Pickups';
import { Effects } from './Effects';
import { WaveDirector } from './WaveDirector';
import { PLAYER } from './config';
import { runtime } from './runtime';
import { useGame } from './store';

export function Scene() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 80, near: 0.05, far: 400, position: [0, PLAYER.eyeHeight, 12] }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
        scene.background = new THREE.Color('#050816');
        scene.fog = new THREE.FogExp2('#070b1c', 0.012);
        runtime.canvas = gl.domElement;
      }}
      onClick={() => {
        // clicking the canvas while playing but unlocked re-acquires the pointer
        const st = useGame.getState();
        if ((st.status === 'playing' || st.status === 'paused') && document.pointerLockElement !== runtime.canvas) {
          runtime.canvas?.requestPointerLock();
        }
      }}
      className="absolute inset-0"
    >
      <World />
      <Player />
      <Weapon />
      <Enemies />
      <Pickups />
      <Effects />
      <WaveDirector />
    </Canvas>
  );
}
