---
title: Neonfall
date: 2026-11-10
kind: game
summary: A bullet-heaven arena in the neon void. You fly and dash; your weapons fire on their own. Survive ten minutes of escalating swarm, draft upgrades with the exact numbers printed, and turn passives into transformations — rail rounds, forking lightning, cluster missiles — on the way to the Void Herald.
file: /projects/neonfall.html
image: /images/projects/neonfall.png
imageAlt: The word NEONFALL in glowing white-cyan over a dark void scattered with neon enemy shapes — pink drifters, amber darters, violet brutes, cyan shards — and one small white ship.
---

Neonfall is a Vampire Survivors-style arena built in one self-contained HTML file. Your ship flies with WASD and dashes on Space; everything you own fires by itself. Drifters, darters, brutes and splitters pour in from the dark, lancers telegraph a warning lane and lunge, spitters keep their distance and shoot back. Kills drop shards, shards buy levels, and every level offers a choice of three upgrades — with the real numbers printed on the card, the same numbers the build panel shows, and a DPS meter that is a true five-second measurement and credits no overkill.

The build is the game. Seven passives bend five weapons, and at the right stacks they stop being bonuses and become transformations: Swift Boots make the Blaster fire rail rounds every third volley, a second Magnet Coil makes Orbit Blades bite twice as often, Chain Lightning forks, Seeking Missiles burst into cluster minis, and the Nova Aura learns to pulse the swarm backwards, slowed. Max a weapon with its paired passive stacked and it runs Overdrive. The house rules from the earlier games still hold — no hidden math anywhere: elite health is printed on the boss bar (576, 1,200, 2,040), the Herald's 3,600 is announced before it arrives at 9:30, and when a run ends, the screen tells you what killed you.

It was tuned the way the other pieces here were: a pure simulation core, 40 engine tests, and three bot pilots — a kiter, a drafter that scores every card by its true DPS delta (the same estimator printed on the cards), and a coin-flip drafter — run over shared seeds until considered drafting demonstrably beat luck: median survival 5:49 against 4:56, two and a half times the kills, and every number in the tuning log reproduces exactly, because the whole harness is seeded. Five fresh outside critics scored the builds between 4 and 5 out of 10; their fair points — a dash, smarter enemies, transformations instead of nudges, a reason to start run number four — are all in the build now, and the bugs they were sure they'd found were probe-tested in the open: most turned out not to exist, and the ones that did (an unseeded test harness among them) got fixed and written up. Seasoning, lightly: Theo the cat is a passive who fetches your shards, and every so often a Slowpoke drifts through and slows the whole swarm down. Never you.
