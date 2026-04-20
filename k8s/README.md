# Kubernetes manifests

This directory contains the Kubernetes resources that support dynamic user workspaces.

## Layout

```text
k8s/base/                  namespace + RBAC + cleanup CronJob + policy + limits
k8s/overlays/prod/         base + TLS resources
k8s/overlays/dev/          same as prod today
k8s/optional/cloudflared/  optional Cloudflare Tunnel deployment for K8s API access
k8s/ssl/                   ClusterIssuer + wildcard Certificate
k8s/secrets.yaml.example   example Secret for cleanup/app runtime values
k8s/cloudflared-secret.yaml.example
                           example Secret for the optional cloudflared Deployment
```

## Apply manifests

Apply the main stack:

```bash
kubectl apply -k k8s
```

Apply the optional Cloudflare Tunnel deployment:

```bash
kubectl apply -f k8s/cloudflared-secret.yaml
kubectl apply -k k8s/optional/cloudflared
```

## Secrets you must provide

### `codeforge-secrets`

Create from `k8s/secrets.yaml.example`.

Important keys:

- `CODEFORGE_APP_URL`
- `CODE_SERVER_CLEANUP_SECRET`
- `CODE_SERVER_IMAGE`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `DATABASE_URL`

The cleanup CronJob reads `CODEFORGE_APP_URL` and `CODE_SERVER_CLEANUP_SECRET` from this Secret.

### `cloudflared-secret`

Create from `k8s/cloudflared-secret.yaml.example` only if you want the optional in-cluster Cloudflare Tunnel deployment.

## Validation

The repo validates these Kustomize entry points in CI:

- `k8s/overlays/prod`
- `k8s/overlays/dev`
- `k8s/optional/cloudflared`
- `k8s`
