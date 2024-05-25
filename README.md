<div style="border: 5px solid red; padding: 0 1ex;">

On this Branch
--------------

This branch (`rotating-base-texture`) is an experiment exploring what
sphere texturing would look like with different main meridians
(or the "cutting" meridians corresponding to
the left/right borders of the equirectangular map).

It works but it's slow.
- Smoothly re-creating textures while sliding the input knob might be too
  inefficient.  (We even create the textures that are currently unused!)
- I think I'm properly disposing of outdated textures, but there might still be
  a leak.  (Things get slower after using the UI for a while.)
- Instead of "materializing" multiple transformed map versions as textures
  we could just use fragment shaders that look up colors in the (unrotated)
  equirectangular base texture.
  This would make more sense in this branch
  (it would not just be faster,
  
  but also more accurate due to fewer interpolation steps),
  but in the main branch I wanted to show how polyhedron-based textures
  can be created and used.

</div>

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

See the README files of the subprojects for more details.


Relation to Paper Maps
----------------------

Projections from a sphere to a plane
are not only needed for textures in computer graphics,
but also for traditional paper maps of the Earth.
There are several desirable properties of such a projection such as
the accurate representation of distances, areas, angles and compass directions.
It is not possible to achieve all these goals in a single projection.
Thus over the centuries many different projections have been developed,
each based on some choice or compromise between the goals according to some use case.
(And actually the simplicity of a mapping is another aspect that might
be considered in the trade-off.)

From the vast amount of resources discussing sphere-to-plane projections
here are just a few:
- A nice [overview video](https://www.youtube.com/watch?v=bpp0xCknQAQ)
  on map projections with some math background.

- [Gene Keyes' discussion of map projections](https://www.genekeyes.com/FULLER/BF-1-intro.html)
  is interesting here for two reasons:
  - It discusses projections based on an octahedron and an icosahedron.
    (See appendix 2 of [part 2](https://www.genekeyes.com/FULLER/BF-2-1943.html)
    for an icosahedral map similar to ours.)
  - It deals with paper maps that are actually folded to 3D objects.

- [This video](https://www.youtube.com/watch?v=vfOcYUWfVqE) (mentioned by Keyes)
  shows a map unfolding somewhat similar to ours.

Notice the following differences between mappings to paper and mappings to a texture:

- In contrast to paper maps,
  textures should be easily applicable to a triangulated sphere.

- For projections between a sphere and a texture
  it is a bit less important to minimize various kinds of distortions
  if the distortions introduced by the projection
  will be reversed when the texture is applied to a sphere.
  But while the user will not see a distorted surface,
  mapping distortions will cause the available level of detail to vary across the sphere.
  And typically we want to limit this variation.

- Maps try to be contiguous (at least on the continents) so that nearby points
  on the earth will also be nearby on the map.
  For textures this is not important,
  provided we have a good "sewing" mechanism.
  This allows us to use more cuts in the mapping to improve other aspects
  such as reducing distortion and arranging the map in a memory-efficient way.

Thus the trade-offs differ between paper maps and textures and may lead
to different solutions.
For example in our octahedral and icosahedral projections we save memory
by moving triangles from the south-pole region to the gaps between
triangles in the north-pole region.
Such a representation would be confusing on a map directly viewed by a user.
