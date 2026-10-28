"use client";

import { useMemo, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Crown } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { Community } from "@/lib/community";
import type { MonthlySelection, MonthlySelectionPlayer } from "@/lib/monthlySelection";

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

const COURT_WIDTH = 6;
const COURT_DEPTH = 9;

// Mesmas posições relativas da versão em cartão (percentual da largura/
// profundidade da quadra), só que em coordenadas X/Z pro tabuleiro 3D.
const PLAYER_SPOTS: [number, number][] = [
  [-0.27, -0.24],
  [0.27, -0.24],
  [-0.27, 0.24],
  [0, 0.24],
  [0.27, 0.24],
];
const SETTER_SPOT: [number, number] = [0, -0.24];

function toWorld([px, pz]: [number, number]): [number, number, number] {
  return [px * COURT_WIDTH, 0, pz * COURT_DEPTH];
}

function makeCourtTexture(sand: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 768;
  const ctx = canvas.getContext("2d")!;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  if (sand) {
    gradient.addColorStop(0, "#d8ad62");
    gradient.addColorStop(0.45, "#edca82");
    gradient.addColorStop(1, "#c99348");
  } else {
    gradient.addColorStop(0, "#6541a5");
    gradient.addColorStop(0.45, "#7954bd");
    gradient.addColorStop(1, "#52318f");
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,.92)";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, canvas.width - 28, canvas.height - 28);
  ctx.beginPath();
  ctx.moveTo(14, canvas.height / 2);
  ctx.lineTo(canvas.width - 14, canvas.height / 2);
  ctx.strokeStyle = "rgba(255,255,255,.8)";
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,.3)";
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height - 36);
  ctx.fillText("VÔLEI POR AMOR", 0, 0);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function Court({ community }: { community: Community }) {
  const texture = useMemo(() => makeCourtTexture(community === "sand"), [community]);
  const logoTexture = useLoader(THREE.TextureLoader, "/vpa-nova-logo.png");

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
        <planeGeometry args={[COURT_WIDTH, COURT_DEPTH]} />
        <meshStandardMaterial map={texture} roughness={0.85} />
      </mesh>
      {/* logo da VPA decalada no centro da quadra */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <planeGeometry args={[2.1, 2.1]} />
        <meshBasicMaterial map={logoTexture} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      {/* rede */}
      <group position={[0, 0, 0]}>
        <mesh position={[-COURT_WIDTH / 2 + 0.05, 0.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
          <meshStandardMaterial color="#ddd6fe" />
        </mesh>
        <mesh position={[COURT_WIDTH / 2 - 0.05, 0.55, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 1.1, 8]} />
          <meshStandardMaterial color="#ddd6fe" />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <planeGeometry args={[COURT_WIDTH - 0.1, 0.55]} />
          <meshStandardMaterial color="#f5f3ff" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

function PlayerFigure({ player, spot, featured = false }: { player: MonthlySelectionPlayer; spot: [number, number]; featured?: boolean }) {
  const [x, , z] = toWorld(spot);
  const bodyColor = featured ? "#fbbf24" : "#7c3aed";

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.06, 20]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, 0.34, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.11, 0.56, 12]} />
        <meshStandardMaterial color={featured ? "#fde68a" : "#c4b5fd"} />
      </mesh>
      <Html position={[0, 0.98, 0]} center distanceFactor={8} style={{ pointerEvents: "none" }}>
        <div className="flex w-24 flex-col items-center text-center">
          <div className="relative">
            <div className={`rounded-full p-0.5 shadow-xl ${featured ? "bg-gradient-to-br from-amber-200 via-yellow-400 to-amber-600" : "bg-white/80"}`}>
              {player.avatarUrl ? (
                <Avatar src={player.avatarUrl} name={player.fullName} size="lg" />
              ) : (
                // Fallback próprio com mais contraste: o degradê suave do
                // Avatar padrão (pensado pra UI 2D cheia de contexto ao redor)
                // ficava quase invisível flutuando sozinho na cena 3D --
                // parecia um boneco vazio, sem ninguém em cima.
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-purple-700 text-base font-black text-white ring-2 ring-white/40">
                  {initials(player.fullName) || "?"}
                </span>
              )}
            </div>
            {featured && (
              <span className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border-2 border-[#30205f] bg-amber-300 text-amber-950 shadow-lg">
                <Crown className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
          </div>
          <div className={`mt-1.5 w-full rounded-xl border px-1.5 py-1 shadow-lg backdrop-blur-md ${featured ? "border-amber-200/40 bg-amber-300/90 text-amber-950" : "border-white/20 bg-[#1b1142]/90 text-white"}`}>
            <p className="truncate text-[9px] font-black leading-tight">{player.fullName}</p>
            <p className={`mt-0.5 truncate text-[7px] font-bold uppercase tracking-wide ${featured ? "text-amber-900/70" : "text-purple-200/65"}`}>
              {featured ? `Levantador(a) · ${player.selectionScore.toFixed(1)}` : `${player.selectionScore.toFixed(1)} pts`}
            </p>
          </div>
        </div>
      </Html>
    </group>
  );
}

function Scene({ selection, community }: { selection: MonthlySelection; community: Community }) {
  const controlsRef = useRef(null);
  if (!selection.setter) return null;

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3, 6, 4]} intensity={1.1} castShadow />
      <directionalLight position={[-4, 3, -3]} intensity={0.35} />
      <Court community={community} />
      {selection.players.map((player, index) => (
        <PlayerFigure key={player.profileId} player={player} spot={PLAYER_SPOTS[index]} />
      ))}
      <PlayerFigure player={selection.setter} spot={SETTER_SPOT} featured />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={7}
        maxDistance={14}
        minPolarAngle={Math.PI / 5}
        maxPolarAngle={Math.PI / 2.35}
      />
    </>
  );
}

export function MonthlySelectionCourt3D({ selection, community }: { selection: MonthlySelection; community: Community }) {
  return (
    <div className="relative mx-auto aspect-[3/4] w-full max-w-xl overflow-hidden rounded-2xl border-4 border-white/80 bg-[#120d2d] shadow-inner">
      <Canvas shadows camera={{ position: [0, 8.6, 9.2], fov: 38 }} dpr={[1, 1.75]}>
        <Scene selection={selection} community={community} />
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-white/60 backdrop-blur">
        Arraste pra girar a maquete
      </div>
    </div>
  );
}
