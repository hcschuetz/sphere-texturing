import * as B from "babylonjs";
import * as T from "./triangulation";
import { slerp } from "./utils";

const MB = B.MeshBuilder;

const TAU = 2 * Math.PI;

const canvas = document.getElementById('renderCanvas') as HTMLCanvasElement;
const engine = new B.Engine(canvas, true, {
  preserveDrawingBuffer: true,
  stencil: true
});

function createStandardMaterial(
  name: string,
  options: Partial<B.StandardMaterial> = {},
  scene?: B.Scene
): B.StandardMaterial {
  const material = new B.StandardMaterial(name, scene);
  for (const property in options) {
    material[property] = options[property];
  };
  return material;
}

function smallSphere(name: string, position: B.Vector3, material: B.Material, scene: B.Scene) {
  const sphere = MB.CreateIcoSphere(name, {
    radius: 0.015,
  }, scene);
  sphere.position = position;
  sphere.material = material;
  return sphere;
}

function showTriangulation(
  props: {
    n: number,
    triangulation: T.Triangulation,
    vertexMaterial?: B.Material,
    edgeColor?: B.Color4,
    faceMaterial?: B.Material,
  },
  scene: B.Scene,  
) {
  const {
    n,
    triangulation,
    vertexMaterial,
    edgeColor,
    faceMaterial,
  } = props;

  const vertices: B.Vector3[] = [];
  const triangles: number[] = [];

  const gen = T.driver<number>(n, triangulation, {
    emitVertex(name, v) {
      if (vertexMaterial) {
        smallSphere(name, vertices[v], vertexMaterial, scene);
      }
    },
    emitEdge(name, v1, v2) {
      if (edgeColor) {
        B.CreateLines(name, {
          points: [vertices[v1], vertices[v2]],
          colors: [edgeColor, edgeColor],
        }, scene);
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

  const customMesh = new B.Mesh("custom", scene);
  if (faceMaterial) {
    customMesh.material = faceMaterial;
  }

  const vertexData = new B.VertexData();
  vertexData.positions = vertices.flatMap(v => [v.x, v.y, v.z]);
  vertexData.indices = triangles;
  vertexData.normals = vertexData.positions;

  vertexData.applyToMesh(customMesh);

}

class MotionController {
  tFrom = 0;
  tTo = 0;
  from = 0;
  to = 0;
  value = 0;
  initStep(stepSize: number, duration: number): void {
    this.from = this.to;
    this.to += stepSize;
    const now = Date.now();
    this.tFrom = now;
    this.tTo = now + duration;
  }
  isMoving(): boolean {
    return this.to !== this.value;
  }
  current(): number {
    const now = Math.min(this.tTo, Date.now());
    return this.value =
      (this.from * (this.tTo - now) + this.to * (now - this.tFrom)) /
      (this.tTo - this.tFrom);
  }
};

const rotationController = new MotionController();

function createScene() {
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
  const cyan4 = cyan.toColor4();
  const magenta = B.Color3.Magenta();
  const magenta4 = magenta.toColor4();
  const yellow = B.Color3.Yellow();
  const yellow4 = yellow.toColor4();

  const mat = (color: B.Color3) =>
    createStandardMaterial("mat", {diffuseColor: color}, scene);

  showTriangulation({
    n,
    triangulation: T.onEvenGeodesics(0),
    vertexMaterial: mat(magenta),
    // edgeColor: red.toColor4(),
  }, scene);
  const geodesics = B.CreateLineSystem("geodesics1", {
    lines: T.evenGeodesics(0, n, 20),
    material: createStandardMaterial("lineMat", {
      diffuseColor: magenta,
      emissiveColor: magenta,
    }, scene),
  }, scene);

  scene.registerAfterRender(function () {
    if (rotationController.isMoving()) {
      geodesics.rotation = B.Vector3.Zero();
      geodesics.rotate(new B.Vector3(1, 1, 1).normalize(), rotationController.current());
    }
  });

  return scene;
}

const scene = createScene();

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());

document.querySelector("#click-me")!.addEventListener("click", () => {
  rotationController.initStep(TAU / 3, 1000);
});
