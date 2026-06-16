const fs = require('fs');
const path = require('path');

let totalFixed = 0;
const FIXED = [];

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
    src = src
      .replace(/\.\.\/\.\.\/application\/ports\/repositories\//g, '../../../../application/ports/repositories/')
      .replace(/\.\.\/\.\.\/application\/ports\//g, '../../../../application/ports/')
      .replace(/\.\.\/\.\.\/application\//g, '../../../../application/');
    if (src !== before) {
      fs.writeFileSync(file, src);
      totalFixed++;
      FIXED.push(path.relative(process.cwd(), file));
    }
  });
}
console.log('Fixed:', totalFixed);
FIXED.forEach(f => console.log(' ', f));
