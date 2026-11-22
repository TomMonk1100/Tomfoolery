---
title: Lights Out
date: 2026-11-21
kind: toy
summary: A playable Lights Out — press a cell and it toggles itself and its four neighbours — backed by an exact GF(2) solver, not a hint engine. The solver knows before you start whether your board can be cleared at all — on 5×5 only one board in four can (rank 23, nullity 2), on 4×4 only one in sixteen, and on 3×3 every board can. New boards are dealt guaranteed-solvable, the solve button plays one of the exactly 2^nullity solutions, and an unsolvable board gets told so, plainly.
file: /projects/lights-out.html
image: /images/projects/lights-out.png
imageAlt: A real 5×5 Lights Out board from the seeded sweep beside its 13-press solution pattern, with the computed 5×5 facts — rank 23, nullity 2, one quarter of all boards solvable, four solutions each.
---

The game is the familiar one — turn every light off, where each press flips a plus-shape — but everything under it is exact linear algebra over GF(2), ported from a tested core. Solving is Gaussian elimination on the press matrix, so the answers are never approximate: the facts table (3×3 rank 9, nullity 0; 4×4 rank 12, nullity 4; 5×5 rank 23, nullity 2) is computed by the same code the game runs, and the sweep behind it sampled 4,000 random boards per size and matched the algebra, 5×5 landing on exactly 1,000 of 4,000 solvable.

The honest parts are built in as features. "New board" applies random presses to the dark board, so every dealt game is solvable by construction. "Am I stuck?" runs the solver and answers straight — including the plain verdict that a board is unsolvable, which you can produce yourself by lighting a single corner on 5×5. And the page shows the quiet patterns, press patterns from the kernel that change nothing at all: they are why some boards are impossible, and pressing one on your own board, live, changes byte-for-byte nothing.
