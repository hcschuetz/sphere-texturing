import * as B from "babylonjs";
import * as T from "./triangulation";

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

  T.driver<number>(n, triangulation, {
    emitVertex(name, p) {
      const result = vertices.length;
      vertices.push(p);
      if (vertexMaterial) {
        smallSphere(name, p, vertexMaterial, scene);
      }
      return result;
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

  const n = 8;

  const colors: B.Color3[] = [
    new B.Color3(0, 1, 1),
    new B.Color3(1, 0, 1),
    new B.Color3(1, 1, 0),
  ]

  for (const rotation of [0]) {
    const color = colors[rotation];
    showTriangulation({
      n,
      triangulation: T.sines,
      vertexMaterial: createStandardMaterial("mat." + rotation, {
        diffuseColor: B.Color3.Gray(),
      }, scene),
      edgeColor: B.Color3.Gray().toColor4()
    }, scene);
    showTriangulation({
      n,
      triangulation: T.sineBased,
      vertexMaterial: createStandardMaterial("mat." + rotation, {
        diffuseColor: B.Color3.White(),
      }, scene),
      edgeColor: B.Color3.White().toColor4()
    }, scene);
    const gray4 = B.Color3.Gray().toColor4();
    T.rays(n, T.sineBased).forEach((ray, i) => {
      MB.CreateLines(`ray[${i}]`, {
        points: ray,
        colors: ray.map(() => gray4)
      }, scene);
    });

    const color4 = color.toColor4();
    false && T.evenGeodesics(rotation, n, 20).forEach(line => {
      MB.CreateLines("geodesic." + rotation, {
        points: line,
        colors: line.map(() => color4),
      }, scene);
    });
  }

  return scene;
}

const scene = createScene();

engine.runRenderLoop(() => scene.render());

window.addEventListener('resize', () => engine.resize());
