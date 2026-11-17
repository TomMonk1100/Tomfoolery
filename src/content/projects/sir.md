---
title: The One Threshold
date: 2026-11-16
kind: simulation
summary: An SIR outbreak on a 60×60 grid, where an infected cell can only reach its four neighbours. Well-mixed theory puts the epidemic threshold at R₀ = 1; the grid's takeoff actually crosses at R₀ ≈ 1.70 and climbs with grid size toward the percolation prediction of 2. At R₀ = 1.4 the formula promises half the grid burns — the grid measured 0.0122. Above the line the sign flips — at R₀ = 3.0 the grid sweeps cleaner than mixing does.
file: /projects/sir.html
image: /images/projects/sir.png
imageAlt: The top of a dark project page — a plain-language panel, the title "the one threshold", and a grid outbreak mid-wave, a pink infection front moving through slate recovered cells.
---

Each cell is susceptible, infected, or recovered. An infected cell tries to pass it to each of its four neighbours for exactly four steps, then recovers immune. The dial is R₀ — the expected number of new cases one case makes in a fully susceptible grid — and the core derives the per-contact probability from it exactly; nothing else is tuned. Run the slider below 1 and the spark dies in a corner; run it high and a pink front crosses the grid leaving slate ash.

The finding is the disagreement. Local saturation starves the wave near the line: a case keeps wasting attempts on neighbours already infected or already recovered, so at R₀ = 1.4 — where the well-mixed final-size formula promises 0.5110 of the population — the grid reached 0.0122, with a 2% takeoff rate. The takeoff crossing climbs with size, below 1.6 at 30×30, 1.73 at 60×60, 1.88 at 120×120, walking toward 2 — exactly where it must land, because a lattice outbreak's final size is a [percolation](/projects/perc.html) cluster, and square-lattice bond percolation turns on at transmissibility 1/2. Two thresholds, both honestly labelled, and the space between them is the piece.
