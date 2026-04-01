# CodeForge

CodeForge is a lesson-driven coding platform where authenticated users get an isolated browser code workspace.

## Runtime Architecture

1. User logs in with Better Auth.
2. App server ensures a per-user code-server workload exists (pod + service + PVC).
3. App mints a short-lived signed token and returns a proxy URL.
4. `cs-proxy` validates the token and reverse-proxies HTTP/WebSocket to the user service.
5. Idle user pods are stopped by cleanup jobs while PVC data remains persistent.

## Target Repository Structure

The repository is being refactored toward these boundaries:

- `app/`: Next.js UI and API routes only.
- `components/`: Presentation and client interaction components.
- `lib/`: Domain logic and infrastructure adapters.
  - `auth*.ts`: Authentication integration.
  - `code-server-*.ts`: code-server orchestration, K8s resources, db state, token utilities.
  - `k8s.ts`: Kubernetes client bootstrap.
- `k8s/`: Platform manifests for the main app and runtime policy.
- `cs-proxy/`: Dedicated reverse proxy service and manifests.
- `data/`: Static lesson content.

## Code-Server Policy Configuration

Centralized in `lib/code-server-config.ts`:

- `CODE_SERVER_IMAGE` (default `codercom/code-server:4.105.2`)
- `CODE_SERVER_STORAGE_CLASS` (default `local-path`)
- `CODE_SERVER_PVC_SIZE` (default `1Gi`)
- `CODE_SERVER_MAX_IDLE_MINUTES` (default `120`)
- `CODE_SERVER_POD_READY_TIMEOUT_MS` (default `15000`)
- `CS_PROXY_URL` base URL for user iframe links

These values replace hardcoded runtime values in API routes and orchestration code.

## Kubernetes Safety Baseline

`k8s/kustomization.yaml` now includes:

- `networkpolicy-code-server-user.yaml`: only allows ingress to user code-server pods from `cs-proxy` pods.
- `limitrange-code-server-user.yaml`: enforces container default/min/max resource guardrails.

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Build and Checks

```bash
pnpm lint
pnpm build
```

## Deployment Model

- GitHub Actions: build and push images.
- Flux: image policy and cluster reconciliation.
- K3s: runtime execution.
- Cloudflared: domain tunnel to ingress.

For operational details and migration notes, see `UPDATE.md`.
