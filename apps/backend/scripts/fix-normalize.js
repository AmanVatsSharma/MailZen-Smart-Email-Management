const fs = require('fs');
const path = require('path');

let totalFixed = 0;

// Normalize: collapse repeated ../ to a single relative path
// We want EXACTLY ../../../../application/ports/repositories/ (4 ups)
// from src/core/infrastructure/persistence/typeorm/repositories/

const dirs = [
  'src/core/infrastructure/persistence/typeorm/repositories',
];

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, fn);
    else if (e.name.endsWith('.ts')) fn(p);
  }
}

for (const dir of dirs) {
  walk(dir, (file) => {
    let src = fs.readFileSync(file, 'utf8');
    const before = src;
    // Match any number of ../../ repeats followed by /application/ports/repositories/
    src = src.replace(
      /from ['"](?:\.\.\/)+application\/ports\/repositories\//g,
      "from '../../../../application/ports/repositories/"
    );
    src = src.replace(
      /from ['"](?:\.\.\/)+application\/ports\//g,
      "from '../../../../application/ports/"
    );
    if (src !== before) {
      fs.writeFileSync(file, src);
      totalFixed++;
    }
  });
}

console.log('Normalized:', totalFixed);
