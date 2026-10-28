export function shouldRegisterPwa(production: boolean, hostname: string, framed: boolean, disabled: boolean): boolean {
  const host = hostname.toLowerCase();
  if (!production || framed || disabled) return false;
  if (/(^|\.)lovableproject(-dev)?\.com$/.test(host) || /(^|\.)beta\.lovable\.dev$/.test(host)) return false;
  const suffix = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/;
  if (suffix.test(host) && /^(?:(?:id-preview|preview)(?:-[a-z0-9]+)?--.+|project--.+-dev)$/.test(host.split('.')[0])) return false;
  return true;
}

/** The sole registrar; preview cleanup touches only this app's worker. */
export async function registerPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const allowed = shouldRegisterPwa(import.meta.env.PROD, window.location.hostname, window.self !== window.top, new URLSearchParams(window.location.search).get("sw") === "off");
  try {
    if (!allowed) {
      for (const registration of await navigator.serviceWorker.getRegistrations()) {
        const worker = registration.active ?? registration.waiting ?? registration.installing;
        if (worker && new URL(worker.scriptURL).pathname === "/sw.js") await registration.unregister();
      }
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await registration.update();
  } catch { /* Offline startup keeps the existing worker and session. */ }
}