import { Vector3 } from "babylonjs";
import { TAU, subdivide, axes, slerp } from "./utils";

export type Triangulation = Vector3[][];
export type TriangulationFn = (n: number) => Triangulation

/** 2-level version of Array.prototype.map */
const map2 = <T, U>(xss: T[][], f: (x: T) => U): U[][] =>
  xss.map(xs => xs.map(f));


// We do not need the refinement here because the lines are straight anyway.
// But we accept a refinement for compatibility with analogous functions.
export const flatLines = (n: number, refinement: number): Vector3[][] => {
  const [X, Y, Z] = axes;
  return subdivide(0, 1, n).map((i, ii) => {
    const XY = Vector3.Lerp(X, Y, i);
    const ZY = Vector3.Lerp(Z, Y, i);
    return subdivide(0, 1, (n - ii) * refinement).map(j =>
      Vector3.Lerp(XY, ZY, j)
    );
  });
}

export const flat: TriangulationFn = n => flatLines(n, 1);


export const geodesic: TriangulationFn =
  n => map2(flat(n), v => v.normalize());

export const geodesics = (n: number, refinement: number): Vector3[][] =>
  map2(flatLines(n, refinement), p => p.normalize());


export const parallels = (n: number, refinement: number): Vector3[][] =>
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

export const onParallels: TriangulationFn = n => parallels(n, 1);


export const evenGeodesics = (n: number, refinement: number): Vector3[][] => {
  const [X, Y, Z] = axes;
  return subdivide(0, 1, n).map((i, ii) => {
    const XY = slerp(X, Y, i);
    const ZY = slerp(Z, Y, i);
    return subdivide(0, 1, (n - ii) * refinement).map(j =>
      slerp(XY, ZY, j)
    );
  });
}

export const onEvenGeodesics: TriangulationFn = n => evenGeodesics(n, 1);


export const sines: TriangulationFn = n =>
  map2(flat(n), vec =>
    new Vector3(...vec.asArray().map(c => Math.sin(c * TAU/4)))
  );

export const sineBased: TriangulationFn =
  n => map2(sines(n), v => v.normalize());


export const collapsedLines = (n: number, refinement: number): Vector3[][] =>
  subdivide(0, 1, n).map((i, ii) =>
    subdivide(0, 1, (n - ii) * refinement).map(j =>
      Vector3.ZeroReadOnly
    )
  );


export const rays = (n: number, tr: Triangulation): Vector3[][] =>
  tr.flatMap(points => points.map(point => [Vector3.ZeroReadOnly, point]));
