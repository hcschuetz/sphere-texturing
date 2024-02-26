/*
Sprite Layout
=============

Conventions:
- We use Babylon's left-handed xyz coordinates.
- We deal with the unit sphere centered at the origin of the coordinate
  system.
- In our names and comments we consider the y axis pointing northward.
  Thus (0, 1, 0) and (0, -1, 0) are the north pole and the south pole of
  the sphere and the x/z plane is the equatorial plane.

Mapping the sphere to a rectangle:
- First the sphere is mapped by a central projection to the faces of an
  inscribed regular octahedron with vertices on the coordinate axes.
  (Within the faces we use barycentric coordinates.)
- Now let the four northern faces of the octahedron be called N0 to N3 in
  west-east direction.  We map them linearly to triangles in the rectangle
  as shown in the image below.  The equator goes to the lower edge of the
  rectangle (v == 0) and the north pole goes to the upper edge (v == 1).
- The four corresponding southern faces S0 to S3 are mapped similarly.
  The equator goes to the upper edge (v == 1) and the south pole goes to
  the lower edge (v == 0).  To fit in the spaces between the northern faces,
  we shift the southern faces left by 1/8 of the rectangle width (relative
  to their northern counterparts).  The half of S0 that would go beyond the
  left edge of the rectangle is wrapped around to the right end.  We
  configure the rectangle texture to be wrapping in the u direction to deal
  with this.

  1 +------------------------+
    |S0/\ S1 /\ S2 /\ S3 /\S0|
  v | /  \  /  \  /  \  /  \ |
    |/ N0 \/ N1 \/ N2 \/ N3 \|
  0 +------------------------+
    0           u            1

- To avoid problems with rounding and interpolations, we leave little
  gaps between neighboring triangles.  The mapping of each triangle is
  continued to the middle of the gap.
- We use a rectangular texture where the ratio between width and height
  is adjusted in such a way that the triangles are (approximately)
  equilateral.

The mapping from xyz position coordinates to uv texture coordinates is
implemented by the function `getUV(...)` below.

The shader code is used to convert an equirectangular texture to a sprite
sheet usable by an octasphere.  For this it performs the inverse mapping,
converting a point in uv space to xyz space.  Then it goes on and maps the
xyz coordinates to longitude and latitude, normalizes these to [0..1]x[0..1],
and looks up a color value in an input map with equirectangular projection.
(Actually the shader bypasses the xyz coordinates and goes directly from
the barycentric face coordinates to longitude and latitude.)
*/

import * as B from "@babylonjs/core";


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
 * 
 * Finally, the last row and column are there because Babylon seems to support
 * only 4x4 matrices.
 */
const wpe2uv1 = B.Matrix.FromValues(
  // u      v  1
  du      , 0, 1, 0, // w
  1/8     , 1, 1, 0, // p
  1/4 - du, 0, 1, 0, // e
  0       , 0, 0, 1,
  // The matrix is actually transposed because Babylon and WebGL use
  // column-major order whereas source code is written in row-major order.
);

// But actually we want to convert in the other direction.
// `(u, v)` is expected to be in the northern half of quadrant 0.
// Otherwise the coordinates need to be adjusted.
const uv12wpe = wpe2uv1.invertToRef(new B.Matrix());

// Now drop the last row and column again.  Furthermore
// the barycentric coordinate p for the pole is actually not needed:
const uv12we = B.Matrix.GetAsMatrix3x3(uv12wpe).filter((_, i) => i % 3 !== 1);


B.Effect.ShadersStore.OctaSpriteFragmentShader = `
varying vec2 vUV;

uniform sampler2D base;

mat3x2 uv12we = mat3x2(${uv12we});

void main(void) {
  float u = vUV.x, v = vUV.y;
  float diag = mix(${du/2}, ${1/8 - du/2}, v);
  // octahedron face identified by quadrant and north/south flag:
  float q = floor((u + diag) * 4.);
  bool north = q == floor((u - diag) * 4.);

  // Adjust uv to the sprite triangle for quadrant 0 of the northern hemisphere:
  vec3 uv1 = vec3(u - q/4. + mix(${1/8}, 0., north), mix(1. - v, v, north), 1);

  // "wpe" would be the barycentric coordinates on the current face.
  // We omit p here because it easy to compute y directly from v without
  // p as an intermediate step.
  vec2 we = uv12we * uv1;
  float y = v - mix(1., 0., north);

  // // debugging
  // if (any(lessThan(abs(vec3(we, y)), vec3(0.005)))) {gl_FragColor = vec4(1,1,0,1); return;}

  float lat = asin(y * inversesqrt(we.x*we.x + y*y + we.y*we.y));
  float lon = atan(we.y, we.x) + q * ${TAU/4};

  // TODO take level of detail into account
  gl_FragColor = texture(base, vec2(
    lon * ${1/TAU},
    lat * ${2/TAU} + .5
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
 * faces.
 * The second argument `faceRef` should be a vector pointing inside the
 * requested face and is used to avoid that ambiguity.
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

  let {x: u, y: v} = B.Vector3.TransformCoordinates(
    new B.Vector3(x, y, z),
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

