# CodeForge — Deployment & Operations Guide

## How it all fits together

```
User browser
    │
    ├── https://codeforge.tkweb.site  (Next.js app)
    │       │  - Login (Better Auth)
    │       │  - Lesson pages
    │       │  - Creates K8s pod/PVC/Service per user on demand
    │       │
    │       └── calls K8s API (in-cluster via ServiceAccount)
    │
    └── https://<slug>.cs-proxy.tkweb.site  (cs-proxy)
            │  - Verifies JWT token → sets per-user subdomain cookie
            │  - Reverse-proxies HTTP + WebSocket to the user's code-server pod
            │
            └── http://cs-svc-<slug>.codelearn.svc.cluster.local:80
                    └── code-server pod  (VS Code in browser)
                            └── PVC: /home/coder/project  (1 Gi, per user, persists)
```

### Kubernetes namespace: `codelearn`

Everything lives in the `codelearn` namespace:

| Resource | Name pattern | What it is |
|---|---|---|
| Deployment | `codeforge` | Next.js app (3 replicas) |
| Deployment | `cs-proxy` | Reverse proxy (1 replica) |
| Service | `codeforge-service` | Routes traffic to Next.js pods |
| Service | `cs-proxy` | Routes traffic to cs-proxy pod |
| Ingress | `codeforge-ingress` | `codeforge.tkweb.site` → codeforge-service |
| Ingress | `cs-proxy` | `*.cs-proxy.tkweb.site` → cs-proxy service |
| CronJob | `cs-cleanup` | Deletes idle code-server pods every 30 min |
| Secret | `codeforge-secrets` | All env secrets |
| ServiceAccount | `codeforge-sa` | Gives Next.js app permission to manage pods |
| Pod (dynamic) | `cs-<slug>` | Per-user code-server instance |
| Service (dynamic) | `cs-svc-<slug>` | Per-user ClusterIP service |
| PVC (dynamic) | `cs-pvc-<slug>` | Per-user 1 Gi workspace volume |

---

## How per-user code-server instances work

1. User logs in → navigates to a lesson page
2. The Next.js server calls `ensureUserCodeServer(userId)`:
   - Computes a deterministic 12-char hex slug: `sha256(userId).slice(0,12)`
   - Creates a PVC `cs-pvc-<slug>` (1 Gi, `local-path`, persists across pod restarts)
   - Creates a pod `cs-<slug>` running `codercom/code-server:latest`  
     workspace dir: `/home/coder/project` (mounted from PVC)
   - Creates a ClusterIP service `cs-svc-<slug>` pointing at that pod
   - Waits up to 15 s for the pod readiness probe to pass
3. App generates a signed JWT: `{ sub: userId, svc: "cs-svc-<slug>", exp: 8h }`
4. Frontend renders an `<iframe>` pointing to `https://<slug>.cs-proxy.tkweb.site/?token=<JWT>`
5. cs-proxy verifies the JWT, sets a `cs_session` cookie **scoped to `<slug>.cs-proxy.tkweb.site`** (subdomain isolation — each user's cookie is on their own subdomain so no user can accidentally get routed to another user's pod), then redirects to `/`
6. All subsequent requests from within the iframe use the cookie; cs-proxy reads the `svc` from the JWT stored in the cookie and proxies to `http://cs-svc-<slug>.codelearn.svc.cluster.local:80`

**Persistence:** The PVC is never deleted automatically. The pod is deleted by the CronJob after 120 min idle (no lesson page open), but the next visit recreates the pod and remounts the same PVC — files are always there.

---

## First-time cluster setup (do once)

### Prerequisites
- k3s running, `kubectl` pointing at it
- `ghcr-secret` image pull secret created in `codelearn` namespace (for GHCR)
- Cloudflared tunnel configured for `codeforge.tkweb.site` and `*.cs-proxy.tkweb.site`
- DNS: both `codeforge.tkweb.site` and `*.cs-proxy.tkweb.site` → cloudflared tunnel

### 1. Create the namespace

```bash
kubectl apply -f code-server/namespace.yaml
```

### 2. Create the GHCR image pull secret

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<your-github-username> \
  --docker-password=<github-PAT-with-read:packages> \
  --docker-email=<your-email> \
  -n codelearn
```

### 3. Edit secrets before deploying

Open `k8s/secrets.yaml` and set real values for every key — especially:
- `CS_PROXY_SECRET` — random 32+ char string (shared between Next.js and cs-proxy)
- `DATABASE_URL` — your Neon (or other Postgres) connection string
- `BETTER_AUTH_SECRET` — random secret for session signing
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — from Google Cloud Console

### 4. Deploy the main app

```bash
kubectl apply -k k8s/
```

This applies: Deployment, Service, Ingress, RBAC, Secret, ConfigMap, CronJob — all in `codelearn`.

Verify:
```bash
kubectl get pods -n codelearn
# codeforge-xxxxxxxxx-xxxxx   1/1   Running   ...
```

### 5. Build and deploy cs-proxy (one time, then only if server.js changes)

```bash
# Build and push the cs-proxy image
docker build -t ghcr.io/dedkola/cs-proxy:latest ./cs-proxy
docker push ghcr.io/dedkola/cs-proxy:latest

# Deploy cs-proxy to the cluster
kubectl apply -f cs-proxy/k8s/
```

Verify:
```bash
kubectl get pods -n codelearn
# cs-proxy-xxxxxxxxx-xxxxx    1/1   Running   ...
```

### 6. Cloudflared wildcard routing

In your cloudflared tunnel config (usually `~/.cloudflared/config.yml` or the Cloudflare dashboard), make sure both domains route to your k3s ingress:

```yaml
ingress:
  - hostname: "codeforge.tkweb.site"
    service: https://<k3s-node-ip>:443
    originRequest:
      noTLSVerify: true          # if using self-signed cert on ingress
  - hostname: "*.cs-proxy.tkweb.site"
    service: https://<k3s-node-ip>:443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

> **Note:** Wildcard hostnames in cloudflared require the tunnel to be configured via the config file or Cloudflare dashboard (not `cloudflared tunnel route dns`). Cloudflare's Universal SSL covers `*.cs-proxy.tkweb.site` automatically on proxied DNS records — no cert-manager wildcard cert needed.

---

## Redeploying the Next.js app (normal workflow)

GitHub Actions handles this automatically on every push to `main`:

1. Push code to `main`
2. GitHub Actions (`.github/workflows/docker-build.yml`) builds a multi-arch Docker image and pushes two tags to GHCR:
   - `ghcr.io/dedkola/codeforge:latest`
   - `ghcr.io/dedkola/codeforge:<timestamp>-<sha>` (e.g. `20260401121306-681a865`)
3. **Manually roll out the new image** on the cluster:

```bash
# Option A — force pull of :latest
kubectl rollout restart deployment/codeforge -n codelearn

# Option B — pin to a specific tag (edit deployment.yaml image line, then apply)
kubectl apply -f k8s/deployment.yaml
```

> The `deployment.yaml` has a Flux CD image policy comment (`{"$imagepolicy": ...}`). If you set up [Flux CD image automation](https://fluxcd.io/flux/guides/image-update/), it will automatically update the image tag in Git and apply it to the cluster whenever a new tag is pushed. Without Flux, use option A or B above.

Check rollout status:
```bash
kubectl rollout status deployment/codeforge -n codelearn
```

---

## Redeploying cs-proxy (only when `cs-proxy/server.js` changes)

```bash
docker build -t ghcr.io/dedkola/cs-proxy:latest ./cs-proxy
docker push ghcr.io/dedkola/cs-proxy:latest
kubectl rollout restart deployment/cs-proxy -n codelearn
```

---

## Updating K8s manifests (secrets, config, RBAC, etc.)

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

# Tail Next.js app logs
kubectl logs -n codelearn -l app=codeforge --tail=100 -f

# Tail cs-proxy logs
kubectl logs -n codelearn -l app=cs-proxy --tail=100 -f

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

All injected from `codeforge-secrets` Secret:

| Variable | Used by | Description |
|---|---|---|
| `DATABASE_URL` | Next.js | Postgres connection string (Neon) |
| `BETTER_AUTH_SECRET` | Next.js | Session signing secret |
| `BETTER_AUTH_URL` | Next.js | Public URL of the app |
| `BETTER_AUTH_API_KEY` | Next.js | Better Auth dashboard key |
| `GOOGLE_CLIENT_ID` | Next.js | OAuth |
| `GOOGLE_CLIENT_SECRET` | Next.js | OAuth |
| `CS_PROXY_SECRET` | Next.js + cs-proxy | Shared secret for JWT signing |
| `CS_PROXY_URL` | Next.js | Set in deployment.yaml as plain env (not secret): `https://cs-proxy.tkweb.site` |

---

## Troubleshooting

**Pods stay in `Pending`**  
PVC can't be provisioned. Check the storage class exists:
```bash
kubectl get storageclass
# Should show: local-path (default)
```

**`ImagePullBackOff` on codeforge pod**  
The `ghcr-secret` pull secret is missing or expired:
```bash
kubectl describe pod <pod-name> -n codelearn | grep -A5 Events
```

**Users see 401 in the iframe**  
The `CS_PROXY_SECRET` in `codeforge-secrets` doesn't match the one in the cs-proxy deployment env. Both must be identical.

**Iframe shows "Bad Gateway"**  
The user's code-server pod is not ready yet. Wait a few seconds and reload. If it persists:
```bash
kubectl get pod cs-<slug> -n codelearn
kubectl describe pod cs-<slug> -n codelearn
```

**Two users see the same files**  
This was a cookie isolation bug (fixed). All user proxy URLs must use the per-user subdomain format `https://<slug>.cs-proxy.tkweb.site`. Verify the `CS_PROXY_URL` env var in `k8s/deployment.yaml` is `https://cs-proxy.tkweb.site` (no slug — the slug is prepended at runtime in the API routes).
