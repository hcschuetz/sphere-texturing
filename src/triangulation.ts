import { Vector3 } from "babylonjs";

const TAU = 2 * Math.PI;

/** Division avoiding `NaN` for `0 / 0` */
const frac = (x: number, y: number) => x === 0 ? 0 : x / y;

function subdivide(from: number, to: number, nSteps: number): number[] {
  const result: number[] = [];
  for (let i = 0, j = nSteps; j >= 0; i++, j--) {
    result.push(frac((j * from + i * to), nSteps));
  }
  return result;
}

const slerp = (from: Vector3, to: Vector3, lambda: number) =>
  Vector3.SlerpToRef(from, to, lambda, new Vector3());

const axes: Vector3[] = [
  new Vector3(1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, 0, 1),
];

const rotateTriplet = <T>(steps: number, [x, y, z]: T[]) =>
  [[x, y, z], [y, z, x], [z, x, y]][steps];

export type Triangulation = (
  n: number,
  // To be called for all pairs of nonnegative integers (i, j) with i + j <= n:
  addVertex: (i: number, j: number, v: Vector3) => void,
) => void;

const mapTriangulation = (t: Triangulation, f: (v: Vector3) => Vector3): Triangulation =>
  (n, addVertex) => t(n, (i, j, v) => addVertex(i, j, f(v)));

const normalize = (v: Vector3) => v.normalize();

export const onParallels = (rotation: number): Triangulation => (n, addVertex) => {
  for (let i = 0; i <= n; i++) {
    const alpha = i/n * TAU/4
    const sin_alpha = Math.sin(alpha);
    const cos_alpha = Math.cos(alpha);
    for (let j = 0; j <= n - i; j++) {
      const beta = frac(j, n - i) * TAU/4;
      const sin_beta = Math.sin(beta);
      const cos_beta = Math.cos(beta);
      addVertex(i, j,
        new Vector3(...rotateTriplet(rotation, [
          cos_alpha * cos_beta,
          sin_alpha,
          cos_alpha * sin_beta
        ])),
      );
    }
  }
}

export const parallels = (rotation: number, n: number, resolution: number): Vector3[][] => {
  return subdivide(0, 1, n).map(i => {
    const alpha = i * TAU/4
    const sin_alpha = Math.sin(alpha);
    const cos_alpha = Math.cos(alpha);
    return subdivide(0, 1, resolution).map(j => {
      const beta = j * TAU/4;
      const sin_beta = Math.sin(beta);
      const cos_beta = Math.cos(beta);
      return new Vector3(...rotateTriplet(rotation, [
        cos_alpha * cos_beta,
        sin_alpha,
        cos_alpha * sin_beta
      ]));
    })
  })
}

export const onEvenGeodesics = (rotation: number): Triangulation => {
  const [A, B, C] = rotateTriplet(rotation, axes);
  return (n, addVertex) => {
    for (let i = 0; i <= n; i++) {
      const AB = slerp(A, B, i/n);
      const CB = slerp(C, B, i/n);
      for (let j = 0; j <= n - i; j++) {
        addVertex(i, j, slerp(AB, CB, frac(j, n - i)));
      }
    }
  }
}

export const evenGeodesics = (rotation: number, n: number, resolution: number): Vector3[][] => {
  const [A, B, C] = rotateTriplet(rotation, axes);
  return subdivide(0, 1, n).map(i => {
    const XY = slerp(A, B, i);
    const ZY = slerp(C, B, i);
    return subdivide(0, 1, resolution).map(j =>
      slerp(XY, ZY, j)
    );
  });
}


export const flat: Triangulation = (n, addVertex) => {
  const X = new Vector3(1, 0, 0);
  const Y = new Vector3(0, 1, 0);
  const Z = new Vector3(0, 0, 1);
  for (let i = 0; i <= n; i++) {
    const XY = Vector3.Lerp(X, Y, i/n);
    const ZY = Vector3.Lerp(Z, Y, i/n);
    for (let j = 0; j <= n - i; j++) {
      addVertex(i, j, Vector3.Lerp(XY, ZY, frac(j, n - i)));
    }
  }
}
export const geodesic = mapTriangulation(flat, normalize);

export const sines: Triangulation = (n, addVertex) => {
  for (let i = 0; i <= n; i++) {
    const sin_i = Math.sin(i/n * TAU/4);
    for (let j = 0; j <= n - i; j++) {
      const k = n - i - j;
      const sin_j = Math.sin(j/n * TAU/4);
      const sin_k = Math.sin(k/n * TAU/4);
      addVertex(i, j, new Vector3(sin_i, sin_j, sin_k));
    }
  }
}
export const sineBased = mapTriangulation(sines, normalize);

export const rays = (n: number, tr: Triangulation): Vector3[][] => {
  const origin = new Vector3();
  const result: Vector3[][] = [];
  tr(n, (i, j, v) => result.push([origin, v]))
  return result;
};


export function driver<V>(
  n: number,
  tr: Triangulation,
  options: {
    emitVertex: (name: string, p: Vector3) => V,
    emitEdge: (name: string, v1: V, v2: V) => void,
    emitFace: (name: string, v1: V, v2: V, v3: V) => void,
  },
): void {
  const key = (i: number, j: number) => `${i},${j},${n - i - j}`;
  const {emitVertex, emitEdge, emitFace} = options;
  const vertices: Record<string, V> = {};
  tr(n, (i, j, p) => {
    const addr = key(i, j);
    const v = emitVertex("v" + addr, p);
    vertices[addr] = v;
    if (i > 0) {
      const v1 = vertices[key(i-1, j)];
      const v2 = vertices[key(i-1, j+1)];
      emitEdge(`e1(${addr})`, v1, v);
      emitEdge(`e2(${addr})`, v2, v);
      emitFace(`f1(${addr})`, v1, v2, v);
      if (j > 0) {
        const v3 = vertices[key(i, j-1)];
        emitFace(`f2(${addr})`, v1, v, v3);
      }
    }
    if (j > 0) {
      const v3 = vertices[key(i, j-1)];
      emitEdge(`e3(${addr})`, v3, v);
    }
  });
}
