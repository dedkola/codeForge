# CodeForge Refactor + Deployment Guide

## 1) What changed

This refactor focused on making the platform predictable, easier to operate, and safer for per-user isolated workspaces.

### Runtime/code changes

- Added centralized runtime policy in `lib/code-server-config.ts`.
  - `CODE_SERVER_IMAGE`
  - `CODE_SERVER_STORAGE_CLASS`
  - `CODE_SERVER_PVC_SIZE`
  - `CODE_SERVER_MAX_IDLE_MINUTES`
  - `CODE_SERVER_POD_READY_TIMEOUT_MS`
  - `CS_PROXY_URL` normalization helper
- Extracted orchestrator logic into `lib/code-server-orchestrator.ts`.
- Kept compatibility via `lib/code-server-manager.ts` (re-exports orchestrator APIs).
- Added one URL builder in `lib/code-server-url.ts` so all entry points generate the same per-user proxy URL.
- Updated API routes and lesson page to use shared URL/runtime policy helpers.

### Kubernetes/platform changes

- Added workload safety policy:
  - `k8s/networkpolicy-code-server-user.yaml`
  - `k8s/limitrange-code-server-user.yaml`
- Introduced Kustomize structure:
  - `k8s/base/kustomization.yaml`
  - `k8s/base/cs-proxy/kustomization.yaml`
  - `k8s/overlays/prod/kustomization.yaml`
  - `k8s/overlays/dev/kustomization.yaml`
- Root `k8s/kustomization.yaml` is now umbrella entrypoint for full stack deployment.
- Added CI manifest validation workflow:
  - `.github/workflows/validate-kustomize.yml`

## 2) How it works now

1. User signs in through Better Auth.
2. App ensures per-user runtime exists:
   - Pod: `cs-<slug>`
   - Service: `cs-svc-<slug>`
   - PVC: `cs-pvc-<slug>`
3. App signs JWT with service claim and returns:
   - `https://cs-proxy.tkweb.site/u/<slug>/?token=<jwt>`
4. `cs-proxy` validates token and slug/service mapping.
5. Proxy sets `cs_session` cookie scoped to `/u/<slug>` and forwards HTTP/WebSocket to the user service.
6. Cleanup job stops idle pods; PVC remains persistent by design.

## 3) New deployment layout

Use these entry points:

- Full stack (prod): `k8s/` (umbrella)
- Explicit prod overlay: `k8s/overlays/prod`
- Dev overlay: `k8s/overlays/dev`

Overlay content:

- `base`: namespace + app infra + runtime policies
- `prod`: base + secrets + cs-proxy
- `dev`: prod-like stack + reduced replicas

## 4) Required config before deploy

## Secrets

Edit `k8s/secrets.yaml` with real values:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `CS_PROXY_SECRET`

## GHCR pull secret

Create image pull secret once:

```bash
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<github-user> \
  --docker-password=<github-pat-read-packages> \
  --docker-email=<email> \
  -n codelearn
```

## Optional runtime tuning

Set env vars in app deployment if needed:

- `CODE_SERVER_IMAGE`
- `CODE_SERVER_STORAGE_CLASS`
- `CODE_SERVER_PVC_SIZE`
- `CODE_SERVER_MAX_IDLE_MINUTES`
- `CODE_SERVER_POD_READY_TIMEOUT_MS`

## 5) Deploy everything together

### Option A: umbrella deploy (recommended)

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -k k8s
```

### Option B: explicit environment overlay

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -k k8s/overlays/prod
# or
kubectl apply -k k8s/overlays/dev
```

Notes:

- `k8s/base` and `k8s/base/cs-proxy` are the canonical manifest sources used by overlays.
- Legacy manifests under `cs-proxy/k8s` are retained for backward compatibility, but overlays use the canonical in-tree path.

## 6) CI/CD flow

1. GitHub Actions builds and pushes app/proxy images.
2. Flux watches image tags and updates manifests (if Flux image automation is configured in-cluster).
3. Cluster reconciles desired state.
4. Additional CI (`validate-kustomize.yml`) ensures manifest graph is valid on push/PR.

## 7) Post-deploy verification checklist

```bash
kubectl get pods -n codelearn
kubectl get svc -n codelearn
kubectl get ingress -n codelearn
kubectl get networkpolicy -n codelearn
kubectl get limitrange -n codelearn
kubectl get pvc -n codelearn
```

Functional checks:

1. Login works.
2. Opening a lesson creates/uses user workspace.
3. Iframe loads through `cs-proxy.tkweb.site/u/<slug>/...`.
4. WebSocket terminal/editor is stable.
5. Idle cleanup removes pod and service but keeps PVC.

## 8) What to change next (recommended)

1. Add `k8s/overlays/staging` for pre-prod promotion.
2. Add per-user namespace mode behind feature flag in orchestrator.
3. Add orphan PVC report + admin cleanup workflow.
4. Add secret rotation strategy for `CS_PROXY_SECRET`.
5. Add policy checks in CI (e.g., kubeconform/conftest).
