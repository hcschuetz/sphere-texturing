import * as B from "@babylonjs/core";
import * as M from "mobx";
import { subdivide, TAU } from "./utils";

const signs = [1, -1];

export class RoundedBox {
  position: B.Vector3;
  /** Should have 3 sub-materials for faces/edges/corners */
  material: B.Nullable<B.MultiMaterial> = null;

  constructor(
    name: string,
    options: {
      xs: [number, number];
      ys: [number, number];
      zs: [number, number];
      radius?: number; steps?: number;
    },
    scene?: B.Scene
  ) {
    M.makeObservable(this, {
      position: M.observable,
      material: M.observable,
    });

    const { xs, ys, zs, radius = 0.1, steps = 6 } = options;

    const mesh = new B.Mesh(name, scene);
    M.autorun(() => mesh.material = this.material);

    const fractions = subdivide(0, 1, steps);
    const sines = fractions.map(alpha => Math.sin(TAU/4 * alpha));
    // Use fractions for a geodesic polyhedron and sines for sine-based placement.

    const positions: B.Vector3[] = [];
    const normals: B.Vector3[] = [];
    const faces: number[] = [];
    const edges: number[] = [];
    const corners: number[] = [];
    const posIdxs: number[/* xIdx */][/* yIdx */][/* zIdx */][/* i */][/* j */] = [];
    xs.forEach((x0, xIdx) => {
      const xSgn = signs[xIdx];
      posIdxs.push([]);
      ys.forEach((y0, yIdx) => {
        const ySgn = signs[yIdx];
        posIdxs.at(-1)!.push([]);
        zs.forEach((z0, zIdx) => {
          const zSgn = signs[zIdx];
          const flip = xSgn * ySgn * zSgn < 0;

          function addTriangle(
            indices: number[], a: number, b: number, c: number
          ) {
            if (flip) {
              indices.push(a, c, b);
            } else {
              indices.push(a, b, c);
            }
          }

          function addQuadrangle(
            indices: number[], a: number, b: number, c: number, d: number
          ) {
            addTriangle(indices, a, b, c);
            addTriangle(indices, a, c, d);
          }

          const cornerPosIdxs: number[/* i */][/* j */] = [];
          posIdxs.at(-1)!.at(-1)!.push(cornerPosIdxs);
          sines.forEach((sineX, i) => {
            const x = xSgn * sineX;
            cornerPosIdxs.push([]);
            sines.slice(0, steps - i + 1).forEach((sineY, j) => {
              const y = ySgn * sineY;
              const k = steps - i - j;
              const sineZ = sines[k];
              const z = zSgn * sineZ;
              const normal = new B.Vector3(x, y, z).normalize();
              const pos = normal.scale(radius).addInPlaceFromFloats(x0, y0, z0);
              const pIdx = positions.length;
              positions.push(pos);
              normals.push(normal)
              cornerPosIdxs[i].push(pIdx);

              // ===== Corners =====
              if (i > 0) {
                if (j > 0) {
                  addTriangle(corners,
                    pIdx,
                    cornerPosIdxs[i][j - 1],
                    cornerPosIdxs[i - 1][j],
                  );
                }
                addTriangle(corners,
                  pIdx,
                  cornerPosIdxs[i - 1][j],
                  cornerPosIdxs[i - 1][j + 1],
                );
              }

              // ===== Edges =====
              if (xIdx === 1 && i === 0 && j > 0) {
                addQuadrangle(edges,
                  pIdx,
                  cornerPosIdxs[0][j - 1],
                  posIdxs[0][yIdx][zIdx][0][j - 1],
                  posIdxs[0][yIdx][zIdx][0][j],
                );
              }
              if (yIdx === 1 && j === 0 && i > 0) {
                addQuadrangle(edges,
                  pIdx,
                  posIdxs[xIdx][0][zIdx][i][0],
                  posIdxs[xIdx][0][zIdx][i - 1][0],
                  cornerPosIdxs[i - 1][0],
                );
              }
              if (zIdx === 1 && k === 0 && i > 0) {
                addQuadrangle(edges,
                  pIdx,
                  cornerPosIdxs[i - 1][j + 1],
                  posIdxs[xIdx][yIdx][0][i - 1][j + 1],
                  posIdxs[xIdx][yIdx][0][i][j],
                );
              }

              // ===== Faces =====
              if (xIdx === 1 && yIdx === 1 && i === 0 && j === 0) {
                addQuadrangle(faces,
                  pIdx,
                  posIdxs[1][0][zIdx][0][0],
                  posIdxs[0][0][zIdx][0][0],
                  posIdxs[0][1][zIdx][0][0],
                );
              }
              if (xIdx === 1 && zIdx === 1 && i === 0 && k === 0) {
                addQuadrangle(faces,
                  pIdx,
                  posIdxs[0][yIdx][1][0][steps],
                  posIdxs[0][yIdx][0][0][steps],
                  posIdxs[1][yIdx][0][0][steps],
                );
              }
              if (yIdx === 1 && zIdx === 1 && j === 0 && k === 0) {
                addQuadrangle(faces,
                  pIdx,
                  posIdxs[xIdx][1][0][steps][0],
                  posIdxs[xIdx][0][0][steps][0],
                  posIdxs[xIdx][0][1][steps][0],
                );
              }
            });
          });
        });
      });
    });

    const indicess = [faces, edges, corners];

    const vertexData = new B.VertexData();
    vertexData.positions = positions.flatMap(p => p.asArray());
    vertexData.normals = normals.flatMap(p => p.asArray());
    vertexData.indices = indicess.flat();
    vertexData.applyToMesh(mesh);

    mesh.subMeshes = [];
    let sum = 0;
    indicess.forEach((indices, i) => {
      new B.SubMesh(i, 0, positions.length, sum, indices.length, mesh);
      sum += indices.length;
    });
  }
}
