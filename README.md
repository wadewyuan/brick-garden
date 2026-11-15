# Brick Garden

A brick-building game for a 4-year-old on a tablet. Pure front end, no build step; Three.js 0.170.0 is kept in `vendor/three` (its add-ons import it by relative path), so nothing loads from a CDN.

Run: `python3 -m http.server 8765` in this folder, then open `http://<this-computer's-ip>:8765` on the tablet (same Wi-Fi). "Add to Home Screen" gives a full-screen icon.

## How it plays
- Pick a mission card → tap the glowing spot to drop each brick → the model comes alive → open the gift.
- Missions 1–2 (tree, flower): the game hands over the right brick.
- From the mushroom on: pick the matching brick from three, then tap the spot.
- Missions are grouped into worlds (tabs on the home screen): Garden, Farm, Town, Wheels, World, Space; five missions each, unlocked in order.
- Farm adds slope bricks, and from the sheep on the tray has five bricks with look-alikes.
- Town adds an arch brick (the bridge), window and door bricks (frames taller than a normal brick; doors swing open when the model is finished), blue and gray. From the bridge on, a whole layer glows at once: pick a brick, tap a spot that fits it, in any order.
- Wheels adds wheels and round bricks. From the bus on, nothing glows: copy the picture in the corner. Pick a brick and drop it with a finger; it snaps into place when it is close, and two misses show the spot.
- World (famous kinds of buildings) adds cones, pointed roofs, tan and a glowing brick. Space adds see-through bricks and purple; the rocket lifts off and the ufo hovers when finished.
- Free build (the yellow "build" card): pick any unlocked brick, then touch the board: a see-through brick follows the finger and drops where it is when the finger lifts (slide off the board to cancel). Touching a brick's top stacks on it; touching its side lands next to it. Bricks are magnetic: near another brick the see-through brick jumps to sit squarely on it or flush beside it, and moving the finger most of a stud further overrides that. The buttons and trays fade out while a brick is held and come back when it drops. Undo and turn-the-brick buttons. The bin removes one thing: tap the bin, then tap a brick, and everything joined to it (stacked or touching) goes; undo brings it back. Holding the bin clears the whole plate. The green hand moves things: switch it on, then drag a brick to a new place; bricks stacked on it come along, and it lands exactly under the finger (no magnets). The creation is saved.
- Every plain 2×2 and 2×4 brick also comes as a tall brick (two layers high) in free build. There is no height limit.
- Free build uses a big 24×24 plate. The magnifier button switches between a close view and the whole plate; two fingers pinch to zoom and slide to move around. The hand button makes one finger slide the plate instead of placing bricks; picking a brick switches it off.
- Turning a brick while placing it: keep the first finger on the plate and tap anywhere with a second finger (or press the turn button). With a mouse: scroll the wheel, or press R or space, while holding the brick; right-drag slides the plate.
- Free-build pickers: the bottom tray chooses the shape; the bar above it chooses the color, toggles eyes (on shapes that have them) and turns the brick (windows and doors can face either way).
- Idle for 6 seconds, or two wrong picks, and the game points at the answer.
- Drag sideways or tap the orange button to turn the view.
- Grown-ups menu: press and hold the gear on the home screen (voice on/off, unlock all, reset).

## Files
- `models.js`: colors and missions (brick lists in build order). Add missions here.
- `game.js`: scene, building, celebration, screens, saving (localStorage).
- `audio.js`: synthesized sound effects.
- `index.html`: layout and styles.
- `test/models.js`: `node test/models.js` checks every mission is buildable (no overlaps, nothing floating).

Opening `index.html?unlock` once unlocks every mission and brick in that browser (same as "Unlock all" in the grown-ups menu).

Test hook: `index.html?auto=duck` plays a mission by itself; `&stop=3` pauses after three bricks.
