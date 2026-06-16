const fs = require('fs');
const path = require('path');

const dir = 'src/core/testing';
if (!fs.existsSync(dir)) {
  console.log('No testing dir');
  process.exit(0);
}
for (const f of fs.readdirSync(dir)) {
  if (f.endsWith('.ts')) {
    const fp = path.join(dir, f);
    const src = fs.readFileSync(fp, 'utf8');
    const lines = src.split('\n');
    for (const l of lines) {
      if (l.match(/^import .* from ['"]/) && l.includes('application/') && !l.includes('../')) {
        console.log(`ABS PATH: ${f}: ${l.trim()}`);
      }
    }
  }
}
