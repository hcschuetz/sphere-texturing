Sub-Projects
------------

Sub-projects in this repository:
- Experiments with texture mappings
  ([source](./earth/), [web app](https://hcschuetz.github.io/sphere-texturing/earth/dist/))
- A presentation on map/texture transformations
  ([source](./map-transformations/),
  [web app](https://hcschuetz.github.io/sphere-texturing/map-transformations/dist/))


Texture Layouts For Spheres
===========================


The most common way to render a sphere is based on the latitude/longitude grid
as it is used for the earth:
Select two opposite points on the sphere as the "poles",
a bunch of equidistant "meridians", and a bunch of equidistant "parallels".
Introduce a vertex at each intersection of a meridian and a parallel
and connect neighboring vertices.
This divides the sphere into a set of quadrangles.
Dividing each quadrangle along one of its diagonals
gives a triangulation of the sphere.

The natural texture for such a "lat/long sphere" is a map with a
[equirectangular projection](https://en.wikipedia.org/wiki/Equirectangular_projection).
This is easy to implement and good enough for many applications.
But while the distance between meridians gets smaller and smaller near the poles
on the sphere,
the meridians have a constant distance on the map.
This leads to some drawbacks:
- Equirectangular maps are heavily distorted.
- Texture memory is wasted.
- Half of the triangles around the poles are degenerated on the sphere
  and thus the corresponding parts of the texture/map are not rendered.

To avoid these drawbacks
this project investigates texture mappings based on octaspheres and icospheres.
