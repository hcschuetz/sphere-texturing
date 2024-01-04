import * as B from "@babylonjs/core";
import * as G from "@babylonjs/gui";
import * as M from "mobx";
import * as T from "./triangulation";
import { MotionController, easeInOut, map2, radToDeg, slerp, subdivide, zip } from "./utils";
import { RoundedBox } from "./RoundedBox";
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


const roundedBox = new RoundedBox("box", {
  xs: [.4, -1],
  ys: [.4, 0],
  zs: [.7, -.2],
  radius: .2,
}, scene);
roundedBox.material = createStandardMaterial("cornerMat", {
  diffuseColor: B.Color3.Gray(),
  alpha: 0,
});


const octasphereAlpha = M.observable.box(0);


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
  M.autorun(() => arrow.material!.alpha = octasphereAlpha.get());

  const labelPos = new B.TransformNode("labelPos" + i, scene);
  labelPos.position = v3(...dims).scaleInPlace(1.1);
  const label = new G.TextBlock("label" + i, "xyz"[i]);
  label.color = "#" + dims.map(dim => "0f"[dim]).join("");
  label.fontSize = 24;
  advancedTexture.addControl(label);
  label.linkWithMesh(labelPos);
  M.autorun(() => label.alpha = octasphereAlpha.get());
});

// Allow to hide some vertices temporarily inside the origin
const origin = B.MeshBuilder.CreateIcoSphere("origin", {
  radius: 0.02,
}, scene);
origin.material = createStandardMaterial("originMat", {
  diffuseColor: B.Color3.Black(),
}, scene);
M.autorun(() => origin.material!.alpha = octasphereAlpha.get());

const octahedron = B.MeshBuilder.CreatePolyhedron("octahedron", {
  type: 1,
  size: Math.sqrt(.5) * 0.999,
}, scene);
octahedron.material = createStandardMaterial("octaMat", {
  diffuseColor: new B.Color3(.8, .8, .8),
  sideOrientation: B.VertexData.DOUBLESIDE,
}, scene);
M.autorun(() => octahedron.material!.alpha = 0.2 * octasphereAlpha.get());


const sphere = B.MeshBuilder.CreateSphere("sphere", {
  diameter: 2,
});
sphere.material = createStandardMaterial("sphMat", {
  diffuseColor: new B.Color3(1,1,1),
  alpha: 0,
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
M.autorun(() => arc1.material!.alpha = octasphereAlpha.get());

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

    subdivide(0, 1, n).forEach((i, ii) =>
      subdivide(0, 1, (n - ii)).forEach((j, jj) => {
        const vertex = B.MeshBuilder.CreateIcoSphere(`vertex(${ii},${jj})`, {
          radius: 0.01,
          subdivisions: 2,
          flat: false,
        }, scene);
        vertex.parent = this;
        vertex.material = vertexMaterial;
        M.autorun(() => vertex.position = this.vertices[ii][jj])
        return vertex;
      })
    );
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

    const color = new B.Color3(.5,.5,.5);
    const material = createStandardMaterial("rayMat", {
      diffuseColor: color,
      // emissiveColor: color,
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

const sub = (text: string) => `<sub>${text}</sub>`;
const ex = "e" + sub("x");
const ey = "e" + sub("y");
const ez = "e" + sub("z");

class Explanation {
  alpha = 0;

  constructor(html: string) {
    M.makeObservable(this, {alpha: M.observable});
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
    div.innerHTML = html;
    M.autorun(() => {
      div.style.opacity = this.alpha.toString();
      div.style.display = this.alpha ? "" : "none";
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
      const pos = coords.scale(1 / (coords.x + coords.y + coords.z));
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
          <b style="color: blue" >${coords.z.toFixed(2)}</b>
        </span>
        <div style="height: 0.3ex;"></div>
        normalized (sum 1):
        <br>
        <span style="
          border-radius: 4px;
          padding: 6px;
          background-color: #ccc;
          color: #000;
        ">
          <b style="color: red"  >${pos.x.toFixed(2)}</b> :
          <b style="color: green">${pos.y.toFixed(2)}</b> :
          <b style="color: blue" >${pos.z.toFixed(2)}</b>
        </span>
        `;
    });

    const pointMaterial = createStandardMaterial("baryMat", {
    }, scene);
    M.autorun(() => pointMaterial.alpha = this.alpha);
    const point = B.MeshBuilder.CreateIcoSphere("bary_point", {
      radius: 0.025,
    }, scene);
    point.material = pointMaterial;
    M.autorun(() => {
      const {coords} = this;
      point.position = coords.scale(1 / (coords.x + coords.y + coords.z))
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
        const base: V3 =
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

class AngularBarycentricCoordinates {
  public pos = V3.ZeroReadOnly;
  public alpha = 0;
  public flatness = 0;

  constructor() {
    M.makeObservable(this, {
      pos: M.observable,
      alpha: M.observable,
      flatness: M.observable,
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
      const {pos} = this;
      const angles = v3(Math.asin(pos.x), Math.asin(pos.y), Math.asin(pos.z));
      const normalized = angles.scale(1 / (angles.x + angles.y + angles.z));
      div.innerHTML = `
        <span style="text-decoration: underline">Angular Barycentric Coordinates</span>
        <br>
        not normalized (sum ${radToDeg(angles.x + angles.y + angles.z).toFixed(1)}°):
        <br>
        <span style="
          border-radius: 4px;
          padding: 6px 8px;
          background-color: #ccc;
          color: #000;
        ">
          <b style="color: red"  >${radToDeg(angles.x).toFixed(1)}°</b> :
          <b style="color: green">${radToDeg(angles.y).toFixed(1)}°</b> :
          <b style="color: blue" >${radToDeg(angles.z).toFixed(1)}°</b>
        </span>
        <div style="height: 0.3ex;"></div>
        normalized (sum 1):
        <br>
        <span style="
          border-radius: 4px;
          padding: 6px;
          background-color: #ccc;
          color: #000;
        ">
          <b style="color: red"  >${normalized.x.toFixed(2)}</b> :
          <b style="color: green">${normalized.y.toFixed(2)}</b> :
          <b style="color: blue" >${normalized.z.toFixed(2)}</b>
        </span>
        `;
    });

    const angles = M.computed(() => {
      const {pos} = this;
      return v3(Math.asin(pos.x), Math.asin(pos.y), Math.asin(pos.z))
    });
    const normalized = M.computed(() => {
      const anglesVal = angles.get();
      return anglesVal.scale(1 / (anglesVal.x + anglesVal.y + anglesVal.z))
    });

    const pointMaterial = createStandardMaterial("baryMat", {
    }, scene);
    M.autorun(() => pointMaterial.alpha = this.alpha);
    const point = B.MeshBuilder.CreateIcoSphere("ABC_point", {
      radius: 0.015,
    }, scene);
    point.material = pointMaterial;
    M.autorun(() => point.position = V3.Lerp(this.pos, normalized.get(), this.flatness));

    [red, green, blue].forEach((color, idx) => {
      const material = createStandardMaterial("baryMat", {
        diffuseColor: color,
        emissiveColor: color,
      }, scene);
      M.autorun(() => material.alpha = this.alpha);
      const arcSteps = 20;
      const ruler = B.CreateTube("angular_ruler", {
        updatable: true,
        path: Array.from({length: arcSteps + 1}, () => V3.ZeroReadOnly),
        radius: 0.008,
        tessellation: 6,
      }, scene);
      ruler.material = material;
      const basePoint = B.MeshBuilder.CreateIcoSphere("base" + idx, {
        radius: 0.015,
      }, scene);
      basePoint.material = pointMaterial;
      M.autorun(() => {
        const {pos} = this;
        const eps = 1e-5; // almost but not quite 0 to avoid division by 0
        const base: V3 =
          idx === 0 ? v3(0, pos.y + eps, pos.z + eps).normalize() :
          idx === 1 ? v3(pos.x + eps, 0, pos.z + eps).normalize() :
          idx === 2 ? v3(pos.x + eps, pos.y + eps, 0).normalize() :
          (() => { throw new Error("unexpected idx"); })();
        const normalizedVal = normalized.get();
        const baseFlat: V3 =
          idx === 0 ? v3(0, normalizedVal.y + normalizedVal.x / 2, normalizedVal.z + normalizedVal.x / 2) :
          idx === 1 ? v3(normalizedVal.x + normalizedVal.y / 2, 0, normalizedVal.z + normalizedVal.y / 2) :
          idx === 2 ? v3(normalizedVal.x + normalizedVal.z / 2, normalizedVal.y + normalizedVal.z / 2, 0) :
          (() => { throw new Error("unexpected idx"); })();
        const baseMix = V3.Lerp(base, baseFlat, this.flatness);
        basePoint.position = baseMix;
        B.CreateTube("ruler", {
          instance: ruler,
          path: Array.from({length: arcSteps + 1}, (_, i) => V3.Lerp(
            slerp(pos, base, i/arcSteps),
            V3.Lerp(normalizedVal, baseFlat, i/arcSteps),
            this.flatness,
          )),
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
      ` : `
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 8))};">normalize(</span>
        sin( <span style="color: yellow">x</span> · 90° ) ${ex} +
        sin( <span style="color: yellow">y</span> · 90° ) ${ey} +
        sin( <span style="color: yellow">z</span> · 90° ) ${ez}
        <span style="opacity: ${Math.max(0, Math.min(1, this.step - 8))};">)</span>
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
// const sineBased2 = T.sineBased2(n);
const asinBased = T.asinBased(n);
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

const demoExpl = new Explanation(`
  See
  <a href="https://github.com/hcschuetz/octasphere/#notes-on-the-demo">https://github.com/hcschuetz/octasphere/#notes-on-the-demo</a>
  for some explanations.
`);
demoExpl.alpha = 1;

const flatExpl = new Explanation(`
<div style="opacity: 0.6;">
  For each
  <ul style="margin: 0;">
    <li>y ≔ 0, 1/n, 2/n, ..., 1</li>
    <li>z ≔ 0, 1/n, 2/n, ..., 1 - y</li>
    <li>x ≔ 1 - y - z</li>
  </ul>
  create a vertex at:
  </div>
  y ${ey} + z ${ez} + x ${ex}
  <div style="opacity: 0.6;">
  =
  lerp( lerp( ${ex}, ${ey}, y ), lerp( ${ez}, ${ey}, y ), z / (1-y) )
  <br>
  =
  lerp( lerp( ${ex}, ${ez}, z / (1-y) ), ${ey}, y )
  </div>
`);
const geodesicExpl = new Explanation(`
  normalize( y ${ey} + z ${ez} + x ${ex} )
  <div style="opacity: 0.6;">
  =
  normalize( lerp( lerp( ${ex}, ${ey}, y ), lerp( ${ez}, ${ey}, y ), z / (1-y) ) )
  <br>
  =
  normalize( lerp( lerp( ${ex}, ${ez}, z / (1-y) ), ${ey}, y ) )
  </div>
`);
const parallelsExpl = new Explanation(`
  slerp( slerp( ${ex}, ${ez}, z / (1-y) ), ${ey}, y )
`);
const onEvenGeodesicsExpl = new Explanation(`
  slerp( slerp(${ex}, ${ey}, y ), slerp( ${ez}, ${ey}, y ), z / (1-y) )
`);
const overviewExpl = new Explanation(`
  <div style="color: red;"    >plain normalization<br>(geodesic polyhedron)</div>
  <div style="color: cyan;"   >equispaced geodesics</div>
  <div style="color: magenta;">parallels</div>
  <div style="color: yellow;" >sine-based</div>
  <div style="color: white;"  >based on angular </div>
`);
const linksExpl = new Explanation(`
  This application: <a href="https://hcschuetz.github.io/octasphere/dist/">https://hcschuetz.github.io/octasphere/dist/</a>
  <br>
  Code and documentation: <a href="https://github.com/hcschuetz/octasphere/">https://github.com/hcschuetz/octasphere/</a>
`);

const cyanMesh    = new TriangulationWithAuxLines(flatLines, flat, cyan   , 0);
const yellowMesh  = new TriangulationWithAuxLines(flatLines, flat, yellow , 0);
const magentaMesh = new TriangulationWithAuxLines(flatLines, flat, magenta, 0);
const redMesh     = new TriangulationWithAuxLines(geodesics, geodesic, red, 0);
const whiteMesh   = new TriangulationWithAuxLines(collapsedLines, evenOnEdges, B.Color3.White(), 0);
const rays = new Rays(collapsed.flat(), 0);
const baryPoints =
  [v3(1,3,2), v3(4,1,1), v3(6,0,0), v3(2,4,0), v3(1,2,3)]
  .map(p => p.scaleInPlace(n/6));
const bary = new BarycentricCoordinates(baryPoints[0], 0);
const sinesExpl = new SinesExplanation();
const angBaryPoints = baryPoints.map(p => p.normalizeToNew());
const angBary = new AngularBarycentricCoordinates();


/** Lerp between two V3[][] (of equal shape) */
const lerp2 = (lambda: number) =>
  zip(zip((from: V3, to: V3) => V3.Lerp(from, to, lambda)));


const mirrorXZ = ({x, y, z}: V3): V3 => v3(z, y, x);
const mirrorXZ2 = (pointss: V3[][]): V3[][] => map2(pointss, mirrorXZ);

const mirror = (mesh: TriangulationWithAuxLines): Motion[] => {
  let origVertices: T.Triangulation;
  let origLines: V3[][];
  let mirroredVertices: T.Triangulation;
  let mirroredLines: V3[][];
  return [
    [0, () => {
      origVertices = mesh.vertices;
      origLines = mesh.lines;
      mirroredVertices = mirrorXZ2(origVertices);
      mirroredLines = mirrorXZ2(origLines);    
    }],
    [1, (lambda: number) => {
      const lambda1 = easeInOut(lambda);
      mesh.vertices = lerp2(lambda1)(origVertices, mirroredVertices);
      mesh.lines = lerp2(lambda1)(origLines, mirroredLines);  
    }],
    [0, () => {
      // jump back to the original orientation because later motions might
      // expect this.
      mesh.vertices = origVertices;
      mesh.lines = origLines;
    }]
  ];
};

const rotate = (
  mesh: TriangulationWithAuxLines,
  mesh2: TriangulationWithAuxLines,
  mesh3: TriangulationWithAuxLines,
  rotateBack: boolean,
): Motion[][] => [[
  [0, () => {
    mesh2.vertices = mesh3.vertices = mesh.vertices;
    mesh2.lines = mesh3.lines = mesh.lines;
}],
  [1, (lambda: number) => {
    mesh2.alpha = Math.sqrt(lambda);
    rotateTo(mesh2, easeInOut(lambda));
  }]],
  [[1, (lambda: number) => {
    mesh3.alpha = Math.sqrt(lambda);
    rotateTo(mesh3, -easeInOut(lambda));
  }],
  ...rotateBack
  ? []
  : [[0, () => {
      // jump back to the original orientation because later motions might
      // expect this.
      mesh2.vertices = mesh3.vertices = mesh.vertices;
      mesh2.lines = mesh3.lines = mesh.lines;
    }] as Motion],
  ],
  ...rotateBack
  ? [[[1, lambda => {
      const lambda1 = 1 - easeInOut(lambda);
      rotateTo(mesh2, lambda1);
      rotateTo(mesh3, -lambda1);
      mesh2.alpha = mesh3.alpha = Math.sqrt(1 - lambda);    
    }] as Motion]]
  : [],
];


type Motion = [number, (current: number) => void];
const motions: Motion[][] = [
  [[.5, lambda => roundedBox.material!.alpha = lambda]],
  [[0, () => {
    magentaMesh.rotation = yellowMesh.rotation = cyanMesh.rotation = V3.ZeroReadOnly;
    magentaMesh.lines = yellowMesh.lines = cyanMesh.lines = flatLines;
    magentaMesh.vertices = yellowMesh.vertices = cyanMesh.vertices = flat;
  }],
  [0.5, lambda => {
    roundedBox.material!.alpha = 1 - lambda;
    octasphereAlpha.set(lambda);
  }]],
  [[0.5, lambda => {
    magentaMesh.alpha = lambda;
    demoExpl.alpha = 1 - lambda;
    flatExpl.alpha = lambda;
  }]],
  // ***** flat *****
  mirror(magentaMesh),
  ...rotate(magentaMesh, yellowMesh, cyanMesh, true),
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
    flatExpl.alpha = 1 - lambda;
    geodesicExpl.alpha = lambda;
  }]],
  [[.5, lambda => {
    rays.alpha = 1 - lambda;
  }]],
  // ***** geodesic *****
  mirror(magentaMesh),
  ...rotate(magentaMesh, yellowMesh, cyanMesh, true),
  // ***** geodesic => evenGeodesics *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines = lerp2(lambda1)(geodesics, evenGeodesics);
    geodesicExpl.alpha = 1 - lambda;
    onEvenGeodesicsExpl.alpha = lambda;
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.vertices = lerp2(lambda1)(geodesic, onEvenGeodesics);
  }]],
  // ***** evenGeodesics *****
  mirror(magentaMesh),
  ...rotate(magentaMesh, yellowMesh, cyanMesh, true),
  // ***** evenGeodesics => parallels *****
  [[1, lambda => {
    magentaMesh.alpha = 1;
    const lambda1 = easeInOut(lambda);
    magentaMesh.lines = lerp2(lambda1)(evenGeodesics, parallels);
    onEvenGeodesicsExpl.alpha = 1 - lambda;
    parallelsExpl.alpha = lambda;
  }]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    magentaMesh.vertices = lerp2(lambda1)(onEvenGeodesics, onParallels);
  }]],
  // ***** parallels *****
  mirror(magentaMesh),
  ...rotate(magentaMesh, yellowMesh, cyanMesh, true),
  // ***** parallels => ... *****
  [[0, () => {
    whiteMesh.vertices = evenOnEdges;
  }],
  [0.5, lambda => {
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha = 1 - lambda;
    parallelsExpl.alpha = 1 - lambda;
    whiteMesh.alpha = lambda;
  }]],
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
  // ***** sineBased *****
  mirror(whiteMesh),
  ...rotate(whiteMesh, yellowMesh, cyanMesh, false),
  // ***** barycentric coordinates *****
  [[0, () => {
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha = 0;
    cyanMesh.lines = yellowMesh.lines = magentaMesh.lines = flatLines;
    cyanMesh.vertices = yellowMesh.vertices = magentaMesh.vertices = collapsed;
    rotateTo(magentaMesh, 0);
    rotateTo(yellowMesh, 1);
    rotateTo(cyanMesh, -1);
    bary.coords = baryPoints[0];
  }],
  [.5, lambda => {
    sinesExpl.alpha = whiteMesh.alpha = 1 - lambda;
    cyanMesh.alpha = yellowMesh.alpha = magentaMesh.alpha = lambda;
  }],
  [0, () => sinesExpl.step = 0]],
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
  // ***** barycentric => angular barycentric coordinates *****
  [[0, () => angBary.pos = angBaryPoints[0]],
  [1, lambda => angBary.alpha = lambda]],
  ...angBaryPoints.slice(1).map((p, i) =>
    [[1, lambda => {
      angBary.pos = slerp(angBaryPoints[i], p, easeInOut(lambda));
    }] as Motion]
  ),
  [[1, lambda => angBary.flatness = easeInOut(lambda)]],
  [[0, () => {
    whiteMesh.lines = collapsedLines;
    whiteMesh.vertices = flat;
  }],
  [.5, lambda => whiteMesh.alpha = lambda]],
  [[1, lambda => {
    const lambda1 = easeInOut(lambda);
    angBary.flatness = 1 - lambda1;
    whiteMesh.vertices = lerp2(lambda1)(flat, asinBased);
  }]],
  [[0.5, lambda => {
    angBary.alpha = 1 - lambda;
  }]],
  // ***** asinBased (angular barycentric coordinates) *****
  mirror(whiteMesh),
  ...rotate(whiteMesh, yellowMesh, cyanMesh, false),
  // ***** overview *****
  [[0, () => {
    cyanMesh.vertices = onEvenGeodesics;
    cyanMesh.lines = evenGeodesics;
    rotateTo(cyanMesh, 0);
    magentaMesh.vertices = onParallels;
    magentaMesh.lines = parallels;
    rotateTo(magentaMesh, 0);
    yellowMesh.vertices = sineBased;
    yellowMesh.lines = collapsedLines;
    rotateTo(yellowMesh, 0);

    cyanMesh.alpha =
    magentaMesh.alpha =
    yellowMesh.alpha =
    redMesh.alpha =
    overviewExpl.alpha = 0;
  }],
  [1, lambda => {
    cyanMesh.alpha =
    magentaMesh.alpha =
    yellowMesh.alpha =
    redMesh.alpha =
    overviewExpl.alpha = lambda;
  }]],



  // TODO show sineBased2?
  // TODO show wireframes
  // TODO show polyhedra with flat faces or Phong shading

  // ***** fade out *****
  [[.5, lambda => {
    octasphereAlpha.set(1 - lambda);
    cyanMesh.alpha =
    magentaMesh.alpha =
    yellowMesh.alpha =
    redMesh.alpha =
    whiteMesh.alpha =
    overviewExpl.alpha = 1 - lambda;
    linksExpl.alpha = lambda;
  }]],
  [[1, lambda => {
    linksExpl.alpha = 1 - lambda;
    demoExpl.alpha = lambda;
  }]],
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
