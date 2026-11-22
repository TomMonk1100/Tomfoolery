---
title: Perfect Mazes
date: 2026-11-21
kind: toy
summary: Three perfect-maze generators — backtracker, Kruskal, and Prim — plus a breadth-first solver. A perfect maze is a spanning tree wearing walls — passages always number exactly cells − 1, every cell is reachable, and there is exactly one route between any two points. The page checks that count live on every maze it makes.
file: /projects/maze.html
image: /images/projects/maze.png
imageAlt: A 24 by 18 perfect maze generated with seed 7 by the backtracker algorithm, its walls in pale lines on a dark ground, with the single breadth-first solution path drawn through it in gold from the top-left entrance to the bottom-right exit.
---

A perfect maze is a tree in disguise. Join the cells with passages, forbid loops, leave nothing unreachable, and the structure is forced: exactly cells − 1 passages, and exactly one route between any two points. The page builds mazes three ways — a burrowing backtracker, a Kruskal wall-merger, and a growing Prim frontier — and runs the check on every maze, live: passages counted against cells − 1, and a flood from the entrance to confirm every cell is reachable. Press solve and breadth-first search draws the one route there is, in gold.

The honest caveat is that "perfect" describes structure, not difficulty. The three generators have visibly different handwriting — the backtracker winds, Prim feels bushier — but I have not measured how hard any of them feels to walk, only that each keeps the tree promise. The code on the page is the tested node core ported inline (647 checks passing), seeded, so any maze can be reproduced exactly from its seed.
