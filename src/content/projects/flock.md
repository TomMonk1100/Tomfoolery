---
title: The Flock Flip
date: 2026-11-16
kind: simulation
summary: Three hundred Vicsek agents steer toward the average heading of their neighbours while noise shoves every heading around — drag the noise dial and one flock assembles out of the milling, or melts. The flip sits at η_c = 1.648 at N=300, steep but smeared — parked at the flip for 2,000 steps, the order parameter wanders from 0.073 to 0.783, so whether the transition is truly continuous or weakly first-order cannot be settled at this size, and the page says so.
file: /projects/flock.html
image: /images/projects/flock.png
imageAlt: The top of a dark project page — a plain-language panel, the title "the flock flip", and the noise dial set to eta = 0.80, below the measured flip at 1.648.
---

The rule set fits in one breath: each agent flies at constant speed, steers toward the mean heading of the neighbours within radius 1, then takes a random shove drawn from a window of width η. The order parameter φ is 0 when headings cancel and 1 when all 300 point the same way, and colour on the canvas is heading — so order is visible: a milling rainbow, or one colour flowing. The live demo runs the same N = 300 the sweep measured, not a smaller illustration size.

The sweep put the φ = 0.5 crossing at η_c = 1.648, interpolated between measured points. What it did not find is a cliff: the descent runs over a broad shoulder, the seed spread peaks right at the flip, and a formed flock is somewhat harder to melt than an unformed one is to assemble — at η = 2.0 an aligned start holds φ = 0.383 against a scattered start's 0.285. [Fireflies](/projects/fireflies.html) synchronised in time; this is the same question asked in direction, and its honest answer is a flip that exists but refuses to be sharp at this size.
