import { Vector3 } from "babylonjs";

export const TAU = 2 * Math.PI;

/** Division avoiding `NaN` for `0 / 0` */
export const frac = (x: number, y: number) => x === 0 ? 0 : x / y;

export function subdivide(from: number, to: number, nSteps: number): number[] {
  const result: number[] = [];
  for (let i = 0, j = nSteps; j >= 0; i++, j--) {
    result.push(frac((j * from + i * to), nSteps));
  }
  return result;
}

export const slerp = (from: Vector3, to: Vector3, lambda: number) =>
  Vector3.SlerpToRef(from, to, lambda, new Vector3());

export const axes: Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1),
];

export const rotateTriplet = <T>(steps: number, [x, y, z]: T[]) =>
  [[x, y, z], [y, z, x], [z, x, y]][steps];

export type Vertex = { i: number; j: number; p: Vector3; };
