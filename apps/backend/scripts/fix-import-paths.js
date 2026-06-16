const fs = require('fs');
const path = require('path');

let totalFixed = 0;
const fileCount = {};

/**
 * Fix relative import paths for repository ports and other core paths.
 * The TypeORM adapters live in src/core/infrastructure/persistence/typeorm/repositories/.
 * From there, the core paths need FOUR levels up: '../../../../'.
 *
 * From src/core/infrastructure/external-services/* → THREE levels up: '../../../'
 * From src/core/infrastructure/crypto/* → THREE levels up: '../../../'
 * From src/core/testing/* → base 'application/...' or relative from 'src/'
 */

const fixPaths = [
  // From infrastructure/persistence/typeorm/repositories/, fix paths
  {
    dir: 'src/core/infrastructure/persistence/typeorm/repositories',
    patterns: [
      { from: /\bfrom ['"]\.\.\/\.\.\/application\/ports\/repositories\//g, to: "from '../../../../application/ports/repositories/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/\.\.\/\.\.\/domain\/bounded-contexts\//g, to: "from '../../../../domain/bounded-contexts/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/\.\.\/domain\//g, to: "from '../../../../domain/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/\.\.\/shared\//g, to: "from '../../../../shared/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/shared\//g, to: "from '../../../../shared/" },
    ],
  },
  // From src/core/infrastructure/crypto/, fix paths
  {
    dir: 'src/core/infrastructure/crypto',
    patterns: [
      { from: /\bfrom ['"]\.\.\/application\/ports\/gateways\//g, to: "from '../../../application/ports/gateways/" },
      { from: /\bfrom ['"]\.\.\/application\/ports\//g, to: "from '../../../application/ports/" },
    ],
  },
  // From src/core/infrastructure/external-services/*/, fix paths
  {
    dir: 'src/core/infrastructure/external-services',
    patterns: [
      { from: /\bfrom ['"]\.\.\/\.\.\/application\/ports\//g, to: "from '../../../application/ports/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/domain\//g, to: "from '../../../domain/" },
      { from: /\bfrom ['"]\.\.\/\.\.\/shared\//g, to: "from '../../../shared/" },
    ],
  },
  // From src/core/testing/, fix paths
  {
    dir: 'src/core/testing',
    patterns: [
      { from: /\bfrom ['"]application\/ports\/repositories\//g, to: "from '../application/ports/repositories/" },
      { from: /\bfrom ['"]application\/ports\//g, to: "from '../application/ports/" },
      { from: /\bfrom ['"]domain\/bounded-contexts\//g, to: "from '../domain/bounded-contexts/" },
      { from: /\bfrom ['"]domain\//g, to: "from '../domain/" },
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
      const rel = path.relative(process.cwd(), file);
      fileCount[rel] = (fileCount[rel] || 0) + 1;
      totalFixed++;
    }
  });
}

console.log('Total files fixed:', totalFixed);
console.log('Top changed files:');
const entries = Object.entries(fileCount).sort((a, b) => b[1] - a[1]).slice(0, 10);
entries.forEach(([f, n]) => console.log(`  ${n}x ${f}`));
