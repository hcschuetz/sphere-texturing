import * as B from "@babylonjs/core";
import * as T from "../lib/triangulation";
import { getUV } from "./OctaSprite";

const signs = [-1, 1];

export function createOctaSphereVertexData(triangulation: T.Triangulation) {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];

  let idx = 0;
  for (const xSgn of signs) {
    for (const ySgn of signs) {
      for (const zSgn of signs) {
        const faceRef = new B.Vector3(xSgn, ySgn, zSgn);
        const flip = xSgn * ySgn * zSgn > 0;
        function emitTriangle(a: number, b: number, c: number) {
          indices.push(a, flip ? c : b, flip ? b : c);
        }
        triangulation.forEach((row, i) => {
          row.forEach((vtx, j) => {
            positions.push(xSgn * vtx.x, ySgn * vtx.y, zSgn * vtx.z);
            const uv = getUV(vtx, faceRef);
            uvs.push(uv.x, uv.y);

            const A = idx++;
            if (i > 0) {
              const B = A - row.length;
              const C = B - 1;
              emitTriangle(A, B, C);
              if (j > 0) {
                const D = A - 1;
                emitTriangle(A, C, D);
              }
            }
          });
        });
      }
    }
  }

  return Object.assign(
    new B.VertexData(),
    {positions, normals: positions, uvs, indices},
  );
}
