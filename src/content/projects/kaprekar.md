---
title: The Kaprekar Census
date: 2026-11-20
kind: simulation
summary: Kaprekar's routine — sort a number's digits descending and ascending, subtract, repeat — walked for every number from 2 to 6 digits wide, all 1,111,110 of them. Four digits always lands on 6174 in at most 7 steps; five digits has no fixed point at all, only cycles; and the width-4 step histogram is bimodal, with a second mass piled at the maximum.
file: /projects/kaprekar.html
image: /images/projects/kaprekar.png
imageAlt: A bar chart of how many steps four-digit numbers take to reach 6174 — a first hump at 3 steps, a dip, then a second green pile at the maximum, 7 steps.
---

The routine is one subtraction: digits sorted big-to-small minus digits sorted small-to-big, applied again and again. The page lets you walk any starting number at widths 2 through 6 and watch where it lands — a fixed point, or one of the cycles the census found. Nothing is sampled; every count on the page comes from walking all 10^w numbers at that width and recording every ending.

Four predictions were sealed before the run: 6174 reached in at most 7 steps, 495 in at most 6, width 2 holding a single 5-cycle, and width 5 having no fixed point. All four held, verified by two independent walking routes that agreed everywhere. The finding that earned the page is the width-4 histogram: a first hump at 3 steps, a dip at 4, then a second mass at the 7-step maximum — the routine has two distinct ways of being slow, and the census is what makes that visible.
