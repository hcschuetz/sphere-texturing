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

export class MotionController {
  tFrom = 0;
  tTo = 0;
  from = 0;
  to = 0;
  value = 0;

  update: (lambda: number) => void;
  onStepDone: () => void;

  initStep(duration: number, update: (lambda: number) => void): Promise<void> {
    this.from = this.to;
    this.to++;
    const now = Date.now();
    this.tFrom = now;
    this.tTo = now + duration;
    this.update = update;
    return new Promise(resolve => this.onStepDone = resolve);
  }

  isMoving(): boolean {
    return this.to !== this.value;
  }

  current(): number {
    const now = Math.min(this.tTo, Date.now());
    let weightFrom = this.tTo - now;
    let weightTo = now - this.tFrom;
    if (weightFrom === 0) {
      this.onStepDone();
    }
    return this.value =
      (this.from * weightFrom + this.to * weightTo) / (weightFrom + weightTo);
  }
}

export const easeInOut = (lambda: number) =>
  lambda * lambda / (1 + 2 * lambda * (lambda - 1));

export const map2 = <T, U>(xss: T[][], f: (x: T) => U): U[][] =>
  xss.map(xs => xs.map(f));
