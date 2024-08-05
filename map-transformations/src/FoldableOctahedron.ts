import * as B from "@babylonjs/core";

const du = .01;

// -----------------------------------------------------------------------------
// Abbreviations and Utilities

const TAU = 2 * Math.PI;

type V3 = B.Vector3;
const V3 = B.Vector3;

// -----------------------------------------------------------------------------
/*
We start with this flattened octahedron:

            .       .       .       .
           / \     / \     / \     / \
          /   \   /   \   /   \   /   \
         /  0  \ /  1  \ /  2  \ /  3  \
        X---+---X-------X-------X-------X
         \4a|4b/ \  5  / \  6  / \  7  /
          \ | /   \   /   \   /   \   /
           \|/     \ /     \ /     \ /
            '       '       '       '

Face 4 is cut in halves so that the net will fit better into a rectangular
texture, see below.

We will consider the central horizontal line in the "equatorial plane".
The upper corners of faces 0 to 3 are mapped to the "north pole".
The lower corners of faces 4 to 7 are mapped to the "south pole".

In the UV mapping faces 4 to 7 are moved up to achieve a rectangular texture
layout. Some small horizontal "safety distance" du between the triangles
avoids possible interferences.

1        -- +---X.X-------X.X------ X.X-------X.X---+
            |4b// \\  5  // \\  6  // \\  7  // \\4a|
            | //   \\   //   \\   //   \\   //   \\ |
            |//  0  \\ //  1  \\ //  2  \\ //  3  \\|
0        -- 'X-------X'X-------X'X-------X'X-------X'

^      u    |    |    |    |    |    |    |    |    |
|v    ---> 0/8  1/8  2/8  3/8  4/8  5/8  6/8  7/8  8/8

Each face has an edge along the equator.  We will denote the western and eastern
ends of that edge by "w" and "e".
Fruthermore triangles 0 to 1 have an edge at the north pole, denoted by "n"
and triangles 4a to 7 have an edge at the south pole, denoted by "s".
These letters are followed by the face id to identify the vertices.
*/

const namedTriangles = `
e0 n0 w0
e1 n1 w1
e2 n2 w2
e3 n3 w3
w4a s4a e4a
w4b s4b e4b
w5 s5 e5
w6 s6 e6
w7 s7 e7
`.trim().split(/\n/).map(line => line.trim().split(/\s+/));

const vertexNames = namedTriangles.flat();

const verticesByName = Object.fromEntries(vertexNames.map((name, i) => [name, i]));

const {
  w0, n0, e0,
  w1, n1, e1,
  w2, n2, e2,
  w3, n3, e3,
  w4a, s4a, e4a,
  w4b, s4b, e4b,
  w5, s5, e5,
  w6, s6, e6,
  w7, s7, e7,
} = verticesByName;

export const indices = namedTriangles.map(tr => tr.map(name => verticesByName[name])).flat();

const uvsByName: Record<string, [number, number]> = {
  w4b: [0/8     , 1],
  s4b: [0/8     , 0],
  e4b: [1/8-du/2, 1],

  w0 : [0/8+du/2, 0],
  n0 : [1/8     , 1],
  e0 : [2/8-du/2, 0],

  w5 : [1/8+du/2, 1],
  s5 : [2/8     , 0],
  e5 : [3/8-du/2, 1],

  w1 : [2/8+du/2, 0],
  n1 : [3/8     , 1],
  e1 : [4/8-du/2, 0],

  w6 : [3/8+du/2, 1],
  s6 : [4/8     , 0],
  e6 : [5/8-du/2, 1],

  w2 : [4/8+du/2, 0],
  n2 : [5/8     , 1],
  e2 : [6/8-du/2, 0],

  w7 : [5/8+du/2, 1],
  s7 : [6/8     , 0],
  e7 : [7/8-du/2, 1],

  w3 : [6/8+du/2, 0],
  n3 : [7/8     , 1],
  e3 : [8/8-du/2, 0],

  w4a: [7/8+du/2, 1],
  s4a: [8/8     , 0],
  e4a: [8/8     , 1],
}

export const uvs = vertexNames.flatMap(name => uvsByName[name])

const r2 = Math.SQRT2;
const r1_5 = Math.sqrt(1.5)
const halfDihedral = TAU/4 - Math.acos(-1/3) / 2;
const du_display = 0.02;

export class FoldableOctahedron {
  private readonly ex = new V3();
  private readonly a = new V3();
  private readonly b = new V3();
  private readonly c = new V3();
  private readonly d = new V3();

  private readonly ex_a = new V3();
  private readonly ex_a_b = new V3();
  private readonly ex_a2_c = new V3();
  private readonly ex_a_b2 = new V3();
  private readonly ex_a_b2_d = new V3();

  // The result of `computePositions()`
  readonly positions = new Float32Array(vertexNames.length * 3);

  computePositions(bend: number, shift: number) {
    // TODO use higher-level operations (such as rotations by quaternions)
    // instead of low-level trigonometric functions and coordinates.
    // See ./FoldableIcosahedron.ts .

    const {
      ex, a, b, c, d, ex_a, ex_a_b, ex_a2_c, ex_a_b2, ex_a_b2_d,
      positions
    } = this;

    const bend45 = TAU/8 * bend;
    const c45 = Math.cos(bend45);
    const s45 = Math.sin(bend45);

    const bendHD = halfDihedral * bend;
    const cHD = Math.cos(bendHD);
    const sHD = Math.sin(bendHD);

    const bend135 = 3 * TAU/8 * bend;
    const c135 = Math.cos(bend135);
    const s135 = Math.sin(bend135);

    ex.set(1, 0, 0);
    a.set(-s45, 0, c45).scaleInPlace(r2);
    b.set(-s135, 0, c135).scaleInPlace(r2);
    c.set(-sHD * c45, cHD, -sHD * s45).scaleInPlace(r1_5);
    d.set(-sHD * c135, cHD, -sHD * s135).scaleInPlace(r1_5);

    ex.addToRef(a, ex_a);
    ex_a.addToRef(b, ex_a_b);
    a.scaleToRef(0.5, ex_a2_c).addInPlace(ex).addInPlace(c);
    b.scaleToRef(0.5, ex_a_b2).addInPlace(ex_a);
    ex_a_b2.addToRef(d, ex_a_b2_d);

    const adjX = shift * (1 - shift);
    const adjY = shift * r1_5;
    const adjZ = -shift * Math.SQRT1_2;

    function set(idxNW: number, idxNE: number, idxSW: number, idxSE: number, {x, y, z}: V3) {
      positions[idxNW * 3 + 0] =  x;
      positions[idxNW * 3 + 1] =  y;
      positions[idxNW * 3 + 2] = -z;

      positions[idxNE * 3 + 0] =  x;
      positions[idxNE * 3 + 1] =  y;
      positions[idxNE * 3 + 2] =  z;

      positions[idxSW * 3 + 0] =  x + adjX;
      positions[idxSW * 3 + 1] = -y + adjY;
      positions[idxSW * 3 + 2] = -z + adjZ;

      positions[idxSE * 3 + 0] =  x + adjX;
      positions[idxSE * 3 + 1] = -y + adjY;
      positions[idxSE * 3 + 2] =  z + adjZ;
    }

    set(w0, e3, w4a, e7, ex_a_b   );
    set(n0, n3, s4a, s7, ex_a_b2_d);
    set(e0, w3, e4b, w7, ex_a     );
    set(w1, e2, w5 , e6, ex_a     );
    set(n1, n2, s5 , s6, ex_a2_c  );
    set(e1, w2, e5 , w6, ex       );

    positions[e4a * 3 + 0] =  ex_a_b2.x + adjX;
    positions[e4a * 3 + 1] = -ex_a_b2.y + adjY;
    positions[e4a * 3 + 2] = -ex_a_b2.z + adjZ;

    positions[s4b * 3 + 0] =  ex_a_b2_d.x + adjX;
    positions[s4b * 3 + 1] = -ex_a_b2_d.y + adjY;
    positions[s4b * 3 + 2] = -ex_a_b2_d.z + adjZ;

    positions[w4b * 3 + 0] =  ex_a_b2.x + adjX;
    positions[w4b * 3 + 1] = -ex_a_b2.y + adjY;
    positions[w4b * 3 + 2] = -ex_a_b2.z + adjZ;

    function adaptD(idx1: number, idx2: number, idx3: number, shiftD: number) {
      positions[idx1 * 3 + 2] += shiftD;
      positions[idx2 * 3 + 2] += shiftD;
      positions[idx3 * 3 + 2] += shiftD;
    }

    const du_display_shift = du_display * shift;
    adaptD(w4b, s4b, e4b, -4 * du_display_shift);
    adaptD(w0 , n0 , e0 , -3 * du_display_shift);
    adaptD(w5 , s5 , e5 , -2 * du_display_shift);
    adaptD(w1 , n1 , e1 , -1 * du_display_shift);
    // adaptD(w6 , s6 , e6 ,  0 * du_display_shift);
    adaptD(w2 , n2 , e2 ,  1 * du_display_shift);
    adaptD(w7 , s7 , e7 ,  2 * du_display_shift);
    adaptD(w3 , n3 , e3 ,  3 * du_display_shift);
    adaptD(w4a, s4a, e4a,  4 * (du_display + r2) * shift);

    // shift face 4a in x direction another time:
    positions[w4a * 3 + 0] += adjX;
    positions[s4a * 3 + 0] += adjX;
    positions[e4a * 3 + 0] += adjX;
  }
}
