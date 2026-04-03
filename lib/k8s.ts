import * as k8s from "@kubernetes/client-node";

let _coreV1Api: k8s.CoreV1Api | null = null;

function getKubeConfig(): k8s.KubeConfig {
  const kc = new k8s.KubeConfig();

  if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster();
  } else if (process.env.K8S_API_SERVER && process.env.K8S_AUTH_TOKEN) {
    kc.loadFromOptions({
      clusters: [
        {
          name: "remote",
          server: process.env.K8S_API_SERVER,
          skipTLSVerify: process.env.K8S_SKIP_TLS_VERIFY === "true",
        },
      ],
      users: [{ name: "token-user", token: process.env.K8S_AUTH_TOKEN }],
      contexts: [{ name: "remote-ctx", cluster: "remote", user: "token-user" }],
      currentContext: "remote-ctx",
    });
  } else {
    kc.loadFromDefault();
  }

  return kc;
}

export function getCoreV1Api(): k8s.CoreV1Api {
  if (!_coreV1Api) {
    _coreV1Api = getKubeConfig().makeApiClient(k8s.CoreV1Api);
  }
  return _coreV1Api;
}

export const NAMESPACE = process.env.K8S_NAMESPACE ?? "codelearn";
