import * as B from "@babylonjs/core";
import { subdivide, TAU } from "./utils";

const signs = [1, -1];

/**
 * A Box with (surprise!) rounded corners and edges.
 *
 * Can take a `MultiMaterial` with 3 sub-materials for faces/edges/corners.
 */
export class RoundedBox extends B.Mesh {
  constructor(
    name: string,
    options: {
      xs?: [number, number];
      ys?: [number, number];
      zs?: [number, number];
      radius?: number; steps?: number;
    } = {},
    scene?: B.Scene
  ) {
    super(name, scene);

    const { xs = signs, ys = signs, zs = signs, radius = 0.2, steps = 6 } = options;

    const fractions = subdivide(0, 1, steps);
    const sines = fractions.map(alpha => Math.sin(TAU/4 * alpha));
    // Use fractions for a geodesic polyhedron or sines for sine-based placement.

    let nVertices = 0;
    const positions: number[] = [];
    const normals: number[] = [];

    function addVertex(position: B.Vector3, normal: B.Vector3): number {
      normals.push(normal.x, normal.y, normal.z)
      positions.push(position.x, position.y, position.z);
      return nVertices++;
    }

    const vertices: number[/* xIdx */][/* yIdx */][/* zIdx */][/* i */][/* j */] = [];

    // three (flattened) lists of triangles:
    const faces: number[] = [];
    const edges: number[] = [];
    const corners: number[] = [];

    xs.forEach((x0, xIdx) => {
      const xSgn = signs[xIdx];
      vertices[xIdx] = [];
      ys.forEach((y0, yIdx) => {
        const ySgn = signs[yIdx];
        vertices[xIdx][yIdx] = [];
        zs.forEach((z0, zIdx) => {
          const zSgn = signs[zIdx];
          const cornerVertices: number[/* i */][/* j */] = [];
          vertices[xIdx][yIdx][zIdx] = cornerVertices;

          const flip = xSgn * ySgn * zSgn < 0;
          function addTriangle(
            triangles: number[], a: number, b: number, c: number
          ) {
            if (flip) {
              triangles.push(a, c, b);
            } else {
              triangles.push(a, b, c);
            }
          }
          function addQuadrangle(
            triangles: number[], a: number, b: number, c: number, d: number
          ) {
            addTriangle(triangles, a, b, c);
            addTriangle(triangles, a, c, d);
          }

          sines.forEach((sineX, i) => {
            const x = xSgn * sineX;
            cornerVertices[i] = [];
            sines.slice(0, steps - i + 1).forEach((sineY, j) => {
              const y = ySgn * sineY;

              // no loop for k as it is determined by i and j:
              const k = steps - i - j;
              const sineZ = sines[k];
              const z = zSgn * sineZ;

              const normal = new B.Vector3(x, y, z).normalize();
              const vertex = addVertex(
                normal.scale(radius).addInPlaceFromFloats(x0, y0, z0),
                normal,
              );
              cornerVertices[i][j] = vertex;

              // ===== Corners =====
              if (i > 0) {
                if (j > 0) {
                  addTriangle(corners,
                    vertex,
                    cornerVertices[i][j - 1],
                    cornerVertices[i - 1][j],
                  );
                }
                addTriangle(corners,
                  vertex,
                  cornerVertices[i - 1][j],
                  cornerVertices[i - 1][j + 1],
                );
              }

              // ===== Edges =====
              if (xIdx === 1 && i === 0 && j > 0) {
                addQuadrangle(edges,
                  vertex,
                  cornerVertices[0][j - 1],
                  vertices[0][yIdx][zIdx][0][j - 1],
                  vertices[0][yIdx][zIdx][0][j],
                );
              }
              if (yIdx === 1 && j === 0 && i > 0) {
                addQuadrangle(edges,
                  vertex,
                  vertices[xIdx][0][zIdx][i][0],
                  vertices[xIdx][0][zIdx][i - 1][0],
                  cornerVertices[i - 1][0],
                );
              }
              if (zIdx === 1 && k === 0 && i > 0) {
                addQuadrangle(edges,
                  vertex,
                  cornerVertices[i - 1][j + 1],
                  vertices[xIdx][yIdx][0][i - 1][j + 1],
                  vertices[xIdx][yIdx][0][i][j],
                );
              }

              // ===== Faces =====
              if (xIdx === 1 && yIdx === 1 && i === 0 && j === 0) {
                addQuadrangle(faces,
                  vertex,
                  vertices[1][0][zIdx][0][0],
                  vertices[0][0][zIdx][0][0],
                  vertices[0][1][zIdx][0][0],
                );
              }
              if (xIdx === 1 && zIdx === 1 && i === 0 && k === 0) {
                addQuadrangle(faces,
                  vertex,
                  vertices[0][yIdx][1][0][steps],
                  vertices[0][yIdx][0][0][steps],
                  vertices[1][yIdx][0][0][steps],
                );
              }
              if (yIdx === 1 && zIdx === 1 && j === 0 && k === 0) {
                addQuadrangle(faces,
                  vertex,
                  vertices[xIdx][1][0][steps][0],
                  vertices[xIdx][0][0][steps][0],
                  vertices[xIdx][0][1][steps][0],
                );
              }
            });
          });
        });
      });
    });

    const triangless = [faces, edges, corners];

    const vertexData = new B.VertexData();
    vertexData.positions = positions;
    vertexData.normals = normals;
    vertexData.indices = triangless.flat();
    vertexData.applyToMesh(this);

    this.subMeshes = [];
    let sum = 0;
    triangless.forEach((triangles, i) => {
      // The documentation of B.SubMesh is unclear/misleading regarding
      // the lengths to be provided:
      // - Should we give the number of vertices or the number of coordinate
      //   values (which is 3 times the former)?
      // - Should we give the number of triangles or the number of vertex
      //   indices (which is 3 times the former)?
      // Experiments show that we need the number of vertex indices used for
      // defining the triangles, not the number of triangles.
      // The `verticesCount` parameter seems not to matter at all, but for
      // analogy we give the number of coordinates, not the number of vertices.
      new B.SubMesh(i, 0, positions.length, sum, triangles.length, this);
      sum += triangles.length;
    });
  }
}
