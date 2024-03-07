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

const inputs = Object.fromEntries(
  [...document.querySelectorAll("input")].map(el => [el.id, el])
);

// -----------------------------------------------------------------------------
// Textures/Sprites

// See https://en.wikipedia.org/wiki/File:Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg
// for origin (NASA) and copyright (public domain).
const url = "https://upload.wikimedia.org/wikipedia/commons/5/56/Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg";
const baseTexture = Object.assign(new B.Texture(url, scene, true), {
  wrapU: B.Texture.WRAP_ADDRESSMODE,
  wrapV: B.Texture.CLAMP_ADDRESSMODE,
});

const llBackMat = createStandardMaterial("back mat", {
  diffuseColor : new B.Color3(.5, .5, .5),
  specularColor: new B.Color3(.5, .5, .5),
}, scene);

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

const icoSphMat = createStandardMaterial("icosphere mat", {
  specularColor: new B.Color3(.5, .5, .5),
  diffuseTexture: createIcoSprite(nm("myIcoSprite"), 3600, baseTexture, scene),
}, scene);

// -----------------------------------------------------------------------------
// Lat/Lon Sphere

class LLBendPluginMaterial extends B.MaterialPluginBase {
  constructor(material: B.Material) {
    super(material, "LLBend", 200, { LL_BEND: false });
    this._enable(true);
  }

  getClassName() {
    return "LLBendPluginMaterial";
  }

  prepareDefines(defines: B.MaterialDefines) {
    defines.LL_BEND = true;
    defines.NORMAL = true;
  }

  getUniforms() {
    return {
      ubo: [
        { name: "lonClosedness", size: 1, type: "float" },
        { name: "latClosedness", size: 1, type: "float" },
      ],
    };
  }

  lonClosedness = 0.7;
  latClosedness = 0.3;

  bindForSubMesh(uniformBuffer: B.UniformBuffer) {
    uniformBuffer.updateFloat("lonClosedness", this.lonClosedness);
    uniformBuffer.updateFloat("latClosedness", this.latClosedness);
  }

  getCustomCode(shaderType: string) {
    return shaderType !== "vertex" ? null : {
      CUSTOM_VERTEX_UPDATE_POSITION: `
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
      `,
      CUSTOM_VERTEX_UPDATE_NORMAL: `
        normalUpdated = (
          cLat < 1e-3 || lonClosedness < 1e-3 ? vec3(cLat, sLat, 0) :
          normalize(cross(
            vec3(-sLat * cLon, cLat, -sLat * sLon),
            vec3(r_xz * -sLon, 0, r_xz * cLon)
          ))
        ) * vec3(position.z);
      `,
    }
  }
}

const flipOffset = [0, 1, -1];
const flipTriangles = (input: B.IndicesArray) =>
  input.map((_, i) => input[i + flipOffset[i % 3]]);

function createGrid(uSteps: number, vSteps: number) {
  const nVertices = (uSteps + 1) * (vSteps + 1);
  const positions = new Float32Array(nVertices * 3); // not really used, just for its size
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

  return Object.assign(new B.VertexData(), {indices, positions, uvs});
}


let llSphere: B.Mesh;
let llSphereBack: B.Mesh;
{
  const bendMaterial = new LLBendPluginMaterial(llMat);
  const bendBackMaterial = new LLBendPluginMaterial(llBackMat);

  function updateBend() {
    bendMaterial.latClosedness = bendBackMaterial.latClosedness = Number(inputs.latClosedness.value);
    bendMaterial.lonClosedness = bendBackMaterial.lonClosedness = Number(inputs.lonClosedness.value);
  }
  updateBend();

  inputs.latClosedness.addEventListener("input", updateBend);
  inputs.lonClosedness.addEventListener("input", updateBend);

  const grid = createGrid(36, 18);
  llSphere = new B.Mesh("llSphere");
  grid.applyToMesh(llSphere);
  llSphere.material = llMat;

  const gridBack = Object.assign(new B.VertexData(), {
    indices: flipTriangles(grid.indices),
    positions: grid.positions.map((val, i) => i % 3 == 2 ? -1 : val),
    uvs: grid.uvs,
  })
  llSphereBack = new B.Mesh("llSphereBack");
  gridBack.applyToMesh(llSphereBack);
  llSphereBack.material = llBackMat;
}

// -----------------------------------------------------------------------------
// Icosphere

class SphereBulgePluginMaterial extends B.MaterialPluginBase {
  constructor(material: B.Material) {
    super(material, "SphereBulge", 200, { SPHERE_BULGE: false });
    this._enable(true);
  }

  getClassName() {
    return "SphereBulgePluginMaterial";
  }

  prepareDefines(defines: B.MaterialDefines) {
    defines.SPHERE_BULGE = true;
    defines.NORMAL = true;
  }

  getUniforms() {
    return {ubo: [{name: "bulge", size: 1, type: "float"}]};
  }

  bulge = 0.7;

  bindForSubMesh(uniformBuffer: B.UniformBuffer) {
    uniformBuffer.updateFloat("bulge", this.bulge);
  }

  getCustomCode(shaderType: string) {
    return shaderType !== "vertex" ? null : {
      CUSTOM_VERTEX_UPDATE_POSITION: `
        vec3 normalizedPos = normalize(position);
        positionUpdated = mix(position, normalizedPos, bulge);
      `,
      CUSTOM_VERTEX_UPDATE_NORMAL: `
        normalUpdated = mix(normal, normalizedPos, bulge);
      `,
    }
  }
}

const icoSphMesh = new B.Mesh(nm("icosphere"), scene);

const icoSphBulgePlugin = new SphereBulgePluginMaterial(icoSphMat);
icoSphMesh.material = icoSphMat;

icoSphMesh.rotate(B.Axis.Y, TAU/2);

const icoSphVertexData = createIcoVertices(12);

icoSphVertexData.applyToMesh(icoSphMesh, true);

function adaptBulge(): void {
  icoSphBulgePlugin.bulge = Number(inputs.icoBulges.value);
}

adaptBulge();

inputs.icoBulges.addEventListener("input", adaptBulge);

// -----------------------------------------------------------------------------
// Icosahedron

// TODO use a tree of single-face meshes instead of one multi-face mesh?

const icoMesh = new B.Mesh(nm("icosahedron"), scene);
icoMesh.material = icoMat;

const icoBackMesh = new B.Mesh(nm("icosahedron back"), scene);
icoBackMesh.material = backMat;

/*
Net:

    a       b       c       d       e
   / \     / \     / \     / \     / \
  /   \   /   \   /   \   /   \   /   \
 /  0  \ /  1  \ /  2  \ /  3  \ /  4  \
f-------g-------h-------i-------j-------k
|\  5  / \  6  / \  7  / \  8  / \  9  /|
| \   /   \   /   \   /   \   /   \   / |
|14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|
l---m-------n-------o-------p-------q---r
|19/ \ 15  / \ 16  / \ 17  / \ 18  / \19|
| /   \   /   \   /   \   /   \   /   \ |
|/     \ /     \ /     \ /     \ /     \|
s       t       u       v       w       x

UV mapping:

1           -- L---M-------N-------O-------P-------Q---R
1   - dv    -- |19/a\ 15  /b\ 16  /c\ 17  /d\ 18  /e\19|
               | // \\   // \\   // \\   // \\   // \\ |
               |//   \\ //   \\ //   \\ //   \\ //   \\|
1/2 + dv/2  -- S/  0  \T/  1  \U/  2  \V/  3  \W/  4  \X
1/2 - dv/2  -- f-------g-------h-------i-------j-------k
               |\  5  / \  6  / \  7  / \  8  / \  9  /|
               | \   /   \   /   \   /   \   /   \   / |
               |14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|
0           -- l---m-------n-------o-------p-------q---r

^         u    |   |   |   |   |   |   |   |   |   |   |
|v       ---> 0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0
*/

/**
 * Which vertices exist?
 * 
 * Some vertices are duplicated (with lower/uppercase names)
 * so that we can assign different uv coordinates to the copies.
 */
const namedIcoIndices: Record<string, number> = Object.fromEntries(
  `
    a   b   c   d   e
  f   g   h   i   j   k
  l m   n   o   p   q r
  L M   N   O   P   Q R
  S   T   U   V   W   X
  `
  .trim().split(/\s+/).map((c, i) => [c, i])
);

const icoIndices = new Uint16Array((20 + 2) * 3);

`
   fga ghb hic ijd jke
   fmg gnh hoi ipj jqk
 lmf mng noh opi pqj qrk
 LSM MTN NUO OVP PWQ QXR
`
.trim().split(/\s+/).forEach(([c0, c1, c2], f) => {
  icoIndices[3 * f + 0] = namedIcoIndices[c0];
  icoIndices[3 * f + 1] = namedIcoIndices[c1];
  icoIndices[3 * f + 2] = namedIcoIndices[c2];
});

/** uv coordinates for vertices */
const icoUVs = Float32Array.of(
  ...[   0.1,  0.3,  0.5,  0.7,  0.9   ].flatMap(u => [u,  1-dv   ]), // a-e
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1-dv)/2]), // f-k
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  0      ]), // l-r
  ...[0, 0.1,  0.3,  0.5,  0.7,  0.9, 1].flatMap(u => [u,  1      ]), // L-R
  ...[0.0,  0.2,  0.4,  0.6,  0.8,  1.0].flatMap(u => [u, (1+dv)/2]), // S-X
);

const icoPos = new Float32Array(31*3);

/**
 * vertex positions
 * 
 * Not aligned with `icoPos`!
 * 
 * `lAux` and `rAux` are not part of the net/mesh, but are used to compute
 * `l` and `r`.
 */
const icoPosAux: Record<string, V3> = Object.fromEntries(
  "a b c d e f g h i j k lAux l m n o p q rAux r s t u v w x"
  .split(/\s+/)
  .map(name => [name, new V3()])
);

/** Map between `icoPos` and `icoPosAux` */
const icoPosAuxMap = Object.keys(namedIcoIndices).map(name => name.toLowerCase());

/**
 * Vertex computation order, starting from given vertices `h`, `o`, and `i`.
 *
 * `n h o i` means that `isoPosAux.n` (the position of vertex `n`) is computed
 * by rotating vertex `i` around the edge from vertex `h` to vertex `o`.
 */
const vertexSteps =
`
  n h o i
  g h n o
  m g n h
  f g m n
  lAux f m g
  p o i h
  j p i o
  q p j i
  k q j p
  rAux q k j
  a g f m
  b h g n
  c i h o
  d j i p
  e k j q
  s lAux m f
  t m n g
  u n o h
  v o p i
  w p q j
  x q rAux k
`
.trim()
.split(/\r?\n/)
.map(line => line.trim().split(/\s+/).map(name => icoPosAux[name]));


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

const mid_hi = new V3();
const oHeight = new V3();
const oHeightFlat = new V3();
const slerp_o = new V3();

const mid_ab = new V3();
const height_c = new V3();
const a_minus_c = new V3();
const b_minus_c = new V3();
const normal_abc = new V3();
const rotated = new V3();

function adaptIcoPos(bend: number, shiftSouth: number) {
  const ix = radius * Math.cos(TAU/10);
  const iz = radius * Math.sin(TAU/10);
  icoPosAux.h.set(ix,  height, -iz);
  icoPosAux.i.set(ix,  height,  iz);

  mid_hi.set(ix, height, 0);
  oHeight.set(radius, -height, 0).subtractInPlace(mid_hi);
  oHeightFlat.set(0, -oHeight.length(), 0);
  mid_hi.addToRef(V3.SlerpToRef(oHeightFlat, oHeight, bend, slerp_o), icoPosAux.o);

  const bendAnglePart = bend * anglePart;
  for (const [out, a, b, c] of vertexSteps) {
    V3.CenterToRef(a, b, mid_ab);
    mid_ab.subtractToRef(c, height_c);
    V3.CrossToRef(
      a.subtractToRef(c, a_minus_c),
      b.subtractToRef(c, b_minus_c),
      normal_abc
    ).normalize().scaleInPlace(height_c.length());
    mid_ab.addToRef(
      V3.SlerpToRef(height_c, normal_abc, bendAnglePart, rotated),
      out,
    );
  }
  V3.CenterToRef(icoPosAux.m, icoPosAux.lAux, icoPosAux.l);
  V3.CenterToRef(icoPosAux.q, icoPosAux.rAux, icoPosAux.r);

  const shiftX = shiftSouth * (1 - shiftSouth);
  const shiftY = (icoPosAux.c.y - icoPosAux.o.y + .02) * shiftSouth;

  // Now copy the computed positions from icoPosAux to icoPos
  // (and apply the shift for the southern triangles).
  icoPosAuxMap.forEach((name, i) => {
    const {x, y, z} = icoPosAux[name];
    icoPos[3 * i + 0] = x + (i > 17 ? shiftX : 0);
    icoPos[3 * i + 1] = y + (i > 17 ? shiftY : 0);
    icoPos[3 * i + 2] = z;
  });
}

adaptIcoPos(Number(inputs.icoClosedness.value), Number(inputs.icoShiftSouth.value));

const icoVertexData = Object.assign(new B.VertexData(), {
  indices: icoIndices,
  positions: icoPos,
  uvs: icoUVs,
});

const icoBackVertexData = Object.assign(new B.VertexData(), {
  indices: flipTriangles(icoIndices),
  positions: icoPos,
  uvs: icoUVs,
});

icoVertexData.applyToMesh(icoMesh, true);
icoBackVertexData.applyToMesh(icoBackMesh, true);

function adaptIco() {
  adaptIcoPos(Number(inputs.icoClosedness.value), Number(inputs.icoShiftSouth.value));
  icoMesh.updateVerticesData(B.VertexBuffer.PositionKind, icoPos);
  icoBackMesh.updateVerticesData(B.VertexBuffer.PositionKind, icoPos);
}

inputs.icoClosedness.addEventListener("input", adaptIco);
inputs.icoShiftSouth.addEventListener("input", adaptIco);

// -----------------------------------------------------------------------------

function setVisibility() {
  llSphere.isVisible = llSphereBack.isVisible = inputs.latLon.checked;
  icoSphMesh.isVisible = inputs.icoSph.checked;
  icoMesh.isVisible = icoBackMesh.isVisible = inputs.icosahedron.checked;
}

setVisibility();

inputs.latLon.addEventListener("input", setVisibility);
inputs.icoSph.addEventListener("input", setVisibility);
inputs.icosahedron.addEventListener("input", setVisibility);

// -----------------------------------------------------------------------------

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());