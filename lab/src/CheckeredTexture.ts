import * as B from "@babylonjs/core";

B.Effect.ShadersStore.CheckeredPixelShader = `
  varying vec2 vUV;

  uniform vec2 density, offset, slant;
  uniform vec4 color1, color2;

  void main(void) {
    vec2 p = density * vUV - offset;
    vec2 counts = floor(vec2(p.y, p.x) - slant * p);
    gl_FragColor = mix(color1, color2, mod(counts.x + counts.y, 2.0));
  }
`;

const defaults = {
  density: new B.Vector2(10,10),
  offset : new B.Vector2(0,0),
  slant  : new B.Vector2(0, 0),
  color1 : new B.Color4(0,0,0,1),
  color2 : new B.Color4(1,1,1,1),
};

type SuperConstrParams = ConstructorParameters<typeof B.ProceduralTexture>;

export default class CheckeredTexture extends B.ProceduralTexture {
  constructor(
    name            : SuperConstrParams[0],
    size            : SuperConstrParams[1],
    uniforms        : Partial<typeof defaults>,
    scene           : SuperConstrParams[3] = null,
    fallbackTexture?: SuperConstrParams[4],
    generateMipMaps?: SuperConstrParams[5],
  ) {
    super(name, size, "Checkered", scene, fallbackTexture, generateMipMaps);
    Object.assign(this, defaults, uniforms);
  }

  set density(value: B.Vector2) { this.setVector2("density", value); }
  set offset (value: B.Vector2) { this.setVector2("offset" , value); }
  set slant  (value: B.Vector2) { this.setVector2("slant"  , value); }
  set color1 (value: B.Color4 ) { this.setColor4 ("color1" , value); }
  set color2 (value: B.Color4 ) { this.setColor4 ("color2" , value); }
}
