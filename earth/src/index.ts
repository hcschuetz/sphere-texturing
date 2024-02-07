import * as B from "@babylonjs/core";
import * as M from "mobx";
import * as T from "../lib/triangulation";
import createIcoSprite from "./IcoSprite";
import { createOctaSprite } from "./OctaSprite";
import { createOctaSphereVertexData } from "./OctaSphere";
// import { log } from "./debug";

M.configure({enforceActions: "never"});

// Abbreviations:
type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

const TAU = 2 * Math.PI;


const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const createStandardMaterial = (
  name: string,
  options: Partial<B.StandardMaterial>,
  scene?: B.Scene
): B.StandardMaterial =>
  Object.assign(new B.StandardMaterial(name, scene), options);

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


const nSteps = M.observable.box(12);
const nStepsElem = document.querySelector("#nSteps") as HTMLInputElement;
Object.assign(nStepsElem, {min: 1, max: 40, value: nSteps.get()});
nStepsElem.addEventListener("change", () => {
  nSteps.set(Number.parseInt(nStepsElem.value));
});
const nStepsLabel = document.querySelector("label[for=nSteps]")!;
M.autorun(() => nStepsLabel.innerHTML = `# steps (${nSteps.get()})`);

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

const displayMode = M.observable.box("polyhedron");
const displayModeElem = document.querySelector("#displayMode") as HTMLSelectElement;
displayModeElem.value = displayMode.get();
displayModeElem.addEventListener("change", () => {
  displayMode.set(displayModeElem.value);
});

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

const numberOfTrianglesElem = document.querySelector("#numberOfTriangles");
const numberOfIndices = M.observable.box<number>(0);
M.autorun(() => numberOfTrianglesElem!.textContent = (numberOfIndices.get() / 3).toFixed());



const smooth = M.computed(() => displayMode.get() !== "polyhedron");
function updateSmooth(mesh: B.Mesh) {
  if (smooth.get()) {
    mesh.updateVerticesData(B.VertexBuffer.NormalKind,
      mesh.getVerticesData(B.VertexBuffer.PositionKind)!,
    );
  } else {
    mesh.removeVerticesData(B.VertexBuffer.NormalKind);
  }
}

// We dispose old textures.  But can't we nevertheless just use M.computed(...)?
let baseTexture = M.observable.box<B.Texture | null>(null);
M.reaction(() => mapURL.get(), url => {
  baseTexture.get()?.dispose();
  baseTexture.set(Object.assign(
    new B.Texture(url, scene), {
      // Wrap around in east/west direction but not in north/south direction:
      wrapU: B.Texture.WRAP_ADDRESSMODE,
      wrapV: B.Texture.CLAMP_ADDRESSMODE,
    }
  ));
}, {fireImmediately: true});

const sphMat = createStandardMaterial("sphMat", {
  specularColor: new B.Color3(.2, .2, .2),
  transparencyMode: B.Material.MATERIAL_ALPHABLEND,
}, scene);
M.autorun(() => sphMat.diffuseTexture = baseTexture.get());
M.autorun(() => sphMat.alpha = Number(triangFn.get() === "[babylon] sphere"));
M.autorun(() => sphMat.wireframe = displayMode.get() === "wireframe");

const sph = new B.Mesh("sph", scene);
// TODO figure out why this rotation is needed:
sph.rotate(v3(1,0,0), TAU/2);
sph.material = sphMat;
M.autorun(() => {
  B.CreateSphereVertexData({
    diameter: 2,
    segments: nSteps.get()
  }).applyToMesh(sph, true);
  if (triangFn.get() === "[babylon] sphere") {
    numberOfIndices.set(sph.getIndices()!.length);
  }
  updateSmooth(sph);
});


const icoMat = createStandardMaterial("icoMat", {
  specularColor: new B.Color3(.2, .2, .2),
  transparencyMode: B.Material.MATERIAL_ALPHABLEND,
}, scene);
const icoSprite = M.observable.box<B.Nullable<B.Texture>>(null);
M.reaction(() => baseTexture.get(), base => {
  icoSprite.get()?.dispose();
  icoSprite.set(!base ? null : createIcoSprite("icoSprite", 3 * 1024, base, scene));
}, {fireImmediately: true});
M.autorun(() => icoMat.diffuseTexture = icoSprite.get());
M.autorun(() => icoMat.alpha = Number(triangFn.get() === "[babylon] icosphere"));
M.autorun(() => icoMat.wireframe = displayMode.get() === "wireframe");

const icoSphere = new B.Mesh("icoSphere");
icoSphere.rotate(v3(0,1,0), TAU/2); // for analogy with the other spheres
icoSphere.material = icoMat;
M.autorun(() => {
  B.CreateIcoSphereVertexData({
    subdivisions: nSteps.get(),
  }).applyToMesh(icoSphere, true);
  if (triangFn.get() === "[babylon] icosphere") {
    numberOfIndices.set(icoSphere.getIndices()!.length);
  }
  updateSmooth(icoSphere);
});

// // Debugging: Display the icoSprite in a square over the Pacific Ocean:
// const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
// const spriteDisplay = new B.Mesh("sprite display", scene)
//   .setIndices([[0, 1, 2], [0, 2, 3]].flat())
//   .setVerticesData(B.VertexBuffer.PositionKind, uvs.flatMap(([u,v]) => [-1.3, v-.5, .5-u]))
//   .setVerticesData(B.VertexBuffer.UVKind      , uvs.flat());
// spriteDisplay.material = icoMat;
// spriteDisplay.parent = icoSphere;


const octaMat = createStandardMaterial("octaMat", {
  specularColor: new B.Color3(.2, .2, .2),
  transparencyMode: B.Material.MATERIAL_ALPHABLEND,
}, scene);
const octaSprite = M.observable.box<B.Nullable<B.Texture>>(null);
M.reaction(() => baseTexture.get(), base => {
  octaSprite.get()?.dispose();
  octaSprite.set(!base ? null : createOctaSprite("octaSprite", 5000, base, scene));
}, {fireImmediately: true});
M.autorun(() => octaMat.diffuseTexture = octaSprite.get());
M.autorun(() => octaMat.alpha = Number(!triangFn.get().startsWith("[")));
M.autorun(() => octaMat.wireframe = displayMode.get() === "wireframe");

const octaSphere = new B.Mesh("octaSphere");
octaSphere.material = octaMat;
M.autorun(() => {
  createOctaSphereVertexData(
    T.triangulationFns[triangFn.get()](nSteps.get())
  ).applyToMesh(octaSphere, true);
  if (!triangFn.get().startsWith("[")) {
    numberOfIndices.set(octaSphere.getIndices()!.length);
  }
  updateSmooth(octaSphere);
});

// // Debugging: Display the octaSprite in a rectangle over the North Pole:
// function sizeRatio(texture: B.Nullable<B.Texture>): number {
//   if (!texture) {
//     return 1;
//   }
//   const {width, height} = texture.getSize();
//   return height / width;
// }
// const uvs = [[0, 0], [1, 0], [1, 1], [0, 1]];
// const zoom = 2;
// const spriteDisplay = new B.Mesh("sprite display", scene)
//   .setIndices([[0, 1, 2], [0, 2, 3]].flat())
//   .setVerticesData(B.VertexBuffer.PositionKind, uvs.flatMap(([u,v]) => [
//     0,
//     v * zoom * sizeRatio(octaSprite.get()) + 1.2,
//     (u - .5) * zoom,
//   ]))
//   .setVerticesData(B.VertexBuffer.UVKind      , uvs.flat());
// spriteDisplay.rotate(v3(0,1,0), TAU/2);
// spriteDisplay.material = octaMat;
// spriteDisplay.parent = octaSphere;


engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
