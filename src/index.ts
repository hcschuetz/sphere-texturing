import * as B from "babylonjs";
import * as M from "mobx";
import * as T from "./triangulation";
import { MotionController, easeInOut, slerp, subdivide } from "./utils";
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
    triangulationBox: M.IComputedValue<T.Triangulation>,
    parent?: B.Mesh,
    vertexMaterial?: B.Material,
    edgeColor?: B.Color4,
    faceMaterial?: B.Material,
  },
  scene: B.Scene,  
) {
  const {
    n,
    triangulationBox,
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

  M.reaction(() => triangulationBox.get(), tr => {
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

const motionController = new MotionController();

const scene = new B.Scene(engine);

const camera = new B.ArcRotateCamera("camera", TAU/12, TAU/5, 3, v3(0, 0, 0), scene);
camera.attachControl(undefined, true);

const light = new B.HemisphericLight('light1', v3(0, 1, 0), scene);
light.intensity = 0.8;

const light2 = new B.DirectionalLight("light2", v3(10, -2, -10), scene);
light2.intensity = 0.8;

const light3 = new B.DirectionalLight("light3", v3(3, 10, 10), scene);
light3.intensity = 0.5;

([[1,0,0], [0,1,0], [0,0,1]] as [number, number, number][])
.forEach((dims, i) => {
  const color = new B.Color4(...dims);
  B.MeshBuilder.CreateLines("axis-" + i, {
    points: [v3(0,0,0), v3(...dims).scaleInPlace(1.5)],
    colors: [color, color],
  }, scene);
});

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
  diffuseColor: new B.Color3(.2, .2, .2),
  alpha: 0.2,
  sideOrientation: B.VertexData.DOUBLESIDE,
}, scene);

const arc1 = B.MeshBuilder.CreateLines("arc1", {
  points:
    subdivide(0, 1, 40).map(lambda =>
      slerp(v3(1, 0, 0), v3(0, 1, 0), lambda)
    ),
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

const n = 6;

const cyan = B.Color3.Teal();
const magenta = B.Color3.Magenta();
const yellow = B.Color3.Yellow();

class WithAuxLines extends B.Mesh {
  constructor (
    public lines: V3[][],
    public triangulation: T.Triangulation,
    public color: B.Color3,
    public alpha: number = 1,
  ) {
    super("WithAuxLines", scene);
    M.makeObservable(this, {
      lines: M.observable,
      triangulation: M.observable.ref,
      alpha: M.observable,
    });

    const lineMaterial = createStandardMaterial("lineMat", {
      diffuseColor: color,
      emissiveColor: color,
    }, scene);
    M.autorun(() => lineMaterial.alpha = this.alpha);

    const lineSys = B.CreateLineSystem("geodesics", {
      updatable: true,
      lines,
      material: lineMaterial,
    }, scene);
    lineSys.parent = this;
    M.autorun(() => {
      B.CreateLineSystem("geodesics+", {
        instance: lineSys,
        lines: this.lines,
      });
    });

    const vertexMaterial = createStandardMaterial("vtxMat", {
      diffuseColor: color,
    }, scene);
    M.autorun(() => vertexMaterial.alpha = this.alpha);

    // TODO get rid of this conversion between two kinds of observables:
    const triangulationBox = M.observable.box(this.triangulation);
    M.autorun(() => triangulationBox.set(this.triangulation));

    createTriangulation({
      n,
      triangulationBox,
      parent: lineSys,
      vertexMaterial,
    }, scene);
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
const onEvenGeodesics = T.evenGeodesics(n);
const sines = T.sines(n);
const sineBased = T.sineBased(n);

const cyanMesh    = new WithAuxLines(flatLines, flat, cyan   , 0);
const yellowMesh  = new WithAuxLines(flatLines, flat, yellow , 0);
const magentaMesh = new WithAuxLines(flatLines, flat, magenta, 0);

// workaround for rendering problems with flatLines:
// TODO cleaner solution: use thin tubes for lines
const directLineMat = createStandardMaterial("directLineMat", {
  diffuseColor: magenta,
  emissiveColor: magenta,
  alpha: 0,
}, scene);
const offset = v3(1,1,1).scaleInPlace(.0001);
B.CreateLineSystem("direct", {
  lines: T.flat(n).map(line => [
    // slightly offset the line so that rendering errors (mostly)
    // do not happen in the same places as for the original line:
    line[0].addInPlace(offset),
    line.at(-1)!.addInPlace(offset),
    // going back to have another chance of proper rendering:
    line[0].addInPlace(offset),
  ]),
  material: directLineMat,
}, scene);

const zip = <T, U, V>(f: (t: T, u: U) => V) => (ts: T[], us: U[]): V[] =>
  ts.map((t, i) => f(t, us[i]));

const motions: [number, (current: number) => void][][] = [
  // TODO show a rounded box with wireframe and colored faces (planes),
  // edges (quarter cylinders), and corners (eighths of spheres)
  // (port the buzzer?)
  // TODO show full octahedron with transparent sphere around
  [[0, () => {
    magentaMesh.lines = yellowMesh.lines = cyanMesh.lines = flatLines;
    magentaMesh.triangulation = yellowMesh.triangulation = cyanMesh.triangulation = flat;
  }],
  [1, lambda => directLineMat.alpha = magentaMesh.alpha = lambda]],
  // ***** flat *****
  [[1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** flat => geodesic *****
  // TODO show rays
  [[1, lambda => {
    magentaMesh.alpha = 1;
    directLineMat.alpha = 0;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (flatLines, geodesics);
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (flat, geodesic);
  }]],
  // ***** geodesic *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** geodesic => parallels *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (geodesics, parallels);
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (geodesic, onParallels);
  }]],
  // ***** parallels *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** parallels => evenGeodesics *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (parallels, evenGeodesics);
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (onParallels, onEvenGeodesics);
  }]],
  // ***** evenGeodesics *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[1, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** evenGeodesics => flat *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (evenGeodesics, collapsedLines);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (onEvenGeodesics, flat);
  }]],
  // ***** flat => sines *****
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (flat, sines);
  }]],
  // ***** sines *****
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }],
  [0, lambda => {
    yellowMesh.alpha = cyanMesh.alpha = 0;
  }]],
  // ***** sines => sineBased *****
  // TODO show rays
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (sines, sineBased);
  }]],
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [1, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[1, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }],
  [0, lambda => {
    yellowMesh.alpha = cyanMesh.alpha = 0;
  }]],
  // ***** for comparison: geodesic
  [[0, () => {
    yellowMesh.lines = collapsedLines;
    yellowMesh.triangulation = geodesic;
  }],
  [1, lambda => {
    yellowMesh.alpha = lambda;
  }]],
  // ***** fade out *****
  [[1, lambda => {
    magentaMesh.alpha = 1 - lambda;
    yellowMesh.alpha = 1 - lambda;
  }]]
]

scene.registerAfterRender(function () {
  if (motionController.isMoving()) {
    const step = motionController.from;
    const lambda = motionController.current() - step;
    motionController.update(lambda);
  }
});

const ROT_AXIS = v3(1, 1, 1).normalize();
function rotateTo(mesh: B.Mesh, amount: number) {
  // Implementing absolute rotation as reset + relative rotation.
  // TODO Check if babylon has absolute rotation directly.
  mesh.rotation = V3.ZeroReadOnly;
  mesh.rotate(ROT_AXIS, TAU/3 * amount)
}

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());


const notes = document.querySelector("#notes")!;

const speed = document.querySelector("#speed") as HTMLInputElement;

const step = document.querySelector("#step")! as HTMLButtonElement;
step.textContent = `step 1/${motions.length}`;

let stepNo = 0;
step.addEventListener("click", async () => {
  step.disabled = true;
  let i = 0;
  for (let subStep of motions[stepNo++ % motions.length]) {
    await motionController.initStep(Number(speed.value) * subStep[0], subStep[1]);
  }
  step.disabled = false;
  step.textContent = `step ${stepNo % motions.length + 1}/${motions.length}`;
});
