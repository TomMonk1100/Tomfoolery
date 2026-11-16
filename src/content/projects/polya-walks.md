---
title: Pólya Walks
date: 2026-11-16
kind: simulation
summary: Random walks in one, two and three dimensions, and Pólya's split — certain return in 1D and 2D, only a 0.3405 chance in 3D. A 20,000-walk sweep at a 4,096-step horizon measured 0.9874, 0.7135 and 0.3326, with the horizon's own bias stated on the page.
file: /projects/polya-walks.html
image: /images/projects/polya-walks.png
imageAlt: Random-walk trails on a dark field — blue paths wandering outward, and a dense gold tangle at the centre where returned walkers pile up at the origin.
---

A walker starts at the origin and steps at random. In 1921 Pólya proved the split this page measures: in one and two dimensions the walk is recurrent and returns to the origin with probability 1, while in three dimensions it is transient, with an ever-return probability of about 0.3405. Forty walkers run the rule live on the page in the dimension you pick — gold when they come home — and the measured table underneath does the real work.

The sweep ran 20,000 seeded walks per dimension out to a 4,096-step horizon. Ever-return by the horizon: 0.9874 in 1D, still climbing; 0.7135 in 2D, against a limit of 1 it approaches only logarithmically; 0.3326 in 3D, stalled just below Pólya's constant. The shortfalls are the horizon's, and the page labels them that way — these are finite-horizon measurements, not the theorem.
