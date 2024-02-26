import * as B from "@babylonjs/core";
import { dv } from "./icosprite";

export const TAU = 2 * Math.PI;

export type V3 = B.Vector3;
export const V3 = B.Vector3;
export const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

// -----------------------------------------------------------------------------

/*
Naming convention:

Each icosahedron face has one edge in west-east direction
(i.e., parallel to the u axis in the sprite sheet).
The opposite corner points to (or even is) the north pole or the south pole
(i.e., in the direction of the positive or negative v axis).

We use the names W and E (for "west" and "east") for the two ends of the
west-east edge and P for the "polar" vertex when dealing with a given face.
*/


const northPole = v3(0, 1, 0);
const southPole = v3(0, -1, 0);
const height = Math.sqrt(1 / 5);
const radius = 2 * height;
// The calculations only require basic arithmetics and square roots.
// But trigonometric functions should be easier to understand:
const nonPoles = Array.from({ length: 10 }, (_, i) => v3(
  radius * Math.cos(TAU / 10 * i),
  height * (-1) ** i,
  radius * Math.sin(TAU / 10 * i)
));
// support some circular access:
nonPoles.push(...nonPoles.slice(0, 2));

export const createIcoVertices = (nSteps: number) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  let idx = 0;

  function emitVertex(pos: V3, u: number, v: number) {
    positions.push(...pos.asArray());
    uvs.push(u, v);
  }

  const indices: number[] = [];

  function emitIcoFace(w: V3, p: V3, e: V3, u_w: number, v_we: number, v_p: number, flip: boolean): void {
    function emitTriangle(a: number, b: number, c: number): void {
      indices.push(a, flip ? c : b, flip ? b : c);
    }

    for (let i = 0, jk = nSteps; jk >= 0; i++, jk--) {
      for (let j = 0, k = jk; k >= 0; j++, k--) {
        if (i > 0) {
          const prevLeft = idx - jk - 2;
          emitTriangle(idx, prevLeft, prevLeft + 1);
          if (j > 0) {
            emitTriangle(idx, idx - 1, prevLeft);
          }
        }

        emitVertex(
          p.scale(i).addInPlace(e.scale(j)).addInPlace(w.scale(k)).normalize(),
          u_w + (i * .1 + j * .2) / nSteps,
          (i * v_p + jk * v_we) / nSteps,
        );
        idx++;
      }
    }
  };

  for (let i = 0; i < 5; i++) {
    const [upper0, lower1, upper2, lower3] = nonPoles.slice(2*i, 2*i + 4);

    //          w       p          e       u_w       v_we      v_p       flip
    emitIcoFace(upper0, northPole, upper2,  i    /5, (1-dv)/2,  1-dv   , false);
    emitIcoFace(upper0, lower1   , upper2,  i    /5, (1-dv)/2,  0      , true );
    emitIcoFace(lower1, upper2   , lower3, (i+.5)/5,  0      , (1-dv)/2, false);
    emitIcoFace(lower1, southPole, lower3, (i+.5)/5,  1      , (1+dv)/2, true );
  };

  return Object.assign(new B.VertexData(), {
    indices,
    positions,
    normals: positions,
    uvs,
  });
};
