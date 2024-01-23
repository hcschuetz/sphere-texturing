Notes on the Demo
=================

[The demo](https://hcschuetz.github.io/octasphere/dist/presentation/) illustrates the
octasphere-related considerations below.

Hints:
- Click the step button to proceed and use the slider to set your preferred
  animation speed.
- Drag the sphere to turn it around so that you can see things from different
  angles.
- Add a query parameter "`start`" to the URL if you want to start at
  a particular step.
- Add a query parameter "`n`" to the URL to set the subdivision
  granularity.  The default value is 6 and some parts of the demo
  were actually written with that value in mind.
- A query parameter "`rbt`" can be used to select the triangulation function
  for the rounded box.  Supported values:
  "`flat`",
  "`sines`",
  "`geodesics`",
  "`evenGeodesics`",
  "`parallels`",
  "`sineBased`",
  "`sineBased2`",
  "`asinBased`",
  "`balanced`".

So https://hcschuetz.github.io/octasphere/dist/presentation/?start=2&n=10&rbt=sineBased
displays step 2 with subdivision granularity 10 and triangulation function `sineBased`.


Notes on the Triangulation of an Octasphere
===========================================

...can be found in the <a href="../README.md">README in the parent directory</a>.
