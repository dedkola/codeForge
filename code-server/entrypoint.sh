#!/bin/bash
set -e

TEMPLATE="/home/coder/template"

seed_lesson_folders() {
  if [ -z "$LESSON_TEMPLATE_SLUGS" ]; then
    return
  fi

  local lesson_dir
  local raw_slug
  local slug

  IFS=',' read -r -a lesson_slugs <<< "$LESSON_TEMPLATE_SLUGS"
  for raw_slug in "${lesson_slugs[@]}"; do
    slug="${raw_slug//[[:space:]]/}"

    if [[ -z "$slug" ]]; then
      continue
    fi

    if [[ ! "$slug" =~ ^[a-z0-9-]+$ ]]; then
      echo "[codeforge] Skipping invalid lesson slug: $slug"
      continue
    fi

    lesson_dir="$WORKSPACE/lessons/$slug"
    mkdir -p "$lesson_dir"
    cp -an "$TEMPLATE"/. "$lesson_dir"/
  done
}

# WORKSPACE env var is set by the K8s pod spec (e.g. /home/coder/ws-0)
if [ -z "$WORKSPACE" ]; then
  echo "[codeforge] WARNING: WORKSPACE env not set, skipping seed."
else
  mkdir -p "$WORKSPACE"

  # Seed workspace from template only if PVC is empty
  if [ -z "$(ls -A "$WORKSPACE" 2>/dev/null)" ]; then
    echo "[codeforge] Empty workspace detected, seeding base Next.js template..."
    cp -a "$TEMPLATE"/. "$WORKSPACE"/
    echo "[codeforge] Workspace seeded."
  fi

  # Seed each lesson folder without overwriting user files.
  seed_lesson_folders
fi

# Pass through to code-server (using dumb-init from base image)
exec dumb-init /usr/bin/code-server "$@"
