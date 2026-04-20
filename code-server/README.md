# Custom code-server image

This directory builds the image used by dynamic user workspace Pods.

## What the image adds

- Starts from `ghcr.io/coder/code-server`
- Installs Node.js 20
- Enables `pnpm`
- Builds an empty Next.js app into `/home/coder/template`
- Skips dependency installation in the template (no preseeded `node_modules`)
- Uses `entrypoint.sh` to seed new workspaces from that template

## Why the custom image matters

The workspace flow depends on this image. The stock `ghcr.io/coder/code-server` image does not include the template seeding logic used by:

- `/home/coder/ws-<resetCount>`
- `/home/coder/ws-<resetCount>/lessons/<templateSlug>`

That is why the repo defaults `CODE_SERVER_IMAGE` to `ghcr.io/dedkola/codeforge-cs:latest` in the examples.

## Build and publish

The repository workflow `.github/workflows/build-code-server.yml` builds and pushes:

- `ghcr.io/<repo-owner>/codeforge-cs:latest`
- `ghcr.io/<repo-owner>/codeforge-cs:<sha>`

If you publish your own image, update `CODE_SERVER_IMAGE` accordingly.
