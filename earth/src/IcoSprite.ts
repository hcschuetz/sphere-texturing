import * as B from "@babylonjs/core";


const TAU = 2 * Math.PI;

// Given the `uv` coordinates of three triangle vertices, return a matrix
// mapping `(u, v, 1)` to normalized barycentric coordinates for the triangle.
const uv12baryMatrix = ([u0, v0, u1, v1, u2, v2]: B.FloatArray) =>
  B.Matrix.GetAsMatrix3x3(
    B.Matrix.FromValues(
      u0, v0, 1, 0,
      u1, v1, 1, 0,
      u2, v2, 1, 0,
      0 , 0 , 0, 1,
    ).invert()
  );

// For the sprite layout take uv and position data from a Babylon icosphere
// without subdivisions, that is, a plain icosahedron.
const ico = B.CreateIcoSphereVertexData({subdivisions: 1});

// The following code assumes that the ico vertex data is not indexed or uses
// indices [0, 1, ..., 59].

const uv12bary = Array.from({length: 20}, (_, i) =>
  uv12baryMatrix(ico.uvs!.slice(i * 6, (i + 1) * 6))
);

const positions = Array.from({length: 20}, (_, i) =>
  ico.positions!.slice(i * 9, (i + 1) * 9)
);


// Apply the following coordinate mappings:
// - uv ==> barycentric (for all faces)
// - select the appropriate face
// - barycentric ==> xyz on icosahedron face
// - position on icosahedron face ==> position on sphere
// - position ==> longitude/latitude
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

    // Actually we only need to scale y as the atan function
    // only cares about the ratio of z an x.
    // But would this really save time?
    vec3 position = normalize(positions[f] * fBary);

    // TODO take level of detail into account
    gl_FragColor = texture(base, vec2(
      atan(position.z, position.x) * ${1/TAU},
      asin(position.y) * ${2/TAU} + .5
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
