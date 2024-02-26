Icosphere Sprite-Sheet Layout
=============================

Babylon's standard icosphere uses a quite complicated sprite-sheet layout,
apparently to make good use of a square sprite sheet, which was necessary at the
time.

With modern graphics hardware we can replace the irregular sprite sheet layout
with a more regular (but non-square) one.
This layout is easier to understand and more efficient to deal with.

Let us start with this well-known icosahedron net where the faces are numbered
from 0 to 19:
```
    .       .       .       .       .
   / \     / \     / \     / \     / \
  /   \   /   \   /   \   /   \   /   \
 /  0  \ /  1  \ /  2  \ /  3  \ /  4  \
X-------X-------X-------X-------X-------X
 \  5  / \  6  / \  7  / \  8  / \  9  / \
  \   /   \   /   \   /   \   /   \   /   \
   \ / 10  \ / 11  \ / 12  \ / 13  \ / 14  \
    X-------X-------X-------X-------X-------X
     \ 15  / \ 16  / \ 17  / \ 18  / \ 19  /
      \   /   \   /   \   /   \   /   \   /
       \ /     \ /     \ /     \ /     \ /
        '       '       '       '       '
```
- The top vertices of faces 0 to 4 are mapped to the same icosahedron vertex,
  which we will call the "north pole".
- Similarly the bottom vertices of faces 15 to 19 are mapped to the
  "south pole".
- Faces 5 and 14 are adjacent on the icosahedron.

Now we modify the net:
- Cut off the right halves of faces 14 and 19 and
  move this part to the left so that the right boundary of face 14 coincides
  with the left boundary of face 5.
- Then cut off faces 15 to 19 and
  move them up so that they fit around and between faces 0 to 4,
  leaving a small vertical gap `dv` to avoid interferences between unrelated
  parts of the icosahedron/sphere surface.

This leads to the following sprite sheet 
```
1           -- |---X-------X-------X-------X-------X---|
1   - dv    -- |19/.\ 15  /.\ 16  /.\ 17  /.\ 18  /.\19|           upper
               | // \\   // \\   // \\   // \\   // \\ |   polar
               |//   \\ //   \\ //   \\ //   \\ //   \\|           lower
1/2 + dv/2  -- '/  0  \'/  1  \'/  2  \'/  3  \'/  4  \'
1/2 - dv/2  -- X-------X-------X-------X-------X-------X
               |\  5  / \  6  / \  7  / \  8  / \  9  /|           upper
               | \   /   \   /   \   /   \   /   \   / |   equatorial
               |14\ / 10  \ / 11  \ / 12  \ / 13  \ /14|           lower
0           -- |---X-------X-------X-------X-------X---|

^         u    |   |   |   |   |   |   |   |   |   |   |
|v       ---> 0.0 0.1 0.2 0.3 0.4 0.5 0.6 0.7 0.8 0.9 1.0

                 l   r   l   r   l   r   l   r   l   r     (left/right)
```
where `uv` coordinates have already been assigned.
(The distinctions between polar/equatorial, upper/lower, and left/right
regions will be used in the code below.)
This way the entire rectangle can be used for texture data
except for the small "safety gap".

The width/height ratio of the texture should be chosen in such a way that the
triangles are roughly equilateral:

    width / height ≈ 5 * (1 - dv) / sqrt(3)

With, say, `dv = 0.01` we get

    width / height ≈ 20 / 7


Texture Transformation
----------------------

The shader code in [src/icosprite.ts](src/icosprite.ts) is used to convert
an equirectangular texture to a sprite sheet usable by an octasphere.

Conventions:
- We use Babylon's left-handed xyz coordinates.
- We deal with the unit sphere centered at the origin of the coordinate
  system.
- In names and comments we consider the y axis pointing northward.
  Thus `(0, 1, 0)` and `(0, -1, 0)` are the north pole and the south pole of
  the sphere and the x/z plane is the equatorial plane.
- First we map the sphere by a central (more precisely: gnomonic) projection
  to the faces of an inscribed regular icosahedron with this orientation:
  - The icosahedron's north pole (adjacent to faces 0 to 4)
    coincides with the sphere's north pole at `(0, 1, 0)`.
  - Furthermore the vertex adjacent to faces 0, 5, 14, 9, and 4 is in the
    `x/y` plane with positive `x` value.
    (Thus it has coordinates `(2 * sqrt(1 / 5), sqrt(1 / 5), 0)`.)
  - This also determines the positions of all the other vertices.
