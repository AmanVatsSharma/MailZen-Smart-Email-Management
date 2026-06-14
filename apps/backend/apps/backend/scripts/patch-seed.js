const fs = require('fs');
let src = fs.readFileSync('scripts/seed-demo.ts', 'utf8');

// Tables that DO exist in current schema — keep as client.query
const safeTables = new Set(['attachments','emails','contacts','workspace_members','email_warmups','mailboxes','email_filters','phone_verifications','email_providers','workspaces','users']);

const lines = src.split('\n');
const out = [];
let inWipe = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('async function wipeDemoAccount')) {
    inWipe = true;
    out.push(line);
    continue;
  }

  if (inWipe && (line.includes("'COMMIT'") || line.includes("'ROLLBACK'"))) {
    inWipe = false;
    out.push(line);
    continue;
  }

  if (inWipe && line.includes('DELETE FROM')) {
    const m = line.match(/DELETE FROM (\S+) WHERE/);
    if (m) {
      const tableName = m[1].toLowerCase().replace(/["\\]/g, '');
      if (safeTables.has(tableName)) {
        out.push(line);
      } else {
        const fixed = line.replace('client.query(', 'safeDelete(client,');
        out.push(fixed);
      }
      continue;
    }
  }

  out.push(line);
}

fs.writeFileSync('scripts/seed-demo.ts', out.join('\n'));
console.log('Patched seed-demo.ts: wrapped missing-table DELETEs in safeDelete');
