---
title: Measuring β — the 3D Ising Retest
date: 2026-11-21
kind: simulation
summary: A sealed-prediction measurement of the 3D Ising critical exponent β. Four predictions were filed before any production run — Tc in [4.505, 4.518], corrected β in [0.30, 0.35] at both lattice sizes, the plain fit under 0.30, and a boundary-accounting bound — and all four hit. The page refits the measured points live as you drag Tc, so you can watch the plain fit's 0.241 and the corrected fit's 0.3495 come out of the same data.
file: /projects/ising-beta.html
image: /images/projects/ising-beta.png
imageAlt: Measured magnetisation points for two lattice sizes with a green corrected power-law fit threading them, titled "measuring β — the 3d ising retest".
---

Just below its critical temperature, a magnet's strength grows as M ~ t^β, and β is universal — the same for every magnet. Measuring it on a finite lattice is a trap: the lattice rounds the corner near Tc, the rounding bends the curve, and a plain power-law fit reads the bend as a smaller exponent. It returns β = 0.241, confidently wrong. The correction term the theory prescribes, fitted to the same points, returns 0.3495 at L=32 and 0.3478 at L=24.

The retest was run prediction-first: four claims sealed in a dated file, then 96 Wolff-cluster runs across two lattice sizes, then a verdict scored against the seal exactly as written. All four hit. The page is honest about the edges — shift Tc up by one standard error and the L=32 value steps just outside the sealed window, and the corrected fits still carry a registered misfit. The fitter on the page is the real weighted least squares, run live on the measured points, so the numbers move because the fit moves, not because the text says so.
