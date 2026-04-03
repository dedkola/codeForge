# K3s Codelearn Namespace: Next Steps (Nginx + Wildcard SSL)

This guide assumes:

- Your app namespace is `codelearn`
- Cloudflare Tunnel is used only for K3s API access (`k8s.tkweb.site`)
- User workspaces are exposed by nginx ingress with cert-manager TLS
- Workspace hosts use `https://<slug>.cs.tkweb.site`

## 1) Verify required controllers

```bash
kubectl get ns
kubectl get pods -n cert-manager
kubectl get pods -n ingress-nginx
```

Expected:

- `cert-manager` pods are running
- `ingress-nginx` controller pod is running

If your nginx controller is not in `ingress-nginx`, update the NetworkPolicy namespace selector accordingly.

## 2) Create Cloudflare API token secret for cert-manager

Create a Cloudflare token with DNS edit permissions for `tkweb.site` zone.

```bash
cp k8s/ssl/cloudflare-api-token-secret.example.yaml /tmp/cloudflare-api-token-secret.yaml
```

Edit `/tmp/cloudflare-api-token-secret.yaml` and set `stringData.api-token`.

Apply it to cert-manager namespace:

```bash
kubectl apply -f /tmp/cloudflare-api-token-secret.yaml
```

## 3) Apply cert-manager issuer + wildcard certificate

```bash
kubectl apply -k k8s/ssl
```

Check progress:

```bash
kubectl get clusterissuer cloudflare-issuer
kubectl get certificate -n codelearn wildcard-cs
kubectl describe certificate -n codelearn wildcard-cs
kubectl get secret -n codelearn wildcard-cs-tls
```

Wait until certificate is `Ready=True`.

## 4) Confirm wildcard DNS for workspace hosts

Create DNS records so workspace subdomains resolve to your nginx ingress public IP.

Required hostname pattern:

- `*.cs.tkweb.site`

Validate:

```bash
dig +short test.cs.tkweb.site
kubectl get svc -n ingress-nginx
```

## 5) Configure app environment

In your runtime environment (`.env.local` or host secrets), set:

```dotenv
K8S_NAMESPACE=codelearn
CODE_SERVER_DOMAIN=cs.tkweb.site
CODE_SERVER_TLS_SECRET=wildcard-cs-tls
CODE_SERVER_CLEANUP_SECRET=<strong-random-secret>
```

Restart your app after env changes.

## 6) Apply project manifests (prod)

```bash
kubectl apply -f k8s/secrets.yaml
kubectl apply -k k8s/overlays/prod
```

`k8s/overlays/prod` already includes:

- base resources
- `k8s/ssl` resources

## 7) Verify NetworkPolicy allows ingress correctly

The policy now allows traffic to `code-server-user` pods from:

- `app=cloudflared` pods in `codelearn`
- any pod in `ingress-nginx` namespace
- nginx controller pods in `codelearn` with label `app.kubernetes.io/name=ingress-nginx`

Check applied policy:

```bash
kubectl get networkpolicy -n codelearn code-server-user-ingress -o yaml
```

## 8) End-to-end test

1. Log in to CodeForge.
2. Open a lesson and start workspace.
3. Confirm Ingress is created:

```bash
kubectl get ingress -n codelearn | grep cs-ing-
```

4. Open the generated URL and verify valid TLS certificate:

- `https://<slug>.cs.tkweb.site`

## 9) Troubleshooting quick checks

Certificate not ready:

```bash
kubectl describe challenge -A
kubectl describe order -A
```

Ingress created but workspace not reachable:

```bash
kubectl get ingress -n codelearn
kubectl describe ingress -n codelearn <ingress-name>
kubectl get endpoints -n codelearn
```

NetworkPolicy blocking:

```bash
kubectl describe networkpolicy -n codelearn code-server-user-ingress
kubectl get pods -n ingress-nginx --show-labels
kubectl get pods -n codelearn --show-labels
```

If nginx runs in a different namespace or has different labels, update:

- `k8s/base/networkpolicy-code-server-user.yaml`
- `k8s/networkpolicy-code-server-user.yaml`

and re-apply manifests.
