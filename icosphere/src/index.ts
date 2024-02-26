import * as B from "@babylonjs/core";
import { createIcovertices } from "./icovertices";
import { createIcoSprite } from "./icosprite";

// -----------------------------------------------------------------------------
// Abbreviations and Utilities

export const TAU = 2 * Math.PI;

export type V3 = B.Vector3;
export const V3 = B.Vector3;
export const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

const createStandardMaterial = (
  name: string,
  options: Partial<B.StandardMaterial>,
  scene?: B.Scene
): B.StandardMaterial =>
  Object.assign(new B.StandardMaterial(name, scene), options);

// -----------------------------------------------------------------------------
// Set up engine/scene/camera/lighting

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

export const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0, 0, 0, 0);

const camera = new B.ArcRotateCamera("camera", .55 * TAU, .15 * TAU, 3, v3(0, 0, 0), scene);
camera.lowerRadiusLimit = 2.1;
camera.upperRadiusLimit = 10;
camera.attachControl(undefined, true);

const light = new B.HemisphericLight('light1', v3(0, 1, 0), scene);
light.intensity = 0.8;

const light2 = new B.DirectionalLight("light2", v3(10, -2, -10), scene);
light2.intensity = 0.8;

const light3 = new B.DirectionalLight("light3", v3(3, 10, 10), scene);
light3.intensity = 0.5;

const light4 = new B.DirectionalLight("light4", v3(-10, 3, -3), scene);
light4.intensity = 0.5;

// -----------------------------------------------------------------------------
// Material

const base = new B.Texture(
  "https://neo.gsfc.nasa.gov/servlet/RenderData?si=526304&cs=rgb&format=JPEG&width=3600&height=1800",
  scene, true);
const sprite = createIcoSprite("icoSprite", 2000, base, scene);

const mat = createStandardMaterial("ico mat", {
  specularColor: new B.Color3(.5, .5, .5),
  diffuseTexture: sprite,
  // wireframe: true,
}, scene);

// -----------------------------------------------------------------------------
// Mesh

const mesh = new B.Mesh("sphere", scene);
mesh.material = mat;
createIcovertices().applyToMesh(mesh);

// Texture/Sprite Debugging
if (false) {
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const rectangle =
    new B.Mesh("sprite display", scene)
    .setIndices([[0, 1, 2], [0, 2, 3]].flat())
    .setVerticesData(B.VertexBuffer.UVKind, uvs.flat());
  const zoom = 1 / 2500;
  const {width, height} = sprite.getSize();
  rectangle.setVerticesData(B.VertexBuffer.PositionKind,
    uvs.flatMap(([u,v]) => [
      (u - .5) * width  * zoom,
      (v - .5) * height * zoom,
      1.05,
    ]),
    true,
  );
  rectangle.parent = camera;
  rectangle.material = createStandardMaterial("sprite disp mat", {
    diffuseColor: B.Color3.Black(),
    specularColor: B.Color3.Black(),
    emissiveTexture: sprite,
  }, scene);
}

// -----------------------------------------------------------------------------

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
