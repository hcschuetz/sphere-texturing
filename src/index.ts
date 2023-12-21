import * as B from "babylonjs";
import * as T from "./triangulation";
import { slerp } from "./utils";
import { MotionController } from "./utils";

const MB = B.MeshBuilder;

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

function smallSphere(name: string, options: {
    position: B.Vector3,
    material: B.Material,
  }, scene: B.Scene) {
  const sphere = MB.CreateIcoSphere(name, {
    radius: 0.015,
  }, scene);
  Object.assign(sphere, options);
  return sphere;
}

function showTriangulation(
  props: {
    n: number,
    triangulation: T.Triangulation,
    parent?: B.Mesh,
    vertexMaterial?: B.Material,
    edgeColor?: B.Color4,
    faceMaterial?: B.Material,
  },
  scene: B.Scene,  
) {
  const {
    n,
    triangulation,
    parent,
    vertexMaterial,
    edgeColor,
    faceMaterial,
  } = props;

  const vertices: B.Vector3[] = [];
  const triangles: number[] = [];

  function linkToParent(mesh: B.Mesh) {
    if (parent) {
      mesh.parent = parent;
    }
  }

  const gen = T.driver<number>(n, triangulation, {
    emitVertex(name, v) {
      if (vertexMaterial) {
        linkToParent(smallSphere(name, {
          position: vertices[v],
          material: vertexMaterial,
        }, scene));
      }
    },
    emitEdge(name, v1, v2) {
      if (edgeColor) {
        linkToParent(B.CreateLines(name, {
          points: [vertices[v1], vertices[v2]],
          colors: [edgeColor, edgeColor],
        }, scene));
      }
    },
    emitFace(name, v1, v2, v3) {
      if (faceMaterial) {
        triangles.push(v1, v2, v3);
      }
    },
  });

  for (let out = gen.next(); !out.done; out = gen.next(vertices.length - 1)) {
    vertices.push(out.value.p);
  }

  if (faceMaterial) {
    const customMesh = new B.Mesh("custom", scene);
    linkToParent(customMesh);
    customMesh.material = faceMaterial;

    const vertexData = new B.VertexData();
    vertexData.positions = vertices.flatMap(v => [v.x, v.y, v.z]);
    vertexData.indices = triangles;
    vertexData.normals = vertexData.positions;
  
    vertexData.applyToMesh(customMesh);
  }
}

const motionController = new MotionController();

const scene = new B.Scene(engine);

const camera = new B.ArcRotateCamera("camera", TAU/12, TAU/5, 3, new B.Vector3(0, 0, 0), scene);
camera.attachControl(undefined, true);

const light = new B.HemisphericLight('light1', new B.Vector3(0, 1, 0), scene);
light.intensity = 0.7;

const light2 = new B.SpotLight("light2",
  new B.Vector3(-3, 3, 10),
  new B.Vector3(3, -3, -10),
  TAU/2, //TAU/80,
  0.9,
  scene
);
light2.intensity = 0.8;

[[1,0,0], [0,1,0], [0,0,1]].forEach((dims, i) => {
  const color = new B.Color4(...dims);
  MB.CreateLines("axis-" + i, {
    points: [new B.Vector3(0,0,0), new B.Vector3(...dims).scaleInPlace(1.5)],
    colors: [color, color],
  }, scene);
});

const n = 6;

const cyan = B.Color3.Teal();
const magenta = B.Color3.Magenta();
const yellow = B.Color3.Yellow();

function withAuxLines(
  lines: B.Vector3[][],
  triangulation: T.Triangulation,
  color: B.Color3,
): B.Mesh {
  const lineSys = B.CreateLineSystem("geodesics", {
    lines,
    material: createStandardMaterial("lineMat", {
      diffuseColor: color,
      emissiveColor: color,
    }, scene),
  }, scene);

  showTriangulation({
    n,
    triangulation,
    parent: lineSys,
    vertexMaterial: createStandardMaterial("mat", {
      diffuseColor: color,
    }, scene),
  }, scene);

  return lineSys;
}

const configurations: Record<string, [
  (n: number, res: number) => B.Vector3[][],
  T.Triangulation,
]> = {
  f: [T.flatLines, T.flat],
  g: [T.geodesics, T.geodesic],
  e: [T.evenGeodesics, T.onEvenGeodesics],
  p: [T.parallels, T.onParallels],
  s: [() => [], T.sines],
  sb: [() => [], T.sineBased],
};
const [lineGen, triangulation] = configurations.f;
const auxLines = lineGen(n, 20);

const cyanMesh = withAuxLines(auxLines, triangulation, cyan);
const yellowMesh = withAuxLines(auxLines, triangulation, yellow);
const magentaMesh = withAuxLines(auxLines, triangulation, magenta);

const motions: ((current: number) => void)[] = [
  lambda => rotateTo(yellowMesh, lambda),
  lambda => rotateTo(cyanMesh, 1 + lambda),
  lambda => {
    rotateTo(yellowMesh, 1 - lambda);
    rotateTo(cyanMesh, 2 + lambda);
  }
]

scene.registerAfterRender(function () {
  if (motionController.isMoving()) {
    const step = motionController.from;
    const lambda = motionController.current() - step;
    console.log(step, lambda);
    motions[step % motions.length](lambda);
  }
});

const ROT_AXIS = new B.Vector3(1, 1, 1).normalize();
function rotateTo(mesh: B.Mesh, amount: number) {
  // Implementing absolute rotation as reset + relative rotation.
  // TODO Check if babylon has absolute rotation directly.
  mesh.rotation = B.Vector3.ZeroReadOnly;
  mesh.rotate(ROT_AXIS, TAU/3 * amount)
}

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());

document.querySelector("#click-me")!.addEventListener("click", () => {
  motionController.initStep(1, 1500);
});
