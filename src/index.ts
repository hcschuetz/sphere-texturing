import * as B from "babylonjs";
import * as M from "mobx";
import * as T from "./triangulation";
import { MotionController, easeInOut, subdivide } from "./utils";
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

const camera = new B.ArcRotateCamera("camera", TAU/12, TAU/5, 3, new V3(0, 0, 0), scene);
camera.attachControl(undefined, true);

const light = new B.HemisphericLight('light1', new V3(0, 1, 0), scene);
light.intensity = 0.7;

const light2 = new B.SpotLight("light2",
  new V3(-3, 3, 10),
  new V3(3, -3, -10),
  TAU/2, //TAU/80,
  0.9,
  scene
);
light2.intensity = 0.8;

[[1,0,0], [0,1,0], [0,0,1]].forEach((dims, i) => {
  const color = new B.Color4(...dims);
  B.MeshBuilder.CreateLines("axis-" + i, {
    points: [new V3(0,0,0), new V3(...dims).scaleInPlace(1.5)],
    colors: [color, color],
  }, scene);
});

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

const flatLines = T.flatLines(n, 10);
const geodesics = T.geodesics(n, 10);
const evenGeodesics = T.evenGeodesics(n, 10);
const parallels = T.parallels(n, 10);
const collapsedLines = T.collapsedLines(n, 10);

const flat = T.flat(n);
const geodesic = T.geodesic(n);
const onParallels = T.onParallels(n);
const onEvenGeodesics = T.onEvenGeodesics(n);
const sines = T.sines(n);
const sineBased = T.sineBased(n);

const cyanMesh    = new WithAuxLines(flatLines, flat, cyan   , 0);
const yellowMesh  = new WithAuxLines(flatLines, flat, yellow , 0);
const magentaMesh = new WithAuxLines(flatLines, flat, magenta, 0);

const zip = <T, U, V>(f: (t: T, u: U) => V) => (ts: T[], us: U[]): V[] =>
  ts.map((t, i) => f(t, us[i]));

const dur = 1500;
const motions: [number, (current: number) => void][][] = [
  // TODO show a rounded box with wireframe and colored faces (planes),
  // edges (quarter cylinders), and corners (eighths of spheres)
  // (port the buzzer?)
  // TODO show full octahedron with transparent sphere around
  [[0, () => {
    magentaMesh.lines = yellowMesh.lines = cyanMesh.lines = flatLines;
    magentaMesh.triangulation = yellowMesh.triangulation = cyanMesh.triangulation = flat;
  }],
  [dur, lambda => magentaMesh.alpha = lambda]],
  // ***** flat *****
  [[dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[dur, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** flat => geodesic *****
  // TODO show rays
  [[dur, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (flatLines, geodesics);
  }]],
  [[dur, lambda => {
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
  [dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[dur, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** geodesic => parallels *****
  [[dur, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (geodesics, parallels);
  }]],
  [[dur, lambda => {
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
  [dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[dur, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** parallels => evenGeodesics *****
  [[dur, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (parallels, evenGeodesics);
  }]],
  [[dur, lambda => {
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
  [dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }]],
  [[dur, lambda => {
    rotateTo(yellowMesh, 1 - easeInOut(lambda));
    rotateTo(cyanMesh, 2 + easeInOut(lambda));
    yellowMesh.alpha = Math.sqrt(1 - lambda);
    cyanMesh.alpha = Math.sqrt(1 - lambda);
  }]],
  // ***** evenGeodesics => flat *****
  [[dur, lambda => {
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
  [[dur, lambda => {
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
  [dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
    cyanMesh.alpha = Math.sqrt(lambda);
    rotateTo(cyanMesh, 1 + easeInOut(lambda));
  }],
  [0, lambda => {
    yellowMesh.alpha = cyanMesh.alpha = 0;
  }]],
  // ***** sines => sineBased *****
  // TODO show rays
  [[dur, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.triangulation =
      zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda1)))
      (sines, sineBased);
  }]],
  [[0, () => {
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines;
    cyanMesh.triangulation = yellowMesh.triangulation = magentaMesh.triangulation;
  }],
  [dur, lambda => {
    yellowMesh.alpha = Math.sqrt(lambda);
    rotateTo(yellowMesh, easeInOut(lambda));
  }]],
  [[dur, lambda => {
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
  [dur, lambda => {
    yellowMesh.alpha = lambda;
  }]],
  // ***** fade out *****
  [[dur, lambda => {
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

const ROT_AXIS = new V3(1, 1, 1).normalize();
function rotateTo(mesh: B.Mesh, amount: number) {
  // Implementing absolute rotation as reset + relative rotation.
  // TODO Check if babylon has absolute rotation directly.
  mesh.rotation = V3.ZeroReadOnly;
  mesh.rotate(ROT_AXIS, TAU/3 * amount)
}

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());


const notes = document.querySelector("#notes")!;

const step = document.querySelector("#step")! as HTMLButtonElement;
step.textContent = `step 1/${motions.length}`;

let stepNo = 0;
step.addEventListener("click", async () => {
  step.disabled = true;
  let i = 0;
  for (let subStep of motions[stepNo++ % motions.length]) {
    await motionController.initStep(...subStep);
  }
  step.disabled = false;
  step.textContent = `step ${stepNo % motions.length + 1}/${motions.length}`;
});
