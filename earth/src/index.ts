import * as B from "@babylonjs/core";
import * as M from "mobx";
import * as T from "../lib/triangulation";
import createIcoSprite from "./IcoSprite";
import { createOctaSprite } from "./OctaSprite";
import { createOctaSphereVertexData } from "./OctaSphere";
import * as MyIco from "./MyIcoSphere";

M.configure({enforceActions: "never"});

let nameCount = 0;
const nm = (base: string) => base + "#" + nameCount++;

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
  Object.assign(new B.StandardMaterial(nm(name), scene), options);

// -----------------------------------------------------------------------------
// Set up engine/scene/camera/lighting

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0, 0, 0, 0);

const camera = new B.ArcRotateCamera(nm("camera"), .55 * TAU, .15 * TAU, 3, v3(0, 0, 0), scene);
camera.lowerRadiusLimit = 2.1;
camera.upperRadiusLimit = 10;
camera.attachControl(undefined, true);

// TODO make lights configurable

// // Day & Night:
// const sunDirection = v3(1, -.2, 0);
// new B.DirectionalLight(nm("sun"), sunDirection, scene);

// Illuminate both hemispheres:
new B.HemisphericLight(nm("north"), v3(0, +1, 0), scene);
new B.HemisphericLight(nm("south"), v3(0, -1, 0), scene);


// -----------------------------------------------------------------------------
// Configuration UI

type URLExample = {name: string, url: string};

const urlExamples: URLExample[] = [
  {
    name: "Earth",
    url: "https://upload.wikimedia.org/wikipedia/commons/5/56/Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg",
    // currently (2024-02-28) downloads from this site do not work:
    // url: "https://neo.gsfc.nasa.gov/servlet/RenderData?si=526304&cs=rgb&format=JPEG&width=3600&height=1800",
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
  // This one is large and slow:
  // {
  //   name: "Earth Elevation",
  //   url: "https://upload.wikimedia.org/wikipedia/commons/9/93/Elevation.jpg",
  // },
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
triangFnElem.innerHTML = `
  <optgroup label="Octahedral&nbsp;">
    ${Object.keys(T.triangulationFns).map(name => {
      switch (name) {
        case "collapsed": return "";
        case "flat":
        case "sines": return `<option value="${name}">${name} (non-spheric)</option>`;
        default: return `<option>${name}</option>`;
        }
    }).join("\n")
    }
  </optgroup>
  <optgroup label="Non-Octahedral&nbsp;">
    <option>[my] icosphere</option>
    <option>[babylon] icosphere</option>
    <option>[babylon] sphere</option>
  </optgroup>
  `;
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

const displayMode = M.observable.box("smooth");
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
});

// -----------------------------------------------------------------------------
// Textures/Sprites

const baseTexture = M.computed(() => {
  const url = mapURL.get();
  if (!url) {
    return null;
  }
  const tx = new B.Texture(url, scene, true);
  // Wrap around in east/west direction but not in north/south direction:
  tx.wrapU = B.Texture.WRAP_ADDRESSMODE;
  tx.wrapV = B.Texture.CLAMP_ADDRESSMODE;
  M.when(() => baseTexture.get() !== tx, () => tx.dispose());
  return tx;
});

const mapping = M.computed(() => {
  switch(triangFn.get()) {
    case "[babylon] sphere"   : return "plain";
    case "[babylon] icosphere": return "ico";
    case "[my] icosphere"     : return "myIco";
    default                   : return "octa";
  }
});

const currentTexture = M.computed(() => {
  const base = baseTexture.get();
  if (!base) {
    return null;
  }

  const mappingVal = mapping.get();

  function disposing(tx: B.Texture) {
    M.when(() => currentTexture.get() !== tx, () => tx.dispose());
    return tx;
  }

  switch (mappingVal) {
    case "plain": return base;
    case "ico"  : return disposing(createIcoSprite(nm("icoSprite"), 2 * 1024, base, scene));
    case "myIco": return disposing(MyIco.createIcoSprite(nm("myIcoSprite"), 3600, base, scene));
    case "octa" : return disposing(createOctaSprite(nm("octaSprite"), 5000, base, scene));
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
    new B.Mesh(nm("sprite display"), scene)
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
  const rectMat = createStandardMaterial("sprite disp mat", {
    diffuseColor: B.Color3.Black(),
    specularColor: B.Color3.Black(),
  }, scene);
  rectangle.material = rectMat;
  M.autorun(() => rectMat.emissiveTexture = currentTexture.get());
  M.autorun(() => rectangle.isVisible = showTexture.get());
}

// -----------------------------------------------------------------------------
// Mesh

const smooth = M.computed(() => displayMode.get() !== "polyhedron");

const mesh = new B.Mesh(nm("sphere"), scene);
mesh.material = mat;
M.autorun(() => {
  const fnName = triangFn.get();
  let vertexData: B.VertexData;
  switch (fnName) {
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
    case "[my] icosphere":
      vertexData = MyIco.createIcoVertices(nSteps.get());
      break;
    default:
      vertexData = createOctaSphereVertexData(
        T.triangulationFns[fnName](nSteps.get())
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
