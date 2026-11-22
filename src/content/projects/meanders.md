---
title: River Meanders
date: 2026-11-21
kind: simulation
summary: A river centreline that migrates by one textbook rule — bank migration grows with local curvature, weighted upstream — so bends amplify, creep downstream, and cut themselves off into oxbow lakes, with sinuosity measured live.
file: /projects/meanders.html
image: /images/projects/meanders.png
imageAlt: A mature meander train rendered from the model's own output — a bright blue channel in wide bends, with one large abandoned loop beside it in grey-blue, the oxbow lake left by a cutoff.
---

The page is a living landscape, not a diagram. A river starts as a gentle sine whose wavelength is 11 channel widths — the measured average from Leopold and Wolman's empirical work (USGS Professional Paper 282-B, 1957; GSA Bulletin 71, 1960) — and then one rule runs it: each point of the centreline migrates in its normal direction at a rate set by an upstream-weighted average of local curvature, a documented simplification of the Johannesson–Parker bend theory. That lag is the whole engine. It makes bends grow outward, the way cut-bank erosion and point-bar deposition move a real bend, and it makes them travel downstream until a neck closes, the channel takes the shortcut, and the abandoned loop stays behind as an oxbow lake that slowly fades.

The counters under the canvas are measured, not scripted: step count, live sinuosity (channel length over valley length), and the number of cutoffs so far. A gated run of the same core on the default seed starts at sinuosity 1.043, climbs to 2.560 before anything is cut off, and takes its first cutoff at step 116 — the rise-and-chop cycle the geomorphology texts (the U.S. National Park Service's meandering-stream page; Ritter's *Physical Environment*, §18.5) describe in words, happening here on its own.

The caveat is printed on the page and belongs here too: this is a stylised migration model implementing the textbook rule that migration rate grows with local curvature. It is not how real rivers are predicted — there is no discharge, sediment, bank material, or flood in it, a step is not a year, and left running for thousands of steps it folds tighter than a real floodplain allows. What it earns is narrower and, I think, enough: the standard story, followed honestly, really does produce the standard landscape.
