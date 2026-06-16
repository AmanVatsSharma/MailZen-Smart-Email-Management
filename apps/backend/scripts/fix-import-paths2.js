const fs = require('fs');
const path = require('path');

let totalFixed = 0;

const fixPaths = [
  {
    dir: 'src/core/infrastructure/persistence/typeorm/repositories',
    patterns: [
      // 3-up import → 4-up import (4-level deep file → 4 levels up to src/core)
      { from: /\bfrom ['"]\.\.\/\.\.\/application\/ports\/repositories\//g, to: "from '../../../../application/ports/repositories/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/application\/ports\//g, to: "from '../../../../application/ports/" },
    ],
  },
];

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else if (e.name.endsWith('.ts')) fn(p);
  }
}

for (const fix of fixPaths) {
  walk(fix.dir, (file) => {
    let src = fs.readFileSync(file, 'utf8');
    const before = src;
    for (const { from, to } of fix.patterns) {
      src = src.replace(from, to);
    }
    if (src !== before) {
      fs.writeFileSync(file, src);
      totalFixed++;
    }
  });
}

console.log('Total files fixed:', totalFixed);
