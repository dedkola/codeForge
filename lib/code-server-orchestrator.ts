import {
  resourceNames,
  createPVC,
  createPod,
  createService,
  createIngress,
  deletePod,
  deletePVC,
  deleteService,
  deleteIngress,
  getPodStatus,
  waitForPodReady,
} from "./code-server-k8s";
import {
  getInstanceByUserId,
  upsertInstance,
  updateStatus,
  touchLastActive,
  getStaleInstances,
  incrementResetCount,
} from "./code-server-db";
import {
  CODE_SERVER_MAX_IDLE_MINUTES,
  CODE_SERVER_POD_READY_TIMEOUT_MS,
  buildCodeServerUrl,
} from "./code-server-config";

export interface EnsureResult {
  status: "ready" | "starting" | "error";
  url: string;
}

export async function ensureUserCodeServer(
  userId: string,
): Promise<EnsureResult> {
  const { pod, svc, pvc, slug } = resourceNames(userId);

  const existing = await getInstanceByUserId(userId);
  const resetCount = existing?.reset_count ?? 0;
  const url = buildCodeServerUrl(slug, resetCount);

  if (existing && existing.status === "running") {
    const phase = await getPodStatus(userId);
    if (phase === "Running") {
      // Ensure ingress exists even if pod is already running
      await createIngress(userId);
      await touchLastActive(userId);
      return { status: "ready", url };
    }
    await updateStatus(userId, "pending");
  }

  try {
    await createPVC(userId);
    await createPod(userId, resetCount);
    await createService(userId);
    await createIngress(userId);
  } catch (err) {
    console.error(
      `Failed to create code-server resources for user ${userId}:`,
      err,
    );
    await upsertInstance(userId, pod, svc, pvc);
    await updateStatus(userId, "error");
    return { status: "error", url };
  }

  await upsertInstance(userId, pod, svc, pvc);

  const ready = await waitForPodReady(userId, CODE_SERVER_POD_READY_TIMEOUT_MS);
  if (ready) {
    await updateStatus(userId, "running");
    return { status: "ready", url };
  }

  await updateStatus(userId, "pending");
  return { status: "starting", url };
}

export async function stopUserCodeServer(userId: string): Promise<void> {
  await deletePod(userId);
  await deleteService(userId);
  await deleteIngress(userId);
  await updateStatus(userId, "stopped");
}

export async function cleanupStaleInstances(
  maxIdleMinutes: number = CODE_SERVER_MAX_IDLE_MINUTES,
): Promise<number> {
  const cutoff = new Date(Date.now() - maxIdleMinutes * 60 * 1000);
  const stale = await getStaleInstances(cutoff);

  for (const instance of stale) {
    try {
      await deletePod(instance.id);
      await deleteService(instance.id);
      await deleteIngress(instance.id);
      await updateStatus(instance.id, "stopped");
    } catch (err) {
      console.error(`Failed to cleanup instance for user ${instance.id}:`, err);
    }
  }

  return stale.length;
}

export async function getUserCodeServerStatus(userId: string): Promise<{
  status: "ready" | "starting" | "stopped" | "error" | "none";
  resetCount: number;
}> {
  const instance = await getInstanceByUserId(userId);
  if (!instance) return { status: "none", resetCount: 0 };

  const resetCount = instance.reset_count ?? 0;

  if (instance.status === "running") {
    const phase = await getPodStatus(userId);
    if (phase === "Running") {
      await touchLastActive(userId);
      return { status: "ready", resetCount };
    }
    return { status: "starting", resetCount };
  }

  return {
    status: instance.status as "starting" | "stopped" | "error",
    resetCount,
  };
}

export async function resetUserWorkspace(
  userId: string,
): Promise<EnsureResult> {
  // Tear down everything including PVC (wipes user data)
  await deletePod(userId);
  await deleteService(userId);
  await deleteIngress(userId);
  await deletePVC(userId);
  await updateStatus(userId, "stopped");

  // Increment reset counter — gives VS Code a new workspace identity
  // so the browser won't restore stale editor tabs from before the reset
  await incrementResetCount(userId);

  // Re-create from scratch — PVC will be fresh, entrypoint seeds the template
  return ensureUserCodeServer(userId);
}
