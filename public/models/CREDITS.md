# Credits

## ship.glb
"Spaceship" by Quaternius — CC0 1.0 / public domain (2 814 triangles).
Source: https://poly.pizza/m/Jqfed124pQ
Used as line art for the Blueprint theme (`src/components/three/ShipModel.tsx`).

## Flight motion
The ship's position is a function of the scroll alone: a Catmull-Rom path through on-screen
keyframes (`FLIGHT_KEYS` in `src/components/three/ShipModel.tsx`), nose along the direction of
travel. The roll into bends uses the technique of three.js' own roller-coaster example
(MIT, https://github.com/mrdoob/three.js, `examples/webxr_vr_rollercoaster.html`):
`bank = -atan(headingChange * k)` from the heading change between the tangents either side of the
current point, applied by rotating `up` about the heading before `lookAt`. Re-implemented here;
no code copied verbatim.
