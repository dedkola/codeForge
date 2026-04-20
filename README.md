# CodeForge

Interactive coding lessons with a live per-user VS Code workspace. The Next.js app serves lesson content, authenticates users with Better Auth, and creates an isolated code-server Pod + Service + Ingress + PVC for each user in Kubernetes.

## Commands

```bash
pnpm install
pnpm dev
pnpm lint
pnpm build
```

There is no automated test suite.

## Big picture

```text
Browser
  ├── Next.js app
  │     ├── /login, /signup            Better Auth + PostgreSQL
  │     ├── /lessons                   Lesson catalog
  │     ├── /lessons/[slug]            Lesson markdown + code-server iframe
  │     └── /api/code-server/*         Ensure / status / reset / cleanup
  │
  └── iframe -> https://<slug>.codelearn.tkweb.site
                 └── per-user code-server Pod + Service + Ingress + PVC

Kubernetes (namespace: codelearn)
  ├── Traefik ingress controller
  ├── cert-manager ClusterIssuer + wildcard Certificate
  ├── RBAC for codeforge-sa
  ├── Cleanup CronJob (calls /api/code-server/cleanup)
  └── Optional cloudflared Deployment for remote K8s API access
```

Key runtime pieces:

- `app/lessons/[slug]/page.tsx` authenticates the user, calls `await connection()`, ensures the workspace exists, and passes the workspace URL into the split layout.
- `components/CodeServerPanel.tsx` owns the iframe UX and polls `/api/code-server/status` while the pod is starting.
- `lib/code-server-orchestrator.ts` coordinates PostgreSQL state, K8s resource creation, status checks, cleanup, and workspace reset.
- `lib/code-server-k8s.ts` creates the dynamic Pod / Service / Ingress / PVC resources using deterministic names based on `sha256(userId).slice(0, 32)`.
- `code-server/Dockerfile` builds the custom workspace image used by user Pods. `code-server/entrypoint.sh` seeds `/home/coder/ws-<resetCount>` from `/home/coder/template` and creates lesson-scoped folders under `lessons/<templateSlug>`.

## Project structure

```text
app/                    App Router pages and API routes
components/             Client components for auth, layout, and iframe UX
lib/                    Auth, DB, K8s client, and code-server orchestration
data/                   Lesson metadata and markdown content
code-server/            Custom code-server image and workspace entrypoint
k8s/                    Kustomize base/overlays, TLS manifests, secret examples
docs/                   Infra-specific runbooks (for example remote K8s API access)
UPDATE.md               Current operations and troubleshooting guide
```

## Step-by-step setup

### 1. Install dependencies

```bash
pnpm install
cp .env.example .env.local
```

Fill in at least:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- OAuth client IDs/secrets if you want Google or GitHub login
- `K8S_NAMESPACE=codelearn`
- `CODE_SERVER_DOMAIN`
- `CODE_SERVER_TLS_SECRET`
- `CODE_SERVER_IMAGE`
- `CODE_SERVER_CLEANUP_SECRET`

If you are developing on the same machine that already has kubeconfig access to the cluster, leave `K8S_API_SERVER` and `K8S_AUTH_TOKEN` empty and the app will use `~/.kube/config`.

### 2. Use the custom code-server image

The repo expects a custom image, not the stock `ghcr.io/coder/code-server`, because the custom image installs Node.js + pnpm and seeds starter workspaces.

Default image used in the examples:

```bash
CODE_SERVER_IMAGE=ghcr.io/dedkola/codeforge-cs:latest
```

To rebuild and push your own image:

```bash
gh workflow run build-code-server.yml
```

Or build locally from `code-server/` if you want to publish your own tag.

### 3. Set up the wildcard workspace domain

1. Point `*.codelearn.tkweb.site` to the public IP that serves Traefik.
2. Forward ports `80` and `443` to the K3s node.
3. Install cert-manager:

   ```bash
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.17.2/cert-manager.yaml
   kubectl -n cert-manager rollout status deploy --timeout=120s
   ```

4. Create the Cloudflare DNS token secret used by the ClusterIssuer:

   ```bash
   kubectl -n cert-manager create secret generic cloudflare-api-token-secret \
     --from-literal=api-token=<your-cloudflare-api-token>
   ```

5. Apply the issuer and wildcard certificate:

   ```bash
   kubectl apply -f k8s/ssl/clusterissuer.yaml
   kubectl apply -f k8s/ssl/cert.yaml
   kubectl -n codelearn get certificate
   ```

The current certificate manifest issues `codelearn.tkweb.site` and `*.codelearn.tkweb.site` into the `wildcard-codelearn-tls` secret.

### 4. Apply the cluster resources

The active Kustomize layout is:

- `k8s/base` - namespace, RBAC, cleanup CronJob, network policy, limit range
- `k8s/overlays/prod` - base + wildcard TLS manifests
- `k8s/optional/cloudflared` - optional in-cluster Cloudflare Tunnel Deployment for remote K8s API access
- `k8s` - root umbrella that points at `overlays/prod`

Apply the main stack:

```bash
kubectl apply -k k8s
```

This creates the namespace, `codeforge-sa`, cleanup CronJob, and the wildcard certificate resources.

### 5. Create the secret used by the cleanup CronJob (and optionally by your app deployment)

Copy the example, fill in real values, and apply it:

```bash
cp k8s/secrets.yaml.example k8s/secrets.yaml
kubectl apply -f k8s/secrets.yaml
```

Important keys in that secret:

- `CODEFORGE_APP_URL` - the base URL the cleanup CronJob should call, for example `https://codeforge.tkweb.site`
- `CODE_SERVER_CLEANUP_SECRET` - bearer token checked by `/api/code-server/cleanup`
- `CODE_SERVER_IMAGE` - custom code-server image tag

### 6. Choose how the app reaches Kubernetes

#### Option A: Local dev or app running on a machine with kubeconfig

Leave `K8S_API_SERVER` and `K8S_AUTH_TOKEN` unset. `lib/k8s.ts` will use the default kubeconfig.

#### Option B: App running inside the cluster

Do not set `K8S_API_SERVER` or `K8S_AUTH_TOKEN`. The client will auto-detect in-cluster credentials via the pod ServiceAccount.

#### Option C: App running outside the cluster

Expose the K3s API through Cloudflare Tunnel, then set:

```bash
K8S_API_SERVER=https://k8s.tkweb.site
K8S_AUTH_TOKEN=<token created below>
K8S_SKIP_TLS_VERIFY=false
```

If you want the Cloudflare Tunnel to run inside the cluster, create the secret and apply the optional overlay:

```bash
cp k8s/cloudflared-secret.yaml.example k8s/cloudflared-secret.yaml
kubectl apply -f k8s/cloudflared-secret.yaml
kubectl apply -k k8s/optional/cloudflared
```

For the full tunnel flow, see `docs/K3S-CLOUDFLARE-TUNNEL-API-ACCESS.md`.

### 7. Create a ServiceAccount token for external app access

If the app is running outside the cluster, mint a token for `codeforge-sa`:

```bash
kubectl -n codelearn create token codeforge-sa --duration=8760h
```

Use that token as `K8S_AUTH_TOKEN`.

### 8. Start the app

```bash
pnpm dev
```

Open a lesson, log in, and verify the full flow:

1. Lesson page loads.
2. A Pod / Service / Ingress / PVC named from `cs-<slug>` is created in `codelearn`.
3. The iframe eventually loads `https://<slug>.codelearn.tkweb.site/?folder=/home/coder/ws-<n>/lessons/<templateSlug>`.

Useful checks:

```bash
kubectl get pods -n codelearn -l app=code-server-user
kubectl get ingress -n codelearn
kubectl get pvc -n codelearn
kubectl logs -n codelearn job.batch/cs-cleanup --tail=100
```

## Cleanup behavior

- The app stores workspace lifecycle state in the `code_server_instance` table.
- The cleanup CronJob runs every 30 minutes.
- It calls `/api/code-server/cleanup` with `CODE_SERVER_CLEANUP_SECRET`.
- The cleanup route deletes stale user Pods / Services / Ingresses after `CODE_SERVER_MAX_IDLE_MINUTES`.
- PVCs are preserved unless the user triggers a workspace reset or you delete the PVC manually.

## Related docs

- `UPDATE.md` - operations, rollout, and troubleshooting
- `docs/K3S-CLOUDFLARE-TUNNEL-API-ACCESS.md` - remote K8s API setup
- `k8s/README.md` - Kustomize layout and secret files
- `code-server/README.md` - custom workspace image details
