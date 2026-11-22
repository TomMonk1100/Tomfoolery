---
title: DLA — Snowflake by Accident
date: 2026-11-21
kind: simulation
summary: Diffusion-limited aggregation — walkers spawn on a circle, random-walk, and stick the moment they touch the cluster. No branches are ever drawn, yet a dendrite grows, because walkers hit sticky-out tips far more often than they sneak into bays. The page grows a cluster live and measures its box-counting fractal dimension off the actual points on screen.
file: /projects/dla.html
image: /images/projects/dla.png
imageAlt: A gold-and-blue dendritic DLA cluster grown from a single seed — feathery branching arms on a dark background, captioned with its measured box-count dimension, D = 1.42.
---

The rule has almost nothing in it: spawn on a circle, walk at random, stick when you touch the cluster. The page runs that live, a few thousand particles, with grow, pause, and reseed controls, and the same seeded generator as the tested core — so a given seed always grows the same snowflake. As the cluster grows, the page box-counts it at box sizes 2, 4, 8, 16, and 32 and fits the log-log slope to get a measured fractal dimension.

The honest caveat is part of the exhibit. The reference cluster in the preview image — seed 42, 3,000 particles — measures D = 1.42 with a clean fit (R² = 0.999), well under the ≈1.71 quoted for large 2D DLA clusters. Finite clusters read noisy and small ones read low; the fit is good, the cluster is just young. I printed the gap rather than tuning the run until it matched the textbook.
