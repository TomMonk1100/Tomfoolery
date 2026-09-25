# Tomfoolery: site and Moon Lander review

Reviewed September 4, 2026. Proposal only; no application changes or deployment made.

## Recommendation

Take Tomfoolery toward a premium personal journal and cabinet of curiosities: warm paper, confident typography, generous photography, and deliberate editorial composition. Give Moon Lander its own cinematic illustrated science-fiction presentation inside that identity. The biggest gains are stronger art direction, clearer first impressions, and better feedback during play.

Keep Astro and the existing game simulation. The code already includes fixed-step physics, cached scenery, layered rendering, ship customization, particles, adaptive effects, synthesized music, progression, and extensive tests. A wholesale engine replacement would introduce substantial risk before proving a visual benefit.

## What was reviewed and verified

- Live desktop homepage, Coffee, Pokémon, Art, Now, Archive, About, and a Pokémon detail page.
- Homepage and game at a 390 × 844 phone viewport, including game start, active play, pause, and a desktop crash recap.
- Archive search: “coffee” returned one blog post and 33 tweets.
- Local page structure, design documentation, game renderer and controller, physics, and leaderboard function.
- `npm run verify` passed: asset checks, type checking, 232 tests across 17 test files, social cards, and a 46-page production build. Sky delivery assets total 6.39 MiB across the entire 192-image matrix; that is not a per-visit download.

This is a broad design and implementation review, not an exhaustive security audit or a completed game balance study. I did not complete an extended run, test every upgrade, listen critically to the soundtrack, exercise a physical touch device, submit a score, or measure real-user performance. Initial image loading was visible during browsing; those brief placeholders do not establish broken images or measured performance failures.

## Site findings and changes

| Priority | Finding | Proposed change | Intended result |
| --- | --- | --- | --- |
| High | The homepage introduces Tom briefly, then gives most of its early space to weather. Personal content and the game arrive considerably later, especially on phones. | Build a stronger opening composition with a personal image, short introduction, and immediate paths to the collections and Moon Lander. Place a featured content row before the expanded almanac. | Visitors quickly understand the person, the content, and what to explore. |
| High | The almanac has the strongest visual ambition, but its many readouts compete for attention. Small text sits over landscape detail on desktop. | Keep its photography and local astronomy. Prioritize conditions and the next sky event; make detailed field notes a clearly labeled secondary layer. Tune localized contrast against every plate. | Preserve the signature feature while improving reading order and accessibility. |
| High | Pokémon is two text tiles. Its metadata and homepage description promise filtering, while the page says that filtering is a future feature. The Clefairy story invites visitors to look at the card but has no image. | Correct the public promise immediately. Design a visual binder with portrait card images, collection metadata, and stories; add filters when the actual collection data supports them. | A finished, truthful collection experience. Actual card photos are a content dependency, not something to invent. |
| High | The game is represented by a text link among the other sections. | Create a featured game panel with actual gameplay artwork, a one-line premise, and a clear Play action. | Make the site's most interactive project visible and appealing. |
| Medium | Coffee has appealing personal images but the opening full-width photo consumes much of the first screen. Images have no inspection interaction. | Recompose the lead image and introduction, add small captions where real context exists, and build a keyboard-accessible image viewer with next/previous navigation and focus return. | A curated photographic gallery that rewards looking closer. |
| Medium | Art has one entry occupying a small tile in a wide grid. | Give a small collection an exhibition layout: one large featured work, title, medium, and a short existing story. Let the grid emerge as the collection grows. | Make limited content feel intentionally curated. |
| Medium | “Recently Tended” includes a 2016 archive entry beside summer 2026 posts. Dates are visible, but the framing suggests freshness. | Present recent updates separately from an explicitly labeled rediscovery from the archive. | More credible editorial framing without manufacturing new activity. |
| Medium | Now and About have stronger personal substance than the homepage but similar generic section openings. | Bring their portrait and personal details into a consistent editorial system with distinct lead compositions, readable text widths, and clear image captions. | The same authorial identity across the site. |
| Medium | Archive search works, but the initial long index offers little editorial entry point. | Add a featured memory or essay and optional year/type browsing while preserving working search and original content boundaries. | Easier discovery across a large archive. |
| Medium | Many destinations use similar small text cards; motion adds activity without establishing a stronger composition. | Standardize a small set of image-led features, editorial rows, and collection items. Use motion for transitions and interaction feedback, with immediately readable content and a reduced-motion path. | A cohesive, expensive-feeling presentation. |

Suggested homepage sequence: personal introduction and image → featured collection and game → Outside almanac → recent notes and archive rediscovery → compact section index.

## Moon Lander findings and changes

### 1. Make the opening feel like entering a game

The current title screen is a pale overlay with a substantial paragraph about controls and 69 upgrades. On the phone viewport, auxiliary options continue below the visible overlay area. It explains the systems before establishing atmosphere.

Build a title scene using the actual game world: the ship in a quiet hangar or above a landing station, restrained environmental motion, a custom title treatment, and one dominant Start action. Keep difficulty accessible; move detailed controls, the shop, achievements, and the pilot selfie into clear secondary destinations. Show touch instructions on touch layouts and keyboard instructions on desktop.

### 2. Improve depth and gameplay readability together

In the first level, the sky, distant ridges, and terrain occupy a narrow range of dark brown values. The ship is charming and prominent, but the world reads comparatively subdued. The landing pad is visible, yet could have a much clearer visual hierarchy.

Author one benchmark environment first: cooler distant ridges, a restrained horizon glow, richer foreground rock, controlled surface highlights, and a distinctive landing station. Keep collision surfaces sharply readable. Expand this into several recognizable environments using consistent silhouettes and lighting rules, rather than relying primarily on palette changes.

The renderer already has glow, dust, parallax layers, pad chevrons, and ship material treatments. Improve their composition and tuning rather than duplicating those systems. Decorative atmosphere must not obscure navigation; keep the retired fog feature disabled.

### 3. Replace the collection of HUD chips with coherent flight instruments

The desktop HUD uses small pale boxes and emoji. At phone width it wraps, and the level/altitude/speed area competes with the spawning ship. The settings row extends past the phone viewport, clipping the music slider.

Create a responsive flight panel with clear fuel, vertical descent, attitude, and safe-landing feedback. Keep critical instruments readable without covering the ship or pad. Move sound sliders into an accessible settings panel and make pause easy to reach. Retain both established touch layouts and test them at 360, 390, and 430 pixels wide and on actual phones.

### 4. Teach landing through feedback

An unattended first descent reached the crash screen in approximately four seconds. That is a baseline observation, not proof that the difficulty is wrong. It does show why an opening paragraph is a weak teaching tool.

Add a short optional flight lesson: thrust to slow descent, rotate to align, land within the safe envelope. Give the first attempt a ready state so the player can locate the controls. Use a readable approach indicator and explain failed landings specifically—too fast, tilted, off-pad, or hit by a hazard—with one helpful next action.

The current crash recap reports level, duration, earnings, and upgrades, but the observed recap does not explain the actual failure. Make Retry the dominant action and show score submission as secondary.

### 5. Turn existing progression into a stronger reward loop

There is already substantial upgrade and cosmetic breadth. First improve choice presentation: custom icons, clear benefit/cost text, comparison to the current ship, and an attractive preview of visible changes. Carry the same design language through the hangar, achievements, pause screen, and run recap.

Tune existing landing dust, engine effects, camera motion, and sound cues together. A good landing should have a brief, satisfying sequence before upgrade selection. Respect reduced motion and preserve stable controls. Review music and SFX with actual listening sessions before deciding whether authored audio assets are needed.

Only after the core loop is polished should daily seeded challenges, biome milestones, or additional content enter scope. These require balance and persistence design, not merely new menu buttons.

## Engineering concerns to address during implementation

- **Keyboard input scope:** the global game handler sets movement inputs outside active play, and its Space branch calls `preventDefault()` without excluding text inputs. This is a source-level concern for pilot-name entry and keyboard activation of menus. Reproduce with real key events, then scope gameplay input to the appropriate state and target.
- **Overlay accessibility:** generated overlays replace inner HTML without explicit focus transfer in `setOverlay`. Add deliberate initial focus, appropriate semantics, and focus restoration. Verify with keyboard use and a screen reader; a passing unit suite does not prove accessible menus.
- **Leaderboard integrity:** scores are accepted from the client, and pilot name plus difficulty acts as identity. Treat this as a casual board until stronger validation exists. Validate JSON shape, bound request size, and apply abuse controls. Do not claim verified competitive scores without server-verifiable runs.
- **Concurrent scores:** the function reads and rewrites one shared score array. Strong consistency alone does not make that sequence atomic; overlapping submissions can overwrite changes. Use conditional writes with retries or independent score records with suitable aggregation. Netlify documents conditional writes in its [Blobs documentation](https://docs.netlify.com/build/data-and-storage/netlify-blobs/).
- **Maintainability:** `main.ts` is 3,230 lines while the overlay helper module is only 58. Extract input, screen rendering, leaderboard access, and run orchestration incrementally as those areas change. Preserve physics behavior and saved data formats with focused regression tests.
- **Performance:** establish a measured baseline before adding artwork. Preserve cached scenery and adaptive effects. Target stable 60 fps on agreed reference devices, with measured lower-cost effects where needed. Measure menu transitions and demanding gameplay separately.
- **Site quality targets:** aim for LCP ≤2.5 seconds, INP ≤200 ms, and CLS ≤0.1 at the 75th percentile of real visits, segmented by mobile/desktop. These are goals, not current measured results; see [Google's Web Vitals guidance](https://web.dev/articles/vitals).

## Delivery plan

| Phase | Work | Reviewable deliverable / completion gate |
| --- | --- | --- |
| 1. Establish the visual direction | Design the homepage opening, game title scene, and one in-game scene at desktop and phone sizes. Define typography, icons, contrast, imagery, and motion. | Side-by-side previews that demonstrate the intended quality before expanding the work. |
| 2. Build a polished first slice | Implement the homepage opening and featured game panel; implement game title, first level visuals, responsive HUD, settings, and helpful crash feedback. Fix input/focus issues encountered in this flow. | A complete start → play → crash/retry experience and a homepage that immediately communicates the new direction. |
| 3. Extend the site | Apply the system to Coffee, Art, Pokémon, Now, About, and Archive. Rebalance Outside and recent content. Integrate available authentic images. | All primary pages work coherently on desktop and mobile, with truthful copy and accessible image inspection. |
| 4. Extend the game | Carry art direction through additional environments, upgrades, hangar, achievements, and rewards. Refine onboarding and sound with playtesting. Strengthen leaderboard storage. | A coherent longer run with readable hazards, understandable choices, and reliable progression. |
| 5. Release verification | Run existing checks plus focused browser tests; test physical phones, keyboard access, reduced motion, slow loading, save compatibility, and demanding game states. | Passing checks, documented performance results, reviewed screenshots, then deployment and live verification. |

Phases 1 and 2 should establish the quality standard. Estimate the wider rollout after that slice reveals the real artwork and iteration workload. Avoid committing to a large new-feature list before the core experience looks and feels right.

Preserve Tom's site identity, Hearthwood Light, authentic personal content, existing URLs and redirects, local astronomy, saved game progress, and the two touch layouts. Additional personal collection photos may require Tom's contribution; substantial improvements can proceed with the existing site assets.
