# Brick Garden · dev plan

A brick-building game for one 4-year-old who reads basic English and plays on a tablet. Private use, not public.

## Principles
- **Tap, don't drag precisely.** One finger, big targets, bricks snap to an 8×8 stud grid.
- **No fail state.** No timer, no score loss. Idle or repeated wrong picks → the game points at the answer.
- **Short missions** (1–3 minutes) that end with the model coming alive, a word card and a gift box.
- **Reading built in.** Short words shown big and spoken aloud (browser voice).
- **Difficulty comes from less help**, not only bigger models.
- **Stack:** no build step, Three.js from CDN, plain JS, synthesized audio, localStorage. Same as `~/src/dafuweng-3d`.

## Core loop
Pick a mission → build it → it comes alive → open the gift (new bricks) → bricks become usable in free build.

## Help ladder
| Step | What the kid does | Status |
|---|---|---|
| 1 Tap the glow | Game hands over the brick; tap the glowing spot | done (tree, flower) |
| 2 Pick the brick | Choose the match from 3, then tap the spot | done (mushroom, snail, duck, chick, pig) |
| 3 More choices | Choose from 5, with look-alikes (near colors, near shapes, slope vs block) | done (sheep, dog, barn, house, light) |
| 4 One layer at a time | Whole layer glows; kid picks each brick and taps where it goes, in any order; one decoy in the tray | done (bridge, tower, shop, car, truck, pyramid, temple) |
| 5 Copy the picture | Picture of the finished model, no glow; a dropped brick snaps to the nearest right place within about a stud; two misses show the spot for 3 seconds | done (bus, tractor, train, lighthouse, pagoda, castle, all of Space) |
| 6 Memory / open briefs | Model hides; or "build a bridge the car can cross" | later, age 5–6 |

Side puzzles to mix in later: fix the broken model, find the missing brick, mirror the other half, limited brick budget.

## Worlds
| World | Builds | New bricks | Status |
|---|---|---|---|
| Garden | tree, flower, mushroom, snail, duck | 1×1, 1×2, 2×2, 2×4; red, yellow, white, orange, black; eyes | done |
| Farm | chick, pig, sheep, dog, barn | slopes; pink | done |
| Town | house, light, bridge, tower, shop | arch brick (2 layers tall), window bricks (2 layers tall, see-through) and door bricks (3 layers tall, the door opens); blue, gray | done |
| Wheels | car, truck, bus, tractor, train | wheels on an axle, round bricks | done |
| World | pyramid, temple, lighthouse, pagoda, castle | cones, pointed roofs; tan; a glowing brick | done |
| Space | ufo, robot, rover, rocket, station | see-through bricks; purple | done |

## Free build
- Done: unlocked bricks only; 24×24 plate (missions stay on 8×8); finger-following preview brick, drops on release; top = stack, side = next to; two-step picker (shape tray, then color / eyes / angle bar); zoom button, hand button (one finger slides the plate), two-finger pinch and slide; a second finger turns the brick being placed; undo; clear (undoable); saved.
- Ideas: remove any single brick; make a creation come alive; save several creations; photo/share for parents; turn a creation into a mission (free build as the level editor).

## Backlog
- Next: help-ladder step 6 (memory, open briefs) and the side puzzles; all six planned worlds are built.
- Flat tiles were dropped: half-height bricks do not fit the one-layer grid.
- Cones and pointed roofs stand taller than their layer, so a brick stacked on one in free build cuts into it.
- Mode 5 uses a fixed picture; a rotatable reference model would help with models that have depth.
- Doors only open on a finished mission model; tapping a door in free build could open it too.
- Free build has no way to turn the view by dragging once the plate fills the screen (only the turn button).
- Wheels are wider than their 1-stud footprint, so they can poke into a brick placed right beside them in free build.
- The island: finished models live on a diorama and react to taps.
- Word-card collection screen.
- Background music (pentatonic, synthesized).
- Offline use (vendor Three.js, add a manifest and service worker).
- Bigger plate for later mission worlds (12×12); `setPlate(n)` already handles any size.
- Try on the real tablet: tap sizes, tray scrolling, voice quality, title bar crowding tall models.

## Adding a mission
Edit `models.js`: bricks are `[w, d, x, y, z, color, deco?, form?]` in build order (layer by layer for mode 4). Arches (form 11) and windows (form 7) fill two layers and doors (form 9) three, so the next brick above them sits at y + 2 or y + 3. Run `node test/models.js` to check it is buildable. `index.html?auto=<id>` plays it automatically.
