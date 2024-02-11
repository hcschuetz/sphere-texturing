import * as B from "@babylonjs/core";


const TAU = 2 * Math.PI;


// Get uvs and positions from a Babylon icosphere without subdivisions
const ico = B.CreateIcoSphereVertexData({subdivisions: 1});
const uvs = ico.uvs!;
const positionsFlat = ico.positions!;

// For each triangle, invert the matrix of uv coordinates (extended with ones,
// and extended ):
const uv12bary: (number[] | Float32Array)[] = [];
for (let offset = 0; offset < uvs.length;) {
  const uv1MatrixInv = B.Matrix.GetAsMatrix3x3(
    B.Matrix.FromValues(
      // u           v        1
      uvs[offset++], uvs[offset++], 1, 0,
      uvs[offset++], uvs[offset++], 1, 0,
      uvs[offset++], uvs[offset++], 1, 0,
      0            , 0            , 0, 1,
    ).invert()
  );
  uv12bary.push(uv1MatrixInv);
}

const positions: number[][] = [];
for (let offset = 0; offset < positionsFlat.length;) {
  positions.push([
    positionsFlat[offset++], positionsFlat[offset++], positionsFlat[offset++],
    positionsFlat[offset++], positionsFlat[offset++], positionsFlat[offset++],
    positionsFlat[offset++], positionsFlat[offset++], positionsFlat[offset++],
  ]);
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

  uniform sampler2D base;

  mat3 uv12bary [20] = mat3[20](${uv12bary .map(values => `mat3(${values})`).join(",\n")});
  mat3 positions[20] = mat3[20](${positions.map(values => `mat3(${values})`).join(",\n")});

  void main(void) {
    int f = -1;
    float fDist = 10000.; // actually infinity
    vec3 fBary;

    int offset = 0;
    for (int i = 0; i < 20; i++) {
      vec3 bary = uv12bary[i] * vec3(vUV, 1.);
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

    vec3 xyz = positions[f] * vec3(fBary);

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
  .setTexture("base", base);

export default createIcoSprite;
