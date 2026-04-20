# CodeForge

Interactive coding lesson platform — authenticated users get isolated browser-based VS Code workspaces.

## Architecture

```text
Browser
  ├── Next.js App (Vercel / local dev / self-hosted)
  │     ├── /login, /signup          → Better Auth (PostgreSQL)
  │     ├── /lessons                 → Lesson catalog
  │     ├── /lessons/[slug]          → Split-panel: lesson + code-server iframe
  │     ├── /api/auth/[...all]       → Better Auth API
  │     ├── /api/code-server/ensure  → Create pod + service + ingress
  │     ├── /api/code-server/status  → Poll readiness
  │     └── /api/code-server/cleanup → Delete idle resources
  │
  └── iframe → https://<slug>.codelearn.tkweb.site → code-server pod (--auth=none)

K3s Cluster (namespace: codelearn)
  ├── Traefik ingress controller (K3s default, in kube-system)
  ├── cert-manager + ClusterIssuer (letsencrypt-dns-prod, DNS-01 via Cloudflare)
  ├── Wildcard TLS cert (*.codelearn.tkweb.site → Secret wildcard-codelearn-tls)
  ├── Per-user (dynamic): Pod + Service + Ingress + PVC
  ├── Cleanup CronJob (every 30 min)
  └── RBAC, NetworkPolicy, LimitRange
```

Key decisions:

- **No proxy** — browser connects directly to code-server via per-user Traefik Ingress
- **No container for frontend** — deploy via `next start`, Vercel, or any Node.js host
- **`--auth=none`** — code-server has no password; users are already authenticated via Better Auth; workspace URLs use 32-char hex slugs (128-bit entropy) for URL obscurity
- **Configurable domains** — all URLs driven by env vars for hosting flexibility

## Prerequisites

1. **K3s cluster** with Traefik ingress controller (included by default) and cert-manager
2. **Wildcard DNS**: `*.codelearn.tkweb.site` → K3s node public IP (ports 80/443 forwarded)
3. **Wildcard TLS cert**: cert-manager Certificate for `*.codelearn.tkweb.site` → Secret `wildcard-codelearn-tls`
4. **PostgreSQL** accessible from wherever Next.js is hosted (e.g. Neon)

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy and fill in environment variables
cp .env.example .env.local

# Run locally
pnpm dev
```

## Setting Up the K3s Cluster from Scratch

### 1. Install cert-manager

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.yaml
kubectl -n cert-manager rollout status deploy --timeout=120s
```

### 2. Create Cloudflare API token secret

```bash
kubectl -n cert-manager create secret generic cloudflare-api-token-secret \
  --from-literal=api-token=<your-cloudflare-api-token>
```

### 3. Apply ClusterIssuer and wildcard certificate

```bash
kubectl apply -f k8s/ssl/clusterissuer.yaml
kubectl apply -f k8s/ssl/cert.yaml
```

Wait for the certificate to be issued:

```bash
kubectl -n codelearn get certificate
# NAME                        READY   AGE
# wildcard-codelearn-cert     True    ...
```

### 4. Apply CodeForge K8s resources

```bash
kubectl apply -k k8s/
```

This deploys: namespace, RBAC (ServiceAccount `codeforge-sa`), NetworkPolicy, LimitRange, cleanup CronJob.

### 5. Create a ServiceAccount token

```bash
kubectl -n codelearn create token codeforge-sa --duration=8760h
```

Use this as `K8S_AUTH_TOKEN` in your `.env.local`.

### 6. Port forwarding

Forward ports **80** and **443** on your router to the K3s node IP so Traefik can serve ingress traffic.

### 7. Cloudflare Tunnel (K8s API only)

If running Next.js outside the cluster (e.g. Vercel), set up a Cloudflare Tunnel for K8s API access. See [K3s API via Cloudflare Tunnel](docs/K3S-CLOUDFLARE-TUNNEL-API-ACCESS.md).

## Environment Variables

See [`.env.example`](.env.example) for all available variables. Key groups:

- **Auth**: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`
- **K8s access**: `K8S_API_SERVER`, `K8S_AUTH_TOKEN` (or leave empty for local kubeconfig)
- **Code-server**: `CODE_SERVER_DOMAIN`, `CODE_SERVER_TLS_SECRET`, `CODE_SERVER_CLEANUP_SECRET`

## Code-Server Configuration

Centralized in `lib/code-server-config.ts`:

| Variable                        | Default                             | Description                                          |
| ------------------------------- | ----------------------------------- | ---------------------------------------------------- |
| `CODE_SERVER_DOMAIN`            | `codelearn.tkweb.site`              | Wildcard domain for per-user subdomains              |
| `CODE_SERVER_IMAGE`             | `ghcr.io/coder/code-server:4.105.2` | Container image                                      |
| `CODE_SERVER_IMAGE_PULL_SECRET` | _(empty)_                           | Optional imagePullSecret name for private registries |
| `CODE_SERVER_STORAGE_CLASS`     | `local-path`                        | PVC storage class                                    |
| `CODE_SERVER_PVC_SIZE`          | `1Gi`                               | Workspace storage size                               |
| `CODE_SERVER_MAX_IDLE_MINUTES`  | `120`                               | Idle timeout before cleanup                          |
| `CODE_SERVER_TLS_SECRET`        | `wildcard-codelearn-tls`            | K8s TLS secret name                                  |

## Build

```bash
pnpm lint
pnpm build
```

## Operations

- [Deployment & Operations Guide](UPDATE.md)
- [K3s API via Cloudflare Tunnel](docs/K3S-CLOUDFLARE-TUNNEL-API-ACCESS.md)

## Project Structure

```text
app/            Next.js pages and API routes
components/     React client components
lib/            Domain logic — auth, K8s client, code-server orchestration
data/           Static lesson content
k8s/            Kubernetes manifests (namespace, RBAC, policies, CronJob, SSL)
```
