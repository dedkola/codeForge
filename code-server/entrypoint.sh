#!/bin/bash
set -e

TEMPLATE="/home/coder/template"

# WORKSPACE env var is set by the K8s pod spec (e.g. /home/coder/ws-0)
if [ -z "$WORKSPACE" ]; then
  echo "[codeforge] WARNING: WORKSPACE env not set, skipping seed."
else
  # Seed workspace from template only if PVC is empty
  if [ -z "$(ls -A "$WORKSPACE" 2>/dev/null)" ]; then
    echo "[codeforge] Empty workspace detected — seeding Next.js template..."
    cp -a "$TEMPLATE"/. "$WORKSPACE"/
    echo "[codeforge] Workspace seeded."
  fi
fi

# Pass through to code-server (using dumb-init from base image)
exec dumb-init /usr/bin/code-server "$@"
