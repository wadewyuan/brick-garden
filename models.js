/* Brick Garden · colors and missions. Plain data, shared by the game and the node test.
   A brick is [w, d, x, y, z, color, deco?, form?]:
     w, d   footprint in studs along x and z
     x, z   stud of its lowest corner on the 8×8 plate (0..7); the camera starts in front, at high z
     y      layer, 0 sits on the plate
     deco   1 eyes, drawn on the front and back faces
     form   0 block; 1..4 a ramp that runs down toward +x, +z, -x, -z; 5 wheels on an axle; 6 round;
            7 window frame, two layers tall, you look through it from the front (8: turned a quarter);
            9 door frame, three layers tall, with a door that opens (10: turned a quarter);
            11 arch, two layers tall, spanning along x (12: along z);
            13 cone; 14 pointed roof with four sides (both end in a point, so nothing goes on top)
   Bricks are listed in build order: each one must rest on the plate or on an earlier brick.
   Animals face +x. */
(function (root) {
  const COLORS = {
    green: '#3fae49', brown: '#8a5a2b', red: '#e53935', yellow: '#ffd21f',
    white: '#f7f7f2', orange: '#ff8a1f', black: '#2b2b33', pink: '#ff8fb3',
    blue: '#2a63c9', gray: '#9aa3ad', tan: '#e2c27f', purple: '#8e5bd0',
    clear: '#a9dcf7',     // see-through
    glow: '#fff27a',      // lights up
  };

  const WORLDS = [{ id: 'garden', word: 'garden', color: '#3fae49' }, { id: 'farm', word: 'farm', color: '#e53935' },
    { id: 'town', word: 'town', color: '#2a63c9' }, { id: 'wheels', word: 'wheels', color: '#ff8a1f' },
    { id: 'world', word: 'world', color: '#c2912f' }, { id: 'space', word: 'space', color: '#6a45c9' }];

  // mode 1: the game hands over the right brick. mode 2: pick the matching brick from three.
  // mode 3: pick from five, with look-alikes.
  // mode 4: a whole layer glows at once; pick each brick and tap where it goes. List the bricks layer by layer.
  // mode 5: nothing glows; copy the picture. A dropped brick snaps to the nearest right place.
  // gift: bricks [w, d, color, deco?, form?] shown in the gift box after the first completion.
  // alive: how the finished model moves. sound: what it says while it does.
  const MISSIONS = [
    { id: 'tree', world: 'garden', word: 'tree', mode: 1, alive: 'sway',
      bricks: [
        [2, 2, 3, 0, 3, 'brown'], [2, 2, 3, 1, 3, 'brown'], [2, 2, 3, 2, 3, 'brown'],
        [4, 2, 2, 3, 2, 'green'], [4, 2, 2, 3, 4, 'green'],
        [2, 2, 3, 4, 3, 'green'],
      ],
      gift: [[4, 2, 'red'], [2, 2, 'yellow'], [1, 2, 'red']] },

    { id: 'flower', world: 'garden', word: 'flower', mode: 1, alive: 'spin',
      bricks: [
        [2, 2, 3, 0, 3, 'green'], [4, 2, 2, 1, 3, 'green'], [2, 2, 3, 2, 3, 'green'],
        [4, 2, 2, 3, 3, 'red'],
        [1, 2, 2, 4, 3, 'red'], [2, 2, 3, 4, 3, 'yellow'], [1, 2, 5, 4, 3, 'red'],
        [4, 2, 2, 5, 3, 'red'],
      ],
      gift: [[2, 2, 'white'], [1, 1, 'white']] },

    { id: 'mushroom', world: 'garden', word: 'mushroom', mode: 2, alive: 'bounce',
      bricks: [
        [2, 2, 3, 0, 3, 'white'], [2, 2, 3, 1, 3, 'white'],
        [4, 2, 2, 2, 2, 'red'], [4, 2, 2, 2, 4, 'red'],
        [2, 2, 3, 3, 3, 'red'],
        [1, 1, 2, 3, 5, 'white'], [1, 1, 5, 3, 2, 'white'],
      ],
      gift: [[4, 2, 'orange'], [1, 1, 'yellow', 1]] },

    { id: 'snail', world: 'garden', word: 'snail', mode: 2, alive: 'crawl',
      bricks: [
        [4, 2, 1, 0, 3, 'yellow'], [2, 2, 5, 0, 3, 'yellow'],
        [4, 2, 1, 1, 3, 'orange'], [2, 2, 5, 1, 3, 'yellow'],
        [2, 2, 2, 2, 3, 'orange'],
        [1, 1, 6, 2, 3, 'yellow', 1], [1, 1, 6, 2, 4, 'yellow', 1],
      ],
      gift: [[1, 2, 'orange'], [2, 2, 'yellow', 1]] },

    { id: 'duck', world: 'garden', word: 'duck', mode: 2, alive: 'waddle', sound: 'quack',
      bricks: [
        [4, 2, 2, 0, 3, 'orange'],
        [4, 2, 1, 1, 3, 'yellow'], [2, 2, 5, 1, 3, 'yellow'],
        [1, 2, 1, 2, 3, 'yellow'], [2, 2, 4, 2, 3, 'yellow'], [1, 2, 6, 2, 3, 'yellow'],
        [2, 2, 4, 3, 3, 'yellow', 1], [1, 2, 6, 3, 3, 'orange'],
      ],
      gift: [[2, 2, 'black'], [1, 1, 'black']] },

    // —— farm ——
    { id: 'chick', world: 'farm', word: 'chick', mode: 2, alive: 'waddle', sound: 'cheep',
      bricks: [
        [2, 2, 3, 0, 3, 'orange'],
        [4, 2, 2, 1, 3, 'yellow'],
        [1, 2, 2, 2, 3, 'yellow', 0, 1], [2, 2, 3, 2, 3, 'yellow', 1], [1, 2, 5, 2, 3, 'orange', 0, 1],
      ],
      gift: [[1, 2, 'yellow', 0, 1], [1, 2, 'orange', 0, 1]] },

    { id: 'pig', world: 'farm', word: 'pig', mode: 2, alive: 'trot', sound: 'oink',
      bricks: [
        [1, 2, 2, 0, 3, 'pink'], [1, 2, 5, 0, 3, 'pink'],
        [4, 2, 1, 1, 3, 'pink'], [2, 2, 5, 1, 3, 'pink'],
        [4, 2, 1, 2, 3, 'pink'], [1, 2, 5, 2, 3, 'pink', 1], [1, 2, 6, 2, 3, 'pink', 0, 1],
        [1, 1, 5, 3, 3, 'pink'], [1, 1, 5, 3, 4, 'pink'],
      ],
      gift: [[4, 2, 'pink'], [2, 2, 'pink'], [1, 2, 'pink', 1]] },

    { id: 'sheep', world: 'farm', word: 'sheep', mode: 3, alive: 'bounce', sound: 'baa',
      bricks: [
        [1, 2, 2, 0, 3, 'black'], [1, 2, 5, 0, 3, 'black'],
        [4, 2, 1, 1, 3, 'white'], [2, 2, 5, 1, 3, 'white'],
        [4, 2, 1, 2, 3, 'white'], [2, 2, 5, 2, 3, 'black', 1],
        [2, 2, 2, 3, 3, 'white'], [1, 2, 5, 3, 3, 'white'],
      ],
      gift: [[4, 2, 'white'], [1, 2, 'black'], [2, 2, 'black', 1]] },

    { id: 'dog', world: 'farm', word: 'dog', mode: 3, alive: 'trot', sound: 'woof',
      bricks: [
        [1, 2, 1, 0, 3, 'brown'], [1, 2, 5, 0, 3, 'brown'],
        [4, 2, 1, 1, 3, 'brown'], [2, 2, 5, 1, 3, 'brown'],
        [1, 2, 1, 2, 3, 'brown', 0, 1], [2, 2, 4, 2, 3, 'brown', 1], [1, 2, 6, 2, 3, 'black'],
        [1, 2, 4, 3, 3, 'black'],
      ],
      gift: [[4, 2, 'brown'], [1, 2, 'brown', 0, 1], [1, 2, 'brown']] },

    { id: 'barn', world: 'farm', word: 'barn', mode: 3, alive: 'bounce',
      bricks: [
        [4, 2, 2, 0, 2, 'red'], [1, 2, 2, 0, 4, 'red'], [2, 2, 3, 0, 4, 'white'], [1, 2, 5, 0, 4, 'red'],
        [4, 2, 2, 1, 2, 'red'], [1, 2, 2, 1, 4, 'red'], [2, 2, 3, 1, 4, 'white'], [1, 2, 5, 1, 4, 'red'],
        [2, 4, 2, 2, 2, 'red'], [2, 4, 4, 2, 2, 'red'],
        [2, 4, 2, 3, 2, 'black', 0, 3], [2, 4, 4, 3, 2, 'black', 0, 1],
      ],
      gift: [[2, 4, 'black', 0, 1], [2, 2, 'red', 0, 1]] },

    // —— town ——
    { id: 'house', world: 'town', word: 'house', mode: 3, alive: 'bounce',
      bricks: [
        [2, 2, 1, 0, 3, 'yellow'], [2, 2, 3, 0, 3, 'red', 0, 9], [2, 2, 5, 0, 3, 'yellow'],
        [2, 2, 1, 1, 3, 'white', 0, 7], [2, 2, 5, 1, 3, 'white', 0, 7],
        [2, 2, 1, 3, 3, 'yellow'], [4, 2, 3, 3, 3, 'yellow'],
        [2, 2, 1, 4, 3, 'red', 0, 3], [2, 2, 3, 4, 3, 'red'], [2, 2, 5, 4, 3, 'red', 0, 1],
      ],
      gift: [[2, 2, 'white', 0, 7], [2, 2, 'red', 0, 9], [1, 2, 'yellow']] },

    { id: 'light', world: 'town', word: 'light', mode: 3, alive: 'sway',
      bricks: [
        [4, 2, 2, 0, 3, 'gray'], [2, 2, 3, 1, 3, 'black'], [2, 2, 3, 2, 3, 'black'],
        [2, 2, 3, 3, 3, 'green'], [2, 2, 3, 4, 3, 'yellow'], [2, 2, 3, 5, 3, 'red'],
        [2, 2, 3, 6, 3, 'black'],
      ],
      gift: [[4, 2, 'gray'], [2, 2, 'gray'], [2, 2, 'red']] },

    { id: 'bridge', world: 'town', word: 'bridge', mode: 4, alive: 'bounce',
      bricks: [
        [1, 2, 1, 0, 3, 'gray'], [4, 2, 2, 0, 3, 'gray', 0, 11], [1, 2, 6, 0, 3, 'gray'],
        [1, 2, 1, 1, 3, 'gray'], [1, 2, 6, 1, 3, 'gray'],
        [1, 2, 1, 2, 3, 'red'], [4, 2, 2, 2, 3, 'red'], [1, 2, 6, 2, 3, 'red'],
        [1, 2, 1, 3, 3, 'yellow'], [1, 2, 6, 3, 3, 'yellow'],
      ],
      gift: [[4, 2, 'gray', 0, 11], [2, 2, 'blue'], [4, 2, 'blue'], [1, 2, 'gray']] },

    { id: 'tower', world: 'town', word: 'tower', mode: 4, alive: 'sway', sound: 'bell',
      bricks: [
        [1, 2, 2, 0, 3, 'gray'], [2, 2, 3, 0, 3, 'blue', 0, 9], [1, 2, 5, 0, 3, 'gray'],
        [1, 2, 2, 1, 3, 'gray'], [1, 2, 5, 1, 3, 'gray'],
        [1, 2, 2, 2, 3, 'gray'], [1, 2, 5, 2, 3, 'gray'],
        [4, 2, 2, 3, 3, 'gray'],
        [1, 2, 2, 4, 3, 'gray'], [2, 2, 3, 4, 3, 'gray', 0, 7], [1, 2, 5, 4, 3, 'gray'],
        [1, 2, 3, 6, 3, 'blue', 0, 3], [1, 2, 4, 6, 3, 'blue', 0, 1],
      ],
      gift: [[2, 2, 'gray', 0, 7], [2, 2, 'blue', 0, 1], [1, 1, 'red']] },

    { id: 'shop', world: 'town', word: 'shop', mode: 4, alive: 'bounce', sound: 'bell',
      bricks: [
        [2, 2, 1, 0, 3, 'blue', 0, 7], [2, 2, 3, 0, 3, 'yellow', 0, 9], [2, 2, 5, 0, 3, 'blue', 0, 7],
        [2, 2, 1, 2, 3, 'blue'], [2, 2, 5, 2, 3, 'blue'],
        [2, 2, 1, 3, 3, 'red'], [2, 2, 3, 3, 3, 'white'], [2, 2, 5, 3, 3, 'red'],
        [4, 2, 2, 4, 3, 'yellow'],
      ],
      gift: [[2, 2, 'yellow', 0, 9], [2, 2, 'blue', 0, 7], [1, 2, 'blue']] },

    // —— wheels ——
    { id: 'car', world: 'wheels', word: 'car', mode: 4, alive: 'drive', sound: 'beep',
      bricks: [
        [1, 4, 2, 0, 2, 'black', 0, 5], [2, 2, 3, 0, 3, 'gray'], [1, 4, 5, 0, 2, 'black', 0, 5],
        [4, 2, 1, 1, 3, 'red'], [2, 2, 5, 1, 3, 'red'],
        [1, 2, 1, 2, 3, 'red', 0, 3], [2, 2, 2, 2, 3, 'red', 0, 7], [1, 2, 4, 2, 3, 'red', 0, 1],
        [2, 2, 2, 4, 3, 'red'],
      ],
      gift: [[1, 4, 'black', 0, 5], [2, 2, 'red', 0, 7], [1, 2, 'red', 0, 1]] },

    { id: 'truck', world: 'wheels', word: 'truck', mode: 4, alive: 'drive', sound: 'honk',
      bricks: [
        [1, 4, 1, 0, 2, 'black', 0, 5], [4, 2, 2, 0, 3, 'gray'], [1, 4, 6, 0, 2, 'black', 0, 5],
        [4, 2, 1, 1, 3, 'blue'], [2, 2, 5, 1, 3, 'blue'],
        [2, 2, 1, 2, 3, 'brown'], [2, 2, 3, 2, 3, 'orange'], [2, 2, 5, 2, 3, 'blue', 0, 7],
        [2, 2, 5, 4, 3, 'blue'],
      ],
      gift: [[1, 4, 'gray', 0, 5], [4, 2, 'blue'], [2, 2, 'orange']] },

    { id: 'bus', world: 'wheels', word: 'bus', mode: 5, alive: 'drive', sound: 'honk',
      bricks: [
        [1, 4, 1, 0, 2, 'black', 0, 5], [1, 4, 6, 0, 2, 'black', 0, 5],
        [4, 2, 1, 1, 3, 'yellow'], [2, 2, 5, 1, 3, 'yellow'],
        [2, 2, 1, 2, 3, 'yellow', 0, 7], [2, 2, 3, 2, 3, 'yellow', 0, 7], [2, 2, 5, 2, 3, 'yellow', 0, 7],
        [4, 2, 1, 4, 3, 'yellow'], [2, 2, 5, 4, 3, 'yellow'],
      ],
      gift: [[4, 2, 'gray'], [1, 2, 'gray', 0, 1], [4, 2, 'black']] },

    { id: 'tractor', world: 'wheels', word: 'tractor', mode: 5, alive: 'drive', sound: 'vroom',
      bricks: [
        [1, 4, 2, 0, 2, 'black', 0, 5], [1, 4, 5, 0, 2, 'black', 0, 5],
        [4, 2, 2, 1, 3, 'green'],
        [2, 2, 2, 2, 3, 'green', 0, 7], [2, 2, 4, 2, 3, 'green'],
        [1, 1, 5, 3, 4, 'black', 0, 6], [2, 2, 2, 4, 3, 'yellow'],
      ],
      gift: [[1, 1, 'black', 0, 6], [1, 1, 'yellow', 0, 6], [2, 2, 'green', 0, 7]] },

    { id: 'train', world: 'wheels', word: 'train', mode: 5, alive: 'drive', sound: 'choo',
      bricks: [
        [1, 4, 1, 0, 2, 'black', 0, 5], [1, 4, 4, 0, 2, 'black', 0, 5], [1, 4, 6, 0, 2, 'black', 0, 5],
        [4, 2, 1, 1, 3, 'red'], [2, 2, 5, 1, 3, 'red'],
        [2, 2, 1, 2, 3, 'blue', 0, 7], [2, 2, 3, 2, 3, 'black'], [2, 2, 5, 2, 3, 'black'],
        [1, 1, 4, 3, 4, 'yellow', 0, 6], [1, 1, 6, 3, 4, 'red', 0, 6], [2, 2, 1, 4, 3, 'yellow'],
      ],
      gift: [[2, 2, 'red', 0, 6], [2, 2, 'black', 0, 6], [1, 1, 'red', 0, 6]] },

    // —— world: famous kinds of buildings ——
    { id: 'pyramid', world: 'world', word: 'pyramid', mode: 4, alive: 'bounce',
      bricks: [
        [4, 2, 1, 0, 1, 'tan'], [2, 2, 5, 0, 1, 'tan'], [2, 2, 1, 0, 3, 'tan'], [4, 2, 3, 0, 3, 'tan'], [4, 2, 1, 0, 5, 'tan'], [2, 2, 5, 0, 5, 'tan'],
        [4, 2, 2, 1, 2, 'tan'], [4, 2, 2, 1, 4, 'tan'],
        [2, 2, 3, 2, 3, 'tan'],
        [2, 2, 3, 3, 3, 'yellow', 0, 14],
      ],
      gift: [[2, 2, 'tan'], [4, 2, 'tan'], [2, 2, 'yellow', 0, 14]] },

    { id: 'temple', world: 'world', word: 'temple', mode: 4, alive: 'bounce',
      bricks: [
        [4, 2, 1, 0, 3, 'tan'], [2, 2, 5, 0, 3, 'tan'],
        [2, 2, 1, 1, 3, 'white', 0, 6], [2, 2, 5, 1, 3, 'white', 0, 6],
        [2, 2, 1, 2, 3, 'white', 0, 6], [2, 2, 5, 2, 3, 'white', 0, 6],
        [2, 2, 1, 3, 3, 'tan'], [4, 2, 3, 3, 3, 'tan'],
        [2, 2, 1, 4, 3, 'red', 0, 3], [2, 2, 3, 4, 3, 'red'], [2, 2, 5, 4, 3, 'red', 0, 1],
      ],
      gift: [[2, 2, 'white', 0, 6], [1, 2, 'tan'], [1, 1, 'tan']] },

    { id: 'lighthouse', world: 'world', word: 'lighthouse', mode: 5, alive: 'sway', sound: 'horn',
      bricks: [
        [4, 2, 2, 0, 3, 'gray'],
        [2, 2, 3, 1, 3, 'red', 0, 6], [2, 2, 3, 2, 3, 'white', 0, 6], [2, 2, 3, 3, 3, 'red', 0, 6], [2, 2, 3, 4, 3, 'white', 0, 6],
        [2, 2, 3, 5, 3, 'glow', 0, 6],
        [2, 2, 3, 6, 3, 'red', 0, 13],
      ],
      gift: [[2, 2, 'glow', 0, 6], [2, 2, 'red', 0, 13], [1, 1, 'glow']] },

    { id: 'pagoda', world: 'world', word: 'pagoda', mode: 5, alive: 'bounce', sound: 'bell',
      bricks: [
        [4, 2, 1, 0, 3, 'red'], [2, 2, 5, 0, 3, 'red'],
        [1, 2, 1, 1, 3, 'black', 0, 3], [4, 2, 2, 1, 3, 'black'], [1, 2, 6, 1, 3, 'black', 0, 1],
        [4, 2, 2, 2, 3, 'red'],
        [1, 2, 2, 3, 3, 'black', 0, 3], [2, 2, 3, 3, 3, 'black'], [1, 2, 5, 3, 3, 'black', 0, 1],
        [2, 2, 3, 4, 3, 'red'],
        [2, 2, 3, 5, 3, 'yellow', 0, 14],
      ],
      gift: [[1, 2, 'black', 0, 1], [2, 2, 'red', 0, 14], [1, 1, 'yellow', 0, 13]] },

    { id: 'castle', world: 'world', word: 'castle', mode: 5, alive: 'bounce', sound: 'horn',
      bricks: [
        [2, 2, 0, 0, 3, 'gray'], [4, 2, 2, 0, 3, 'gray', 0, 11], [2, 2, 6, 0, 3, 'gray'],
        [2, 2, 0, 1, 3, 'gray'], [2, 2, 6, 1, 3, 'gray'],
        [2, 2, 0, 2, 3, 'gray', 0, 7], [4, 2, 2, 2, 3, 'gray'], [2, 2, 6, 2, 3, 'gray', 0, 7],
        [1, 2, 2, 3, 3, 'gray'], [1, 2, 5, 3, 3, 'gray'],
        [2, 2, 0, 4, 3, 'blue', 0, 14], [2, 2, 6, 4, 3, 'blue', 0, 14],
      ],
      gift: [[2, 2, 'blue', 0, 14], [2, 2, 'gray', 0, 6], [1, 1, 'gray', 0, 13]] },

    // —— space ——
    { id: 'ufo', world: 'space', word: 'ufo', mode: 5, alive: 'hover', sound: 'warble',
      bricks: [
        [1, 1, 1, 0, 4, 'glow', 0, 6], [2, 2, 3, 0, 3, 'gray', 0, 6], [1, 1, 6, 0, 4, 'glow', 0, 6],
        [1, 2, 1, 1, 3, 'purple', 0, 3], [4, 2, 2, 1, 3, 'purple'], [1, 2, 6, 1, 3, 'purple', 0, 1],
        [2, 2, 3, 2, 3, 'clear', 0, 6],
      ],
      gift: [[2, 2, 'clear', 0, 6], [4, 2, 'purple'], [1, 2, 'purple', 0, 1]] },

    { id: 'robot', world: 'space', word: 'robot', mode: 5, alive: 'trot', sound: 'beep',
      bricks: [
        [1, 2, 2, 0, 3, 'gray'], [1, 2, 5, 0, 3, 'gray'],
        [4, 2, 2, 1, 3, 'blue'],
        [2, 2, 1, 2, 3, 'gray'], [2, 2, 3, 2, 3, 'glow'], [2, 2, 5, 2, 3, 'gray'],
        [2, 2, 3, 3, 3, 'white', 1],
        [1, 1, 3, 4, 4, 'red', 0, 13],
      ],
      gift: [[2, 2, 'glow'], [2, 2, 'purple'], [1, 1, 'red', 0, 13]] },

    { id: 'rover', world: 'space', word: 'rover', mode: 5, alive: 'drive', sound: 'beep',
      bricks: [
        [1, 4, 1, 0, 2, 'black', 0, 5], [1, 4, 3, 0, 2, 'black', 0, 5], [1, 4, 6, 0, 2, 'black', 0, 5],
        [4, 2, 1, 1, 3, 'gray'], [2, 2, 5, 1, 3, 'gray'],
        [4, 2, 1, 2, 3, 'blue'], [1, 1, 6, 2, 4, 'gray', 0, 6],
        [1, 1, 6, 3, 4, 'white', 1],
      ],
      gift: [[2, 2, 'clear'], [4, 2, 'clear'], [1, 1, 'white', 1]] },

    { id: 'rocket', world: 'space', word: 'rocket', mode: 5, alive: 'launch', sound: 'whoosh',
      bricks: [
        [1, 2, 2, 0, 3, 'red', 0, 3], [2, 2, 3, 0, 3, 'gray', 0, 6], [1, 2, 5, 0, 3, 'red', 0, 1],
        [2, 2, 3, 1, 3, 'white', 0, 6], [2, 2, 3, 2, 3, 'clear', 0, 6], [2, 2, 3, 3, 3, 'white', 0, 6], [2, 2, 3, 4, 3, 'red', 0, 6],
        [2, 2, 3, 5, 3, 'red', 0, 13],
      ],
      gift: [[2, 2, 'white', 0, 13], [1, 2, 'white', 0, 1], [2, 2, 'purple', 0, 6]] },

    { id: 'station', world: 'space', word: 'station', mode: 5, alive: 'spin',
      bricks: [
        [2, 2, 3, 0, 3, 'gray'], [2, 2, 3, 1, 3, 'gray'],
        [4, 2, 2, 2, 3, 'white'],
        [4, 2, 0, 3, 3, 'blue'], [4, 2, 4, 3, 3, 'blue'],
        [2, 2, 3, 4, 3, 'clear', 0, 6],
        [1, 1, 3, 5, 4, 'glow', 0, 13],
      ],
      gift: [[4, 2, 'glow'], [1, 1, 'clear', 0, 6], [1, 1, 'glow', 0, 13]] },
  ];

  // how many layers a brick stands tall
  const tall = form => form === 7 || form === 8 || form === 11 || form === 12 ? 2 : form === 9 || form === 10 ? 3 : 1;

  const api = { COLORS, WORLDS, MISSIONS, PLATE: 8, tall };
  if (typeof module !== 'undefined') module.exports = api; else root.BRICKS = api;
})(typeof window !== 'undefined' ? window : globalThis);
