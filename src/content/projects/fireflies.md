---
title: Fireflies
date: 2026-10-25
kind: simulation
summary: A swarm of phase-coupled oscillators in the Kuramoto model — each firefly flashes at its own rate and feels either the whole swarm or only its neighbours, and synchrony emerges or it doesn't. Measured honestly — local coupling never reaches global sync, topping out at r = 0.424 where the global mode crosses 0.8.
file: /projects/fireflies.html
image: /images/projects/fireflies.png
imageAlt: Dozens of golden firefly dots at different brightnesses scattered over a dark navy field, some flashing large and bright.
---

Each firefly carries a phase that advances at its own natural frequency — about one flash per second, with a 12% spread. In global mode every firefly feels the swarm's mean field; in local mode each feels only the neighbours within a short radius. Nothing is hand-synced. Synchrony either emerges from the coupling or it doesn't, and the order parameter r says which — 0 when phases are scattered, 1 when all flash together.

The sweep's honest result: the transition is continuous, not a sharp knee. r sits near the noise floor up to K ≈ 0.7, lifts gently from K ≈ 1.0, and crosses 0.8 only at K = 1.9. At that same strength, local coupling reaches only r = 0.424 — radius neighbours form partial order, not global sync. That local failure is what the next night's piece, [Pulseflies](/projects/pulseflies.html), set out to fix with a different mechanism entirely.
