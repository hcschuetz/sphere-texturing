The "Octasphere Lab"
====================

The web application https://hcschuetz.github.io/octasphere/dist/lab/
is a tool to investigate properties of various triangulations
of an "eighth of a sphere", that is, of the spherical triangle corresponding
to one face of an inscribed octahedron.

- In the top left of the page you can set various parameters:
  - The number of steps used by the triangulation in each direction.
  - The triangulation method.
    See [the README of the parent folder](../README.md) for an introduction
    to various methods.
  - A parameter "adjacent shape" for computing dihedral angles
    along the border of the rendered spherical triangle.
    See below for details.
  - The remaining parameters should be self-explanatory.

- The bottom left of the page provides some statistics about the triangulation,
  primarily about edge lengths.
  There is also information about dihedral angles.  (See below.)
- The display on the right can be rotated, zoomed, and moved with the mouse or
  another pointing device.
- Some extra output is available in the browser console.


Bends and Dihedral Angles
-------------------------

One desirable property of a triangulation is that it has as uniform
edge lengths as possible.  Therefore we display various statistic parameters.

Another desirable property is that the surface is bent as little as possible
across an edge from one face to the next.
More formally this "bend" is the angle between the face normals.
It can also be defined as 180° minus the dihedral angle between the faces.
For our purposes it is more practical to work with the bends than with
the dihedral angles.

The largest bend is displayed and the corresponding edges are highlighted.

We also compute bends along the border of the spherical triangle.
For this we must make an assumption how the surface continues.
- If the spherical triangle is the corner of a rounded box,
  then the adjacent shapes are the quarter-cylinders for the box edges.
- The spherical triangle may also be part of a full sphere.
  In that case the surface is continued with mirrored (or rotated)
  copies of the spherical triangle.

You can select one of these assumptions in the "adjacent shape" menu.

Notice that he bends with an assumed cylindrical continuation are half the size
of the corresponding bends with an assumed spherical continuation.
