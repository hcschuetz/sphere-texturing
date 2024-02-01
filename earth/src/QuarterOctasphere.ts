import * as B from "@babylonjs/core";
import * as T from "../lib/triangulation";

/**
 * A mesh for a quarter of a sphere.
 */
export class QuarterOctasphere extends B.Mesh {
  constructor(
    name: string,
    options: {
      steps?: number;
      smooth: boolean;
    },
    scene?: B.Scene
  ) {
    super(name, scene);

    const {
      steps = 6, smooth = true,
    } = options;

    // ========== VERTEX UTILS ==========
    /**
     * Total number of vertices in the first `i` vertex rows
     * in a sub-triangulated triangle
     */
    const rowVertices = (i: number) =>
      // This would be `i * (steps + 1)` if all rows had `steps + 1` vertices.
      // Subtract `i * (i - 1) / 2` to correct for the decreasing row lengths.
      // Then simplify the formula:
      i * (2 * steps + 3 - i) / 2;
    const nVerticesPerFace = rowVertices(steps + 1);
    const nVertices = 2 * nVerticesPerFace;
    const normals = new Float32Array(nVertices * 3);
    const uvs = new Float32Array(nVertices * 2);

    /** Compute a vertex index from the "logical" vertex position */
    // At least for now we do not merge vertices along the equator.
    const vtx = (h: number, i: number, j: number): number => h * nVerticesPerFace + rowVertices(i) + j;

    // ========== TRIANGLE UTILS ==========
    const nTriangles = 2 * steps ** 2;
    const indices = new Uint32Array(nTriangles * 3);

    let vertexIdx = 0;

    function triangle(flip: boolean, vtxLocal: (u: number, v: number) => number) {
      indices[vertexIdx * 3 + 0] = vtxLocal(0, 0);
      indices[vertexIdx * 3 + 1] = flip ? vtxLocal(1, 0) : vtxLocal(0, 1);
      indices[vertexIdx * 3 + 2] = flip ? vtxLocal(0, 1) : vtxLocal(1, 0);
      vertexIdx++;
    }

    // ========== CREATE VERTICES AND TRIANGLES ==========
    const triangulation = T.geodesics(steps); // TODO make selectable again

    [-1, 1].forEach((ySgn, h) => {
      const flip = ySgn < 0;
      // In our triangulations i grows in the y direction, j in the z
      // direction and k in the x direction.
      triangulation.forEach((row, i) => {
        row.forEach(({ x, y, z }, j) => {
          const scale = 1 / (x + y + z);
          y *= ySgn;

          const idx = vtx(h, i, j);
          normals[idx * 3 + 0] = x;
          normals[idx * 3 + 1] = y;
          normals[idx * 3 + 2] = z;

          const v_ = z + Math.max(y, 0);
          const u_ = v_ - y;
          uvs[(idx * 2 + 0)] = u_ * scale;
          uvs[(idx * 2 + 1)] = v_ * scale;

          if (i > 0) triangle(flip, (u, v) => vtx(h, i - 1 + u, j + v));
          if (i > 0 && j > 0) triangle(flip, (u, v) => vtx(h, i - u, j - v));
        });
      });
    });

    // ========== BUILD THE MESH ==========
    const vertexData = new B.VertexData();
    vertexData.positions = normals; // works since we are on the unit sphere
    if (smooth) {
      vertexData.normals = normals;
    }
    vertexData.uvs = uvs;
    vertexData.indices = indices;
    vertexData.applyToMesh(this);
  }
}
