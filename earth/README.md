Sphere Texturing
================

The web application https://hcschuetz.github.io/octasphere/earth/dist/
investigates the mapping of a texture to an octasphere and, for comparison,
an icosphere and a latitude/longitude sphere.


Input Data
----------

We start with an Earth map (or a map of another sphere) using
equirectangular projection.
That is,
meridians are mapped to equidistant vertical lines and
parallels are mapped to equidistant horizontal lines.
The map is expected to cover the entire sphere
vertically 180° from pole to pole and
horizontally 360° around the sphere.
Frequently also the scales in the north/south and east/west directions agree
at the equator, but we do not depend on this condition as textures are anyway
accessed with `uv` coordinates normalized to the range `[0..1]x[0..1]`.

We start with this projection because it is used by various maps on the web,
in particular at [Nasa Earth Observations](https://neo.gsfc.nasa.gov/)
and in the [Wikipedia Commons](https://commons.wikimedia.org/w/index.php?search=equirectangular+projection&title=Special:MediaSearch&go=Go&type=image).

You can select an example map in the menu or enter the URL of an image file
in the text-input field.

Notice that the image resource
- must have one of the image types supported by BabylonJS textures
  (JPEG, PNG, maybe others) and
- must be CORS-enabled so that the application may retrieve it.


Longitude/Latitude Spheres
--------------------------

A simple and common way to approximate a sphere by a polyhedron
is essentially a discretization of the equirectangular projection.
We select a sequence of equidistant meridians and a sequence of equidistant
parallels on the sphere.  Each intersection between a meridian and a parallel
becomes a vertex of the polyhedron.  The intersections of the +/-90° lateral
with the meridians all coincide with the north pole or the south pole,
respectively, but we treat them as separate vertices.

Vertices are connected by straight lines with their east/west/north/south
neighbors, giving a grid of quadrilaterals.  Each of the quadrilaterals is
divided along one of its diagonals to produce a triangulation.

A straight-forward texture mapping simply assigns `uv` coordinates from the
equirectangular map to the vertices and leaves it to the graphics engine
to interpolate `uv` coordinates linearly within a triangular face.

With finer and finer grids this converges to a correct mapping.
But for a finite grid there are distortions.

For example, a segment of a parallel between two neighboring grid points
is drawn as a straight line.
Thus an object on the middle of the segment
is drawn closer to the north or south pole than it should.

Another problem shows up between a pole and its closest parallel.
Grid quadrilaterals in that region degenerate to triangles.
When such a quadrilateral is split diagonally into two triangles,
one of them degenerates to a line.
The corresponding area on the equirectangular map will not be drawn at all.

Distortions are strongest near the poles,
which is generally good for Earth maps
since the polar regions of the Earth are sparsely inhabited.

The core reason for these relatively strong distortions is the fact that the
equirectangular projection is not linear
and it cannot even be approximated well by a linear projection near the poles.

In the application use the triangulation method "[babylon] sphere" to select
a longitude/latitude sphere provided by Babylon.js.


Octaspheres
-----------

Another way of approximating a sphere by a polyhedron is an "octasphere".
It can be created like this:
- Divide the sphere at the equator and at the meridians for longitudes
  180°, 90° West, 0°, and 90° East.
  This gives 8 spherical triangles, which correspond to the 8 faces of an
  octahedron inscribed in the sphere.
- Subdivide each spherical triangle into smaller triangles with vertices
  on the sphere.

Various such subdivisions have been investigated in a
[sibling project](../lab/).
In the current application the triangulation methods from "geodesics"
onward produce octaspheres.

Again we could use an equirectangular map directly:
To each vertex assign the `uv` coordinates of the corresponding point on the map
and let the graphics engine interpolate linearly inside each triangle.
(For the poles the `u` coordinate is actually undefined.
One could, for example, use the middle of the range corresponding to the
respective spherical triangle.)
This approach leads to distortions which are even worse than in the
longitude/latitude case around the poles.

A better approach works like this:
- For each of the 8 spherical triangles create a map by applying a central
  (more precisely: gnomonic) projection to the corresponding octahedron face.
- Create an atlas containing these 8 maps.
  Let's call such an atlas an "octahedral atlas".
  Such an atlas can be stored as a sprite-sheet texture.
- Assign `uv` coordinates from the atlas to the vertices.
  (Vertices at the boundaries of our 8 spherical triangles must be replicated
  so that they can get separate `uv` coordinates for the different maps
  they occur in.)
  Again let the graphics engine perform linear `uv` interpolation within
  the sub-triangles.

This draws a far more precise surface than the approaches
using an equirectangular map.
This is due to the fact that
the linear `uv` interpolation performed by the graphics engine
is now correct:
Each point on the polyhedron surface now gets its color
from the nearest point on the sphere.

Unfortunately I have not found an octahedral atlas on the web.
So I have implemented a [conversion](src/OctaSprite.ts)
from an equirectangular map to an octahedral atlas.

Notice that the same octahedral atlas can be used for any of our octasphere
triangulations.
This is particularly comfortable
if we want to work with different triangulations.

OTOH, if we have decided on a particular triangulation,
we could even use an atlas with separate maps per sub-triangle.
This has the following advantages:
- The mapping from the atlas to the face can be simpler.
- The map resolution can be more uniform across the sub-triangles.

However, such refined atlases have not been implemented in this project.
And they might not be worth the effort.


Icospheres
----------

All the considerations about octaspheres can be carried over to icospheres.

But our icosphere code differs from the octasphere code in several aspects:
- Instead of implementing our own icosphere,
  we use the implementation provided by Babylon.js.
  (In the application select triangulation method "[babylon] icosphere".)

- That implementation does not support multiple sub-triangulation methods
  for the icosahedron faces.  The only supported sub-triangulation is
  analogous to the "geodesics" subtriangulation for octaspheres.

- Our octahedral atlas has a quite regular layout, which makes it easy to
  find the appropriate map (= sprite) for a given `uv` coordinate pair.

  In contrast, the [atlas for Babylon.js' icosphere
  ](https://github.com/BabylonJS/Babylon.js/blob/v4.0.0/src/Meshes/Builders/icoSphereBuilder.ts#L88)
  has a special irregular layout.
  It was probably manually designed to fit into a square
  at a time when only square textures were supported by graphics hardware.
  Our [shader code](src/IcoSprite.ts) mapping `uv` coordinates to the
  longitude/latitude coordinates of an equirectangular map
  searches through the maps/sprites for the appropriate one.


With modern graphics hardware we could replace the irregular
atlas/sprite sheet layout for icospheres with a regular (but non-square) one.
This layout would be easier to understand and easier to deal with.

Assign `uv` coordinates to the common icosahedron net like this
```
1.5 * (1 - dv) ---       .       .       .       .       .
                        / \     / \     / \     / \     / \
                       /   \   /   \   /   \   /   \   /   \
                      /  0  \ /  1  \ /  2  \ /  3  \ /  4  \
1.0 * (1 - dv) ---   <-------X-------X-------X-------X-------X
                      \  5  / \  6  / \  7  / \  8  / \  9  / \
                       \   /   \   /   \   /   \   /   \   /   \
                        \ / 10  \ / 11  \ / 12  \ / 13  \ / 14  \
0.5 * (1 - dv) ---       X-------X-------X-------X-------X------->
                          \ 15  / \ 16  / \ 17  / \ 18  / \ 19  /
                           \   /   \   /   \   /   \   /   \   /
                            \ /     \ /     \ /     \ /     \ / 
0.0 * (1 - dv) ---           V       V       V       V       V
 
                     |   |   |   |   |   |   |   |   |   |   |   |
                    0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0 1.1
```
with wrapping enabled for both the `u` and `v` coordinate.

Notice that the wrapped regions with `u >= 1` or `v >= 1` fit in the
unused spaces on the other side of the texture.
In the `v` direction there is some "safety distance" `dv`
so that triangles 0 to 4 will not interfere
with triangles 15 to 19 due to rounding/interpolation.
No safety distance is needed in the `u` direction
since triangles 14 and 5 are adjacent on the icosahedron.

This way the entire rectangle is used for map data
except for the small safety gap.
The width/height ratio of the texture should be chosen in such a way that the
triangles are approximately equilateral.


More Notes on the Application
-----------------------------

The number of steps that you can select has a different meaning depending
on the kind of sphere:
- In Babylon's lon/lat sphere a meridian from the north pole to the south pole
  is divided in `#steps + 2` segments.  (No idea where the "2" comes from.)
  The parallels are divided in twice as many segments.
  This gives `2 * (#steps + 2)^2` quadrilaterals and therefore
  `4 * (#steps + 2)^2` triangles (including the degenerate triangles around
  the poles).

- Each octahedron face is divided into `#steps^2` triangles.
  Thus an octasphere consists of `8 * #steps^2` triangles.

- Similarly an icosphere consists of `20 * #steps^2` triangles.

The number of triangles is also displayed.
Take it into account in order to avoid unfair comparisons.

Choices in the "display mode" menu:
- "wireframe" should be self-explanatory.

- "smooth" uses Phong shading (interpolation of normals across a face
  making the surface reflect light in a continuously changing direction),
  whereas

- "polyhedron" uses constant normals, revealing the polyhedron faces
  provided the material has some specular reflectivity
  and there is appropriate lighting.

Two triangulation methods have not yet been mentioned:
- "flat" places vertices on the octahedron face rather than the sphere.
- "sines" is an intermediate (non-spherical) placement.
  It is explained together with the other octahedral triangulations
  in the [outer README](../?tab=readme-ov-file#sine-based-mapping).


Conclusion and Outlook
----------------------

The transformation from the equirectangular map to the octahedral or
icosahedral atlas reduces the quality of the map,
making the sphere surface look a bit blurry.
(It is probably possible to improve my transformation code,
but a transformed map will always be somewhat worse than the original one.)

In contrast, the longitude/latitude sphere using the equirectangular map
directly looks crisper.
This crispness and also the simplicity of the lon/lat sphere
must be weighed against the stronger map distortion.

The ideal case would be to have the raw data (such as the
[Nasa Earth Observations](https://neo.gsfc.nasa.gov/)) available as an
octahedral or icosahedral atlas, which would avoid the texture deterioration
imposed by the additional mapping step via the lon/lat map.
