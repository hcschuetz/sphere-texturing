import * as B from "@babylonjs/core";
import { createIcoSprite, createIcoVertices, dv } from "./MyIcoSphere";

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

const latLon2Element = document.querySelector<HTMLInputElement>("#latLon2")!;
latLon2Element.addEventListener("change", setVisibility);

const latLonElement = document.querySelector<HTMLInputElement>("#latLon")!;
latLonElement.addEventListener("change", setVisibility);

const latClosednessElem = document.querySelector<HTMLInputElement>("#latClosedness")!;
latClosednessElem.addEventListener("input", repositionLL);

const lonClosednessElem = document.querySelector<HTMLInputElement>("#lonClosedness")!;
lonClosednessElem.addEventListener("input", repositionLL);

const icoSphElement = document.querySelector<HTMLInputElement>("#icosph")!;
icoSphElement.addEventListener("change", setVisibility);

const icoBulgesElement = document.querySelector<HTMLInputElement>("#icoBulges")!;
icoBulgesElement?.addEventListener("input", adaptBulge);

const icosahedronElement = document.querySelector<HTMLInputElement>("#icosahedron")!;
icosahedronElement.addEventListener("change", setVisibility);

const icoClosednessElem = document.querySelector<HTMLInputElement>("#icoClosedness")!;
icoClosednessElem.addEventListener("input", adaptIco);

const icoShiftSouthElem = document.querySelector<HTMLInputElement>("#icoShiftSouth")!;
icoShiftSouthElem.addEventListener("input", adaptIco);

// -----------------------------------------------------------------------------
// Textures/Sprites

// See https://en.wikipedia.org/wiki/File:Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg
// for origin (NASA) and copyright (public domain).
const url = "https://upload.wikimedia.org/wikipedia/commons/5/56/Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg";
const baseTexture = Object.assign(new B.Texture(url, scene, true), {
  wrapU: B.Texture.WRAP_ADDRESSMODE,
  wrapV: B.Texture.CLAMP_ADDRESSMODE,
});

const backMat = createStandardMaterial("back mat", {
  diffuseColor : new B.Color3(.5, .5, .5),
  specularColor: new B.Color3(.5, .5, .5),
}, scene);

const llMat = createStandardMaterial("latLon sphere mat", {
  specularColor: new B.Color3(.5, .5, .5),
  diffuseTexture: baseTexture,
}, scene);

const icoMat = createStandardMaterial("icosphere mat", {
  specularColor: new B.Color3(.5, .5, .5),
  diffuseTexture: createIcoSprite(nm("myIcoSprite"), 3600, baseTexture, scene),
}, scene);

// -----------------------------------------------------------------------------
// Lat/Lon Sphere

const llMesh = new B.Mesh(nm("latLon sphere"), scene);
llMesh.material = llMat;

const llBackMesh = new B.Mesh(nm("latLon sphere back"), scene);
llBackMesh.material = backMat;

const stepsPerRightAngle = 90;

const nLongitudes = 4 * stepsPerRightAngle + 1;
const nLatitudes = 2 * stepsPerRightAngle + 1;
const nVertices = nLatitudes * nLongitudes;

const indices =
  new Float32Array((4 * stepsPerRightAngle) * (2 * stepsPerRightAngle) * 2 * 3);
const backIndices =
  new Float32Array((4 * stepsPerRightAngle) * (2 * stepsPerRightAngle) * 2 * 3);
{ 
  let vtxIdx = 0;
  let indicesIdx = 0;
  for (let i = -stepsPerRightAngle; i < stepsPerRightAngle; i++) {
    for (let j = -2*stepsPerRightAngle; j < 2*stepsPerRightAngle; j++) {
      const A = vtxIdx++;
      const B = A + 1;
      const D = A + (4*stepsPerRightAngle+1);
      const C = D + 1;

      indices[indicesIdx] = A; backIndices[indicesIdx++] = A;
      indices[indicesIdx] = B; backIndices[indicesIdx++] = D;
      indices[indicesIdx] = D; backIndices[indicesIdx++] = B;

      indices[indicesIdx] = B; backIndices[indicesIdx++] = B;
      indices[indicesIdx] = C; backIndices[indicesIdx++] = D;
      indices[indicesIdx] = D; backIndices[indicesIdx++] = C;
    }
    vtxIdx++;
  }
}

const llUVs = new Float32Array(nVertices * 2);
{
  let uvIdx = 0;
  for (let i = -stepsPerRightAngle; i <= stepsPerRightAngle; i++) {
    for (let j = -2*stepsPerRightAngle; j <= 2*stepsPerRightAngle; j++) {
      llUVs[uvIdx++] = (j + 2 * stepsPerRightAngle) / (4 * stepsPerRightAngle);
      llUVs[uvIdx++] = (i + stepsPerRightAngle) / (2 * stepsPerRightAngle);
    }
  }
}

const step = TAU / (4 * stepsPerRightAngle);

const llPos = new Float32Array(nVertices * 3);

const flatLimit = 1e-3;

// TODO implement as vertex shader
function setLL(latClosedness: number, lonClosedness: number) {
  const latFlat = latClosedness < flatLimit;
  const latStep = step * latClosedness;
  const rLat = 1 / latClosedness;

  const lonFlat = lonClosedness < flatLimit;
  const lonStep = step * lonClosedness;
  const rLon = 1 / lonClosedness;

  let posIdx = 0;
  for (let i = -stepsPerRightAngle; i <= stepsPerRightAngle; i++) {
    const lat = i * latStep;
    const y    = latFlat ? i * step : rLat *  Math.sin(lat);
    const rXZ1 = latFlat ? 0        : rLat * (Math.cos(lat) - 1);
    const rXZ2 = rLon + rXZ1;
    for (let j = -2*stepsPerRightAngle; j <= 2*stepsPerRightAngle; j++) {
      const lon = j * lonStep;
      llPos[posIdx++] = 1 + (lonFlat ? rXZ1     : rXZ2 * Math.cos(lon) - rLon);
      llPos[posIdx++] = y;
      llPos[posIdx++] =      lonFlat ? j * step : rXZ2 * Math.sin(lon);
    }
  }
}

setLL(Number(latClosednessElem.value), Number(lonClosednessElem.value));

const llVertexData = Object.assign(new B.VertexData(), {
  indices,
  positions: llPos,
  uvs: llUVs,
});

llVertexData.applyToMesh(llMesh, true);
llMesh.createNormals(true);

const llBackVertexData = Object.assign(new B.VertexData(), {
  indices: backIndices,
  positions: llPos,
});

llBackVertexData.applyToMesh(llBackMesh, true);
llBackMesh.createNormals(true);

function repositionLL() {
  setLL(Number(latClosednessElem.value), Number(lonClosednessElem.value));
  llMesh.updateVerticesData(B.VertexBuffer.PositionKind, llPos);
  llMesh.createNormals(true);
  llBackMesh.updateVerticesData(B.VertexBuffer.PositionKind, llPos);
  llBackMesh.createNormals(true);
}

// ------------- --------------  --------- ----------  ------------------  ----

const latLonMaterial = new B.ShaderMaterial(nm("lat/lon mat"), scene, {
  vertexSource: `
    uniform float latClosedness;
    uniform float lonClosedness;

    uniform mat4 worldViewProjection;

    // attribute vec3 position;
    attribute vec2 uv;

    varying vec2 vUV;

    void main() {
      float rLat = 1. / latClosedness;
      float lat = (uv.y - 0.5) * ${TAU/2};
      float latEffective = lat * latClosedness;
      vec2 meridian =
      latClosedness < 1e-3
        //     radial (xz)                       axial (y)
        ? vec2(0                               , lat                     )
        : vec2((cos(latEffective) - 1.0) * rLat, sin(latEffective) * rLat);

      float rLon = 1. / lonClosedness;
      float lon = (uv.x - 0.5) * ${TAU};
      float lonEffective = lon * lonClosedness;
      float r_xz = rLon + meridian.x;
      vec2 parallel =
        lonClosedness < 1e-3
        //     x                                 z
        ? vec2(meridian.x                     , lon                     )
        : vec2(r_xz * cos(lonEffective) - rLon, r_xz * sin(lonEffective));

      gl_Position = worldViewProjection * vec4(parallel.x + 1.0, meridian.y, parallel.y, 1.0);
      vUV = uv;
    }
  `,
  fragmentSource: `
    uniform sampler2D tx;

    varying vec2 vUV;

    void main() {
      gl_FragColor = texture(tx, vUV);
    }
  `
}, {
  attributes: ["uv"],
  uniforms: [
    "latClosedness", "lonClosedness",
    "worldViewProjection",
    "tx",
  ],
});

const uvs = new Float32Array(nVertices * 2);
const positions = new Float32Array(nVertices * 3); // just needed for its size
{
  const nUSteps = 4 * stepsPerRightAngle;
  const nVSteps = 2 * stepsPerRightAngle;
  const uStep = 1 / nUSteps;
  const vStep = 1 / nVSteps;
  let uvIdx = 0;
  for (let i = 0; i <= nVSteps; i++) {
    for (let j = 0; j <= nUSteps; j++) {
      uvs[uvIdx++] = j * uStep;
      uvs[uvIdx++] = i * vStep;
    }
  }
}

latLonMaterial.setTexture("tx", baseTexture);

latClosednessElem.addEventListener("input", setLL2Params);
lonClosednessElem.addEventListener("input", setLL2Params);

const ll2Mesh = new B.Mesh(nm("lat/lon 2"), scene);
Object.assign(new B.VertexData(), {
  indices,
  positions,
  normals: positions,
  uvs,
}).applyToMesh(ll2Mesh, true);
ll2Mesh.material = latLonMaterial;

const ll2BackMesh = new B.Mesh(nm("lat/lon 2 back"), scene);
Object.assign(new B.VertexData(), {
  indices: backIndices,
  positions,
  normals: positions,
  uvs,
}).applyToMesh(ll2BackMesh, true);
ll2BackMesh.material = latLonMaterial;

function setLL2Params() {
  latLonMaterial.setFloat("latClosedness", Number(latClosednessElem.value));
  latLonMaterial.setFloat("lonClosedness", Number(lonClosednessElem.value));
  ll2Mesh.createNormals(true);
}

setLL2Params();


// -----------------------------------------------------------------------------
// Icosphere

const icoSphMesh = new B.Mesh(nm("icosphere"), scene);
icoSphMesh.material = icoMat;

icoSphMesh.rotate(B.Axis.Y, TAU/2);

const icoSphVertexData = createIcoVertices(12);

icoSphVertexData.applyToMesh(icoSphMesh, true);

function adaptBulge(): void {
  const bulge = Number(icoBulgesElement.value);

  // TODO
  // - computing full vtxData is not needed, only positions
  // - should not create new data structures but write into existing
  // - might/should go to WebGL

  const {positions} = createIcoVertices(12, bulge);
  icoSphMesh.updateVerticesData(B.VertexBuffer.PositionKind, positions);
  if (bulge === 1) {
    icoSphMesh.updateVerticesData(B.VertexBuffer.NormalKind, positions);
  } else {
    icoSphMesh.createNormals(true);
  }
}

adaptBulge();

// -----------------------------------------------------------------------------
// Icosahedron

// TODO use a tree of single-face meshes instead of one multi-face mesh?

const icoMesh = new B.Mesh(nm("icosahedron"), scene);
icoMesh.material = icoMat;

const icoBackMesh = new B.Mesh(nm("icosahedron back"), scene);
icoBackMesh.material = backMat;

const namedIndices: Record<string, number> = {};
"abcdefghijklmnopqrLMNOPQRSTUVWX".split("").forEach((c, i) => namedIndices[c] = i);

const icoIndices = new Float32Array((20 + 2) * 3);
const icoBackIndices = new Float32Array((20 + 2) * 3);

`
   fga ghb hic ijd jke
   fmg gnh hoi ipj jqk
 lmf mng noh opi pqj qrk
 LSM MTN NUO OVP PWQ QXR`
.trim().split(/\s+/).forEach(([c0, c1, c2], f) => {
  icoBackIndices[3 * f + 0] = icoIndices[3 * f + 0] = namedIndices[c0];
  icoBackIndices[3 * f + 2] = icoIndices[3 * f + 1] = namedIndices[c1];
  icoBackIndices[3 * f + 1] = icoIndices[3 * f + 2] = namedIndices[c2];
});

const icoUVs = Float32Array.of(
  ...[   0.1,  0.3,  0.5,  0.7,  0.9   ].flatMap(u => [u,  1-dv   ]), // a-e
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1-dv)/2]), // f-k
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  0      ]), // l-r
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  1      ]), // L-R
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1+dv)/2]), // S-X
);

/** How far above/below the equator are the non-pole vertices? */
const height = Math.sqrt(1 / 5);
/** How far away from the main axis are the non-pole vertices? */
const radius = 2 * height;
const dihedralAngle = Math.acos(-Math.sqrt(5)/3); // ~ 138.2°
/**
 * What fraction of a right angle must be subtracted from a straight angle
 * to get the dihedral angle? 
 */
const anglePart = 2 - dihedralAngle / (TAU / 4);

const icoPos = new Float32Array(31*3);

function fillIcoPos(bend: number, shiftSouth: number) {
  function nextVertex(a: V3, b: V3, c: V3) {
    const mid_ab = a.add(b).scaleInPlace(.5);
    const height = mid_ab.subtract(c);
    const normal = a.subtract(c).cross(b.subtract(c)).normalize().scale(height.length());
    const rotated = V3.SlerpToRef(height, normal, bend * anglePart, new V3());
    return mid_ab.add(rotated);
  }

  const mid_hi = v3(radius * Math.cos(TAU/10), height, 0);
  const oHeight = v3(radius, -height, 0).subtract(mid_hi);
  const oHeightFlat = v3(0, -oHeight.length(), 0);

  const h_ = v3(radius * Math.cos(-TAU/10),  height, radius * Math.sin(-TAU/10));
  const o_ = mid_hi.add(V3.SlerpToRef(oHeightFlat, oHeight, bend, new V3()));
  const i_ = v3(radius * Math.cos( TAU/10),  height, radius * Math.sin( TAU/10));

  const n_ = nextVertex(h_, o_, i_);
  const g_ = nextVertex(h_, n_, o_);
  const m_ = nextVertex(g_, n_, h_);
  const f_ = nextVertex(g_, m_, n_);
  const lAux = nextVertex(f_, m_, g_);
  const l_ = m_.add(lAux).scale(0.5);

  const p_ = nextVertex(o_, i_, h_);
  const j_ = nextVertex(p_, i_, o_);
  const q_ = nextVertex(p_, j_, i_);
  const k_ = nextVertex(q_, j_, p_);
  const rAux = nextVertex(q_, k_, j_);
  const r_ = q_.add(rAux).scale(0.5);

  const a_ = nextVertex(g_, f_, m_);
  const b_ = nextVertex(h_, g_, n_);
  const c_ = nextVertex(i_, h_, o_);
  const d_ = nextVertex(j_, i_, p_);
  const e_ = nextVertex(k_, j_, q_);

  const s_ = nextVertex(lAux, m_, f_);
  const t_ = nextVertex(m_, n_, g_);
  const u_ = nextVertex(n_, o_, h_);
  const v_ = nextVertex(o_, p_, i_);
  const w_ = nextVertex(p_, q_, j_);
  const x_ = nextVertex(q_, rAux, k_);

  const shiftX = shiftSouth * (1 - shiftSouth);
  const shiftY = (c_.y - o_.y + .02) * shiftSouth;

  [
      a_, b_, c_, d_, e_,
   f_,  g_, h_, i_, j_,  k_,
   l_,m_, n_, o_, p_, q_,r_,
   l_,m_, n_, o_, p_, q_,r_,
   s_,  t_, u_, v_, w_,  x_,
  ].forEach(({x, y, z}, i) => {
    icoPos[3 * i + 0] = x + (i > 17 ? shiftX : 0);
    icoPos[3 * i + 1] = y + (i > 17 ? shiftY : 0);
    icoPos[3 * i + 2] = z;
  });
}

fillIcoPos(Number(icoClosednessElem.value), Number(icoShiftSouthElem.value));

const icoVertexData = Object.assign(new B.VertexData(), {
  indices: icoIndices,
  positions: icoPos,
  uvs: icoUVs,
});

const icoBackVertexData = Object.assign(new B.VertexData(), {
  indices: icoBackIndices,
  positions: icoPos,
  uvs: icoUVs,
});

icoVertexData.applyToMesh(icoMesh, true);
icoBackVertexData.applyToMesh(icoBackMesh, true);

function adaptIco() {
  fillIcoPos(Number(icoClosednessElem.value), Number(icoShiftSouthElem.value));
  icoMesh.updateVerticesData(B.VertexBuffer.PositionKind, icoPos);
  icoBackMesh.updateVerticesData(B.VertexBuffer.PositionKind, icoPos);
}

// -----------------------------------------------------------------------------

function setVisibility() {
  ll2Mesh.isVisible = ll2BackMesh.isVisible = latLon2Element.checked;
  llMesh.isVisible = llBackMesh.isVisible = latLonElement.checked;
  icoSphMesh.isVisible = icoSphElement.checked;
  icoMesh.isVisible = icoBackMesh.isVisible = icosahedronElement.checked;
}

setVisibility();

// -----------------------------------------------------------------------------

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
