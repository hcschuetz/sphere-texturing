import * as B from "@babylonjs/core";
import * as G from "@babylonjs/gui";
import * as M from "mobx";
import * as T from "../../lib/triangulation";
import { easeInOut, map2, radToDeg, slerp, subdivide, zip } from "../../lib/utils";
// import { log } from "./debug";

M.configure({
  enforceActions: "never",
  // computedRequiresReaction: false,
  // reactionRequiresObservable: false,
  // observableRequiresReaction: false,
  // isolateGlobalState: false,
  // useProxies: "never",
});


// Abbreviations:
type V3 = B.Vector3;
const V3 = B.Vector3;
const v3 = (x: number, y: number, z: number) => new V3(x, y, z);

const gray = B.Color3.Gray();
const black = B.Color3.Black();

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

const advancedTexture = G.AdvancedDynamicTexture.CreateFullscreenUI("myUI", true, scene);
advancedTexture.rootContainer.scaleX = window.devicePixelRatio;
advancedTexture.rootContainer.scaleY = window.devicePixelRatio;

const camera = new B.ArcRotateCamera("camera", .15 * TAU, .2 * TAU, 3, v3(0, 0, 0), scene);
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

  const labelPos = new B.TransformNode("labelPos" + i, scene);
  labelPos.position = v3(...dims).scaleInPlace(1.1);
  const label = new G.TextBlock("label" + i, "xyz"[i]);
  label.color = "#" + dims.map(dim => "0f"[dim]).join("");
  label.fontSize = 24;
  advancedTexture.addControl(label);
  label.linkWithMesh(labelPos);
});

// Allow to hide some vertices temporarily inside the origin
const origin = B.MeshBuilder.CreateIcoSphere("origin", {
  radius: 0.02,
}, scene);
origin.material =
  createStandardMaterial("originMat", {diffuseColor: black}, scene);


const arc = (name: string, from: B.Vector3, to: B.Vector3, mat: B.Material): B.Mesh => {
  const a = B.MeshBuilder.CreateTube(name, {
    path: subdivide(0, 1, 40).map(lambda => slerp(from, to, lambda)),
    radius: 0.003,
    tessellation: 6,
  }, scene);
  a.material = mat;
  return a;
}

const arcMaterial = createStandardMaterial("arcMat", {diffuseColor: gray}, scene);

arc("arc1", v3(1, 0, 0), v3(0, 1, 0), arcMaterial);
arc("arc2", v3(0, 1, 0), v3(0, 0, 1), arcMaterial);
arc("arc3", v3(0, 0, 1), v3(1, 0, 0), arcMaterial);



export default class EighthSphereTriangulation extends B.Mesh {
  constructor(
    name: string,
    options: {
      steps?: number,
      triangulationFn: (steps: number) => T.Triangulation,
      smooth: boolean,
    },
    scene?: B.Scene
  ) {
    super(name, scene);

    const {
      steps = 6,
      triangulationFn,
      smooth,
    } = options;

    // ========== VERTEX UTILS ==========

    /**
     * Total number of vertices in the first `i` vertex rows
     * in a sub-triangulated triangle
     */
    const rowVertices = (i: number) =>
      // This would be `i * (steps + 1)` if all rows had `steps + 1` vertices.
      // Subtract `i * (i - 1) / 2` to correct for the decreasing row lengths.
      // Then simplify the formula:
      i * (2 * steps + 3 - i) / 2;
    const verticesPerCorner = rowVertices(steps + 1);
    const nCoords = 8 * verticesPerCorner * 3;
    const positions = new Float32Array(nCoords);
    const normals = new Float32Array(nCoords);

    /** Compute a vertex index from the "logical" vertex position */
    const vtx = (i: number, j: number): number =>
      verticesPerCorner + rowVertices(i) + j;

    function setVertexData(
      idx: number, position: B.Vector3, normal: B.Vector3,
    ): void {
      let idx3 = 3 * idx;
      positions[idx3] = position.x; normals[idx3] = normal.x; idx3++;
      positions[idx3] = position.y; normals[idx3] = normal.y; idx3++;
      positions[idx3] = position.z; normals[idx3] = normal.z;
    }

    // ========== TRIANGLE UTILS ==========

    const nTriangles = 6 * 2 + 12 * steps * 2 + 8 * steps**2;
    const indices = new Uint32Array(nTriangles * 3);

    let vertexIdx = 0;

    function triangle(vtxLocal: (u: number, v: number) => number) {
      indices[vertexIdx * 3 + 0] = vtxLocal(0, 0);
      indices[vertexIdx * 3 + 1] = vtxLocal(0, 1);
      indices[vertexIdx * 3 + 2] = vtxLocal(1, 0);
      vertexIdx++;
    }

    // ========== CREATE VERTICES AND TRIANGLES ==========

    const cornerVertices = triangulationFn(steps);

    // In our triangulations i grows in the y direction, j in the z
    // direction and k in the x direction.
    cornerVertices.forEach((row, i) => {
      /** Is it time to draw edges and faces parallel to the y axis? */
      row.forEach((v, j) => {

        // no loop for k as it is fully determined by i and j:
        const k = steps - i - j;

        setVertexData(vtx(i, j), v, v);

        if (i > 0)          triangle((u, v) => vtx(i-1+u, j+v));
        if (i > 0 && j > 0) triangle((u, v) => vtx(i-u  , j-v));
      });
    });

    // ========== BUILD THE MESH ==========

    const vertexData = new B.VertexData();
    vertexData.positions = positions;
    if (smooth) {
      vertexData.normals = normals;
    }
    vertexData.indices = indices;
    vertexData.applyToMesh(this);
  }
}

const nSteps = M.observable.box(12);
const nStepsElem = document.querySelector("#nSteps") as HTMLInputElement;
Object.assign(nStepsElem, {min: 1, max: 40, value: nSteps.get()});
nStepsElem.addEventListener("change", () => {
  nSteps.set(Number.parseInt(nStepsElem.value));
});

const triangFn = M.observable.box("geodesics");
const triangFnElem = document.querySelector("#triangFn") as HTMLSelectElement;
triangFnElem.innerHTML =
  Object.keys(T.triangulationFns).map(name => `<option>${name}</option>`).join("\n");
triangFnElem.value = triangFn.get();
triangFnElem.addEventListener("change", () => {
  triangFn.set(triangFnElem.value);
});

const adjacentShape = M.observable.box("sphere");
const adjacentShapeElem = document.querySelector("#adjacentShape") as HTMLSelectElement;
adjacentShapeElem.value = adjacentShape.get();
adjacentShapeElem.addEventListener("change", () => {
  adjacentShape.set(adjacentShapeElem.value);
});

const displayMode = M.observable.box("wireframe");
const displayModeElem = document.querySelector("#displayMode") as HTMLSelectElement;
displayModeElem.value = displayMode.get();
displayModeElem.addEventListener("change", () => {
  displayMode.set(displayModeElem.value);
});

const color = M.observable.box("#808080");
const colorElem = document.querySelector("#color") as HTMLInputElement;
colorElem.value = color.get();
colorElem.addEventListener("change", () => {
  color.set(colorElem.value);
});


let estMaterial = createStandardMaterial("mat", {}, scene);
M.autorun(() => {
  estMaterial.wireframe = displayMode.get() === "wireframe";
});
M.autorun(() => {
  estMaterial.diffuseColor = B.Color3.FromHexString(color.get());
});

let est: EighthSphereTriangulation | undefined;
M.autorun(() => {
  est?.dispose();
  est = new EighthSphereTriangulation("est-mesh", {
    triangulationFn: T.triangulationFns[triangFn.get()],
    steps: nSteps.get(),
    smooth: M.computed(() => displayMode.get() !== "polyhedron").get(),
  }, scene);
  est.material = estMaterial;
})


const forwardNeighborOffsets = [[1, -1], [1, 0], [0, 1]];

/**
 * Dihedral "bend" between triangles `p0 p1 p2` and `p0 p2 p3`,
 * that is, the supplementary angle to the dihedral angle.
 */
function dihedralBend(p0: V3, p1: V3, p2: V3, p3: V3) {
  const u01 = p1.subtract(p0);
  const u02 = p2.subtract(p0);
  const u03 = p3.subtract(p0);
  const n012 = u01.cross(u02).normalize();
  const n023 = u02.cross(u03).normalize();
  return Math.acos(n012.dot(n023));
}

type DihedralInfo = {bend: number, i: number, j: number, i_: number, j_: number};

let mostBentEdges: B.Mesh[] = [];
const mostBentEdgeMat = createStandardMaterial("mbeMat", {
  diffuseColor: B.Color3.Yellow(),
}, scene);

M.autorun(() => {
  const n = nSteps.get();
  const fn = triangFn.get();
  const adjCyl = adjacentShape.get() === "cylinder";
  console.log(n, fn, adjCyl ? "cyl" : "sph");
  const t = T.triangulationFns[fn](n);
  let sum0 = 0, sum1 = 0, sum2 = 0;
  let min = 2 /* diameter of unit sphere */, max = 0;
  const dihedrals: DihedralInfo[] = [];

  t.forEach((row, i) => {
    row.forEach((vtx, j) => {
      const k = n - i - j;
      forwardNeighborOffsets.forEach(([di, dj]) => {
        const i_ = i + di, j_ = j + dj, k_ = n - i_ - j_;
        if (i_ >= 0 && j_ >= 0 && k_ >= 0) {
          const v_ = t[i_][j_];
          const u_ = v_.subtract(vtx);
          const d = u_.length();
          sum0++;
          sum1 += d;
          sum2 += d * d;
          min = Math.min(min, d);
          max = Math.max(max, d);

          {
            let va: V3, vb: V3;
            const ia = i + di + dj, ja = j - di     ;
            const ib = i      - dj, jb = j + di + dj;
            if (ib < 0) {
              va = t[1][j];
              vb = adjCyl ? v3(vtx.x, -1, vtx.z) : v3(va.x, -va.y, va.z);
            } else if (ja < 0) {
              vb = t[i][1];
              va = adjCyl ? v3(vtx.x, vtx.y, -1) : v3(vb.x, vb.y, -vb.z);
            } else if (ib + jb > n) {
              vb = t[i][j-1];
              va = adjCyl ? v3(-1, vtx.y, vtx.z) : v3(-vb.x, vb.y, vb.z);
            } else {
              va = t[ia][ja];
              vb = t[ib][jb];
            }
            dihedrals.push({bend: dihedralBend(vtx, va, v_, vb), i, j, i_, j_});
          }
        }
      });
    });
  });

  const mean = sum1/sum0;
  const stdDev = Math.sqrt(sum2/sum0 - (sum1/sum0)**2);
  const stdDevInPercent = stdDev/mean*100;

  dihedrals.sort(({bend: alpha}, {bend: beta}) => beta - alpha);
  console.log(dihedrals.map(({bend, i, j, i_, j_}, rank) =>
    (rank === 0 || bend < dihedrals[rank-1].bend - 1e-7 ? "* " : "  ") +
    `${(bend/TAU*360).toFixed(4)}° @` +
    ` ${i}:${j}:${n-i-j} - ${i_}:${j_}:${n-i_-j_}`
  ));

  const maxBend = dihedrals[0].bend;
  mostBentEdges.forEach(e => e.dispose());
  mostBentEdges =
    dihedrals.filter(({bend}) => maxBend - bend < 1e-7)
    .map(({i, j, i_, j_}) => {
      const e = B.MeshBuilder.CreateTube("mostBentEdge", {
        path: [t[i][j], t[i_][j_]],
        tessellation: 6,
        radius: 0.005,
        cap: B.Mesh.CAP_ALL,
      }, scene);
      e.material = mostBentEdgeMat;
      return e;
    });

  // TODO Also analyze bends between pairs of triangles sharing only one vertex?

  function show(where: string, what: string) {
    document.querySelector(where)!.innerHTML = what;
  }

  show("#nStepsOut", nSteps.get().toFixed());
  show("#nEdges", sum0.toFixed());
  show("#mean", mean.toFixed(5));
  show("#stdDev", stdDev.toFixed(5));
  show("#stdDevInPercent", stdDevInPercent.toFixed(3));
  show("#min", min.toFixed(5));
  show("#max", max.toFixed(5));
  show("#ratio", (max/min).toFixed(5));
  show("#maxBend", (maxBend/TAU*360).toFixed(4) + "°")
});


engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
