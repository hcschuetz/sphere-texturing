import * as B from "@babylonjs/core";
import { getUV } from "./OctaSprite";

const signs = [-1, 1];

export function createOctaSphereVertexData(n: number) {
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
        for (let i = 0; i <= n; i++) {
          for (let j = 0; j <= n - i; j++) {
            const vtx = new B.Vector3((n - i - j)/n, i/n, j/n)
            positions.push(xSgn * vtx.x, ySgn * vtx.y, zSgn * vtx.z);
            const uv = getUV(vtx, faceRef);
            uvs.push(uv.x, uv.y);

            const A = idx++;
            if (i > 0) {
              const B = A - (n - i + 1);
              const C = B - 1;
              emitTriangle(A, B, C);
              if (j > 0) {
                const D = A - 1;
                emitTriangle(A, C, D);
              }
            }
          }
        }
      }
    }
  }

  const normals = new Float32Array(positions.length);
  B.VertexData.ComputeNormals(positions, indices, normals);
  return Object.assign(new B.VertexData(), {positions, normals, uvs, indices});
}
