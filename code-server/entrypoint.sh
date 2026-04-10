#!/bin/bash
set -e

WORKSPACE="/home/coder/project"

# Seed workspace from template only if PVC is empty
if [ -z "$(ls -A "$WORKSPACE" 2>/dev/null)" ]; then
  echo "[codeforge] Empty workspace detected — seeding Next.js template..."
  cp -a /template/. "$WORKSPACE"/
  echo "[codeforge] Workspace seeded."
fi

# Pass through to code-server (using dumb-init from base image)
exec dumb-init /usr/bin/code-server "$@"
