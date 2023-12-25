import { Vector3 } from "babylonjs";

export const TAU = 2 * Math.PI;

/** Division avoiding `NaN` for `0 / 0` */
export const frac = (x: number, y: number) => x === 0 ? 0 : x / y;

export const subdivide = (from: number, to: number, nSteps: number): number[] =>
  Array.from({length: nSteps + 1}, (_, i) =>
    frac(((nSteps - i) * from + i * to), nSteps)
  );

// Why isn't there a Vector3.Slerp(...) in babylon.js?
export const slerp = (from: Vector3, to: Vector3, lambda: number) =>
  Vector3.SlerpToRef(from, to, lambda, new Vector3());

export const axes: Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1),
];

export class MotionController {
  #tFrom = 0;
  #tTo = 0;
  #from = 0;
  #to = 0;
  #value = 0;

  #updateRaw: (lambda: number) => void;
  #onStepDone: () => void;

  initStep(duration: number, updateRaw: (lambda: number) => void): Promise<void> {
    this.#from = this.#to;
    this.#to++;
    const now = Date.now();
    this.#tFrom = now;
    this.#tTo = now + duration;
    this.#updateRaw = updateRaw;
    return new Promise(resolve => this.#onStepDone = resolve);
  }

  update = () => {
    if (this.#to !== this.#value) {
      const step = this.#from;
      const now = Math.min(this.#tTo, Date.now());
      let weightFrom = this.#tTo - now;
      let weightTo = now - this.#tFrom;
      this.#value =
        (this.#from * weightFrom + this.#to * weightTo) / (weightFrom + weightTo);
      this.#updateRaw(this.#value - step);
      if (weightFrom === 0) {
        this.#onStepDone();
      }
    }
  }
}

export const easeInOut = (lambda: number) =>
  lambda * lambda / (1 + 2 * lambda * (lambda - 1));

export const map2 = <T, U>(xss: T[][], f: (x: T) => U): U[][] =>
  xss.map(xs => xs.map(f));

export const zip =
  <T, U, V>(f: (t: T, u: U) => V) =>
    (ts: T[], us: U[]): V[] =>
      ts.map((t, i) => f(t, us[i]));
