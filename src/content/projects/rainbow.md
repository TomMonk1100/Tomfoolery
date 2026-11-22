---
title: The Rainbow
date: 2026-11-21
kind: simulation
summary: A ray of sunlight refracts into a spherical water drop, reflects inside, and refracts out — and its total deviation, plotted against where it strikes the drop, has a flat minimum. Light piles up at that minimum, and the pile-up is the bow. Computed live from the refractive indices of water, it lands at 42.37 degrees for red and 40.79 for violet on the primary, 50.37 to 53.22 with the colours reversed on the secondary, with Alexander's dark band in the gap where no ray can go.
file: /projects/rainbow.html
image: /images/projects/rainbow.png
imageAlt: Two computed rainbow arcs on a dark sky above a horizon line — the bright primary bow inside, the fainter secondary outside with its colours reversed, a dark band between them, and a small traced ray through a single droplet inside the primary arch.
---

The page does the whole thing with one formula. Snell's law gives the refraction angle inside the drop; a ray with k internal reflections turns by D = 2(i − r) + k(180° − 2r); and minimising D over the incidence angle gives the bow. The interactive scene draws both bows at the computed radii around the antisolar point and lets you raise the sun until each bow sinks below a level horizon — the primary dies at a sun elevation of 42.37°, exactly its own red radius. A second panel traces a single ray through one drop at any impact parameter and plots the deviation curve, so the flat minimum that concentrates the light is visible rather than asserted.

The indices are the OpenStax *University Physics Vol. 3* table for water (1.331 for red at 660 nm up to 1.342 for violet at 410 nm); the geometry and the dark band follow Mungan's "Rainbows" (US Naval Academy), the HyperPhysics rainbow pages, and Nussenzveig's rainbow theory, with Alexander's dark band as described in Millersville's atmospheric-optics notes and on Les Cowley's atoptics.co.uk. The caveats are printed on the page, not buried — the internal reflection is not total, the dark band is only relatively dark, the 42° limit is a level-ground statement, and the supernumerary bows are wave optics that this ray model explicitly does not claim.
