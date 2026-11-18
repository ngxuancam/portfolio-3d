/**
 * Cinematic signals shared by the blueprint ship and the camera rig (both live in the same
 * stage thread): how fast the flight is, how hard the ship is banking, and whether the visitor
 * asked for reduced motion (no shake, no roll, no FOV kick).
 */
export const cinema = {
  /** flight speed, 0 (parked) .. 1 (full sweep), smoothed */
  speed: 0,
  /** the ship's roll into the current bend, radians */
  bank: 0,
  calm: false,
};
