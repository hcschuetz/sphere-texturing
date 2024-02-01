import * as B from "@babylonjs/core";
import { TAU } from "../lib/utils";


B.Effect.ShadersStore.OctaQuarterFragmentShader = `
  varying vec2 vUV;

  uniform float quadrant;
  uniform sampler2D base;

  void main(void) {
    float u = vUV.x;
    float v = vUV.y;

    float x = 1. - max(u, v);
    float y = v - u;
    float z = min(u, v);

    float lat = asin(y * inversesqrt(x*x + y*y + z*z));
    float lon = atan(z, x);

    // TODO take level of detail into account
    gl_FragColor = texture(base, vec2(
      lon / ${TAU} + quadrant * .25,
      lat / ${TAU/2} + .5
    ));
  }
`;

type SuperConstrParams = ConstructorParameters<typeof B.ProceduralTexture>;

/**
 * Convert a quarter of a sphere texture into a texture for two
 * adjacent octahedron faces (that is, for a quarter of the octahedron).
 * 
 * The `base` texture is expected to use an equirectangular projection.
 * A quarter of that base texture (corresponding to a quarter of the sphere)
 * is used:
 * the full 180° latitude range and a longitude subrange spanning 90°.
 * 
 * The uniform variable `quadrant` (usually 0, 1, 2 or 3) selects the
 * quarter to be mapped.
 * 
 * The selected sphere quarter is projected to two adjacent octahedron faces
 * north and south of the equator, using a gnomonic (= central) projection.
 * 
 * The uv coordinates for the result span the two octahedron faces like this:
 * - u = 0, v = 0 at the western end of the equator segment
 * - u = 0, v = 1 at the north pole
 * - u = 1, v = 0 at the south pole
 * - u = 1, v = 1 at the eastern end of the equator segment
 * 
 * The uv coordinates are linear within each of the two faces,
 * but obviously not across the equator.
 */
export default class OctaQuarterTexture extends B.ProceduralTexture {
  constructor(
    name            : SuperConstrParams[0],
    size            : SuperConstrParams[1],
    scene           : SuperConstrParams[3] = null,
    fallbackTexture?: SuperConstrParams[4],
    generateMipMaps?: SuperConstrParams[5],
  ) {
    super(name, size, "OctaQuarter", scene, fallbackTexture, generateMipMaps);
  }
}
