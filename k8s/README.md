# Kubernetes manifests

This directory contains the Kubernetes resources that support dynamic user workspaces.

## Layout

```text
k8s/base/                  namespace + RBAC + cleanup CronJob + policy + limits
k8s/overlays/prod/         base + TLS resources
k8s/overlays/dev/          same as prod today
k8s/ssl/                   ClusterIssuer + wildcard Certificate
k8s/secrets.yaml.example   example Secret for cleanup/app runtime values
```

## Apply manifests

Apply the main stack:

```bash
kubectl apply -k k8s
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

## Validation

The repo validates these Kustomize entry points in CI:

- `k8s/overlays/prod`
- `k8s/overlays/dev`
- `k8s`
