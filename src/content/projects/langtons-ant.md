---
title: Langton's Ant
date: 2026-11-15
kind: simulation
summary: One ant, one flip-and-turn rule, ten thousand steps of chaos — then a period-104 highway to infinity. Measured rather than assumed — the colour sequence locks at step 9,977, the geometry follows at 10,525, and the stricter claim that failed its test is printed on the page.
file: /projects/langtons-ant.html
image: /images/projects/langtons-ant.png
imageAlt: A black-and-white cell pattern on cream — a tangled blob resolving into a clean diagonal banded trail, with one small red ant at its head.
---

On a white cell the ant turns right, flips the cell black, and steps forward. On a black cell it turns left, flips the cell white, and steps forward. That is the entire rule set — and for roughly ten thousand steps it produces only a tangled, patternless blob. Then the ant falls into a repeating cycle and marches off to infinity laying a diagonal highway. Run it, or jump straight to the highway and watch the pattern repeat.

The page treats the famous period as a hypothesis, not a premise. Measured: the encountered-colour sequence first locks to period 104 at step 9,977, and no divisor of 104 is a period, so 104 is minimal. The windowed geometry around the ant repeats every 104 steps under a (−2, −2) translation from step 10,525. The stricter full-grid version of that claim was tested first and rejected — the chaotic blob stays behind and breaks it — and the page says so.
