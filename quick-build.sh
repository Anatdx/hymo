#!/bin/bash
# Quick build script for development
# Usage: ./quick-build.sh

set -e

echo "🚀 Quick Build - ARM64 + WebUI"
echo ""

./build.sh testzip

echo ""
echo "✅ Quick build complete!"
echo "Package: build/out/hymo-*.zip"
