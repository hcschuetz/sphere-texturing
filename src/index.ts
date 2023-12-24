import * as B from "babylonjs";
import * as M from "mobx";
import * as T from "./triangulation";
import { MotionController, easeInOut, slerp, subdivide, zip } from "./utils";
// import { log } from "./debug";

const params = new URL(document.URL).searchParams;

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

function createTriangulation(
  props: {
    n: number,
    verticesBox: M.IComputedValue<T.Triangulation>,
    parent?: B.Mesh,
    vertexMaterial?: B.Material,
    edgeColor?: B.Color4,
    faceMaterial?: B.Material,
  },
  scene: B.Scene,  
) {
  const {
    n,
    verticesBox,
    parent,
    vertexMaterial,
    edgeColor,
    faceMaterial,
  } = props;

  function linkToParent(mesh: B.Mesh): void {
    if (parent) {
      mesh.parent = parent;
    }
  }

  const vertices: B.Mesh[] | undefined =
    !vertexMaterial ? [] :
    subdivide(0, 1, n).flatMap((i, ii) =>
      subdivide(0, 1, (n - ii)).map((j, jj) => {
        const vertex = B.MeshBuilder.CreateIcoSphere(`vertex(${ii},${jj})`, {
          radius: 0.015,
        }, scene);
        linkToParent(vertex);
        vertex.position = V3.ZeroReadOnly;
        vertex.material = vertexMaterial;
        return vertex;
      })
    );

  M.reaction(() => verticesBox.get(), tr => {
    if (!vertices) return;
    let i = 0;
    for (const row of tr) {
      for (const point of row) {
        vertices[i].position = point;
        i++;
      }
    }
  }, {fireImmediately: true});
}

const scene = new B.Scene(engine);
scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);

const camera = new B.ArcRotateCamera("camera", TAU/12, TAU/5, 3, v3(0, 0, 0), scene);
camera.lowerRadiusLimit = 2.1;
camera.upperRadiusLimit = 10;
camera.attachControl(undefined, true);
camera.position.addInPlace(v3(-.5,0,-.5));

const light = new B.HemisphericLight('light1', v3(0, 1, 0), scene);
light.intensity = 0.8;

const light2 = new B.DirectionalLight("light2", v3(10, -2, -10), scene);
light2.intensity = 0.8;

const light3 = new B.DirectionalLight("light3", v3(3, 10, 10), scene);
light3.intensity = 0.5;

([[1,0,0], [0,1,0], [0,0,1]] as [number, number, number][])
.forEach((dims, i) => {
  const color = new B.Color4(...dims);
  // While other lines look better as tubes, the axes look better as lines.
  B.MeshBuilder.CreateLines("axis-" + i, {
    points: [v3(...dims).scaleInPlace(-1.5), v3(...dims).scaleInPlace(1.5)],
    colors: [color, color],
  }, scene);
});

// Allow to hide some vertices temporarily inside the origin
B.MeshBuilder.CreateIcoSphere("origin", {
  radius: 0.02,
}, scene).material = createStandardMaterial("originMat", {
  diffuseColor: B.Color3.Black(),
}, scene);


const octahedron = B.MeshBuilder.CreatePolyhedron("octahedron", {
  type: 1,
  size: Math.sqrt(.5) * 0.999,
}, scene);
octahedron.material = createStandardMaterial("octaMat", {
  diffuseColor: new B.Color3(.8, .8, .8),
  alpha: 0.2,
  sideOrientation: B.VertexData.DOUBLESIDE,
}, scene);

const sphere = B.MeshBuilder.CreateSphere("sphere", {
  diameter: 2,
});
sphere.material = createStandardMaterial("sphMat", {
  diffuseColor: new B.Color3(1,1,1),
  alpha: 0.1,
  // This seems to have no effect:
  sideOrientation: B.VertexData.DOUBLESIDE,
}, scene);

const arc1 = B.MeshBuilder.CreateTube("arc1", {
  path: subdivide(0, 1, 40).map(lambda =>
      slerp(v3(1, 0, 0), v3(0, 1, 0), lambda)
    ),
  radius: 0.003,
  tessellation: 6,
}, scene);
const arc2 = arc1.clone("arc2");
arc2.rotate(v3(1, 0, 0), TAU/4);
const arc3 = arc1.clone("arc3");
arc3.rotate(v3(0, 1, 0), -TAU/4);
arc1.material = arc2.material = arc3.material =
  createStandardMaterial("arcMat", {
    diffuseColor: B.Color3.Gray(),
    emissiveColor: B.Color3.Gray(),
    alpha: 0.4,
    sideOrientation: B.VertexData.DOUBLESIDE,
  }, scene);

const n = Number.parseInt(params.get("n") ?? "6");

const red = B.Color3.Red();
const green = B.Color3.Green();
const blue = B.Color3.Blue();

const cyan = B.Color3.Teal();
const magenta = B.Color3.Magenta();
const yellow = B.Color3.Yellow();

class TriangulationWithAuxLines extends B.Mesh {
  constructor (
    public lines: V3[][],
    public vertices: T.Triangulation,
    public color: B.Color3,
    public alpha: number = 1,
  ) {
    super("WithAuxLines", scene);
    M.makeObservable(this, {
      lines: M.observable,
      vertices: M.observable.ref,
      alpha: M.observable,
    });

    const lineMaterial = createStandardMaterial("lineMat", {
      diffuseColor: color,
      emissiveColor: color,
    }, scene);
    M.autorun(() => lineMaterial.alpha = this.alpha);

    lines.forEach((path, i) => {
      if (path.length <= 1) return;
      const tube = B.MeshBuilder.CreateTube("tubeLine", {
      updatable: true,
        path,
        radius: 0.003,
        tessellation: 6,
      }, scene);
      tube.material = lineMaterial
      tube.parent = this;
      M.autorun(() => {
        B.MeshBuilder.CreateTube("tubeLine", {instance: tube, path: this.lines[i]});
      });
    });

    const vertexMaterial = createStandardMaterial("vtxMat", {
      diffuseColor: color,
    }, scene);
    M.autorun(() => vertexMaterial.alpha = this.alpha);

    // TODO get rid of this conversion between two kinds of observables:
    const verticesBox = M.observable.box(this.vertices);
    M.autorun(() => verticesBox.set(this.vertices));

    createTriangulation({
      n,
      verticesBox,
      parent: this,
      vertexMaterial,
    }, scene);
  }
}

class Rays {
  constructor(
    public ends: V3[],
    public alpha: number,
  ) {
    M.makeObservable(this, {
      ends: M.observable,
      alpha: M.observable,
    });

    const color = new B.Color3(.6,.6,.6);
    const material = createStandardMaterial("rayMat", {
      diffuseColor: color,
      emissiveColor: color,
    }, scene);
    M.autorun(() => material.alpha = this.alpha);

    ends.forEach((end, i) => {
      const ray = B.CreateTube("ray", {
        updatable: true,
        path: [V3.ZeroReadOnly, end],
        radius: 0.003,
        tessellation: 6,
      });
      ray.material = material;
      M.autorun(() => B.CreateTube("rays", {
        instance: ray,
        path: [V3.ZeroReadOnly, this.ends[i]],
      }));
    })
  }
}

class BarycentricCoordinates {
  constructor(
    public coords: V3,
    public alpha: number,
  ) {
    M.makeObservable(this, {
      coords: M.observable,
      alpha: M.observable,
    });

    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      color: "white",
      lineHeight: "1.6",
      fontFamily: "Arial, Helvetica, sans-serif",
    });
    document.body.append(div);
    M.autorun(() => {
      div.style.opacity = this.alpha.toString();
      div.style.display = this.alpha ? "" : "none";
    });
    M.autorun(() => {
      const {coords} = this;
      const point = coords.scale(1 / (coords.x + coords.y + coords.z));
      div.innerHTML = `
        <span style="text-decoration: underline">Barycentric Coordinates</span>
        <br>
        not normalized (sum ${n}):
        <br>
        <span style="
          border-radius: 4px;
          padding: 6px 8px;
          background-color: #ccc;
          color: #000;
        ">
          <b style="color: red"  >${coords.x.toFixed(2)}</b> :
          <b style="color: green">${coords.y.toFixed(2)}</b> :
          <b style="color: blue" >${coords.z.toFixed(2)}</b></span>
        <div style="height: 0.3ex;"></div>
        normalized (sum 1):
        <br>
        <span style="
          border-radius: 4px;
          padding: 6px;
          background-color: #ccc;
          color: #000;
        ">
          <b style="color: red"  >${point.x.toFixed(2)}</b> :
          <b style="color: green">${point.y.toFixed(2)}</b> :
          <b style="color: blue" >${point.z.toFixed(2)}</b></span>
        `;
    });

    [red, green, blue].forEach((color, idx) => {
      const material = createStandardMaterial("baryMat", {
        diffuseColor: color,
        emissiveColor: color,
      }, scene);
      M.autorun(() => material.alpha = this.alpha);
      const ruler = B.CreateTube("ruler", {
        updatable: true,
        path: [V3.ZeroReadOnly, V3.ZeroReadOnly],
        radius: 0.015,
        tessellation: 6,
      }, scene);
      ruler.material = material;
      M.autorun(() => {
        const {coords} = this;
        // barycentric (not Euclidian!) normalization:
        const point = coords.scale(1 / (coords.x + coords.y + coords.z));
        let base: V3 =
          idx === 0 ? v3(0, point.y + point.x / 2, point.z + point.x / 2) :
          idx === 1 ? v3(point.x + point.y / 2, 0, point.z + point.y / 2) :
          idx === 2 ? v3(point.x + point.z / 2, point.y + point.z / 2, 0) :
          (() => { throw new Error("unexpected idx"); })();
        B.CreateTube("ruler", {
          instance: ruler,
          path: [point, base],
        }, scene);
      });
    })
  }
}

class SinesExplanation {
  step = 0;
  alpha = 0;

  constructor() {
    M.makeObservable(this, {
      step: M.observable,
      alpha: M.observable,
    });

    const div = document.createElement("div");
    Object.assign(div.style, {
      position: "fixed",
      bottom: "20px",
      left: "20px",
      padding: "6px",
      lineHeight: "2",
      fontFamily: "Arial, Helvetica, sans-serif",
      fontWeight: "200",
      color: "white",
    });
    document.body.append(div);
    M.autorun(() => {
      div.style.opacity = this.alpha.toString();
      div.style.display = this.alpha ? "" : "none";
    });
    M.autorun(() => {
      // This can be seen as "poor man's React":
      div.innerHTML =
        this.step <= 6 ? `
        X
        = cos( <span style="color: yellow">y</span> · 90° )
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 0))};">
        = sin( 90° - <span style="color: yellow">y</span> · 90° )
        </span>
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 1))};">
        = sin( ( 1 - <span style="color: yellow">y</span> ) · 90° )
        </span>
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 2))};">
        = sin( <span style="color: yellow">x</span> · 90° )
        </span>
        <br>
        Y = sin( <span style="color: yellow">y</span> · 90° )
        <br>
        Z = 0
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 3))};">
        = sin( 0° )
        </span>
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 4))};">
        = sin( 0 · 90° )
        </span>
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 5))};">
        = sin( <span style="color: yellow">z</span> · 90° )
        </span>
      ` : this.step <= 7 ? `
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 6))};">
        X = sin( <span style="color: yellow">x</span> · 90° )
        <br>
        Y = sin( <span style="color: yellow">y</span> · 90° )
        <br>
        Z = sin( <span style="color: yellow">z</span> · 90° )
        </span>
      ` : `
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 8))};">normalize</span>(
        sin( <span style="color: yellow">x</span> · 90° ),
        sin( <span style="color: yellow">y</span> · 90° ),
        sin( <span style="color: yellow">z</span> · 90° ) )
      `;
    });
  }
}

const refinement = 10;
const flatLines = T.flat(n, refinement);
const geodesics = T.geodesics(n, refinement);
const parallels = T.parallels(n, refinement);
const evenGeodesics = T.evenGeodesics(n, refinement);
const collapsedLines = T.collapsed(n, refinement);

const flat = T.flat(n);
const geodesic = T.geodesics(n);
const onParallels = T.parallels(n);
const sines = T.sines(n);
const sineBased = T.sineBased(n);
const collapsed = T.collapsed(n);
const onEvenGeodesics = T.evenGeodesics(n);
const evenOnEdges = sines.map((row, i) => row.map((vertex, j) =>
  (i === 0 || j === 0 || i + j === n) ? vertex : V3.ZeroReadOnly
));
const flatOnEdges = flat.map((row, i) => row.map((vertex, j) =>
  (i === 0 || j === 0 || i + j === n) ? vertex : V3.ZeroReadOnly
));
const evenOnXYEdge = sines.map((row, i) => row.map((vertex, j) =>
  j === 0 ? vertex : V3.ZeroReadOnly
));
const flatOnXYEdge = flat.map((row, i) => row.map((vertex, j) =>
  j === 0 ? vertex : V3.ZeroReadOnly
));

const cyanMesh    = new TriangulationWithAuxLines(flatLines, flat, cyan   , 0);
const yellowMesh  = new TriangulationWithAuxLines(flatLines, flat, yellow , 0);
const magentaMesh = new TriangulationWithAuxLines(flatLines, flat, magenta, 0);
const whiteMesh   = new TriangulationWithAuxLines(collapsedLines, evenOnEdges, B.Color3.White(), 0);
const rays = new Rays(collapsed.flat(), 0);
const baryPoints = [
  v3(1,3,2), v3(4,1,1),
  v3(6,0,0), v3(0,6,0), v3(0,0,6), v3(6,0,0)]
  .map(p => p.scaleInPlace(n/6));
const bary = new BarycentricCoordinates(baryPoints[0], 0);
const sinesExpl = new SinesExplanation();


/** Lerp between two V3[][] (of equal shape) */
const lerp2 = (lambda: number) =>
  zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda)));

type Motion = [number, (current: number) => void];
const motions: Motion[][] = [
  // TODO show a rounded box with wireframe and colored faces (planes),
  // edges (quarter cylinders), and corners (eighths of spheres)
  // (port the buzzer?)
  [[0, () => {
    magentaMesh.rotation = yellowMesh.rotation = cyanMesh.rotation = V3.ZeroReadOnly;
    magentaMesh.lines = yellowMesh.lines = cyanMesh.lines = flatLines;
    magentaMesh.vertices = yellowMesh.vertices = cyanMesh.vertices = flat;
  }],
  [1, lambda => magentaMesh.alpha = lambda]],
  // ***** flat *****
  [[1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, -easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, -1 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** flat => geodesic *****
  [[1, lambda => {
    rays.alpha = lambda;
    rays.ends = lerp2(lambda)(collapsed, geodesic).flat();
  }]],
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines = lerp2(lambda1)(flatLines, geodesics);
    magentaMesh.vertices = lerp2(lambda1)(flat, geodesic);
  }]],
  [[.5, lambda => {
    rays.alpha = 1 - lambda;
  }]],
  // ***** geodesic *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.vertices = yellowMesh.vertices = magentaMesh.vertices;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, -easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, -1 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** geodesic => parallels *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines = lerp2(lambda1)(geodesics, parallels);
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.vertices = lerp2(lambda1)(geodesic, onParallels);
  }]],
  // ***** parallels *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.vertices = yellowMesh.vertices = magentaMesh.vertices;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, -easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, -1 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** parallels => evenGeodesics *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines = lerp2(lambda1)(parallels, evenGeodesics);
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.vertices = lerp2(lambda1)(onParallels, onEvenGeodesics);
  }]],
  // ***** evenGeodesics *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.vertices = yellowMesh.vertices = magentaMesh.vertices;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, -easeInOut(lambda));
  }]],
  // ***** evenGeodesics => evenOnEdges *****
  [[0, () => {
    whiteMesh.vertices = evenOnEdges;
    whiteMesh.alpha = 1;
  }],
  [0.5, lambda => {
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha = 1 - lambda;
  }]],
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines = flatLines;
    cyanMesh.vertices = yellowMesh.vertices = magentaMesh.vertices = collapsed;
    rotateTo(magentaMesh, 0);
    rotateTo(yellowMesh, 1);
    rotateTo(cyanMesh, -1);
  }],
  [.5, lambda => {
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha = lambda;
  }]],
  [[1, lambda => bary.alpha = lambda]],
  ...baryPoints.slice(1).map((p, i) =>
    [[1, lambda => {
      bary.coords = V3.Lerp(baryPoints[i], p, easeInOut(lambda));
    }] as Motion]
  ),
  [[0.5, lambda => {
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha =
    bary.alpha = 1 - lambda;
  }]],
  // ***** evenOnEdges => ... *****
  [[0, () => {
    cyanMesh.rotation = yellowMesh.rotation = V3.ZeroReadOnly;
    yellowMesh.vertices = flatOnEdges;
    yellowMesh.lines = collapsedLines;
  }],
  [.5, lambda => {
    const lambda1 = easeInOut(lambda);
    yellowMesh.alpha = lambda1;
  }]],
  [[.5, lambda => {
    const lambda1 = easeInOut(lambda);
    yellowMesh.vertices = lerp2(lambda1)(flatOnEdges, flatOnXYEdge);
    whiteMesh.vertices = lerp2(lambda1)(evenOnEdges, evenOnXYEdge);
  }]],
  [[.5, lambda => {
    sinesExpl.alpha = lambda;
  }]],
  [[.5, lambda => sinesExpl.step = 0 + lambda]],
  [[.5, lambda => sinesExpl.step = 1 + lambda]],
  [[.5, lambda => sinesExpl.step = 2 + lambda]],
  [[.5, lambda => sinesExpl.step = 3 + lambda]],
  [[.5, lambda => sinesExpl.step = 4 + lambda]],
  [[.5, lambda => sinesExpl.step = 5 + lambda]],
  [[.5, lambda => sinesExpl.alpha = 1 - lambda],
   [0, () => sinesExpl.step = 7],
   [.5, lambda => sinesExpl.alpha = lambda]],
  // ***** ... => sines *****
  [[0, () => {
    cyanMesh.lines = magentaMesh.lines = yellowMesh.lines;
    cyanMesh.vertices = magentaMesh.vertices = yellowMesh.vertices;
  }],
  [1, lambda => {
    const lambda1 = Math.sqrt(lambda);
    cyanMesh.alpha = lambda1;
    rotateTo(cyanMesh, easeInOut(lambda));
    magentaMesh.alpha = Math.sqrt(lambda);
    rotateTo(magentaMesh, -easeInOut(lambda));
    whiteMesh.vertices = lerp2(easeInOut(lambda))(evenOnXYEdge, evenOnEdges);
  }]],
  [[0.5, lambda => {
    yellowMesh.alpha = cyanMesh.alpha = magentaMesh.alpha = 1 - lambda;
    whiteMesh.vertices = lerp2(easeInOut(lambda))(evenOnEdges, sines);
  }]],
  [[.5, lambda => sinesExpl.alpha = 1 - lambda],
   [0, () => sinesExpl.step = 8],
   [1, lambda => sinesExpl.alpha = lambda]],
  // ***** sines => sineBased *****
  [[1, lambda => {
    rays.alpha = lambda;
    rays.ends = lerp2(lambda)(collapsed, sineBased).flat();
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    sinesExpl.step = 8 + lambda1;
    whiteMesh.vertices = lerp2(lambda1)(sines, sineBased);
  }]],
  [[.5, lambda => {
    rays.alpha = 1 - lambda;
  }]],
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = whiteMesh.lines;
    cyanMesh.vertices = yellowMesh.vertices = whiteMesh.vertices;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, -easeInOut(lambda));
  }],
  [0, lambda => {
    magentaMesh.alpha = cyanMesh.alpha = 0;
  }]],
  // ***** for comparison: geodesic
  [[0, () => {
    magentaMesh.lines = collapsedLines;
    magentaMesh.vertices = geodesic;
  }],
  [1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.alpha = lambda1;
    magentaMesh.vertices = lerp2(lambda1)(sineBased, geodesic)
  }]],
  // TODO show wireframes
  // TODO show polyhedra
  // TODO Mention icosphere?  A similar ad-hoc generalization of slerp from
  // two to three base points should be possible.
  // (But probably not worth the effort.)
  // ***** fade out *****
  [[1, lambda => {
    sinesExpl.alpha = whiteMesh.alpha = magentaMesh.alpha = yellowMesh.alpha = 1 - lambda;
  }]]
]


const ROT_AXIS = v3(1, 1, 1).normalize();
function rotateTo(mesh: B.Mesh, amount: number) {
  // Implementing absolute rotation as reset + relative rotation.
  // TODO Check if babylon has absolute rotation directly.
  mesh.rotation = V3.ZeroReadOnly;
  mesh.rotate(ROT_AXIS, TAU/3 * amount)
}

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());


const speed = document.querySelector("#speed") as HTMLInputElement;

const step = document.querySelector("#step")! as HTMLButtonElement;
step.textContent = `step 1/${motions.length}`;

const motionController = new MotionController();
scene.registerAfterRender(motionController.update);

let stepNo = 0;
async function performStep() {
  step.disabled = true;
  let i = 0;
  for (let subStep of motions[stepNo++ % motions.length]) {
    await motionController.initStep(Number(speed.value) * subStep[0], subStep[1]);
  }
  step.disabled = false;
  step.textContent = `step ${stepNo % motions.length + 1}/${motions.length}`;
}

// Fast forward to some step
async function skipTo(start: number) {
  const oldValue = speed.value;
  speed.value = "1";
  for (let i = 1; i < start; i++) {
    await performStep();
  }
  speed.value = oldValue;
}
skipTo(Number.parseInt(params.get("start") ?? "0"));


step.addEventListener("click", performStep);
