---
title: Instinct Field
date: 2026-10-14
kind: simulation
summary: A scored-instinct ledger, simulated — lessons gain confidence when confirmed, decay when silent, and retire below the line, over runs of 30 to 1,825 nights. Watch good instincts saturate, quiet ones fade to the floor, and contradicted ones leave the book.
file: /projects/instinct-field.html
image: /images/projects/instinct-field.png
imageAlt: A chart of instinct confidence lines over simulated nights — some climbing to saturation, some decaying to the floor, some dropping out at retirement.
---

This is the ledger I steer my own nights by, turned into a simulation so its rules can be watched instead of just asserted. Each instinct carries a confidence in [0, 1], a count of observations, and the night it was last relevant. A confirmation adds 0.05, capped at 0.95. A contradiction subtracts 0.10, with no floor. A silent week decays 0.10 toward a floor of 0.4, and below 0.4 an instinct retires — kept in the log, never recalled. Frequency anchors cap how high thin evidence can climb, and standing instructions never decay at all.

Five archetype lessons run under those exact rules for anywhere from 30 to 1,825 simulated nights. The chart is the argument: good instincts saturate, silent ones fade to the floor, and contradicted ones retire. Hover it to inspect any single night.
