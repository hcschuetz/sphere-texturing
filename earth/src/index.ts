import * as B from "@babylonjs/core";
import * as M from "mobx";
import * as T from "../lib/triangulation";
import createIcoSprite from "./IcoSprite";
import { createOctaSprite } from "./OctaSprite";
import { createOctaSphereVertexData } from "./OctaSphere";

M.configure({enforceActions: "never"});

// -----------------------------------------------------------------------------
// Abbreviations and Utilities

const TAU = 2 * Math.PI;

type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

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

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0, 0, 0, 0);

const camera = new B.ArcRotateCamera("camera", .55 * TAU, .15 * TAU, 3, v3(0, 0, 0), scene);
camera.lowerRadiusLimit = 2.1;
camera.upperRadiusLimit = 10;
camera.attachControl(undefined, true);

// TODO make lights configurable

// // Day & Night:
// const sunDirection = v3(1, -.2, 0);
// new B.DirectionalLight("sun", sunDirection, scene);

// Illuminate both hemispheres:
new B.HemisphericLight("north", v3(0, +1, 0), scene);
new B.HemisphericLight("south", v3(0, -1, 0), scene);


// -----------------------------------------------------------------------------
// Configuration UI

type URLExample = {name: string, url: string};

const urlExamples: URLExample[] = [
  {
    name: "Earth",
    url: "https://neo.gsfc.nasa.gov/servlet/RenderData?si=526304&cs=rgb&format=JPEG&width=3600&height=1800",
  },
  {
    name: "Moon",
    url: "https://upload.wikimedia.org/wikipedia/commons/9/9d/Moon_map_grid_showing_artificial_objects_on_moon.PNG",
  },
  {
    name: "Mars",
    url: "https://upload.wikimedia.org/wikipedia/commons/b/b7/Mars_G%C3%A9olocalisation.jpg",
  },
  {
    name: "Earth with Tissot indicatrix",
    url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Plate_Carr%C3%A9e_with_Tissot%27s_Indicatrices_of_Distortion.svg/2560px-Plate_Carr%C3%A9e_with_Tissot%27s_Indicatrices_of_Distortion.svg.png",
  },
]

const mapURL = M.observable.box(urlExamples[0].url);
const mapURLElem = document.querySelector("#mapURL") as HTMLInputElement;
mapURLElem.value = mapURL.get();
mapURLElem.addEventListener("change", () => {
  mapURL.set(mapURLElem.value);
});

const mapLinkElem = document.querySelector("#mapLink") as HTMLAnchorElement;
M.autorun(() => mapLinkElem.href = mapURL.get());

const mapURLExamplesElem = document.querySelector("#mapURLExamples") as HTMLSelectElement;
mapURLExamplesElem.innerHTML =
  `<option></option>` +
  urlExamples
  .map(({name, url}) => `<option value="${url}">${name}</option>`).join("\n");
mapURLExamplesElem.value = "";
mapURLExamplesElem.addEventListener("change", () => {
  mapURL.set(mapURLElem.value = mapURLExamplesElem.value);
});

const triangFn = M.observable.box("geodesics");
const triangFnElem = document.querySelector("#triangFn") as HTMLSelectElement;
triangFnElem.innerHTML =
  ["[babylon] sphere", "[babylon] icosphere", ...Object.keys(T.triangulationFns)]
  .filter(name => name !== "collapsed")
  .map(name => `<option>${name}</option>`).join("\n");
triangFnElem.value = triangFn.get();
triangFnElem.addEventListener("change", () => {
  triangFn.set(triangFnElem.value);
});

const nSteps = M.observable.box(12);
const nStepsElem = document.querySelector("#nSteps") as HTMLInputElement;
Object.assign(nStepsElem, {min: 1, max: 40, value: nSteps.get()});
nStepsElem.addEventListener("change", () => {
  nSteps.set(Number.parseInt(nStepsElem.value));
});
const nStepsLabel = document.querySelector("label[for=nSteps]")!;
M.autorun(() => nStepsLabel.innerHTML = `# steps (${nSteps.get()})`);

const numberOfTrianglesElem = document.querySelector("#numberOfTriangles");
const numberOfTriangles = M.observable.box<number>(0);
M.autorun(() => numberOfTrianglesElem!.textContent = numberOfTriangles.get().toFixed());

const displayMode = M.observable.box("polyhedron");
const displayModeElem = document.querySelector("#displayMode") as HTMLSelectElement;
displayModeElem.value = displayMode.get();
displayModeElem.addEventListener("change", () => {
  displayMode.set(displayModeElem.value);
});

const showTexture = M.observable.box(false);
const showTextureElem = document.querySelector("#showTexture") as HTMLInputElement;
showTextureElem.checked = showTexture.get();
showTextureElem.addEventListener("change", () => {
  showTexture.set(showTextureElem.checked);
})

// -----------------------------------------------------------------------------
// Textures/Sprites

let baseTexture = M.computed(() => {
  const url = mapURL.get();
  const tx = new B.Texture(url);
  // Wrap around in east/west direction but not in north/south direction:
  tx.wrapU = B.Texture.WRAP_ADDRESSMODE;
  tx.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  M.when(() => mapURL.get() !== url, () => tx.dispose());
  return tx;
});

const octaSprite = M.computed(() => {
  const base = baseTexture.get();
  const spr = !base ? null : createOctaSprite("octaSprite", 5000, base, scene);
  M.when(() => baseTexture.get() !== base, () => spr?.dispose())
  return spr;
});

const icoSprite = M.computed(() => {
  const base = baseTexture.get();
  const spr = !base ? null : createIcoSprite("icoSprite", 2 * 1024, base, scene);
  M.when(() => baseTexture.get() !== base, () => spr?.dispose());
  return spr;
});

const currentTexture = M.computed(() => {
  switch (triangFn.get()) {
    case "[babylon] sphere"   : return baseTexture.get();
    case "[babylon] icosphere": return icoSprite.get();
    default:                    return octaSprite.get();
  }
});

// -----------------------------------------------------------------------------
// Material

const mat = createStandardMaterial("sphere mat", {
    specularColor: new B.Color3(.2, .2, .2),
  }, scene);

M.autorun(() => mat.diffuseTexture = currentTexture.get());
M.autorun(() => mat.wireframe = displayMode.get() === "wireframe");

// -----------------------------------------------------------------------------
// Texture/Sprite Debugging

{
  const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
  const rectangle =
    new B.Mesh("sprite display", scene)
    .setIndices([[0, 1, 2], [0, 2, 3]].flat())
    .setVerticesData(B.VertexBuffer.UVKind, uvs.flat());
  const zoom = 1 / 5000;
  M.autorun(() => {
    const {height, width} =
      currentTexture.get()?.getSize() ?? {width: 1000, height: 1000};
    rectangle.setVerticesData(B.VertexBuffer.PositionKind,
      uvs.flatMap(([u,v]) => [
        (u - .5) * width  * zoom,
        (v - .5) * height * zoom,
        1.05,
      ]),
      true,
    );
  });
  rectangle.parent = camera;
  rectangle.material = mat;
  M.autorun(() => rectangle.isVisible = showTexture.get());
}

// -----------------------------------------------------------------------------
// Mesh

const smooth = M.computed(() => displayMode.get() !== "polyhedron");

const mesh = new B.Mesh("sphere", scene);
mesh.material = mat;
M.autorun(() => {
  let vertexData: B.VertexData, material: B.Nullable<B.Material>;
  switch (triangFn.get()) {
    case "[babylon] sphere":
      vertexData = B.CreateSphereVertexData({
        diameter: 2,
        segments: nSteps.get()
      }).transform(B.Matrix.RotationX(TAU/2));
      break;
    case "[babylon] icosphere":
      vertexData = B.CreateIcoSphereVertexData({
        subdivisions: nSteps.get(),
      });
      break;
    default:
      vertexData = createOctaSphereVertexData(
        T.triangulationFns[triangFn.get()](nSteps.get())
      );
      break;
  }
  vertexData.applyToMesh(mesh, true);

  numberOfTriangles.set(vertexData.indices!.length / 3);

  // TODO Why doesn't this work anymore if we put it into a separate autorun?
  if (smooth.get()) {
    mesh.updateVerticesData(B.VertexBuffer.NormalKind,
      mesh.getVerticesData(B.VertexBuffer.PositionKind)!,
    );
  } else {
    mesh.removeVerticesData(B.VertexBuffer.NormalKind);
  }
});

// -----------------------------------------------------------------------------

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
