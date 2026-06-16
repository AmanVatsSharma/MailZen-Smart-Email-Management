const fs = require('fs');
const path = require('path');

const lines = [];
lines.push('# Refactor Status Audit');
lines.push('');

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) n += countFiles(path.join(dir, e.name));
    else if (e.name.endsWith('.ts')) n++;
  }
  return n;
}

lines.push(`- core/domain: ${countFiles('src/core/domain')} files`);
lines.push(`- core/application: ${countFiles('src/core/application')} files`);
lines.push(`- core/infrastructure: ${countFiles('src/core/infrastructure')} files`);
lines.push(`- core/testing: ${countFiles('src/core/testing')} files`);
lines.push(`- composition: ${countFiles('src/composition')} files`);
lines.push(`- interfaces: ${countFiles('src/interfaces')} files`);
lines.push('');

const err = fs.readFileSync('C:/tmp/tsc-errors-current.txt', 'utf8');
const m = err.match(/error TS\d+/g) || [];
lines.push(`TS errors: ${m.length}`);
lines.push('');

const byCode = {};
for (const e of m) byCode[e] = (byCode[e] || 0) + 1;
Object.entries(byCode).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  lines.push(`  ${k}: ${v}`);
});

fs.writeFileSync('C:	mpefactor-status-audit.md', lines.join('\n'));
console.log('Wrote C:	mpefactor-status-audit.md');
