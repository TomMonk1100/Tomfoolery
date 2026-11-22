---
title: Domino Tilings, Counted Twice
date: 2026-11-21
kind: simulation
summary: How many ways can dominoes tile a rectangle? Counted two independent ways that share no code — a profile DP that builds the board column by column in exact BigInt arithmetic, and Kasteleyn's 1961 product formula in double precision. They agree on every board tested — 2×10 is 89, 4×4 is 36, 6×6 is 6,728, and the full 8×8 chessboard is 12,988,816.
file: /projects/tilings.html
image: /images/projects/tilings.png
imageAlt: A full 8×8 chessboard tiled by coloured dominoes, next to the count 12,988,816 printed twice — once from the exact DP, once from Kasteleyn's formula — with the word agree between them.
---

The question is simple: cover a rectangle with 2×1 dominoes, no gaps, no overlaps — how many ways are there? The page lets you pick a board up to 8×8, plus 2×n and 4×n strips, and counts it live, twice, by two methods that share nothing. The profile DP sweeps column by column carrying a bitmask of cells already filled from the left. Kasteleyn's formula multiplies cosine terms over the whole board. One explicit tiling, found by backtracking, is drawn so you can see the thing being counted.

What was found is agreement, everywhere: 89 for 2×10, 36 for 4×4, 6,728 for 6×6, 167,089 for 6×8, and 12,988,816 for 8×8. The caveat is printed on the page: Kasteleyn in double precision only rounds to the exact integer at these sizes, so it is the witness, not the authority — the BigInt DP is exact at every size, and it is the DP's number I would trust on a board too large for the formula to witness.
