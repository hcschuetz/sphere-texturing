import * as B from "@babylonjs/core";
import * as M from "mobx";
import * as T from "../lib/triangulation";
import OctaQuarterTexture from "./OctaQuarterTexture";
import { QuarterOctasphere } from "./QuarterOctasphere";
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
  Object.keys(T.triangulationFns)
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

const mapURLExamplesElem = document.querySelector("#mapURLExamples") as HTMLSelectElement;
mapURLExamplesElem.innerHTML =
  `<option></option>` +
  urlExamples
  .map(({name, url}) => `<option value="${url}">${name}</option>`).join("\n");
mapURLExamplesElem.value = "";
mapURLExamplesElem.addEventListener("change", () => {
  mapURL.set(mapURLElem.value = mapURLExamplesElem.value);
});

const stdSphere = M.observable.box(false);
const stdSphereElem = document.querySelector("#stdSphere") as HTMLInputElement;
stdSphereElem.checked = stdSphere.get();
stdSphereElem.addEventListener("change", () => {
  stdSphere.set(stdSphereElem.checked);
});


const smooth = M.computed(() => displayMode.get() !== "polyhedron");

// We dispose old textures.  But can't this be nevertheless be written
// in a way (almost) as simple as for `smooth`?
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

const sph = B.MeshBuilder.CreateSphere("sph", {diameter: 2}, scene);
// TODO figure out why this rotation is needed:
sph.rotate(v3(1,0,0), TAU/2);
const sphMat = createStandardMaterial("sphMat", {
  specularColor: new B.Color3(.2, .2, .2),
  transparencyMode: B.Material.MATERIAL_ALPHABLEND,
}, scene);
sph.material = sphMat;
M.autorun(() => sphMat.diffuseTexture = baseTexture.get());
M.autorun(() => sphMat.alpha = stdSphere.get() ? 1 : 0);

for (const quadrant of [0, 1, 2, 3]) {
  const texture = M.observable.box<B.Nullable<B.Texture>>(null);
  M.reaction(() => baseTexture.get(), base => {
    texture.get()?.dispose();
    texture.set(!base ? null : Object.assign(
      new OctaQuarterTexture("triangTex", 1024*2, scene)
      .setTexture("base", base)
      .setFloat("quadrant", quadrant), {
        wrapU: B.Texture.CLAMP_ADDRESSMODE,
        wrapV: B.Texture.CLAMP_ADDRESSMODE,
      }
    ));  
  }, {fireImmediately: true});

  const material = createStandardMaterial("mat", {
    specularColor: new B.Color3(.2, .2, .2),
    transparencyMode: B.Material.MATERIAL_ALPHABLEND,
  }, scene);
  M.autorun(() => material.diffuseTexture = texture.get());
  M.autorun(() => material.wireframe = displayMode.get() === "wireframe");
  M.autorun(() => material.alpha = stdSphere.get() ? 0 : 1);

  let qo: QuarterOctasphere | undefined;
  M.autorun(() => {
    qo?.dispose();
    qo = new QuarterOctasphere("qo", {
      steps: nSteps.get(),
      triangulationFn: T.triangulationFns[triangFn.get()],
      smooth: smooth.get(),
    }, scene);
    qo.material = material;
    qo.rotate(v3(0, -1, 0), quadrant * (TAU/4));
  });
}


engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
