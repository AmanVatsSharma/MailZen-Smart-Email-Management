/**
 * Documentation flowchart contract check.
 *
 * Ensures module-local READMEs include at least one Mermaid flowchart block.
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const srcRoot = path.join(projectRoot, 'src');
const requiredNestedReadmes = ['src/common/sms/README.md'];

function resolveRequiredReadmes() {
  const topLevelDirectories = fs
    .readdirSync(srcRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `src/${entry.name}/README.md`);
  return [...topLevelDirectories, ...requiredNestedReadmes];
}

function fail(message) {
  console.error(`[doc-flowchart-check] ${message}`);
  process.exit(1);
}

function run() {
  const requiredReadmes = resolveRequiredReadmes();
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
