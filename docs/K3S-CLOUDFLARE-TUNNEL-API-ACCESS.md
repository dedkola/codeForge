# K3s API Access via Cloudflare Tunnel

Use this when the Next.js app runs outside the cluster and still needs to create per-user workspace resources through the Kubernetes API.

This tunnel is only for the Kubernetes API. User workspaces still load through the wildcard Traefik ingress on `*.codelearn.tkweb.site`.

## What this solves

```text
External app (local / Vercel / VPS)
  -> https://k8s.tkweb.site
  -> Cloudflare Tunnel
  -> K3s API on localhost:6443

Browser iframe
  -> https://<slug>.codelearn.tkweb.site
  -> Traefik Ingress
  -> per-user code-server Service
```

## Prerequisites

- K3s cluster running
- `kubectl` access to the cluster
- Cloudflare account for the domain
- Wildcard workspace domain already set up for `*.codelearn.tkweb.site`

## Step 1 - Create the tunnel in Cloudflare

Create a tunnel that forwards:

- hostname: `k8s.tkweb.site`
- service: `https://localhost:6443`

If you prefer the CLI flow, the equivalent local config is:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /root/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: k8s.tkweb.site
    service: https://localhost:6443
    originRequest:
      noTLSVerify: true
  - service: http_status:404
```

`noTLSVerify: true` only applies to the local hop between cloudflared and the K3s API server because K3s normally serves a self-signed cert on port 6443.

## Step 2 - Deploy the optional cloudflared workload in-cluster

Copy the example secret, paste the tunnel token, and apply it:

```bash
cp k8s/cloudflared-secret.yaml.example k8s/cloudflared-secret.yaml
kubectl apply -f k8s/cloudflared-secret.yaml
kubectl apply -k k8s/optional/cloudflared
```

This deploys the `cloudflared` Deployment from `k8s/optional/cloudflared/deployment.yaml`.

If you already run cloudflared elsewhere, you can skip this overlay entirely.

## Step 3 - Create a ServiceAccount token for the app

Apply the main Kustomize stack if you have not already:

```bash
kubectl apply -k k8s
```

Then create a token for `codeforge-sa`:

```bash
kubectl -n codelearn create token codeforge-sa --duration=8760h
```

Use that value as `K8S_AUTH_TOKEN`.

## Step 4 - Configure the app environment

Set these in `.env.local` or in your deployment platform:

```bash
K8S_API_SERVER=https://k8s.tkweb.site
K8S_AUTH_TOKEN=<service-account-token>
K8S_SKIP_TLS_VERIFY=false
K8S_NAMESPACE=codelearn
```

`K8S_SKIP_TLS_VERIFY=false` is correct when the public hostname terminates with a valid Cloudflare-served certificate.

## Step 5 - Verify the tunnel

From a machine outside the cluster:

```bash
curl -s -H "Authorization: Bearer <TOKEN>" \
  https://k8s.tkweb.site/api/v1/namespaces/codelearn/pods | head -20
```

If the token and tunnel are correct, you should get a JSON response.

## Step 6 - Verify end-to-end from the app

1. Start the app with `pnpm dev`
2. Log in
3. Open a lesson
4. Confirm a `cs-<slug>` Pod is created in `codelearn`
5. Confirm the iframe opens `https://<slug>.codelearn.tkweb.site`

Useful commands:

```bash
kubectl get pods -n codelearn -l app=cloudflared
kubectl logs -n codelearn -l app=cloudflared --tail=100
kubectl get pods -n codelearn -l app=code-server-user
```

## Troubleshooting

| Problem | Check |
| --- | --- |
| `401 Unauthorized` from `k8s.tkweb.site` | Regenerate the `codeforge-sa` token |
| `403 Forbidden` | Verify the `codeforge-sa` Role and RoleBinding in `k8s/base/rbac.yaml` |
| Tunnel pod failing | Check `cloudflared-secret` and `kubectl logs -n codelearn -l app=cloudflared` |
| App cannot reach K8s API | Verify `K8S_API_SERVER`, `K8S_AUTH_TOKEN`, and `K8S_SKIP_TLS_VERIFY=false` |
| Workspace pods created but iframe fails | The issue is likely wildcard ingress/TLS, not the K8s API tunnel |
