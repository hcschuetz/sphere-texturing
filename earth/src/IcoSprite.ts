import * as B from "@babylonjs/core";
import * as G from "gl-matrix";


const TAU = 2 * Math.PI;


// Extract coordinate mappings from a Babylon icosphere without subdivisions:
// - uv ==> per-face barycentric
// - per-face barycentric ==> xyz (= position)
const ico = B.CreateIcoSphereVertexData({subdivisions: 1});
const uv2bary = Array.from({length: 20*3*3}, () => 0);
const bary2xyz = Array.from({length: 20*3*3}, () => 0);

for (let faceIdx = 0; faceIdx < 20; faceIdx++) {
  const ABC_uv1 = new Float32Array(3*3);
  const ABC_xyz = new Float32Array(3*3);

  for (let corner = 0; corner < 3; corner++){
    const vtxIdx = 3*faceIdx + corner;

    ABC_uv1[corner * 3 + 0] = ico.uvs![vtxIdx*2 + 0];
    ABC_uv1[corner * 3 + 1] = ico.uvs![vtxIdx*2 + 1];
    ABC_uv1[corner * 3 + 2] = 1;

    ABC_xyz[corner * 3 + 0] = ico.positions![vtxIdx*3 + 0];
    ABC_xyz[corner * 3 + 1] = ico.positions![vtxIdx*3 + 1];
    ABC_xyz[corner * 3 + 2] = ico.positions![vtxIdx*3 + 2];
  }

  const ABC_uv1_inv = G.mat3.invert(new Float32Array(3*3), ABC_uv1);

  for (let i = 0; i < 3*3; i++) {
    uv2bary[faceIdx * (3*3) + i] = ABC_uv1_inv[i];
    bary2xyz[faceIdx * (3*3) + i] = ABC_xyz[i];
  }
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
  uniform /* mat3[20] */ float[180] uv2bary;
  uniform /* vec2[20] */ float[180] bary2xyz;
  uniform sampler2D base;

  void main(void) {
    int f = -1;
    float fDist = 10000.; // actually infinity
    vec3 fBary;
    for (int i = 0; i < 20; i++) {
      mat3 Mbary = mat3(
        uv2bary[i*9+0], uv2bary[i*9+1], uv2bary[i*9+2],
        uv2bary[i*9+3], uv2bary[i*9+4], uv2bary[i*9+5],
        uv2bary[i*9+6], uv2bary[i*9+7], uv2bary[i*9+8]
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

    mat3 Mxyz = mat3(
      bary2xyz[f*9+0], bary2xyz[f*9+1], bary2xyz[f*9+2],
      bary2xyz[f*9+3], bary2xyz[f*9+4], bary2xyz[f*9+5],
      bary2xyz[f*9+6], bary2xyz[f*9+7], bary2xyz[f*9+8]
    );
    vec3 xyz = Mxyz * vec3(fBary);

    // Actually we only need to scale y.  But would this really save time?
    xyz = normalize(xyz);

    float lat = asin(xyz.y);
    float lon = atan(xyz.z, xyz.x);

    // TODO take level of detail into account
    gl_FragColor = texture(base, vec2(
      lon / ${TAU} + .5,
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
  .setFloats("bary2xyz", bary2xyz)
  .setFloats("uv2bary", uv2bary)
  .setTexture("base", base);

export default createIcoSprite;
