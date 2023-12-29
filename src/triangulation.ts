import { Vector3 } from "@babylonjs/core";
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
/**
 * Not a sphere triangulation as non-edge face points are mapped to some point
 * within the sphere.
 */
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


const baryNorm = (p: Vector3): number => p.x + p.y + p.z;
const baryNormalizeInPlace = (p: Vector3): Vector3 => p.scaleInPlace(1 / baryNorm(p));

/**
 * For a given vector p on the octahedron face (i.e., "baryNormalized"),
 * iteratively find a unit vector (x, y, z) such that the angles
 * `asin(x), asin(y), asin(z)` have a barycentric ratio
 * `asin(x) : asin(y) : asin(z)` equal to
 * `p.x : p.y : p.z`.
 */
function findSineRatio(p: Vector3): Vector3 {
  // `p.normalizeToNew()` or even `new Vector3(1,1,1).normalize()` as an
  // initial gues would work, but starting from our "sineBased" estimation
  // saves a few iterations and leads to exact values along the edges:
  const guess = new Vector3(
    Math.sin(TAU/4 * p.x), Math.sin(TAU/4 * p.y), Math.sin(TAU/4 * p.z),
  ).normalize();
  for (let i = 0; i < 30; i++) {
    const angles = new Vector3(Math.asin(guess.x), Math.asin(guess.y), Math.asin(guess.z));
    baryNormalizeInPlace(angles);
    const offset = angles.subtract(p);
    if (offset.length() < 1e-10) {
      // console.log("success", i, p, angles)
      return guess;
    }
    baryNormalizeInPlace(guess).subtractInPlace(offset).normalize()
  }
  console.warn("findSineRatio: iteration failed");
  return guess;
}
export const asinBased = (n: number, refinement?: number) =>
  map2(flat(n, refinement), findSineRatio);

export const rays = (n: number, tr: Triangulation): Vector3[][] =>
  tr.flatMap(points => points.map(point => [Vector3.ZeroReadOnly, point]));
