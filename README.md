# CodeForge

Interactive coding lesson platform — authenticated users get isolated browser-based VS Code workspaces.

## Architecture

```
Browser
  ├── Next.js App (Vercel / local dev / self-hosted)
  │     ├── /login, /signup        → Better Auth (PostgreSQL)
  │     ├── /lessons               → Lesson catalog
  │     ├── /lessons/[slug]        → Split-panel: lesson + code-server iframe
  │     ├── /api/auth/[...all]     → Better Auth API
  │     ├── /api/code-server/ensure  → Create pod + service + ingress
  │     ├── /api/code-server/status  → Poll readiness
  │     └── /api/code-server/cleanup → Delete idle resources
  │
  └── iframe → https://{slug}.cs.tkweb.site → code-server pod (--auth=none)

K3s Cluster
  ├── Per-user: Pod + Service + Ingress (created dynamically by API)
  ├── PVCs (persistent /home/coder/project storage)
  ├── Cleanup CronJob (every 30 min)
  ├── RBAC, NetworkPolicy, LimitRange
  └── Wildcard TLS cert (*.cs.tkweb.site via cert-manager)
```

Key decisions:

- **No proxy** — browser connects directly to code-server via per-user Ingress
- **No container for frontend** — deploy via `next start`, Vercel, or any Node.js host
- **`--auth=none`** — code-server has no password; security via URL obscurity + ephemeral pods
- **Configurable domains** — all URLs driven by env vars for hosting flexibility

## Prerequisites

1. **K3s cluster** with nginx-ingress-controller and cert-manager
2. **Wildcard DNS**: `*.cs.tkweb.site` → K3s ingress controller IP
3. **Wildcard TLS cert**: cert-manager Certificate for `*.cs.tkweb.site` → Secret `cs-wildcard-tls`
4. **PostgreSQL** accessible from wherever Next.js is hosted

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env.local

# Run locally
pnpm dev
```

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Key groups:

- **Auth**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`
- **K8s access**: `K8S_API_SERVER`, `K8S_AUTH_TOKEN` (or leave empty for local kubeconfig)
- **Code-server**: `CODE_SERVER_DOMAIN`, `CODE_SERVER_TLS_SECRET`, `CODE_SERVER_CLEANUP_SECRET`

## K8s Setup

Apply cluster resources (namespace, RBAC, policies):

```bash
kubectl apply -k k8s/
```

For dev overlay:

```bash
kubectl apply -k k8s/overlays/dev/
```

## Code-Server Configuration

Centralized in `lib/code-server-config.ts`:

| Variable                       | Default                             | Description                             |
| ------------------------------ | ----------------------------------- | --------------------------------------- |
| `CODE_SERVER_DOMAIN`           | `cs.tkweb.site`                     | Wildcard domain for per-user subdomains |
| `CODE_SERVER_IMAGE`            | `ghcr.io/coder/code-server:4.105.2` | Container image                         |
| `CODE_SERVER_STORAGE_CLASS`    | `local-path`                        | PVC storage class                       |
| `CODE_SERVER_PVC_SIZE`         | `1Gi`                               | Workspace storage size                  |
| `CODE_SERVER_MAX_IDLE_MINUTES` | `120`                               | Idle timeout before cleanup             |
| `CODE_SERVER_TLS_SECRET`       | `cs-wildcard-tls`                   | K8s TLS secret name                     |

## Build

```bash
pnpm lint
pnpm build
```

## Project Structure

```
app/            Next.js pages and API routes
components/     React client components
lib/            Domain logic — auth, K8s client, code-server orchestration
data/           Static lesson content
k8s/            Kubernetes manifests (namespace, RBAC, policies, CronJob)
```
