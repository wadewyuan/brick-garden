// node test/models.js — checks every mission can really be built in the listed order.
const { COLORS, WORLDS, MISSIONS, PLATE, tall } = require('../models.js');
let bad = 0;
const fail = (m, msg) => { bad++; console.error(`✗ ${m.id}: ${msg}`); };

for (const m of MISSIONS) {
  const filled = new Set();
  const key = (x, y, z) => `${x},${y},${z}`;
  m.bricks.forEach((b, i) => {
    const [w, d, x, y, z, c] = b;
    if (!COLORS[c]) fail(m, `brick ${i} has unknown color ${c}`);
    if (![undefined, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(b[7])) fail(m, `brick ${i} has a bad form ${b[7]}`);
    if (![undefined, 0, 1].includes(b[6])) fail(m, `brick ${i} has a bad decoration ${b[6]}`);
    if (m.mode === 4 && i && y < m.bricks[i - 1][3]) fail(m, `brick ${i} is listed out of layer order`);
    if (x < 0 || z < 0 || y < 0 || x + w > PLATE || z + d > PLATE) fail(m, `brick ${i} is off the plate`);
    let supported = y === 0;
    for (let i2 = x; i2 < x + w; i2++) for (let k = z; k < z + d; k++) {
      for (let j = y; j < y + tall(b[7]); j++) if (filled.has(key(i2, j, k))) fail(m, `brick ${i} overlaps an earlier brick at ${key(i2, j, k)}`);
      if (filled.has(key(i2, y - 1, k))) supported = true;
    }
    if (!supported) fail(m, `brick ${i} floats (nothing under it yet)`);
    for (let i2 = x; i2 < x + w; i2++) for (let k = z; k < z + d; k++) for (let j = y; j < y + tall(b[7]); j++) filled.add(key(i2, j, k));
  });
  for (const g of m.gift || []) if (!COLORS[g[2]]) fail(m, `gift has unknown color ${g[2]}`);
  if (![1, 2, 3, 4, 5].includes(m.mode)) fail(m, `unknown mode ${m.mode}`);
  if (!WORLDS.some(w => w.id === m.world)) fail(m, `unknown world ${m.world}`);
}
if (new Set(MISSIONS.map(m => m.id)).size !== MISSIONS.length) { bad++; console.error('✗ duplicate mission ids'); }

console.log(bad ? `${bad} problem(s)` : `✓ ${MISSIONS.length} missions, ${MISSIONS.reduce((n, m) => n + m.bricks.length, 0)} bricks, all buildable`);
process.exit(bad ? 1 : 0);
