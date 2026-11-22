---
title: Dawn Chorus
date: 2026-11-21
kind: generative
summary: Four bird songs rebuilt as pure oscillator phrases from published descriptions of their structure alone, with a live spectrogram of the synthesis — no recordings, and no frequency claimed as data.
file: /projects/dawn-chorus.html
image: /images/projects/dawn-chorus.png
imageAlt: Four rows of coloured frequency tracks on a dark background, one per species, drawn from the synthesis core syllable lists — robin phrases in blue, song sparrow intro and trill in green, white-throated sparrow two-level whistles in gold, Carolina wren repeated triplets in purple.
---

Four species, chosen because Cornell Lab descriptions state their song structure in words clearly enough to code: the American robin in 2–3-note carolling groups with pauses, the song sparrow opening with clear notes then a trill then a varied tail, the white-throated sparrow whistling pure notes on typically two pitches in the "Old Sam Peabody" triplet pattern, and the Carolina wren repeating a loud three-parted "teakettle" motif. Each card on the page quotes its sourced one-line description, and its sing button renders the modelled phrase through WebAudio oscillators while a shared spectrogram, fed by an AnalyserNode, draws the synthesis as it sounds.

The caveat is the point. No numeric pitch range could be sourced from the Cornell or Xeno-canto text descriptions used here, so every frequency in the synth is the synth's choice, labelled as such — only the grouping, repetition, trill and triplet structure comes from the sources named on the page. These are not what the species exactly sound like, and the spectrogram does not show a real bird. The pure phrase core was gated in Node over 20 seeds per species, 2,296 checks with none failing, for determinism, no overlapping syllables, at most two base pitches for the white-throated sparrow, and at least six rapid syllables in the song sparrow trill.
