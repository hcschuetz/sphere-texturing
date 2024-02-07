import * as B from "@babylonjs/core";
import * as G from "gl-matrix";


const TAU = 2 * Math.PI;


/**
 * Horizontal "safety" distance between neighboring sprite regions
 */
const du = .01;

/**
 * Matrix converting barycentric coordinates `(w, p, e)` on the octahedron face
 * in the northern half of quadrant 0 to `(u, v, 1)`.
 * 
 * Barycentric coordinates:
 * - w: towards western corner on equator
 * - p: towards north pole
 * * e: towards eastern corner on equator
 *  
 * About the "1"s:
 * - Technically they make the matrix square and invertible.
 * - Their origin is from the condition that the barycentric coordinates are
 *   normalized, that is, `w + p + e = 1`.
 */
const wpe2uv1: G.mat3 = [
  // u      v  1
  du      , 0, 1, // w
  1/8     , 1, 1, // p
  1/4 - du, 0, 1, // e
  // The matrix is actually transposed because gl-matrix and WebGL use
  // column-major order whereas source code is written in row-major order.
];

// But actually we want to convert in the other direction.
// `(u, v)` is expected to be in the northern half of quadrant 0.
// Otherwise the coordinates need to be adjusted.
const uv12wpe = G.mat3.invert(new Float32Array(9), wpe2uv1);

// The barycentric coordinate p for the pole is actually not needed:
const uv12we = [...uv12wpe].filter((_, i) => i % 3 !== 1);


B.Effect.ShadersStore.OctaSpriteFragmentShader = `
varying vec2 vUV;

uniform sampler2D base;

mat3x2 uv12we = mat3x2(${uv12we.map(x => x.toString()).join(", ")});

void main(void) {
  float u = vUV.x, v = vUV.y;
  float diag = -mix(${du/2}, ${1/8 - du/2}, v);
  // octahedron face identified by quadrant and north/south flag:
  float q = floor((u - diag) * 4.);
  bool north = q == floor((u + diag) * 4.);

  // Adjust uv to the sprite triangle for quadrant 0, northern hemisphere:
  vec3 uv1 = vec3(u - q/4. + mix(${1/8}, 0., north), mix(1. - v, v, north), 1);
  vec2 we = uv12we * uv1;
  float y = v - mix(1., 0., north);

  // wye is like xyz, but still needs to be rotated around the y axis.
  // We postpone this to the longitude computation, where it is easier.
  vec3 wye = normalize(vec3(we.x, y, we.y));

  // // debugging
  if (any(lessThan(abs(wye), vec3(0.005)))) {gl_FragColor = vec4(1.,1.,0.,1.); return;}

  float lat = asin(wye.y);
  float lon = atan(wye.z, wye.x) + q * ${TAU/4};

  // TODO take level of detail into account
  gl_FragColor = texture(base, vec2(
    lon / ${TAU},
    lat / ${TAU/2} + .5
  ));
}
`;
// console.log(B.Effect.ShadersStore.OctaSpriteFragmentShader);

/**
 * Convert an equirectangular sphere texture to a sprite texture appropriate
 * for Babylon's octasphere.
 */
export const createOctaSprite = (
  name: string, width: number, base: B.Texture, scene: B.Scene
): B.Texture =>
  Object.assign(
    new B.ProceduralTexture(name, {width, height: getHeight(width)}, "OctaSprite", scene)
    .setTexture("base", base),
    {
      wrapU: B.Texture.WRAP_ADDRESSMODE,
      wrapV: B.Texture.CLAMP_ADDRESSMODE,
    }
  );

const getHeight = (width: number) => (width/4 - 2*du) * (Math.sqrt(3)/2);

/**
 * Map a point on the unit sphere or a octahedron face given by vector `pos`
 * to the corresponding `uv` value.
 * 
 * Actually that mapping is ambiguous if `pos` points to a boundary between
 * faces, that is, if one of its coordinates is 0.
 * The second argument `faceRef` should be a vector pointing inside the
 * requested face and is used to resolve that ambiguity.
 * (You can simply use the sum of the 3 corner vectors of the face.)
 * 
 * The input vectors need not be normalized.  They represent directions
 * from the origin.
 */
export function getUV(pos: B.Vector3, faceRef: B.Vector3): B.Vector2 {
  let {x, y, z} = pos;

  x = Math.abs(x); y = Math.abs(y); z = Math.abs(z);
  const scale = 1 / (x + y + z);
  x *= scale; y *= scale; z *= scale;

  let [u, v] = G.vec3.transformMat3(
    new Float32Array(3),
    G.vec3.fromValues(x, y, z),
    wpe2uv1,
  );

  if (faceRef.x < 0) {
    u = 0.5 - u;
  }
  if (faceRef.z < 0) {
    u = 1 - u;
  }
  if (faceRef.y < 0) {
    v = 1 - v;
    u -= 1/8;
  }
  return new B.Vector2(u, v);
}

