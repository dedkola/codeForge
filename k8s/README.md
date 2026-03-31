# CodeLearn — k8s Deployment

Deploy code-server (VS Code in browser) on k3s with `ingress-nginx`.

## Prerequisites

- k3s cluster running
- nginx-ingress-controller installed:

  ```bash
  # Install nginx ingress on k3s (disable default Traefik first if needed)
  kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.12.0/deploy/static/provider/cloud/deploy.yaml
  ```

- kubectl configured to talk to your cluster

## Deploy

Apply manifests in order:

```bash
kubectl apply -f namespace.yaml
kubectl apply -f code-server-pvc.yaml
kubectl apply -f code-server-deployment.yaml
kubectl apply -f code-server-service.yaml
kubectl apply -f code-server-ingress.yaml
```

Or all at once:

```bash
kubectl apply -f .
```

## Verify

```bash
kubectl -n codelearn get pods
kubectl -n codelearn get svc
kubectl -n codelearn get ingress
```

The pod should show `Running` and the ingress should have an `ADDRESS` assigned.

## NGINX Ingress Notes

- `code-server-ingress.yaml` is configured for the `nginx` ingress class.
- `code-server-service.yaml` exposes port `80` inside the cluster and forwards to container port `80`.
- If you have a DNS name, add `host: code.your-domain.tld` under `spec.rules` in `code-server-ingress.yaml`.
- If you do not use DNS yet, you can still access it through the ingress IP or load balancer address.

## TLS for Browser + Iframe

When code-server is rendered in an iframe, the browser requires a valid trusted certificate.
If TLS is untrusted/self-signed, iframe loading fails with SSL errors.

- For public DNS names, use a trusted ACME issuer (for example Let's Encrypt) in `cert-manager.io/cluster-issuer`.
- For private/internal CA issuers (like `lan-ca`), install that CA root certificate in the client OS/browser trust store.
- Verify certificate chain and host match:

```bash
openssl s_client -connect cs.doc.tk.com:443 -servername cs.doc.tk.com </dev/null 2>/dev/null | openssl x509 -noout -issuer -subject -dates
```

The URL configured in the frontend must be HTTPS and trusted, for example:

```bash
NEXT_PUBLIC_CODE_SERVER_URL=https://cs.doc.tk.com
```

## Connect the Frontend

1. Copy the env example:

   ```bash
   cp frontend/.env.local.example frontend/.env.local
   ```

2. Edit `frontend/.env.local` and set the URL to your code-server:

   ```env
   # If using ingress (replace with your ingress address):
   NEXT_PUBLIC_CODE_SERVER_URL=http://<ingress-ip>

   # If using port-forward:
   NEXT_PUBLIC_CODE_SERVER_URL=http://localhost:8080
   ```

3. Start the frontend:

   ```bash
   cd frontend
   npm run dev
   ```

4. Open <http://localhost:3000>

## Port-Forward Alternative

If you don't want to use Ingress, you can port-forward directly:

```bash
kubectl -n codelearn port-forward svc/code-server 8080:80
```

Then set `NEXT_PUBLIC_CODE_SERVER_URL=http://localhost:8080` in your `.env.local`.

## Authentication Mode

This setup runs code-server with `--auth=none` for seamless UI embedding.

If you need password auth later:

1. Add a `PASSWORD` env var in `code-server-deployment.yaml` (or use `HASHED_PASSWORD`).
2. Re-apply the deployment and restart the pod.

Note: password auth in code-server will always show a login screen before IDE access.
