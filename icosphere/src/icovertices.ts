import * as B from "@babylonjs/core";
import { dv } from "./icosprite";

export const TAU = 2 * Math.PI;

export type V3 = B.Vector3;
export const V3 = B.Vector3;
export const v3 = (x: number, y: number, z: number) => new V3(x, y, z);


// -----------------------------------------------------------------------------
// Assigning u/v coordinates to a point on a face (a sub-triangulation vertex)

/*
Naming convention:

Each icosahedron face has one edge in west-east direction
(i.e., parallel to the u axis in the sprite sheet).
The opposite corner points to (or even is) the north pole or the south pole
(i.e., in the direction of the positive or negative v axis).

We use the names W and E (for "west" and "east") for the two ends of the
west-east edge and P for the "polar" vertex when dealing with a given face.
*/

/** For each face a matrix containing the `u/v` coordinates of `W/P/E` */
const wpe2uv = Array.from({length: 20}, function(_, f) {
  const Wu = (f % 5 + Number(f >= 10)/2) / 5;
  const Pu = Wu + .1;
  const Eu = Pu + .1;
  const Wv = f < 10 ? (1 - dv) / 2
                    : (f < 15 ? 0 : 1);
  const Pv = f < 10 ? (f < 5  ?  1 - dv      : 0           )
                    : (f < 15 ? (1 - dv) / 2 : (1 + dv) / 2);
  const Ev = Wv;
  return B.Matrix.FromValues(
    Wu, Wv, 1, 0,
    Pu, Pv, 1, 0,
    Eu, Ev, 1, 0,
    0 , 0 , 0, 1,
  );
});

/**
 * Map a point identified by face number and
 * (two of the three) barycentric coordinates within the face
 * to the corresponding `uv` value.
 */
export function getUV(
  face: number, p: number, e: number, w = 1 - e - p
): [number, number] {
  const {x: u, y: v} = B.Vector3.TransformCoordinates(
    new B.Vector3(w, p, e),
    wpe2uv[face],
  );
  return [u, v];
}

// -----------------------------------------------------------------------------

const northPole = v3(0, 1, 0);
const southPole = v3(0, -1, 0);
const height = Math.sqrt(1 / 5);
const radius = 2 * height;
// The calculations only require basic arithmetics and square roots.
// But trigonometric functions should be easier to understand:
const nonPoles = Array.from({ length: 10 }, (_, i) => v3(
  radius * Math.cos(TAU / 10 * i),
  height * (-1) ** i, // or equivalently: h * Math.cos(TAU/2 * i)
  radius * Math.sin(TAU / 10 * i)
));

export const createIcovertices = () => {
  const indices: number[] = [];
  const positions: number[] = [];
  const uvs: number[] = [];
  let idx = 0;
  const emitIcoFace = (a: V3, b: V3, c: V3, face: number) => {
    indices.push(idx++, idx++, idx++);
    positions.push(
      a.x, a.y, a.z,
      b.x, b.y, b.z,
      c.x, c.y, c.z
    );
    if (Math.floor(face / 5) % 2 == 0) {
      uvs.push(
        ...getUV(face, 0, 1, 0),
        ...getUV(face, 1, 0, 0),
        ...getUV(face, 0, 0, 1),
      );
    } else {
      uvs.push(
        ...getUV(face, 0, 0, 1),
        ...getUV(face, 1, 0, 0),
        ...getUV(face, 0, 1, 0),
      );
    }
  };
  for (let i = 0; i < 5; i++) {
    const [upper0, lower1, upper2, lower3] =
      Array.from({length: 4}, (_, j) => nonPoles[(2*i + j) % 10]);
    emitIcoFace(upper2, northPole, upper0,  0 + i);
    emitIcoFace(upper0, lower1   , upper2,  5 + i);
    emitIcoFace(lower3, upper2   , lower1, 10 + i);
    emitIcoFace(lower1, southPole, lower3, 15 + i);
  };

  return Object.assign(new B.VertexData(), { indices, positions, uvs });
};
