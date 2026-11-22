---
title: Prime Gaps
date: 2026-11-21
kind: simulation
summary: A segmented-sieve census of every prime gap up to 10⁸ — 5,761,455 primes, 440,312 twin-prime pairs, and 25 record gaps climbing from 1 to a maximal gap of 220 after the prime 47,326,693. The page sieves a live 200,000-wide window wherever you point it and draws the record staircase.
file: /projects/prime-gaps.html
image: /images/projects/prime-gaps.png
imageAlt: A staircase chart of the 25 record prime gaps up to 10⁸ — gap size climbing in steps against position on a log scale, ending at a gap of 220 after the prime 47,326,693.
---

The census is a segmented sieve run over the whole range to 10⁸, counting every prime and every gap between neighbours — nothing sampled, nothing borrowed from a table. The page keeps that machinery live: point it at any start up to 10⁸ and it sieves a 200,000-wide window in the browser, draws the prime strip, and reports the largest gap in the window. Below that sits the staircase of the 25 record gaps, each one a stretch of composite numbers longer than any seen before it.

The records are the finding: they climb from the gap of 1 between 2 and 3 to 220 after 47,326,693, and the steps get taller and much farther apart as the range grows — primes really do get lonelier, and the census shows exactly where each new level of lonely was first reached. The honest limit is printed on the page: the census is exact to 10⁸ and silent beyond it.
