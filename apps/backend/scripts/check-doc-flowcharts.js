/**
 * Documentation flowchart contract check.
 *
 * Ensures module-local READMEs include at least one Mermaid flowchart block.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const requiredReadmes = [
  'src/auth/README.md',
  'src/common/README.md',
  'src/common/sms/README.md',
  'src/phone/README.md',
  'src/user/README.md',
  'src/database/README.md',
  'src/ai-agent-gateway/README.md',
  'src/smart-replies/README.md',
  'src/billing/README.md',
  'src/mailbox/README.md',
  'src/notification/README.md',
  'src/email-integration/README.md',
  'src/outlook-sync/README.md',
  'src/gmail-sync/README.md',
  'src/workspace/README.md',
  'src/inbox/README.md',
  'src/unified-inbox/README.md',
  'src/feature/README.md',
  'src/contacts/README.md',
  'src/organization/README.md',
  'src/email/README.md',
];

function fail(message) {
  console.error(`[doc-flowchart-check] ${message}`);
  process.exit(1);
}

function run() {
  const missingFiles = [];
  const missingFlowcharts = [];

  for (const relativePath of requiredReadmes) {
    const absolutePath = path.join(projectRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      missingFiles.push(relativePath);
      continue;
    }
    const content = fs.readFileSync(absolutePath, 'utf8');
    if (!content.includes('```mermaid')) {
      missingFlowcharts.push(relativePath);
    }
  }

  if (missingFiles.length) {
    fail(
      `Missing required README files:\n${missingFiles.map((value) => `- ${value}`).join('\n')}`,
    );
  }
  if (missingFlowcharts.length) {
    fail(
      `README files missing mermaid flowcharts:\n${missingFlowcharts.map((value) => `- ${value}`).join('\n')}`,
    );
  }

  console.log(
    `[doc-flowchart-check] OK: ${requiredReadmes.length} module README flowchart contracts satisfied.`,
  );
}

run();
