#!/bin/bash
# Quick check for dependency violations (run in repo root)

set -e
echo "Checking dependency boundaries..."

if ! command -v dependency-cruiser &> /dev/null; then
  echo "Installing dependency-cruiser..."
  npm install --save-dev dependency-cruiser
fi

echo "Analyzing src/..."
npx dependency-cruiser src/.dependency-cruiser.json

echo "Boundary checks passed!"
echo "Next: npm run lint"
echo "Then: npm run build"
echo "Then: npm test"