---
title: The Oscillation Switch
date: 2026-11-16
kind: simulation
summary: A Rosenzweig–MacArthur predator–prey meadow with one knob — K, how rich the meadow is. Feed the prey better and, past K_c = 3.0954, stillness turns into a limit cycle — the paradox of enrichment, live on a phase plane. Theory says the cycle's amplitude grows with exponent exactly 1/2; the measured fit says 0.5238, and the page prints the bend and explains it instead of rounding it away.
file: /projects/hopf.html
image: /images/projects/hopf.png
imageAlt: A dark phase plane under the title "the oscillation switch" — one glowing teal loop, the limit cycle at K = 4.200, above the switch at 3.0954, with a small white ring marking the balance point inside it and an orange dot for the meadow right now.
---

Prey grow logistically; predators eat with a saturating Holling type-II response. The balance point itself never moves with K — only its stability does. Start lean and a nudge dies away in a settling spiral. Drag the dial slowly through the switch and each loop comes back the same size instead: a limit cycle is born, rabbits boom, foxes boom, both crash, repeat. The state is not reset when you drag, so the meadow answers the new richness from wherever it was.

The switch was located two independent ways: bisection with an envelope classifier gave K_c = 3.0954, and the closed-form Jacobian condition gave 3.09524 — agreement inside the printed bracket. The amplitude law is where the page earns its keep. Across the fit window the amplitude follows C·(K − K_c)^β with β = 0.5238, not the theoretical 1/2, because the pure square-root law only holds in a limit that finite runs cannot reach — closer in, critical slowing down means the cycle has not finished being born. The drift is printed on the page, 1.173 rising to 1.288, where anyone can check it. It is the one Allspark flip where the order that switches on is a beat in time.
