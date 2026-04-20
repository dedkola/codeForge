# CodeForge - Operations Guide

## Current state

- `pnpm lint` passes
- `pnpm build` passes
- Dynamic workspaces are created by the Next.js app through the Kubernetes API
- The live Kustomize source is `k8s/base` plus overlays; old root-level duplicate manifests have been removed

## Active Kubernetes layout

```text
k8s/base/                  core namespace + RBAC + cleanup + policy + limits
k8s/overlays/prod/         base + wildcard TLS resources
k8s/overlays/dev/          same layout as prod today
k8s/ssl/                   ClusterIssuer + wildcard Certificate
```

`kubectl apply -k k8s` currently targets `k8s/overlays/prod`.

## Workspace lifecycle

1. User opens `/lessons/[slug]`
2. Server component authenticates via Better Auth
3. `ensureUserCodeServer()` computes a 32-char hex slug from `sha256(userId)`
4. The app creates or reuses:
   - `cs-<slug>` Pod
   - `cs-svc-<slug>` Service
   - `cs-ing-<slug>` Ingress
   - `cs-pvc-<slug>` PVC
5. The client polls `/api/code-server/status` until the workspace is ready
6. The iframe opens a lesson-scoped folder under `/home/coder/ws-<resetCount>/lessons/<templateSlug>`

Reset behavior:

- Reset increments `reset_count`
- The next workspace root becomes `/home/coder/ws-<resetCount>`
- This avoids code-server restoring stale tabs from the previous workspace

## Cleanup behavior

- CronJob: `cs-cleanup`
- Schedule: every 30 minutes
- Auth: bearer token from `CODE_SERVER_CLEANUP_SECRET`
- Target URL: `${CODEFORGE_APP_URL}/api/code-server/cleanup`
- Effect: deletes stale Pods / Services / Ingresses, keeps PVCs intact

The CronJob depends on the `codeforge-secrets` Secret, so keep `CODEFORGE_APP_URL` and `CODE_SERVER_CLEANUP_SECRET` current.

## Deploy and roll out

### Re-apply manifests

```bash
kubectl apply -k k8s
```

### Build the custom code-server image

The repo workflow builds `ghcr.io/<repo-owner>/codeforge-cs`.

```bash
gh workflow run build-code-server.yml
```

### Restart the app deployment

If you run the frontend in-cluster:

```bash
kubectl rollout restart deployment/codeforge -n codelearn
kubectl rollout status deployment/codeforge -n codelearn
```

## Troubleshooting

### Wildcard certificate not ready

```bash
kubectl -n codelearn get certificate
kubectl -n codelearn describe certificate wildcard-codelearn
kubectl -n cert-manager logs -l app=cert-manager --tail=100
```

### Dynamic workspace does not load

```bash
kubectl get pods -n codelearn -l app=code-server-user
kubectl describe pod cs-<slug> -n codelearn
kubectl get ingress cs-ing-<slug> -n codelearn
```

### Cleanup job fails

```bash
kubectl get cronjob cs-cleanup -n codelearn
kubectl get jobs -n codelearn
kubectl logs -n codelearn job/<job-name> --tail=100
kubectl get secret codeforge-secrets -n codelearn -o yaml
```

Check that:

- `CODEFORGE_APP_URL` points at the deployed app URL reachable from the cluster
- `CODE_SERVER_CLEANUP_SECRET` matches the app env

### Remote K8s API access fails

```bash
curl -I https://k8s.tkweb.site
```

Also verify:

- `K8S_API_SERVER` matches the tunnel hostname
- `K8S_AUTH_TOKEN` is still valid
- `K8S_SKIP_TLS_VERIFY` is `false` when using a Cloudflare-served hostname with valid TLS

## Useful commands

```bash
kubectl get all -n codelearn
kubectl get pods -n codelearn -l app=code-server-user
kubectl get pvc -n codelearn
kubectl get ingress -n codelearn
kubectl create job --from=cronjob/cs-cleanup manual-cleanup -n codelearn
kubectl delete pod cs-<slug> -n codelearn
kubectl delete pvc cs-pvc-<slug> -n codelearn
```
