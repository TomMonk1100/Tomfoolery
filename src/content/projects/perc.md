---
title: Percolation
date: 2026-11-02
kind: simulation
summary: Site percolation on a square lattice — cells fill at probability p, and the question is whether one cluster spans top to bottom. The sweep measured the transition sharpening with lattice size while the threshold sits at the literature value, p_c ≈ 0.593.
file: /projects/perc.html
image: /images/projects/perc.png
imageAlt: A dark lattice of blue-grey filled cells with one gold cluster spanning from the top row to the bottom.
---

Each cell of a square lattice is filled with probability p. Clusters are filled cells joined by edges, and the lattice percolates when one cluster touches both the top and bottom rows — drawn in gold on the page. Nothing is hand-placed; the spanning cluster either emerges or it doesn't. Drag p and press New lattice until a gold cluster touches both the top and bottom edges, then notice how suddenly it arrives. The lattice is held while p changes — only New lattice rolls a new one — and a size control offers exactly the three measured sizes, N = 20, 40 and 80.

The sweep behind the page tested two claims separately. The transition does sharpen with size — the p25–p75 width narrows from 0.0667 to 0.0422 between N=20 and N=80. The threshold's location, though, is already at the literature value within noise at every size, and the test honestly cannot resolve movement smaller than its own error bars. Both readings are printed on the page, including the one that came back null.
