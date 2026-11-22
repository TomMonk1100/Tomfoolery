---
title: Monomers — Tilings with Holes
date: 2026-11-21
kind: simulation
summary: Punch holes (monomers) in a chessboard and recount its domino tilings, live, after every click. The classic mutilated chessboard — 8×8 minus two opposite corners — has exactly 0 tilings, because the corners share a colour and every domino covers one light and one dark square. Remove two corners of opposite colours instead and the count is 2,436,304. On small boards a brute-force counter checks the exact DP and agrees.
file: /projects/monomer-dimer.html
image: /images/projects/monomer-dimer.png
imageAlt: An 8×8 board with two pink crossed-out corner squares as holes, the rest covered by coloured dominoes, captioned with its exact tiling count of 2,436,304.
---

A monomer is a single square left uncovered — a hole. This page starts with a full board and lets you click squares to punch holes, with the exact number of tilings of what remains recomputed after every click by a profile DP that treats holes as blocked cells. A colour-balance readout runs beside it: light squares minus dark squares among the cells left over. Every domino covers one of each, so if that balance is not zero the count must be 0, and the page says why in plain language.

The presets carry the finding. The classic — the 8×8 board minus its two opposite corners — counts exactly 0, the famous mutilated chessboard, and the colour readout shows the reason before the counter even runs: 32 of one colour, 30 of the other. Two corners of opposite colours give 2,436,304. The caveat, also on the page: equal balance never promises a tiling exists; it can only prove zero. And the brute-force second counter is exponential, so it only appears on boards up to 5×5 — there it agreed with the DP on every board tested, including 196 for the 5×5 board minus its centre.
