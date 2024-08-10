import * as B from "@babylonjs/core";
import { dv } from "./MyIcoSphere";

// -----------------------------------------------------------------------------
// Abbreviations and Utilities

const TAU = 2 * Math.PI;

type V3 = B.Vector3;
const V3 = B.Vector3;

// -----------------------------------------------------------------------------
/*
We start with this icosahedron net:

            a       b       c       d       e
           / \     / \     / \     / \     / \
          /   \   /   \   /   \   /   \   /   \
         /  0  \ /  1  \ /  2  \ /  3  \ /  4  \
        f-------g-------h-------i-------j-------k
       /|\  5  / \  6  / \  7  / \  8  / \  9  /|\
      / | \   /   \   /   \   /   \   /   \   / | \
     /  |14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|  \
    y---l---m-------n-------o-------p-------q---r---z
     \  |19/ \ 15  / \ 16  / \ 17  / \ 18  / \19|  /
      \ | /   \   /   \   /   \   /   \   /   \ | /
       \|/     \ /     \ /     \ /     \ /     \|/
        s       t       u       v       w       x

The faces with numbers 14 and 19 above are usually placed either on the left
or on the right side in icosahedron nets.  We cut them in halves so that the net
will fit better into a rectangular texture, see below.  Thus vertices `y` and
`z` are not part of the net, but will be used to compute `l` and `r`.
*/

// Vertex names have "_" appended to avoid name collisions.
const v3Names = "abcdefghijklmnopqrstuvwxyz".split("").map(char => char + "_");
const v3Indices = Object.fromEntries(v3Names.map((name, i) => [name, i]));
const {c_, h_, i_, l_, m_, o_, q_, r_, y_, z_} = v3Indices;

/*
Vertex positions for a partly unfolded icosahedron will be computed like this:
- h and i do not move.  They are just the positions from the folded icosahedron.
- o is interpolated between its folded position and a position just below the
  center of edge hi.
- Now all the other vertices except for l and r are computed according to the
  "stepDefs" below.
  For example, step def "kqjp" means that the position of vertex k is computed
  from the positions of vertices q, j, and p.
  The dihedral angle at edge qj (between faces 13 and 9) is interpolated
  between 180° and the dihedral angle of a fully folded icosahedron.
- l and r are computed as centers of the edges ym and qz.

The interpolations are controlled by parameter "bend" varying between 0 for
unfolded and 1 for folded.
*/

type StepDef = [number, number, number, number];

const stepDefs = `
  nhoi ghno mgnh fgmn yfmg
  poih jpio qpji kqjp zqkj
  agfm bhgn ciho djip ekjq
  symf tmng unoh vopi wpqj xqzk
`.trim().split(/\s+/).map(line =>
  line.trim().split("").map(char => v3Indices[char + "_"]) as StepDef
);

/*
In the UV mapping faces 15 to 19 are moved up to achieve a rectangular texture
layout.  For this some vertices are duplicated with uppercase names.
`dv` is some small "safety distance".

1           -- L---M-------N-------O-------P-------Q---R
1   - dv    -- |19/a\ 15  /b\ 16  /c\ 17  /d\ 18  /e\19|
               | // \\   // \\   // \\   // \\   // \\ |
               |//   \\ //   \\ //   \\ //   \\ //   \\|
1/2 + dv/2  -- s/  0  \t/  1  \u/  2  \v/  3  \w/  4  \x
1/2 - dv/2  -- f-------g-------h-------i-------j-------k
               |\  5  / \  6  / \  7  / \  8  / \  9  /|
               | \   /   \   /   \   /   \   /   \   / |
               |14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|
0           -- l---m-------n-------o-------p-------q---r

^         u    |   |   |   |   |   |   |   |   |   |   |
|v       ---> 0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0
*/

const vertexNames = `
    a   b   c   d   e
  f   g   h   i   j   k
  l m   n   o   p   q r
  L M   N   O   P   Q R
  s   t   u   v   w   x
`.trim().split(/\s+/);

const vertexIndices = Object.fromEntries(vertexNames.map((char, i) => [char, i]));

/** Is this the index of a vertex of a face being shifted up? */
const isSouthernVtx = (idx: number) => idx >= 18;

export const uvs = Float32Array.of(
  ...[   0.1,  0.3,  0.5,  0.7,  0.9   ].flatMap(u => [u,  1-dv   ]), // a-e
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1-dv)/2]), // f-k
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  0      ]), // l-r
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  1      ]), // L-R
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1+dv)/2]), // s-x
);

/** triangulation */
export const indices = Uint16Array.from(`
    fga ghb hic ijd jke
    fmg gnh hoi ipj jqk
  lmf mng noh opi pqj qrk
  LsM MtN NuO OvP PwQ QxR
`.trim().split(/\s+/).flatMap(triangle =>
  triangle.split("").map(name => vertexIndices[name])
));

/**
 * Mapping between the two kinds of position indices
 * (Vector3[] during computation vs. Float32Array for shader)
 */
const vertexIndexMap = vertexNames.map(name => v3Indices[name.toLowerCase() + "_"]);


/** How far above/below the equator are the non-pole vertices? */
const height = Math.sqrt(1 / 5);
/** How far away from the main axis are the non-pole vertices? */
const radius = 2 * height;
const externalDihedralAngle = Math.acos(Math.sqrt(5)/3); // ~ 180° - 138.2°

const ix = radius * Math.cos(TAU/10);
const iz = radius * Math.sin(TAU/10);


export class FoldableIcosahedron {
  // Variables for intermediate computation results are created here
  // so that we need not create garbage during computation runs.
  private readonly v3s = v3Names.map(() => new V3());
  private readonly steps = stepDefs.map(line => line.map(idx => this.v3s[idx]));

  private readonly mid_hi = new V3();
  private readonly oHeight = new V3();
  private readonly oHeightFlat = new V3();
  private readonly slerp_o = new V3();
  private readonly axis = new V3();
  private readonly quaternion = new B.Quaternion();

  // The result of `computePositions()`
  readonly positions = new Float32Array(vertexNames.length * 3);

  constructor() {
    const {mid_hi, oHeight, oHeightFlat, v3s} = this;

    mid_hi.set(ix, height, 0);
    oHeight.set(radius, -height, 0).subtractInPlace(mid_hi);
    oHeightFlat.set(0, -oHeight.length(), 0);
  
    // These two positions do not depend on the bend parameter.
    // So we compute them right now.
    v3s[h_].set(ix,  height, -iz);
    v3s[i_].set(ix,  height,  iz);
  }

  computePositions(bend: number, shiftSouthern: number) {
    const {
      mid_hi, oHeight, oHeightFlat, slerp_o,
      v3s, steps,
      axis, quaternion,
      positions,
    } = this;

    mid_hi.addToRef(V3.SlerpToRef(oHeightFlat, oHeight, bend, slerp_o), v3s[o_]);

    const bendAngle = TAU/2 - bend * externalDihedralAngle;
    for (const [out, a, b, c] of steps) {
      b.subtractToRef(a, axis);
      B.Quaternion.RotationAxisToRef(axis, bendAngle, quaternion);
      out.copyFrom(c)
      .subtractInPlace(a)
      // applies the quaternion directly:
      .applyRotationQuaternionInPlace(quaternion)
      .addInPlace(a);
      // converts the quaternion into a matrix and applies that
      // (and takes care of the shifting by `a` and back):
      // c.rotateByQuaternionAroundPointToRef(quaternion, a, out);
    }
    V3.CenterToRef(v3s[m_], v3s[y_], v3s[l_]);
    V3.CenterToRef(v3s[q_], v3s[z_], v3s[r_]);

    const shiftX = shiftSouthern * (1 - shiftSouthern);
    const shiftY = (v3s[c_].y - v3s[o_].y + dv) * shiftSouthern;

    // Now copy the computed positions from pos to positions
    // (and apply the shift for the southern triangles).
    vertexIndexMap.forEach((i, j) => {
      const {x, y, z} = v3s[i];
      positions[j * 3 + 0] = x + (isSouthernVtx(j) ? shiftX : 0);
      positions[j * 3 + 1] = y + (isSouthernVtx(j) ? shiftY : 0);
      positions[j * 3 + 2] = z;
    });
  }
}
