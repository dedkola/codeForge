# Docker — Build & Push dedkola/tk-docs:latest

Purpose

Short instructions to build the Docker image for this repository and push it to Docker Hub as `dedkola/tk-docs:latest`.

Prerequisites

- Docker (20+) installed and running
- pnpm (used by this repo) installed
- Logged in to Docker Hub (the `dedkola` namespace must exist or you must have access)

Commands

1) Login to Docker Hub

```zsh
docker login
```

2) (Optional) Check buildx availability (needed for multi-arch builds)

```zsh
docker buildx version
```

Build (single-arch, local)

This repo's Dockerfile expects Next.js standalone output when building for production. Set `DOCKER_BUILD=true` to produce the `.next/standalone` output used by the Dockerfile.

```zsh
# Build Next.js standalone output then build the Docker image
DOCKER_BUILD=true pnpm build && docker build -t dedkola/tk-docs:latest .
```

Tag (if you want additional tags )

```zsh
# Tag the same image with a version or commit SHA
docker tag dedkola/tk-docs:latest dedkola/tk-docs:1.0.0
# or
docker tag dedkola/tk-docs:latest dedkola/tk-docs:$(git rev-parse --short HEAD)
```

Push

```zsh
# Push latest tag to Docker Hub
docker push dedkola/tk-docs:latest

# Push additional tag (if created)
docker push dedkola/tk-docs:1.0.0
```

Multi-arch (optional)

Use `docker buildx` to build and push multi-architecture images (amd64 + arm64). Ensure a builder is created and QEMU is available on the host if you're cross-building.

```zsh
# Create builder (one-time)
docker buildx create --use --name tk-builder || true
docker buildx inspect --bootstrap

# Build & push multi-arch image
docker buildx build --platform linux/amd64,linux/arm64 -t dedkola/tk-docs:latest --push .
```

Run / Verify

```zsh
# Run locally to verify the container
docker run --rm -p 3000:3000 dedkola/tk-docs:latest

# From another terminal (or after background run), check headers
curl -I http://localhost:3000
```

Troubleshooting

- docker login fails: re-run `docker login` and confirm credentials
- Build errors during `pnpm build`: run `pnpm install` then `DOCKER_BUILD=true pnpm build` and inspect the Next.js output
- Image missing runtime files: confirm the build produced `.next/standalone` (Next.js standalone) before docker build
- buildx errors: ensure `docker buildx inspect --bootstrap` succeeds and that QEMU support is installed if cross-building

Notes

- Recommend adding tag by commit SHA for traceability (e.g. `dedkola/tk-docs:<sha>`).
- CI pipelines typically run the build and push steps and use secrets for Docker Hub credentials.


