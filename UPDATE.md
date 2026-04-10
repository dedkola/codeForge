# CodeForge — Deployment & Operations Guide

## Current Architecture (May 2026)

- Each user gets a dedicated code-server pod with `--auth=none` (users are already authenticated via Better Auth)
- Per-user Traefik Ingress routes `<slug>.codelearn.tkweb.site` directly to the user's pod — no proxy layer
- Workspace URLs use 32-char hex slugs (128-bit entropy from `sha256(userId)`)
- Wildcard TLS via cert-manager (`letsencrypt-dns-prod` ClusterIssuer, DNS-01 challenge via Cloudflare)
- Runtime config centralized in `lib/code-server-config.ts`
- K8s manifests use `base` + `overlays` structure via Kustomize

## How it all fits together

```text
User browser
    │
    ├── https://codeforge.tkweb.site  (Next.js app — Vercel / local dev)
    │       │  - Login (Better Auth: email/password + Google + GitHub OAuth)
    │       │  - Lesson pages (split-panel: markdown + iframe)
    │       │  - Creates K8s Pod/PVC/Service/Ingress per user on demand
    │       │
    │       └── calls K8s API via:
    │             - In-cluster ServiceAccount, OR
    │             - Cloudflare Tunnel (k8s.tkweb.site → localhost:6443)
    │
    └── https://<slug>.codelearn.tkweb.site  (per-user Traefik Ingress)
            │  - Wildcard TLS cert (*.codelearn.tkweb.site)
            │  - Routes directly to code-server pod (no proxy)
            │
            └── code-server pod (--auth=none, VS Code in browser)
                    └── PVC: /home/coder/project (1 Gi, persists across pod restarts)
```

### Kubernetes namespace: `codelearn`

| Resource          | Name pattern              | What it is                                     |
| ----------------- | ------------------------- | ---------------------------------------------- |
| CronJob           | `cs-cleanup`              | Deletes idle code-server pods every 30 min     |
| Secret            | `codeforge-secrets`       | All env secrets                                |
| ServiceAccount    | `codeforge-sa`            | Gives Next.js app permission to manage pods    |
| Certificate       | `wildcard-codelearn-cert` | Wildcard TLS cert for `*.codelearn.tkweb.site` |
| Pod (dynamic)     | `cs-<slug>`               | Per-user code-server instance                  |
| Service (dynamic) | `cs-svc-<slug>`           | Per-user ClusterIP service                     |
| PVC (dynamic)     | `cs-pvc-<slug>`           | Per-user 1 Gi workspace volume                 |
| Ingress (dynamic) | `cs-ing-<slug>`           | Per-user Traefik Ingress with TLS              |

---

## How per-user code-server instances work

1. User logs in → navigates to a lesson page
2. The Next.js server component calls `ensureUserCodeServer(userId)`:
   - Computes a deterministic 32-char hex slug: `sha256(userId).hex.slice(0, 32)`
   - Creates a PVC `cs-pvc-<slug>` (1 Gi, `local-path`, persists across pod restarts)
   - Creates a pod `cs-<slug>` running `ghcr.io/coder/code-server:4.105.2` with `--auth=none`; workspace dir: `/home/coder/project` (mounted from PVC)
   - Creates a ClusterIP service `cs-svc-<slug>` pointing at that pod
   - Creates a Traefik Ingress `cs-ing-<slug>` with TLS termination using the wildcard cert
   - Waits up to 15 s for the pod readiness probe to pass
3. Frontend renders an `<iframe>` pointing to `https://<slug>.codelearn.tkweb.site`
4. `CodeServerPanel` (client component) polls `/api/code-server/status` every 3s while pod is starting

**Security:** Workspace URLs contain 32 hex characters (128 bits of entropy) — computationally infeasible to guess. Same security model as Google Docs share links.

**Persistence:** The PVC is never deleted automatically. The pod is deleted by the CronJob after 120 min idle, but the next visit recreates the pod and remounts the same PVC — files are always there.

---

## First-time cluster setup (do once)

### Prerequisites

- K3s running with Traefik ingress controller (included by default)
- `kubectl` pointing at the cluster
- Ports 80 and 443 forwarded from router to K3s node IP
- Wildcard DNS: `*.codelearn.tkweb.site` → K3s node public IP
- Cloudflare account with the domain for DNS-01 challenges

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
kubectl apply -f k8s/ssl/clusterissuer.yaml   # letsencrypt-dns-prod
kubectl apply -f k8s/ssl/cert.yaml             # *.codelearn.tkweb.site
```

Wait for the certificate to be issued:

```bash
kubectl -n codelearn get certificate
# NAME                        READY
# wildcard-codelearn-cert     True
```

### 4. Apply CodeForge K8s resources

```bash
kubectl apply -k k8s/
```

This applies: namespace, RBAC (`codeforge-sa`), NetworkPolicy, LimitRange, cleanup CronJob.

Verify:

```bash
kubectl get all -n codelearn
```

### 5. Create a ServiceAccount token

```bash
kubectl -n codelearn create token codeforge-sa --duration=8760h
```

Use this as `K8S_AUTH_TOKEN` in your `.env.local` (only needed if running Next.js outside the cluster).

### 6. Edit secrets (if deploying to K8s)

Copy and edit `k8s/secrets.yaml.example`:

```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
# Edit k8s/secrets.yaml with real values
kubectl apply -f k8s/secrets.yaml
```

### 7. Cloudflare Tunnel (K8s API access)

If running Next.js outside the cluster (e.g. Vercel or local dev), set up a Cloudflare Tunnel for K8s API access:

See [K3s API via Cloudflare Tunnel](docs/K3S-CLOUDFLARE-TUNNEL-API-ACCESS.md).

---

## Redeploying the Next.js app

GitHub Actions (`.github/workflows/docker-build.yml`) builds and pushes Docker images on every push to `main`:

- `ghcr.io/dedkola/codeforge:latest`
- `ghcr.io/dedkola/codeforge:<timestamp>-<sha>`

Roll out the new image:

```bash
kubectl rollout restart deployment/codeforge -n codelearn
kubectl rollout status deployment/codeforge -n codelearn
```

---

## Updating K8s manifests

```bash
# Re-apply everything
kubectl apply -k k8s/

# Or apply a single file
kubectl apply -f k8s/secrets.yaml
```

---

## Useful kubectl commands

```bash
# See all resources in the codelearn namespace
kubectl get all -n codelearn

# See per-user code-server pods
kubectl get pods -n codelearn -l app=code-server-user

# See per-user PVCs (these persist even after pod cleanup)
kubectl get pvc -n codelearn

# See per-user ingresses
kubectl get ingress -n codelearn

# Check wildcard TLS certificate status
kubectl -n codelearn get certificate
kubectl -n codelearn describe certificate wildcard-codelearn-cert

# Tail a specific user's code-server logs
kubectl logs -n codelearn cs-<slug> -f

# Force cleanup of stale pods now (instead of waiting for CronJob)
kubectl create job --from=cronjob/cs-cleanup manual-cleanup -n codelearn

# Delete a specific user's pod (will be recreated on next lesson visit)
kubectl delete pod cs-<slug> -n codelearn

# Delete a user's workspace volume permanently (data loss!)
kubectl delete pvc cs-pvc-<slug> -n codelearn
```

---

## Environment variables reference

For local development, set these in `.env.local`:

| Variable                     | Description                                                       |
| ---------------------------- | ----------------------------------------------------------------- |
| `DATABASE_URL`               | Postgres connection string (Neon)                                 |
| `BETTER_AUTH_SECRET`         | Session signing secret                                            |
| `BETTER_AUTH_URL`            | Public URL of the app                                             |
| `GOOGLE_CLIENT_ID`           | OAuth                                                             |
| `GOOGLE_CLIENT_SECRET`       | OAuth                                                             |
| `GITHUB_CLIENT_ID`           | OAuth                                                             |
| `GITHUB_CLIENT_SECRET`       | OAuth                                                             |
| `K8S_API_SERVER`             | K8s API URL (e.g. `https://k8s.tkweb.site` via Cloudflare Tunnel) |
| `K8S_AUTH_TOKEN`             | Long-lived ServiceAccount token                                   |
| `CODE_SERVER_DOMAIN`         | Default: `codelearn.tkweb.site`                                   |
| `CODE_SERVER_TLS_SECRET`     | Default: `wildcard-codelearn-tls`                                 |
| `CODE_SERVER_CLEANUP_SECRET` | Random secret for cleanup API auth                                |

---

## Troubleshooting

**Pods stay in `Pending`**  
PVC can't be provisioned. Check the storage class exists:

```bash
kubectl get storageclass
# Should show: local-path (default)
```

**Wildcard TLS cert not ready**  
Check cert-manager logs and certificate status:

```bash
kubectl -n codelearn describe certificate wildcard-codelearn-cert
kubectl -n cert-manager logs -l app=cert-manager --tail=50
```

**Iframe shows "Bad Gateway" or connection refused**  
The user's code-server pod is not ready yet. Wait a few seconds and reload. If it persists:

```bash
kubectl get pod cs-<slug> -n codelearn
kubectl describe pod cs-<slug> -n codelearn
kubectl get ingress cs-ing-<slug> -n codelearn
```

**Iframe blocked by browser**  
Check that `next.config.ts` has `frame-src https://*.codelearn.tkweb.site` in the CSP header.
