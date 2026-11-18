"use client";

/**
 * Dark room: almost no ambient, a warm key from front-right-above and a cool rim from behind-left
 * so the dark hull reads by its silhouette. The moving point light at the weld lives in Ship.
 */
export function Lights() {
  return (
    <>
      <ambientLight color="#6f8796" intensity={0.12} />
      <directionalLight color="#ffc49a" intensity={2.2} position={[7, 8, 6]} />
      <directionalLight color="#bfefff" intensity={2.8} position={[-8, 3, -9]} />
      {/* faint bounce from below keeps the belly from going pure black */}
      <directionalLight color="#3a4a58" intensity={0.5} position={[0, -6, 2]} />
    </>
  );
}
