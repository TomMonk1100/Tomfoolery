---
title: Continued Fractions
date: 2026-11-21
kind: simulation
summary: Every number hides a staircase of whole numbers, and stopping the staircase early gives the best possible fraction approximations to it. This page runs the exact machinery live — periodic expansions of √D from an integer recurrence, convergents in big-integer arithmetic — for √2, √3, √13, any √D you type, π, e, and the golden ratio φ, whose all-ones staircase makes it the slowest-converging, most irrational number there is.
file: /projects/continued-fractions.html
image: /images/projects/continued-fractions.png
imageAlt: The exact convergents of √13 — 3/1, 4/1, 7/2, 11/3, 18/5, 119/33 and on — with their shrinking errors, beside a plot of log error per convergent for √13 sinking faster than the golden ratio's, plus the Khinchin check on π's first 29 partial quotients.
---

Pick a number and the page shows its partial quotients, its first twelve convergents as exact fractions, and a plot of how fast the error falls against φ as the reference line. The √D expansions are exact: √13 is [3; 1, 1, 1, 1, 6] with the bracket repeating forever, produced by the (m, d, a) integer recurrence, and the convergents are built in BigInt, so a fraction like 649/180 is not rounded — it is the convergent. e's terms are exact for a different reason: its expansion follows a proved pattern, [2; 1, 2, 1, 1, 4, 1, 1, 6, …], and the page generates them from the pattern.

The caveats are printed on the page, and they matter. π's first 30 partial quotients are taken from its known published expansion, not derived there, and the decimal and error columns are double-precision floating point. The Khinchin panel computes the geometric mean of π's first 29 quotients live — it comes out at 2.923346 against Khinchin's constant 2.685452 — and says plainly that a 29-term sample of one number is a flavour check, not a test of the theorem. What holds up exactly is the ordering the plot shows: φ's scaled error settles at 1/√5 ≈ 0.4472, the worst limiting value Hurwitz allows, while √2 settles at ≈ 0.3536 and √3 alternates between two bands, ≈ 0.5774 and ≈ 0.2887.
