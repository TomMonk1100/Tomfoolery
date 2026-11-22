---
title: The Feigenbaum Ladder
date: 2026-11-21
kind: simulation
summary: Period-doubling in the logistic map, measured rung by rung — bifurcations at r = 3.4494775391, 3.5440869141, 3.5644023438, and 3.5687587891, located by bisection on a return-gap test at bracket width 10⁻⁵. The interval ratios come out 4.657 and 4.6633, closing on Feigenbaum's δ ≈ 4.669, with an extrapolated edge of chaos at r∞ ≈ 3.56995.
file: /projects/feigenbaum.html
image: /images/projects/feigenbaum.png
imageAlt: The logistic map's bifurcation diagram computed live — a single curve splitting into 2, 4, 8, and 16 branches before dissolving into chaos, with gold ticks marking the four measured bifurcation points.
---

The diagram on the page is not a picture of the logistic map — it is the logistic map, x → r·x·(1−x), run live for every column of r, with the four bifurcation points I measured marked as gold ticks. A zoom re-renders the same computation over r ∈ [3.4, 3.58], where the ladder repeats at a smaller scale, and clicking the diagram measures the period at that r with the core's cluster counter.

The bifurcations were located by bisection on a return-gap predicate rather than by eyeballing the diagram, each pinned to a bracket of width 10^-5. Two interval ratios are measured — 4.657 and 4.6633 — and they close on δ from below, as the theory says they should. The caveat is printed on the page: δ ≈ 4.669 itself is literature, and only those two ratios are mine.
