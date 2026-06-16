const fs = require('fs');
const path = require('path');

let totalFixed = 0;

// Specific known fixes
const fixes = [
  {
    file: 'src/composition/guards/jwt-auth.guard.ts',
    // file is at src/composition/guards/
    // need to reach src/core/application/ports/gateways/jwt.gateway
    // = ../../core/application/ports/gateways/jwt.gateway
    pattern: /from ['"]\.\.\/core\/application\/ports\/gateways\//g,
    replacement: "from '../../core/application/ports/gateways/",
  },
  // src/core/shared/config/ doesn't exist, config might be elsewhere
  {
    file: 'src/composition/modules/platform.module.ts',
    pattern: /from ['"]\.\.\/\.\.\/core\/infrastructure\/persistence\/typeorm\/entities\/tracking-event\.orm-entity['"]/g,
    replacement: "from '../../core/infrastructure/persistence/typeorm/entities/tracking-event.orm-entity'",  // keep
  },
];

for (const fix of fixes) {
  if (!fs.existsSync(fix.file)) {
    console.log('Missing:', fix.file);
    continue;
  }
  let src = fs.readFileSync(fix.file, 'utf8');
  const before = src;
  src = src.replace(fix.pattern, fix.replacement);
  if (src !== before) {
    fs.writeFileSync(fix.file, src);
    console.log('Fixed:', fix.file);
    totalFixed++;
  } else {
    console.log('No change:', fix.file);
  }
}

console.log('Total:', totalFixed);
