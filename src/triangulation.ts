import { Vector3 } from "babylonjs";
import { TAU, subdivide, axes, slerp, map2 } from "./utils";

/**
Actually triangulations should not just be arbitrary 2-level arrays of points,
but they should have a certain shape:

The last subarray should contain one point and each preceding subarray should
contain one point more than its successor.
*/
export type Triangulation = Vector3[][];

// We do not need the refinement here because the lines are straight anyway.
// But we accept a refinement for compatibility with analogous functions.
export const flat = (n: number, refinement = 1): Vector3[][] => {
  const [X, Y, Z] = axes;
  return subdivide(0, 1, n).map((i, ii) => {
    const XY = Vector3.Lerp(X, Y, i);
    const ZY = Vector3.Lerp(Z, Y, i);
    return subdivide(0, 1, (n - ii) * refinement).map(j =>
      Vector3.Lerp(XY, ZY, j)
    );
  });
}

export const geodesics = (n: number, refinement = 1): Vector3[][] =>
  map2(flat(n, refinement), p => p.normalize());

export const parallels = (n: number, refinement = 1): Vector3[][] =>
  subdivide(0, 1, n).map((i, ii) => {
    const alpha = i * TAU/4
    const sin_alpha = Math.sin(alpha);
    const cos_alpha = Math.cos(alpha);
    return subdivide(0, 1, (n - ii) * refinement).map(j => {
      const beta = j * TAU/4;
      const sin_beta = Math.sin(beta);
      const cos_beta = Math.cos(beta);
      return new Vector3(
        cos_alpha * cos_beta,
        sin_alpha,
        cos_alpha * sin_beta
      );
    });
  });

export const evenGeodesics = (n: number, refinement = 1): Vector3[][] => {
  const [X, Y, Z] = axes;
  return subdivide(0, 1, n).map((i, ii) => {
    const XY = slerp(X, Y, i);
    const ZY = slerp(Z, Y, i);
    return subdivide(0, 1, (n - ii) * refinement).map(j =>
      slerp(XY, ZY, j)
    );
  });
}

/** sin scaled to period 4 */
const sin4 = (x: number) => Math.sin(TAU/4 * x);

export const sines = (n: number): Triangulation =>
  map2(flat(n), ({x, y, z}) => new Vector3(sin4(x), sin4(y), sin4(z)));

export const sineBased = (n: number): Triangulation =>
  map2(sines(n), v => v.normalize());

export const collapsed = (n: number, refinement = 1): Vector3[][] =>
  map2(flat(n, refinement), () => Vector3.Zero());


export const rays = (n: number, tr: Triangulation): Vector3[][] =>
  tr.flatMap(points => points.map(point => [Vector3.ZeroReadOnly, point]));
