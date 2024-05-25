import * as B from "@babylonjs/core";
import * as BM from "@babylonjs/materials";
import * as M from "mobx";
import { createIcoSprite, createIcoVertices } from "./MyIcoSphere";
import { createOctaSprite } from "./OctaSprite";
import * as FI from "./FoldableIcosahedron";
import * as FO from "./FoldableOctahedron";
import { createOctaSphereVertexData } from "./OctaSphere";

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

const canvas = document.querySelector<HTMLCanvasElement>('#renderCanvas');
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

const scene = new B.Scene(engine);
scene.clearColor = new B.Color4(0, 0, 0, 0);

const camera = new B.ArcRotateCamera(nm("camera"), .05 * TAU, .2 * TAU, 7, v3(0, 0, 0), scene);
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


if (false) {
  ([[1,0,0], [0,1,0], [0,0,1]] as [number, number, number][])
  .forEach((dims, i) => {
    const color = new B.Color3(...dims);
    const arrow = B.MeshBuilder.CreateTube("arrow-" + i, {
      path: [0, .9, .9, 1].map(s => v3(...dims).scaleInPlace(s)),
      radiusFunction: i => [.008, .008, .024, 0][i],
    }, scene);
    arrow.material = createStandardMaterial("arrowMat", {
      diffuseColor: color,
      // emissiveColor: color,
    }, scene);
  });

  // Allow to hide some vertices temporarily inside the origin
  const origin = B.MeshBuilder.CreateIcoSphere("origin", {
    radius: 0.02,
  }, scene);
  origin.material =
    createStandardMaterial("originMat", {
      diffuseColor: B.Color3.Black(),
    }, scene);
}

// -----------------------------------------------------------------------------
// Base Texture

// See https://en.wikipedia.org/wiki/File:Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg
// for origin (NASA) and copyright (public domain).
const url = "https://upload.wikimedia.org/wikipedia/commons/5/56/Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg";
const baseTexture = Object.assign(new B.Texture(url, scene, true), {
  wrapU: B.Texture.WRAP_ADDRESSMODE,
  wrapV: B.Texture.CLAMP_ADDRESSMODE,
});

const baseReady = M.observable.box<B.Texture | null>(null);
baseTexture.onLoadObservable.addOnce(() => baseReady.set(baseTexture));

const offset = M.observable.box(0);

function disposing(box: M.IComputedValue<B.Texture | null>, tx: B.Texture): B.Texture {
  M.when(() => box.get() !== tx, () => tx.dispose());
  return tx;
};

const icoSprite = M.computed((): B.Texture | null => {
  const base = baseReady.get();
  return base && disposing(icoSprite, createIcoSprite(nm("myIcoSprite"), 3600, base, offset.get(), scene));
});
const octaSprite = M.computed((): B.Texture | null => {
  const base = baseReady.get();
  return base && disposing(octaSprite, createOctaSprite(nm("octaSprite"), 3600, base, offset.get(), scene));
});

// -----------------------------------------------------------------------------
// Lat/Lon Sphere

class LatLonMaterial extends BM.CustomMaterial {
  constructor(name: string, withRot: boolean, scene: B.Scene) {
    super(name, scene);

    this
    .AddUniform("latClosedness", "float", 0.3)
    .AddUniform("lonClosedness", "float", 0.7)
    .Vertex_Before_PositionUpdated(`
      float rLat = 1. / latClosedness;
      float lat = position.y;
      float latEffective = lat * latClosedness;
      float cLat = cos(latEffective);
      float sLat = sin(latEffective);
      vec2 meridian =
        latClosedness < 1e-3
        //     radial (xz)          axial (y)
        ? vec2(0                  , lat                     )
        : vec2((cLat - 1.0) * rLat, sLat * rLat);

      float rLon = 1. / lonClosedness;
      float lon = position.x;
      float lonEffective = lon * lonClosedness;
      float cLon = cos(lonEffective);
      float sLon = sin(lonEffective);
      float r_xz = rLon + meridian.x;
      vec2 parallel =
        lonClosedness < 1e-3
        //     x                   z
        ? vec2(meridian.x        , lon        )
        : vec2(r_xz * cLon - rLon, r_xz * sLon);

      positionUpdated = vec3(parallel.x + 1.0, meridian.y, parallel.y);
    `)
    .Vertex_Before_NormalUpdated(`
      normalUpdated = (
        cLat < 1e-3 || lonClosedness < 1e-3 ? vec3(cLat, sLat, 0) :
        normalize(cross(
          vec3(-sLat * cLon, cLat, -sLat * sLon),
          vec3(r_xz * -sLon, 0, r_xz * cLon)
        ))
      ) * vec3(position.z);
    `);
    if (withRot) {
      this
      .AddUniform("rot", "float", 0)
      .Vertex_After_WorldPosComputed(`
        uvUpdated.x -= rot;
      `);
    }
  }

  set latClosedness(value: number) {
    this.onBindObservable.add(() => {
      this.getEffect().setFloat("latClosedness", value);
    });
  }

  set lonClosedness(value: number) {
    this.onBindObservable.add(() => {
      this.getEffect().setFloat("lonClosedness", value);
    });
  }

  set rot(value: number) {
    this.onBindObservable.add(() => {
      this.getEffect().setFloat("rot", value);
    });
  }
}

const llMat = Object.assign(new LatLonMaterial("latLon mat", true, scene), {
  specularColor: new B.Color3(.5, .5, .5),
  diffuseTexture: baseTexture,
});
M.autorun(() => llMat.rot = offset.get());

const llBackMat = Object.assign(new LatLonMaterial("latLon back mat", false, scene), {
  diffuseColor : new B.Color3(.5, .5, .5),
  specularColor: new B.Color3(.5, .5, .5),
});

const flipOffset = [0, 1, -1];
const flipTriangles = (input: B.IndicesArray) =>
  input.map((_, i) => input[i + flipOffset[i % 3]]);

function createGrid(uSteps: number, vSteps: number) {
  const nVertices = (uSteps + 1) * (vSteps + 1);
  const positions = new Float32Array(nVertices * 3);
  const uvs = new Float32Array(nVertices * 2);
  const indices = new Uint32Array(6 * uSteps * vSteps);

  let idxIdx = 0;
  for (let vIdx = 0; vIdx <= vSteps; vIdx++) {
    const v = vIdx / vSteps;
    for (let uIdx = 0; uIdx <= uSteps; uIdx++) {
      const u = uIdx / uSteps;
      const idx = uIdx + vIdx * (uSteps + 1);
      uvs[2 * idx + 0] = u;
      uvs[2 * idx + 1] = v;
      positions[3 * idx + 0] = (u - 0.5) * TAU;    // lon
      positions[3 * idx + 1] = (v - 0.5) * TAU/2;  // lat
      positions[3 * idx + 2] = 1;                  // +1: outside, -1: inside
      if (u > 0 && v > 0) {
        indices[idxIdx++] = idx;
        indices[idxIdx++] = idx-1;
        indices[idxIdx++] = idx-(uSteps+1);
        indices[idxIdx++] = idx-1;
        indices[idxIdx++] = idx-(uSteps+1)-1;
        indices[idxIdx++] = idx-(uSteps+1);
      }
    }
  }

  return Object.assign(new B.VertexData(), {
    indices,
    positions,
    // The normals are not used by our material; the property here just causes
    // Babylon to include normals support in the shaders, which is used by our
    // shader code (variable "normalUpdated").
    normals: positions,
    uvs});
}

let llSphere: B.Mesh;
let llSphereBack: B.Mesh;
{
  const grid = createGrid(36, 18);
  llSphere = new B.Mesh("llSphere");
  grid.applyToMesh(llSphere);
  llSphere.material = llMat;

  const gridBack = Object.assign(new B.VertexData(), {
    indices: flipTriangles(grid.indices),
    positions: grid.positions.map((val, i) => i % 3 == 2 ? -1 : val),
    normals: grid.positions, // See the comment on normals above.
    uvs: grid.uvs,
  })
  llSphereBack = new B.Mesh("llSphereBack");
  gridBack.applyToMesh(llSphereBack);
  llSphereBack.material = llBackMat;
}

// -----------------------------------------------------------------------------
// Inflate polyhedron to sphere

class SphereMaterial extends BM.CustomMaterial {
  constructor(name: string, scene: B.Scene) {
    super(name, scene);

    this.AddUniform("bulge", "float", 0.9)
    .Vertex_Before_PositionUpdated(`
      vec3 normalizedPos = normalize(position);
      positionUpdated = mix(position, normalizedPos, bulge);
    `)
    .Vertex_Before_NormalUpdated(`
      normalUpdated = mix(normal, normalizedPos, bulge);
    `);
  }

  set bulge(value: number) {
    // No idea why we have to do this incantation of  "onBindObservable".
    // But I found this in a playground example and it seems to work.
    this.onBindObservable.add(() => {
      this.getEffect().setFloat("bulge", value);
    });
  }
}

// -----------------------------------------------------------------------------
// Octasphere

const octaSphMat = Object.assign(new SphereMaterial("octasphere mat", scene), {
  specularColor: new B.Color3(.5, .5, .5),
});
M.autorun(() => octaSphMat.diffuseTexture = octaSprite.get());

const octaSphMesh = new B.Mesh(nm("octasphere"), scene);
octaSphMesh.material = octaSphMat;
octaSphMesh.rotate(B.Axis.Y, TAU/2);

createOctaSphereVertexData(8).applyToMesh(octaSphMesh, true);

// -----------------------------------------------------------------------------
// Icosphere

const icoSphMat = Object.assign(new SphereMaterial("icosphere mat", scene), {
  specularColor: new B.Color3(.5, .5, .5),
});
M.autorun(() => icoSphMat.diffuseTexture = icoSprite.get());

const icoSphMesh = new B.Mesh(nm("icosphere"), scene);
icoSphMesh.material = icoSphMat;
icoSphMesh.rotate(B.Axis.Y, TAU/2);

createIcoVertices(8).applyToMesh(icoSphMesh, true);

// -----------------------------------------------------------------------------
// Octahedron

const octaMat = createStandardMaterial("octa mat", {
  specularColor: new B.Color3(.5, .5, .5),
}, scene);
M.autorun(() => octaMat.diffuseTexture = octaSprite.get());

const octaMesh = new B.Mesh(nm("octahedron"), scene);
octaMesh.material = octaMat;

const octaBackMesh = new B.Mesh(nm("octahedron back"), scene);
octaBackMesh.material = createStandardMaterial("back mat", {
  diffuseColor : new B.Color3(.5, .5, .5),
  specularColor: new B.Color3(.5, .5, .5),
}, scene);

const fo = new FO.FoldableOctahedron();
const foPosArray = fo.positions;

Object.assign(new B.VertexData(), {
  indices: FO.indices,
  positions: foPosArray,
  uvs: FO.uvs,
}).applyToMesh(octaMesh, true);

Object.assign(new B.VertexData(), {
  indices: flipTriangles(FO.indices),
  positions: foPosArray,
  uvs: FO.uvs,
}).applyToMesh(octaBackMesh, true);

function adaptOctaPos(bend: number, shiftSouthern: number) {
  fo.computePositions(bend, shiftSouthern);
  octaMesh.updateVerticesData(B.VertexBuffer.PositionKind, foPosArray);
  octaBackMesh.updateVerticesData(B.VertexBuffer.PositionKind, foPosArray);
}

// -----------------------------------------------------------------------------
// Icosahedron

const icoMat = createStandardMaterial("ico mat", {
  specularColor: new B.Color3(.5, .5, .5),
}, scene);
M.autorun(() => icoMat.diffuseTexture = icoSprite.get());

const icoMesh = new B.Mesh(nm("icosahedron"), scene);
icoMesh.material = icoMat;

const icoBackMesh = new B.Mesh(nm("icosahedron back"), scene);
icoBackMesh.material = createStandardMaterial("back mat", {
  diffuseColor : new B.Color3(.5, .5, .5),
  specularColor: new B.Color3(.5, .5, .5),
}, scene);

const fi = new FI.FoldableIcosahedron();
const fiPosArray = fi.positions;

Object.assign(new B.VertexData(), {
  indices: FI.indices,
  positions: fiPosArray,
  uvs: FI.uvs,
}).applyToMesh(icoMesh, true);

Object.assign(new B.VertexData(), {
  indices: flipTriangles(FI.indices),
  positions: fiPosArray,
  uvs: FI.uvs,
}).applyToMesh(icoBackMesh, true);

function adaptIcoPos(bend: number, shiftSouthern: number) {
  fi.computePositions(bend, shiftSouthern);
  icoMesh.updateVerticesData(B.VertexBuffer.PositionKind, fiPosArray);
  icoBackMesh.updateVerticesData(B.VertexBuffer.PositionKind, fiPosArray);
}

// -----------------------------------------------------------------------------

type Point = DOMPointReadOnly;
const point = (x: number, y: number) => new DOMPointReadOnly(x, y);

function svgEl<K extends keyof SVGElementTagNameMap>(name: K, attrs: Object = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, value.toString());
  }
  return el;
}

interface ConfigElem {
  /** Provide hints to the user. */
  createSVG(): SVGElement;

  /** The point in this element that is closest to the given point. */
  getClosest(p: Point): Point;

  /** Apply the given point.  (It will be in this element.) */
  processValue(p: Point): void;
}

class ConfigHLine implements ConfigElem {
  constructor(
    private xStart: number,
    private xEnd: number,
    private y: number,
    private process: (val: number) => void,
  ) {}

  createSVG(): SVGElement {
    return svgEl("line", {
      x1: this.xStart, y1: this.y,
      x2: this.xEnd  , y2: this.y,
    })
  }

  getClosest(p: Point): Point {
    return point([this.xStart, p.x, this.xEnd].sort((a, b) => a - b)[1], this.y);
  }

  processValue(p: Point) {
    this.process((p.y - this.xStart) / (this.xEnd - this.xStart));
  }
}

class ConfigVLine implements ConfigElem {
  constructor(
    private x: number,
    private yStart: number,
    private yEnd: number,
    private process: (val: number) => void,
  ) {}

  createSVG(): SVGElement {
    return svgEl("line", {
      x1: this.x, y1: this.yStart,
      x2: this.x, y2: this.yEnd,
    })
  }

  getClosest(p: Point): Point {
    return point(this.x, [this.yStart, p.y, this.yEnd].sort((a, b) => a - b)[1]);
  }

  processValue(p: Point) {
    this.process((p.y - this.yStart) / (this.yEnd - this.yStart));
  }
}

class ConfigDiamond implements ConfigElem {
  constructor(
    private center: Point,
    private halfDiag: number,
    private process: (a: number, b: number) => void,
  ) {}

  createSVG(): SVGElement {
    return svgEl("polygon", {
      points: `
        ${this.center.x              },${this.center.y-this.halfDiag}
        ${this.center.x-this.halfDiag},${this.center.y              }
        ${this.center.x              },${this.center.y+this.halfDiag}
        ${this.center.x+this.halfDiag},${this.center.y              }
      `
    });
  }

  getClosest(p: Point): Point {
    const {center, halfDiag} = this;
    const xOff = (p.x - center.x);
    const yOff = (p.y - center.y);
    const a = Math.max(-halfDiag, Math.min(halfDiag, yOff - xOff));
    const b = Math.max(-halfDiag, Math.min(halfDiag, yOff + xOff));
    return point(center.x + (b - a)/2, center.y + (b + a)/2);
  }

  processValue(p: Point): void {
    const {center, halfDiag} = this;
    const xOff = (p.x - center.x);
    const yOff = (p.y - center.y);
    this.process(
      ((yOff - xOff) / halfDiag + 1) / 2,
      ((yOff + xOff) / halfDiag + 1) / 2,
    );
  }
}

function setVisibility(name: "lat/lon" | "octaSphere" | "octahedron" | "icoSphere" | "icosahedron") {
  llSphere.isVisible = llSphereBack.isVisible = name === "lat/lon";
  octaSphMesh.isVisible = name === "octaSphere";
  icoSphMesh.isVisible = name === "icoSphere";
  octaMesh.isVisible = octaBackMesh.isVisible = name === "octahedron";
  icoMesh.isVisible = icoBackMesh.isVisible = name === "icosahedron";
}

const configs: ConfigElem[] = [
  new ConfigDiamond(point(29, 20), 15, (latClosedness, lonClosedness) => {
    setVisibility("lat/lon");
    Object.assign(llMat, {latClosedness, lonClosedness});
    Object.assign(llBackMat, {latClosedness, lonClosedness});
  }),
  new ConfigHLine(22, 36, 35.5, () => {
    setVisibility("lat/lon");
    Object.assign(llMat, {latClosedness: 1, lonClosedness: 1});
    Object.assign(llBackMat, {latClosedness: 1, lonClosedness: 1});
  }),

  new ConfigVLine(22, 36, 55, flat => {
    setVisibility("octaSphere");
    octaSphMat.bulge = 1 - flat;
  }),
  new ConfigVLine(22, 56, 75, open => {
    setVisibility("octahedron");
    adaptOctaPos(1 - open, 0);
  }),
  new ConfigVLine(22, 76, 95, shiftSouthern => {
    setVisibility("octahedron");
    adaptOctaPos(0, shiftSouthern);
  }),

  new ConfigVLine(36, 36, 55, flat => {
    setVisibility("icoSphere");
    icoSphMat.bulge = 1 - flat;
  }),
  new ConfigVLine(36, 56, 75, open => {
    setVisibility("icosahedron");
    adaptIcoPos(1 - open, 0);
  }),
  new ConfigVLine(36, 76, 95, shiftSouthern => {
    setVisibility("icosahedron");
    adaptIcoPos(0, shiftSouthern);
  }),
];

const selectorElement = document.querySelector<SVGSVGElement>("#selector")!;

configs.forEach(config => selectorElement.append(config.createSVG()));

function label(labelText: string, {x, y}: Point) {
  // Or use <foreignObject> and let HTML do the line breaking?
  const text = svgEl("text");
  labelText.split(/\r?\n/).forEach((line, i, array) => {
    const tspan = svgEl("tspan", {x, y: y + 3*(i + 1 - array.length/2) - 0.5});
    tspan.textContent = line;
    text.append(tspan);
  });
  selectorElement.append(text);
}

label("equirectangular map", point(32, 5));
label("stretched\nparallels", point(0, 20));
label("stretched\nmeridians", point(47, 20));

function dot(p: Point) {
  selectorElement.append(svgEl("circle", {cx: p.x, cy: p.y, r: 0.7}))
}

dot(point(22, 35.5)); dot(point(36, 35.5));
dot(point(22, 55.5)); dot(point(36, 55.5));
dot(point(22, 75.5)); dot(point(36, 75.5));
dot(point(22, 95.5)); dot(point(36, 95.5));

label("sphere", point(38, 35.5));
label("octahedron", point(5, 55.5));
label("icosahedron", point(38, 55.5));
label("flat", point(27, 75.5));
label("sprite\nsheet", point(25.5, 95.5));

const handleElement = svgEl("circle", {
  r: 1.5, fill: "#808080", stroke: "#fff", "stroke-width": 0.3
})
selectorElement.append(handleElement);

function selectPoint(p: Point) {
  const {distSq, config, coords} =
    configs.map(config => {
      const coords = config.getClosest(p);
      const distSq = (coords.x - p.x)**2 + (coords.y - p.y)**2;
      return {distSq, config, coords};
    })
    .sort((a, b) => a.distSq - b.distSq)
    [0];

  if (distSq > 49) {
    return;
  }

  handleElement.setAttribute("cx", coords.x.toString());
  handleElement.setAttribute("cy", coords.y.toString());

  config.processValue(coords);
}

function selectRawPoint(ev: MouseEvent) {
  if (ev.buttons) {
    selectPoint(
      point(ev.clientX, ev.clientY)
      .matrixTransform(selectorElement.getScreenCTM()!.inverse())
    );
  }
}

selectorElement.addEventListener("pointerdown", selectRawPoint);
selectorElement.addEventListener("pointermove", selectRawPoint);

selectPoint(point(29, 36));

// -----------------------------------------------------------------------------

const rotInput = document.querySelector<HTMLInputElement>("#rotation-input")!;
rotInput.addEventListener("input", () => {
  offset.set(Number.parseFloat(rotInput.value)/360);
});
rotInput.value = "0";

// -----------------------------------------------------------------------------

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
