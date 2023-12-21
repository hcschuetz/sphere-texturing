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

export type Vertex = { i: number; j: number; p: Vector3; };

export class MotionController {
  tFrom = 0;
  tTo = 0;
  from = 0;
  to = 0;
  value = 0;
  initStep(stepSize: number, duration: number): void {
    this.from = this.to;
    this.to += stepSize;
    const now = Date.now();
    this.tFrom = now;
    this.tTo = now + duration;
  }
  isMoving(): boolean {
    return this.to !== this.value;
  }
  current(): number {
    const now = Math.min(this.tTo, Date.now());
    let weightFrom = this.tTo - now;
    let weightTo = now - this.tFrom;

    // easing:
    weightFrom = weightFrom ** 2;
    weightTo = weightTo ** 2;

    return this.value =
      (this.from * weightFrom + this.to * weightTo) / (weightFrom + weightTo);
  }
}
;

