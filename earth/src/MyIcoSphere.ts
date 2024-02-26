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

/** How far above/below the equator are the non-pole vertices? */
const height = Math.sqrt(1 / 5);
/** How far away from the main axis are the non-pole vertices? */
const radius = 2 * height;

/**
 * Vertical "safety gap" between neighboring sprite regions
 */
const dv = .01;

// -----------------------------------------------------------------------------
// Naming convention:
//
// Each icosahedron face has one edge in west-east direction
// (i.e., parallel to the u axis in the sprite sheet).
// The opposite corner points to (or even is) the north pole or the south pole
// (i.e., in the direction of the positive or negative v axis).
//
// We use the names W and E (for "west" and "east") for the two ends of the
// west-east edge and P for the "polar" vertex when dealing with a given face.

// -----------------------------------------------------------------------------
// Triangulation

const northPole = v3(0, 1, 0);
const southPole = v3(0, -1, 0);

// The calculations only require basic arithmetics and square roots.
// But trigonometric functions should be easier to understand:
const nonPoles = Array.from({ length: 10 }, (_, i) => v3(
  radius * Math.cos(TAU / 10 * i),
  height * (-1) ** i,
  radius * Math.sin(TAU / 10 * i)
));
// support some circular access:
nonPoles.push(...nonPoles.slice(0, 2));

/** Compute vertex data for an icosphere where each edge is subdivided
 * into `nSteps` segments.
 */
export const createIcoVertices = (nSteps: number) => {
  const positions: number[] = [];
  const uvs: number[] = [];
  let idx = 0;

  function emitVertex(pos: V3, u: number, v: number) {
    positions.push(...pos.asArray());
    uvs.push(u, v);
  }

  const indices: number[] = [];

  function emitIcoFace(w: V3, p: V3, e: V3, u_w: number, v_we: number, v_p: number, flip: boolean): void {
    function emitTriangle(a: number, b: number, c: number): void {
      indices.push(a, flip ? c : b, flip ? b : c);
    }

    for (let i = 0, jk = nSteps; jk >= 0; i++, jk--) {
      for (let j = 0, k = jk; k >= 0; j++, k--) {
        if (i > 0) {
          const prevLeft = idx - jk - 2;
          emitTriangle(idx, prevLeft, prevLeft + 1);
          if (j > 0) {
            emitTriangle(idx, idx - 1, prevLeft);
          }
        }

        emitVertex(
          p.scale(i).addInPlace(e.scale(j)).addInPlace(w.scale(k)).normalize(),
          u_w + (i * .1 + j * .2) / nSteps,
          (i * v_p + jk * v_we) / nSteps,
        );
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

  return Object.assign(new B.VertexData(), {
    indices,
    positions,
    normals: positions,
    uvs,
  });
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
    .invertToRef(new B.Matrix())
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
    atan(pos.z, pos.x) * ${1/TAU} + uOffset,
    atan(pos.y, length(pos.xz)) * ${2/TAU} + .5
  ));
}
`;

/**
 * Convert an equirectangular sphere texture to a sprite texture appropriate
 * for icospheres.
 */
export const createIcoSprite = (
  name: string, width: number, base: B.Texture, scene: B.Scene
): B.Texture =>
  Object.assign(
    new B.ProceduralTexture(name, {
      width,
      height: Math.round(width * Math.sqrt(3) / (5 * (1 - dv))),
    }, "MyIcoSprite", scene)
    .setTexture("base", base),
    {
      wrapU: B.Texture.WRAP_ADDRESSMODE,
      wrapV: B.Texture.WRAP_ADDRESSMODE,
    }
  );
