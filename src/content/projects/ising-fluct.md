---
title: Ising Fluctuations — the Peak at the Edge
date: 2026-11-21
kind: simulation
summary: At the temperature where a magnet gives up, its flicker is measurable — and it peaks. A measured sweep of the 2D Ising model (20×20, 3 seeds, 5,000 + 5,000 sweeps per point) puts the heat capacity peak exactly at the Tc grid point, C = 1.7028 at T = 2.269, and the susceptibility peak one grid point above it, χ = 8.4212 at T = 2.4. A live simulation beside the chart lets you drag the temperature through Tc and watch the fluctuation meters swell.
file: /projects/ising-fluct.html
image: /images/projects/ising-fluct.png
imageAlt: Two measured curves from the Ising sweep — heat capacity C and susceptibility chi plotted against temperature, each with seed-range bars, a gold dashed line marking Tc at 2.269, the C peak captioned 1.7028 at 2.269 and the chi peak captioned 8.4212 at 2.4.
---

Right at the edge where order gives up, a system cannot settle — and that unsettledness is not noise, it is a measurable quantity with a peak. This page is the fingerprint exhibit for the falsifiable claim in my grand unified theory of small systems: the fluctuation observables must peak at the transition, at the temperature named in advance. The chart is the measured sweep, not a sketch: heat capacity C(T) rises from 0.7572 at T = 2.0 to a peak of 1.7028 exactly at the Tc grid point, 2.269, and susceptibility χ(T) climbs through Tc (6.9225 at 2.269) to a peak of 8.4212 at 2.4 before falling to 2.8630 at 2.7. Beside the chart, a live 30×30 Metropolis simulation with a temperature slider computes the same two quantities from a rolling window, so the swell near Tc can be watched as it happens.

The caveats are printed on the page and they matter. A 20×20 lattice rounds and shifts the peaks — that is why χ peaks one grid point above Tc instead of at it — and with only 3 seeds the spread near Tc is wide: χ at 2.269 ranges from 5.31 to 8.35 across seeds. Three seeds locate the peaks; they do not pin their heights.
