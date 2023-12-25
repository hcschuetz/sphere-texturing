import { Vector3 } from "babylonjs";
import { TAU, subdivide, slerp, map2, lerp, frac } from "./utils";

/**
Actually triangulations should not just be arbitrary 2-level arrays of points,
but they should have a certain shape:

The last subarray should contain one point and each preceding subarray should
contain one point more than its successor.
*/
export type Triangulation = Vector3[][];

// Unit vectors
const ex = new Vector3(1, 0, 0);
const ey = new Vector3(0, 1, 0);
const ez = new Vector3(0, 0, 1);

const triangulate =
  (f: (t: number, u: number) => Vector3) =>
  (n: number, refinement = 1): Vector3[][] =>
  subdivide(0, 1, n).map((u, j) =>
    subdivide(0, 1, (n - j) * refinement).map(t =>
      f(t, u)
    )
  );

// These implementations are optimized for brevity/readability/comparability,
// not for efficiency:

export const flat = triangulate((t, u) =>
  lerp(lerp(ex, ez, t), ey, u)
  // lerp(lerp(ex, ey, u), lerp(ez, ey, u), t)
)
export const collapsed = triangulate(() =>
  Vector3.ZeroReadOnly
);
export const geodesics = triangulate((t, u) =>
  lerp(lerp(ex, ez, t), ey, u).normalize()
);
export const parallels = triangulate((t, u) =>
  slerp(slerp(ex, ez, t), ey, u)
)
export const evenGeodesics = triangulate((t, u) =>
  slerp(slerp(ex, ey, u), slerp(ez, ey, u), t)
)
export const sines = (n: number) => map2(flat(n), ({x, y, z}) =>
  new Vector3(Math.sin(TAU/4 * x), Math.sin(TAU/4 * y), Math.sin(TAU/4 * z))
)
export const sineBased = (n: number) => map2(sines(n), v => v.normalize());

/**
 * Parallel projection of a point in the (1,1,1) direction
 * onto the unit sphere
 */
const proj: (p: Vector3) => Vector3 = ({x, y, z}) => {
  const lambda = (Math.sqrt(2*(x*y + x*z + y*z - x*x - y*y - z*z) + 3) - (x + y + z)) / 3;
  return new Vector3(x + lambda, y + lambda, z + lambda);
}
/**
 * A variant of `sineBased` using parallel instead of central projection
 */
export const sineBased2 = (n: number) => map2(sines(n), proj);


export const rays = (n: number, tr: Triangulation): Vector3[][] =>
  tr.flatMap(points => points.map(point => [Vector3.ZeroReadOnly, point]));
