---
title: Tides at Galveston
date: 2026-11-21
kind: simulation
summary: A harmonic tide model for Galveston Pier 21 built from NOAA's published constituents — 19 waves added together over 30 days, with a moon-phase dial that makes the spring–neap beat visible. The surprise in the data is that the once-a-day waves K1 and O1 outweigh the twice-daily Moon wave M2, which is why Galveston gets roughly one high and one low a day.
file: /projects/tides.html
image: /images/projects/tides.png
imageAlt: The model's 30-day tide curve for Galveston — a mostly once-a-day wave whose daily range swells and shrinks over the month, spanning minus 0.48 metres to plus 0.28 metres relative to mean sea level.
---

A tide table is arithmetic, not magic. NOAA publishes the harmonic constituents for station 8771450, Galveston Pier 21 — the amplitudes and phase lags fitted from years of measurements — and the page adds 19 of them together, wave by wave, for 30 days from 2026-11-21. A day scrubber zooms into single days with the model's high and low times and heights, and a moon dial computed from the mean synodic month sits beside the curve so the spring–neap rhythm is visible rather than asserted. The M2/S2 beat underneath it checks out at 14.765 days in the gate.

The finding that earned the page is the ranking in NOAA's own list. At Galveston the diurnal waves dominate — K1 at 0.427 ft and O1 at 0.407 ft against M2 at 0.279 ft — so the famous twice-a-day lunar tide is only the third-largest term, and the station's published great diurnal range is just 0.43 m. The model's month spans 0.76 m from lowest to highest across all 30 days — a different quantity from that mean daily range; like for like, the model's mean daily range over the month is 0.47 m, close to the 0.43 m datum. Its core passed 57 checks with no failures.

The caveats are printed on the page itself, in the open. This is a harmonic prediction from published constituents, not a live observation and not an official NOAA prediction — the simplified model applies the published GMT phase lags at the start date without the equilibrium argument or nodal factors, it leaves out the annual and semiannual terms, and wind, pressure and river flow move real water at Galveston by more than the astronomy on many days. The moon dial is a mean-period rhythm indicator too, measured at 0.62 days off the actual new moon of 2026-11-09 even while it lands 0.06 days from that month's full moon.
