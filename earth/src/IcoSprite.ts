import * as B from "@babylonjs/core";
import * as G from "gl-matrix";


const TAU = 2 * Math.PI;


// Get uvs and positions from a Babylon icosphere without subdivisions
const ico = B.CreateIcoSphereVertexData({subdivisions: 1});
const uvs = ico.uvs!;
const positions = [...ico.positions!];

// For each triangle, invert the matrix of uv coordinates (extended with ones):
const uv12bary: number[] = [];
for (let offset = 0; offset < uvs.length;) {
  const uv1Matrix = Float32Array.of(
    // u           v              1
    uvs[offset++], uvs[offset++], 1, // column for vertex 0
    uvs[offset++], uvs[offset++], 1, // column for vertex 1
    uvs[offset++], uvs[offset++], 1, // column for vertex 2
  );
  const uv1MatrixInv = G.mat3.invert(new Float32Array(9), uv1Matrix);
  uv12bary.push(...uv1MatrixInv);
}


// Apply the following coordinate mappings
// - uv ==> barycentric (per face)
// - select the appropriate face
// - barycentric ==> xyz on icosahedron face
// - xyz on icosahedron face ==> xyz on sphere
// - xyz ==> longitude/latitude
// - longitude/latitude ==> [0..1]^2
// At this position look up the base texture color and return it as the color
// for position (u, v) in the sprite.
B.Effect.ShadersStore.IcoSpriteFragmentShader = `
  varying vec2 vUV;

  // Apparently ProceduralTexture does not support passing arrays of vectors or
  // matrices as uniforms.  So we pass arrays of floats and extract vectors and
  // matrices as needed.
  uniform /* mat3[20] */ float[180] uv12bary;
  uniform /* vec2[20] */ float[180] positions;
  uniform sampler2D base;

  void main(void) {
    int f = -1;
    float fDist = 10000.; // actually infinity
    vec3 fBary;

    int offset = 0;
    for (int i = 0; i < 20; i++) {
      mat3 Mbary = mat3(
        uv12bary[offset++], uv12bary[offset++], uv12bary[offset++],
        uv12bary[offset++], uv12bary[offset++], uv12bary[offset++],
        uv12bary[offset++], uv12bary[offset++], uv12bary[offset++]
      );
      vec3 bary = Mbary * vec3(vUV, 1.);
      vec3 edgeDists = max(-bary, 0.);
      float dist = edgeDists.x + edgeDists.y + edgeDists.z;
      if (dist < fDist) {
        f = i;
        fDist = dist;
        fBary = bary;
      }
    }

    if (fDist > .06) {
      // We are in an unused part of the sprite.
      // Paint it red to expose (certain) mapping errors.
      gl_FragColor = vec4(1., 0., 0., 1.);
      return;
    }

    // if (any(lessThan(abs(fBary), vec3(.005)))) {
    //   // We are close to an edge. Paint it yellow for demo/debugging:
    //   gl_FragColor = vec4(1., 1., 0., 1.);
    //   return;
    // }
    // {
    //   // Debugging: 20 shades of grey according to face index.
    //   gl_FragColor = vec4(vec3(float(f) / 19.), 1.);
    //   return;
    // }

    offset = f * 9;
    mat3 Mxyz = mat3(
      positions[offset++], positions[offset++], positions[offset++],
      positions[offset++], positions[offset++], positions[offset++],
      positions[offset++], positions[offset++], positions[offset++]
    );
    vec3 xyz = Mxyz * vec3(fBary);

    // Actually we only need to scale y.  But would this really save time?
    xyz = normalize(xyz);

    float lon = atan(xyz.z, xyz.x);
    float lat = asin(xyz.y);

    // TODO take level of detail into account
    gl_FragColor = texture(base, vec2(
      lon / ${TAU},
      lat / ${TAU/2} + .5
    ));
  }
`;

/**
 * Convert an equirectangular sphere texture to a sprite texture appropriate
 * for Babylon's icosphere.
 */
const createIcoSprite = (
  name: string, size: number, base: B.Texture, scene: B.Scene
): B.Texture =>
  new B.ProceduralTexture(name, size, "IcoSprite", scene)
  .setFloats("uv12bary", uv12bary)
  .setFloats("positions", positions)
  .setTexture("base", base);

export default createIcoSprite;
