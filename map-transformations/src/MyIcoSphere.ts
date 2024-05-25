import * as B from "@babylonjs/core";

// -----------------------------------------------------------------------------
// General utilities

/** perimeter/radius ratio of a circle */
const TAU = 2 * Math.PI;

type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

/**
 * Create a BABYLON Matrix representing a 3x3 matrix with the given fields.
 * 
 * (BABYLON seems to support only 4x4 matrices)
 */
const createMat3 = (
  a: number, b: number, c: number,
  d: number, e: number, f: number,
  g: number, h: number, i: number,
): B.Matrix => B.Matrix.FromValues(
  a, b, c, 0,
  d, e, f, 0,
  g, h, i, 0,
  0, 0, 0, 1,
);

// -----------------------------------------------------------------------------

// Sprite Sheet (see also ../MyIcoSphere.md)
// =========================================
//
// 1           -- |---X-------X-------X-------X-------X---|
// 1   - dv    -- |19/.\ 15  /.\ 16  /.\ 17  /.\ 18  /.\19|           upper
//                | // \\   // \\   // \\   // \\   // \\ |   polar
//                |//   \\ //   \\ //   \\ //   \\ //   \\|           lower
// 1/2 + dv/2  -- '/  0  \'/  1  \'/  2  \'/  3  \'/  4  \'
// 1/2 - dv/2  -- X-------X-------X-------X-------X-------X
//                |\  5  / \  6  / \  7  / \  8  / \  9  /|           upper
//                | \   /   \   /   \   /   \   /   \   / |   equatorial
//                |14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|           lower
// 0           -- |---X-------X-------X-------X-------X---|
//
// ^         u    |   |   |   |   |   |   |   |   |   |   |
// |v       ---> 0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0
//
//                  l   r   l   r   l   r   l   r   l   r     (left/right)
//
// (The distinctions between
// - polar and equatorial,
// - upper and lower,
// - left and right
// regions are made in the texture conversion code below
// to figure out to which face a given (u, v) coordinate pair belongs.)
//
//
// Conventions
// ===========
//
// In names and comments we consider the y axis pointing northward.
// Thus (0, 1, 0) and (0, -1, 0) are the north pole and the south pole of
// the (unit) sphere and the x/z plane is the equatorial plane.
//
// The inscribed icosahedron has vertices at the north and south pole.
// The upper vertices of faces 1 to 4 in the sprite sheet
// are mapped to the north pole,
// the lower vertices of faces 15 to 19 are mapped to the south pole.
//
// The left edge of face 0 and the right edge of face 4 are adjacent and mapped
// to the meridian in the x/y plane, actually in the half plane with x >= 0.
// Also the central vertical lines in faces 14 and 19 (where they are split in
// the sprite sheet) are mapped to that meridian.
//
// Notice that each icosahedron face has one edge in west-east direction
// (i.e., parallel to the u axis in the sprite sheet).
// The opposite corner points to (or even is) the north pole or the south pole
// (i.e., in the direction of the positive or negative v axis).
// We use the names
// - W and E (for "west" and "east") for the two ends of the west-east edge and
// - P for the "poleward" vertex
// when dealing with a given face.

// -----------------------------------------------------------------------------

/** How far above/below the equator are the non-pole vertices? */
const height = Math.sqrt(1 / 5);
/** How far away from the main axis are the non-pole vertices? */
const radius = 2 * height;

/**
 * Vertical "safety gap" between neighboring sprite regions
 */
export const dv = .01;

// -----------------------------------------------------------------------------
// Triangulation

const northPole = v3(0, 1, 0);
const southPole = v3(0, -1, 0);

// The following calculations only require basic arithmetics and square roots.
// But trigonometric functions are easier to understand here:
const nonPoles = Array.from({ length: 10 }, (_, i) => v3(
  radius * Math.cos(TAU / 10 * i),
  height * (-1) ** i,
  radius * Math.sin(TAU / 10 * i)
));
// support some circular access:
nonPoles.push(...nonPoles.slice(0, 2));

/**
 * Compute vertex data for an icosphere where each edge is subdivided
 * into `nSteps` segments.
 */
export const createIcoVertices = (nSteps: number) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  let idx = 0;

  const indices: number[] = [];

  function emitIcoFace(w: V3, p: V3, e: V3, u_w: number, v_we: number, v_p: number, flip: boolean): void {
    function emitTriangle(a: number, b: number, c: number): void {
      indices.push(a, flip ? c : b, flip ? b : c);
    }

    for (let i = 0, jk = nSteps; jk >= 0; i++, jk--) {
      for (let j = 0, k = jk; k >= 0; j++, k--) {
        // This position is actually on the icosahedron face.  We leave it to the material
        // to add a "bulge" over the face to produce a sphere.
        const pos = p.scale(i).addInPlace(e.scale(j)).addInPlace(w.scale(k)).scale(1 / nSteps);
        positions.push(pos.x, pos.y, pos.z);
        uvs.push(
          u_w + (i * .1 + j * .2) / nSteps,
          (i * v_p + jk * v_we) / nSteps,
        );

        if (i > 0) {
          const prevLeft = idx - jk - 2;
          emitTriangle(idx, prevLeft, prevLeft + 1);
          if (j > 0) {
            emitTriangle(idx, idx - 1, prevLeft);
          }
        }
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

  const normals = new Float32Array(positions.length);
  B.VertexData.ComputeNormals(positions, indices, normals);
  return Object.assign(new B.VertexData(), {indices, positions, normals, uvs});
};

// -----------------------------------------------------------------------------
// Texture conversion

/**
 * Create a matrix converting a vector (u, v, 1)
 * to the corresponding 3D position on an icosahedron face.
 * 
 * The conversion is based on a particular face described by the parameters.
 */
function uv12pos(
  u_w: number, v_we: number, v_p: number,
  radius_p: number, y_we: number, y_p: number,
) {
  const u_p = u_w + .1, u_e = u_w + .2;
  return B.Matrix.GetAsMatrix3x3(
    createMat3(
      u_w, v_we, 1,
      u_p, v_p , 1,
      u_e, v_we, 1,
    )
    .invert()
    .multiply(createMat3(
      radius   * Math.cos(u_w * TAU), y_we, radius   * Math.sin(u_w * TAU),
      radius_p * Math.cos(u_p * TAU), y_p , radius_p * Math.sin(u_p * TAU),
      radius   * Math.cos(u_e * TAU), y_we, radius   * Math.sin(u_e * TAU),
    ))
  );
}

// When we convert (u,v) coordinates to longitude/latitude,
// we first shift u so that our point lands in one of the four
// "reference faces" 0, 5, 14, and 19.
// We precompute conversion matrices for the reference faces.

//                          u0   v_we      v_p      radius_p  y_we     y_p
const uv12pos_0  = uv12pos( 0.0, (1-dv)/2,  1-dv   , 0     ,  height,  1     );
const uv12pos_5  = uv12pos( 0.0, (1-dv)/2,  0      , radius,  height, -height);
const uv12pos_14 = uv12pos(-0.1, 0       , (1-dv)/2, radius, -height,  height);
const uv12pos_19 = uv12pos(-0.1, 1       , (1+dv)/2, 0     , -height, -1     );


B.Effect.ShadersStore.MyIcoSpriteFragmentShader = `
varying vec2 vUV;

uniform sampler2D base;
uniform float offset;

mat3 uv12pos[4] = mat3[4](${
  [uv12pos_14, uv12pos_5, uv12pos_0, uv12pos_19].map(mat => `
  mat3(${mat})`).join(",")}
);

void main(void) {
  float u = vUV.x, v = vUV.y;

  // divide horizontally in fifths
  float u5 = u * 5.;
  float u5fract = fract(u5);

  // are we in the right half of a fifth?
  bool right = u5fract > .5;

  // divide vertically at (1 - dv)/2
  bool polar = v > ${(1 - dv) / 2};

  // split at diagonal lines:
  bool upper = v > mix(
    mix(${(1 - dv) / 2}, 0.5          , polar),
    mix(0.             , ${1 - dv / 2}, polar),
    2. * mix(u5fract, 1. - u5fract, right)
  );

  // offset (in u direction) between the "reference face" 0, 5, 14 or 19 and
  // the actual face we are in:
  float uOffset = (floor(u5) + float(right && (upper == polar))) * .2;

  // 3D position on reference face:
  vec3 pos = uv12pos[2 * int(polar) + int(upper)] * vec3(u - uOffset, v, 1.);

  gl_FragColor = texture(base, vec2(
    atan(pos.z, pos.x) * ${1/TAU} + uOffset - offset,
    atan(pos.y, length(pos.xz)) * ${2/TAU} + .5
  ));
}
`;

/**
 * Convert an equirectangular sphere texture to a sprite texture appropriate
 * for icospheres.
 */
export const createIcoSprite = (
  name: string, width: number, base: B.Texture, offset: number, scene: B.Scene
): B.Texture =>
  Object.assign(
    new B.ProceduralTexture(name, {
      width,
      height: Math.round(width * Math.sqrt(3) / (5 * (1 - dv))),
    }, "MyIcoSprite", scene)
    .setTexture("base", base)
    .setFloat("offset", offset),
    {
      wrapU: B.Texture.WRAP_ADDRESSMODE,
      wrapV: B.Texture.WRAP_ADDRESSMODE,
    }
  );
