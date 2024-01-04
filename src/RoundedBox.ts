import * as B from "@babylonjs/core";
import * as M from "mobx";
import { subdivide, TAU } from "./utils";

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
    function addTriangle(indices: number[], a: number, b: number, c: number, flip: boolean) {
      if (flip) {
        indices.push(a, c, b);
      } else {
        indices.push(a, b, c);
      }
    }
    function addQuadrangle(indices: number[], a: number, b: number, c: number, d: number, flip: boolean)  {
      addTriangle(indices, a, b, c, flip);
      addTriangle(indices, a, c, d, flip);
    }
    const positionIdxs: number[/* xIdx */][/* yIdx */][/* zIdx */][/* i */][/* j */] = [];
    xs.forEach((x0, xIdx) => {
      const xSgn = [1, -1][xIdx];
      positionIdxs.push([]);
      ys.forEach((y0, yIdx) => {
        const ySgn = [1, -1][yIdx];
        positionIdxs.at(-1)!.push([]);
        zs.forEach((z0, zIdx) => {
          const zSgn = [1, -1][zIdx];
          const flip = xSgn * ySgn * zSgn < 0;
          const cornerPositionIdxs: number[][] = [];
          positionIdxs.at(-1)!.at(-1)!.push(cornerPositionIdxs);
          sines.forEach((sineX, i) => {
            const x = xSgn * sineX;
            cornerPositionIdxs.push([]);
            sines.forEach((sineY, j) => {
              const k = steps - i - j;
              if (k < 0) {
                return;
              }
              const sineZ = sines[k];
              const y = ySgn * sineY;
              const z = zSgn * sineZ;
              const normal = new B.Vector3(x, y, z).normalize();
              const pos = normal.scale(radius).addInPlaceFromFloats(x0, y0, z0);
              const pIdx = positions.length;
              positions.push(pos);
              normals.push(normal)
              cornerPositionIdxs[i].push(pIdx);
              if (i > 0) {
                if (j > 0) {
                  addTriangle(
                    corners,
                    pIdx,
                    cornerPositionIdxs[i][j - 1],
                    cornerPositionIdxs[i - 1][j],
                    flip,
                  );
                }
                addTriangle(
                  corners,
                  pIdx,
                  cornerPositionIdxs[i - 1][j],
                  cornerPositionIdxs[i - 1][j + 1],
                  flip,
                );
            }
              if (xIdx === 1 && i === 0 && j > 0) {
                addQuadrangle(
                  edges,
                  pIdx,
                  cornerPositionIdxs[0][j - 1],
                  positionIdxs[0][yIdx][zIdx][0][j - 1],
                  positionIdxs[0][yIdx][zIdx][0][j],
                  flip,
                );
              }
              if (yIdx === 1 && j === 0 && i > 0) {
                addQuadrangle(
                  edges,
                  pIdx,
                  positionIdxs[xIdx][0][zIdx][i][0],
                  positionIdxs[xIdx][0][zIdx][i - 1][0],
                  cornerPositionIdxs[i - 1][0],
                  flip,
                );
              }
              if (zIdx === 1 && k === 0 && i > 0) {
                addQuadrangle(
                  edges,
                  pIdx,
                  cornerPositionIdxs[i - 1][j + 1],
                  positionIdxs[xIdx][yIdx][0][i - 1][j + 1],
                  positionIdxs[xIdx][yIdx][0][i][j],
                  flip,
                );
              }
              if (xIdx === 1 && yIdx === 1 && i === 0 && j === 0) {
                addQuadrangle(
                  faces,
                  pIdx,
                  positionIdxs[1][0][zIdx][0][0],
                  positionIdxs[0][0][zIdx][0][0],
                  positionIdxs[0][1][zIdx][0][0],
                  flip,
                );
              }
              if (xIdx === 1 && zIdx === 1 && i === 0 && k === 0) {
                addQuadrangle(
                  faces,
                  pIdx,
                  positionIdxs[0][yIdx][1][0][steps],
                  positionIdxs[0][yIdx][0][0][steps],
                  positionIdxs[1][yIdx][0][0][steps],
                  flip,
                );
              }
              if (yIdx === 1 && zIdx === 1 && j === 0 && k === 0) {
                addQuadrangle(
                  faces,
                  pIdx,
                  positionIdxs[xIdx][1][0][steps][0],
                  positionIdxs[xIdx][0][0][steps][0],
                  positionIdxs[xIdx][0][1][steps][0],
                  flip,
                );
              }
            });
          });
        });
      });
    });
    const vertexData = new B.VertexData();
    vertexData.positions = positions.flatMap(p => p.asArray());
    vertexData.normals = normals.flatMap(p => p.asArray());
    vertexData.indices = [...faces, ...edges, ...corners];
    vertexData.applyToMesh(mesh);

    mesh.subMeshes = [];
    new B.SubMesh(0, 0, positions.length, 0, faces.length, mesh);
    new B.SubMesh(1, 0, positions.length, faces.length, edges.length, mesh);
    new B.SubMesh(2, 0, positions.length, faces.length + edges.length, corners.length, mesh);
  }
}
