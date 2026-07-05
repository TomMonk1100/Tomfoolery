# Understory — Playtest Checklist (MVP vertical slice)

Run through this on a real touch device (portrait) after each deploy.

## Core loop
- [ ] A full run completes start-to-finish (Spring → Winter → Life Story).
- [ ] Drag anywhere establishes the floating joystick and moves the Dog.
- [ ] Tap on/near a forage node harvests it (XP + counter increments, blip plays).
- [ ] Hold-and-release near a target triggers a Focus Action (Befriend) with a timing accuracy.
- [ ] Quick swipe performs a dash / Evade.
- [ ] Explore reveals fog-of-war tiles as you move.
- [ ] Nest action fires at a nest zone.
- [ ] Migrate bonus fires at a season boundary.
- [ ] All six verbs reachable at least once in a single run.

## Draft & cards
- [ ] Level-up pauses the world and raises a 3-card fan.
- [ ] Rarity borders are visually distinct (common → mythic).
- [ ] Across ~3 runs, at least one card of each rarity tier is seen.
- [ ] Skip grants a partial XP refund (less than taking a card).
- [ ] The single `isUnique` card (The Second Spring) can appear in normal play…
- [ ] …and is EXCLUDED from the draft pool during an Instinct Mode run.
- [ ] Pity: after 4 drafts with no Epic+, the 5th shows an Epic-or-above slot.

## Visual evolution
- [ ] Drafting a `head`/`back` card visibly changes the Dog sprite.
- [ ] Stacking the same card intensifies the attachment.

## Seasons & hazards
- [ ] Palette/mood shifts at each season boundary.
- [ ] Hazards appear and can be evaded; a hit costs Vitality, never ends the run.

## Meta & persistence
- [ ] Life Story shows Stats + Card Value Breakdown with no `NaN`/`undefined`.
- [ ] "No cards drafted this run" appears if a run ends at level 1.
- [ ] Sunseeds are credited and persist across a hard page reload.
- [ ] Meta hub node unlocks spend Sunseeds and stay unlocked after reload.

## Instinct Mode
- [ ] Toggle on the hub; a run completes unattended within ~15 min wall-clock.
- [ ] XP is visibly reduced (0.6×) vs active play.

## PWA
- [ ] "Add to Home Screen" installs; launches standalone in portrait.
- [ ] Loads offline after first visit (service worker precache).
