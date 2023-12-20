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

  const red = B.Color3.Red();
  const red4 = red.toColor4();
  const blue = B.Color3.Blue();
  const blue4 = blue.toColor4();
  const mat = (color: B.Color3) =>
    createStandardMaterial("mat", {diffuseColor: color}, scene);

    showTriangulation({
    n,
    triangulation: T.onParallels(0),
    vertexMaterial: mat(red),
    // edgeColor: red.toColor4(),
  }, scene);
  T.parallels(0, n, 20).forEach(points => {
    B.CreateLines("geodesic", {points, colors: points.map(() => red4)}, scene);
  });

  showTriangulation({
    n,
    triangulation: T.onEvenGeodesics(0),
    vertexMaterial: mat(blue),
    // edgeColor: blue.toColor4(),
  }, scene);
  T.evenGeodesics(0, n, 20).forEach(points => {
    B.CreateLines("geodesic", {points, colors: points.map(() => blue4)}, scene);
  });

  return scene;
}

const scene = createScene();

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
