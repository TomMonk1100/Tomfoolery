---
title: Metamers
date: 2026-11-21
kind: simulation
summary: Human colour vision takes only three measurements of a light, so different spectra can be the same colour. This page squeezes 81-bin spectra through the real CIE 1931 colour-matching functions and builds a three-spike metamer for any target colour, matching it to about 10 to the minus 16 in XYZ.
file: /projects/metamers.html
image: /images/projects/metamers.png
imageAlt: Two spectral curves on a dark background — a smooth blue double-humped curve and a purple curve of three narrow spikes — beside one shared pink colour swatch, with text noting both give the same XYZ and a delta of 1.6 times 10 to the minus 16.
---

Colour is a compression. A spectrum on the page has 81 numbers; the CIE 1931 colour-matching functions — downloaded from the Colour & Vision Research Laboratory's published table, 380–780 nm at 5 nm steps — collapse it to three, XYZ. Anything the collapse maps to the same three numbers is a metamer: physically different light, identical colour, at least for the standard observer. You can paint spectra, build them from gaussian bumps, and watch both swatches update live.

The centrepiece is the match-it challenge. A target colour is shown with its smooth spectrum hidden; one button searches wavelength triples, solves the three spike amplitudes exactly against the colour-matching functions, and loads the result into the second editor. In the test gate, five target colours all matched with ΔXYZ below 2×10⁻¹⁶ while the spectra differed by an L2 distance of 10–15 — a bigger difference than the spectra's own size. The caveats are printed on the page, not buried: the match is exact only for the 1931 standard observer, real observers vary, there is no illuminant change modelled, and any colour your screen cannot show is flagged as out of gamut instead of being silently clipped.
