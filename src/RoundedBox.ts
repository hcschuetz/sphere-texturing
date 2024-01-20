import * as B from "@babylonjs/core";
import * as T from "./triangulation";
import { map2 } from "./utils";

// TODO Support single-value dimensions.
// In that case do not create the corresponding faces and edges.
// Identify the coinciding vertices of adjacent corners?

// TODO Or support partial rounded boxes more generally.
// How to specify what to include and what to exclude?

// TODO Support textures and UV coordinates (not just our per-triangle `(u, v)`)
// (How do we want to attach textures conceptually?)

enum Mat { FACE, EDGE, CORNER };
const mats = Object.values(Mat).filter(v => typeof v === "string");

const signs: [number, number] = [-1, 1];

/**
 * A Box with (surprise!) rounded corners and edges.
 *
 * Can take a `MultiMaterial` with 3 sub-materials for faces/edges/corners.
 * 
 * Notice that the `radius` goes on top of the dimensions.
 * That is, we do not grind off the edges and corners of a `xs`/`ys`/`zs` box
 * to make them round.  We rather pack such a box in a `radius`-thick wrapper.
 * 
 * `options.steps` gives the number of segments into which a quarter-circle
 * of the rounding is divided.
 */
export default class RoundedBox extends B.Mesh {
  constructor(
    name: string,
    options: {
      xs?: [number, number], ys?: [number, number], zs?: [number, number],
      radius?: number, steps?: number,
      triangulationFn: (steps: number) => T.Triangulation,
    },
    scene?: B.Scene
  ) {
    super(name, scene);

    const {
      xs = signs, ys = signs, zs = signs,
      radius = 0.2, steps = 6,
      triangulationFn,
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
    const verticesPerCorner = rowVertices(steps + 1);
    const nCoords = 8 * verticesPerCorner * 3;
    const positions = new Float32Array(nCoords);
    const normals = new Float32Array(nCoords);

    /** Compute a vertex index from the "logical" vertex position */
    const vtx = (
      xIdx: number, yIdx: number, zIdx: number, // which corner?
      i: number, j: number, // where in the rounded corner's triangulation?
    ): number =>
      ((xIdx * 2 + yIdx) * 2 + zIdx) * verticesPerCorner + rowVertices(i) + j;

    function setVertexData(
      idx: number, position: B.Vector3, normal: B.Vector3,
    ): void {
      let idx3 = 3 * idx;
      positions[idx3] = position.x; normals[idx3] = normal.x; idx3++;
      positions[idx3] = position.y; normals[idx3] = normal.y; idx3++;
      positions[idx3] = position.z; normals[idx3] = normal.z;
    }

    // ========== TRIANGLE UTILS ==========

    const nTriangles = 6 * 2 + 12 * steps * 2 + 8 * steps**2;
    const indices = new Uint32Array(nTriangles * 3);
    const matIdxs = new Uint8Array(nTriangles);

    let vertexIdx = 0;
    let flip: boolean;
    let matIdx: number;

    function triangle(vtxLocal: (u: number, v: number) => number) {
      indices[vertexIdx * 3 + 0] = vtxLocal(0, 0);
      indices[vertexIdx * 3 + 1] = flip! ? vtxLocal(1, 0) : vtxLocal(0, 1);
      indices[vertexIdx * 3 + 2] = flip! ? vtxLocal(0, 1) : vtxLocal(1, 0);
      matIdxs[vertexIdx] = matIdx;
      vertexIdx++;
    }

    function quadrangle(vtxLocal: (u: number, v: number) => number) {
      triangle(vtxLocal);
      triangle((u, v) => vtxLocal(1-u, 1-v));
    }

    // ========== CREATE VERTICES AND TRIANGLES ==========

    const cornerVertices = triangulationFn(steps);

    xs.forEach((x, xIdx) => {
      const xSgn = signs[xIdx];
      ys.forEach((y, yIdx) => {
        const ySgn = signs[yIdx];
        zs.forEach((z, zIdx) => {
          const zSgn = signs[zIdx];
          flip = xSgn * ySgn * zSgn < 0;
          // In our triangulations i grows in the y direction, j in the z
          // direction and k in the x direction.
          cornerVertices.forEach((row, i) => {
            /** Is it time to draw edges and faces parallel to the y axis? */
            const doY = yIdx === 1 && i === 0;
            row.forEach((point, j) => {
              const doZ = zIdx === 1 && j === 0;

              // no loop for k as it is fully determined by i and j:
              const k = steps - i - j;
              const doX = xIdx === 1 && k === 0;

              const normal = new B.Vector3(xSgn * point.x, ySgn * point.y, zSgn * point.z);
              const position = normal.scale(radius).addInPlaceFromFloats(x, y, z);
              setVertexData(vtx(xIdx, yIdx, zIdx, i, j), position, normal);

              matIdx = Mat.CORNER;
              if (i > 0)          triangle((u, v) => vtx(xIdx, yIdx, zIdx, i-1+u, j+v));
              if (i > 0 && j > 0) triangle((u, v) => vtx(xIdx, yIdx, zIdx, i-u  , j-v));

              matIdx = Mat.EDGE;
              if (doX && j > 0) quadrangle((u, v) => vtx(u   , yIdx, zIdx, i+v, j-v));
              if (doY && j > 0) quadrangle((u, v) => vtx(xIdx, v   , zIdx, i  , j-u));
              if (doZ && i > 0) quadrangle((u, v) => vtx(xIdx, yIdx, u   , i-v, j  ));

              matIdx = Mat.FACE;
              if (doX && doY) quadrangle((u, v) => vtx(u   , v   , zIdx, i, j));
              if (doX && doZ) quadrangle((u, v) => vtx(v   , yIdx, u   , i, j));
              if (doY && doZ) quadrangle((u, v) => vtx(xIdx, u   , v   , i, j));
            });
          });
        });
      });
    });

    // ========== BUILD THE MESH ==========
    // ... grouping triangles by material

    // Set up group structure:
    const counts = mats.map(() => 0);
    matIdxs.forEach(m => counts[m] += 3);

    let sum = 0;
    const starts = counts.map(count => {
      const start = sum;
      sum += count;
      return start;
    });

    // Move indices to their groups:
    const fillPointers = starts.map(start => start);
    new Uint32Array(indices).forEach((index, i) => {
      indices[fillPointers[matIdxs[Math.floor(i/3)]]++] = index;
    });

    // Set up mesh ...
    Object.assign(new B.VertexData(), {positions, normals, indices})
    .applyToMesh(this);

    // ... and sub-meshes:
    this.subMeshes = [];
    mats.forEach((_, m) => new B.SubMesh(m, 0, nCoords, starts[m], counts[m], this));
  }
}
