---
title: Elementary Cellular Automata
date: 2026-11-21
kind: simulation
summary: One row of 201 cells on a ring, each cell deciding its next state from itself and its two neighbours using one of 256 one-byte rules. The page draws the spacetime diagram for any rule — presets for 30 (chaos), 90 (Sierpinski), 110 (universal), and 184 (traffic) — and a second view that flips exactly one starting cell and shows, in pink, how far the damage spreads.
file: /projects/eca.html
image: /images/projects/eca.png
imageAlt: A spacetime diagram of rule 30 growing from a single lit cell — a widening blue triangle filled with chaotic pattern on a dark background, 100 steps of time running downward.
---

A rule here is a single byte: for each of the eight possible neighbourhoods, one bit says whether the centre cell turns on. That is the entire machine, and the page runs it for any rule from 0 to 255, from either a single seed cell or a seeded random row. Nothing in the byte mentions triangles, chaos, or traffic — rule 90 draws Sierpinski triangles anyway, rule 30 dissolves into chaos, and rule 184 sorts cells like cars.

The second view is the finding I keep returning to. Run the same start twice with one centre cell flipped and compare: from the seeded random start (seed 11), rule 110 finishes the 99 steps shown with 55 of 201 cells differing, while rule 184 — same start, same flip — finishes with exactly 1. Some rules forgive one flipped cell; some let it take over the world, and the difference is visible at a glance. The caveat, printed on the page: rule 110's "universal" label is a theorem about the right starting pattern with unlimited room, not something a 201-cell ring run demonstrates.
