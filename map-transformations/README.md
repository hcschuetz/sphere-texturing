Map Transformations
===================

[This web application](https://hcschuetz.github.io/octasphere/map-transformations/dist/)
shows different ways of projecting a sphere to a flat map.

(See [here](https://en.wikipedia.org/wiki/File:Blue_Marble_Next_Generation_%2B_topography_%2B_bathymetry.jpg)
for map origin (NASA) and copyright information (public domain).)


Latitude/Longitude Mapping
--------------------------

In the control GUI you can move the handle upward from the "sphere" position
to stretch the meridians and/or the parallels of the sphere.
Stretching both leads to an equirectangular map.

Distances along the equator and along any meridian are preserved.
Meridians and parallels intersect with right angles.
Thus the map is not distorted at the equator.
But it gets more and more distorted as one moves away from the equator.
It is heavily distorted around the poles.

Both the map texture and the grid mesh for latitude/longitude spheres waste
computational resources (pixels and vertices) near the poles.


Icosahedral Mapping
-------------------

Moving the handle downward from the "sphere" position transforms the sphere in
three steps:
- First the map is shrunk to an icosahedron inscribed in the sphere.
  This distorts the map, but far less than the latitude/longitude mapping above.
- Then the icosahedron is unfolded to a flat net.
- Finaly the triangles adjacent to the south pole are moved upward
  to the gaps between the northern triangles.
  This gives a rectangular sprite map for the icosphere.

Notice that this is not the icosphere provided by Babylon.js.
The sprite-sheet layout for that icosphere is more complex and wastes some area.
But it fits in a square, which is needed by older graphics hardware.
In contrast, our non-square sprite map is more regular and wastes almost no area.


Technical Notes
---------------

### IcoSprite Generation

Maps on the web are frequently published in equirectangular form.
So for icospheres we need a map transformation from equirectangular layout
to the icosphere spritesheet.

Intuitively, the transformation corresponds to a traversal of our GUI
from the top to the bottom.
But the implementation actually works the other way round:

> For each texel position in the icosphere spritesheet:
> - Figure out to which icosahedron face it belongs.
>   (This step is actually most of the code.)
> - Find the corresponding place on the icosahedron face.
> - Project that place to the sphere.
> - Get longitude and latitude.
> - Look up the corresponding texel on the equirectangular map.

### Notes on Babylon.js

- The IcoSprite has been implemented as a ProceduralTexture,
  which allows the texture transformation to be implemented efficiently
  as a WebGL fragment shader.
- Both the transitions between sphere and equirectangular map and
  between sphere and icosahedron have been implemented with subclasses of
  CustomMaterial, which allows to just inject some code snippets into
  Babylon's shader code.
  (See
  [this topic](https://forum.babylonjs.com/t/how-to-do-lighting-with-shadermaterial/48538)
  in the Babylon forum for different approaches.)
- The transition from the icosphere to the icosphere net and from there
  to the sprite sheet are implemented in JS (actually TypeScript).
  There is no need for doing this in shader code as we only deal with the
  icosahedron faces without any subdivisions.
