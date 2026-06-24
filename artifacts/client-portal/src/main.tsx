import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyPortalBrandingToHead, getCachedPortalBranding } from "@/lib/portalBranding";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

applyPortalBrandingToHead(getCachedPortalBranding());

const CLIENT_PRODUCT_CACHE_VERSION = "client-portal-live-updates-v23";
const CLIENT_PRODUCT_CACHE_KEY = "client-product-cache-version";
const APP_SHELL_SIGNATURE_KEY = "client-app-shell-signature";
const UPDATE_RELOAD_KEY = "client-app-update-reload-at";
const isClientRoute = window.location.pathname.startsWith("/client");
const TECHNICAL_CACHE_KEY_PATTERN = /^(contract|client-product|client-contract|tanstack|react-query|persist|branding|product-detail|portal)/i;

const getCurrentShellSignature = () =>
  Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))
    .map((script) => script.src)
    .sort()
    .join("|");

const clearClientRuntimeCaches = () => {
  window.caches?.keys().then((keys) => {
    keys
      .filter((key) => /workbox|vite|client|contract|crm|supabase/i.test(key))
      .forEach((key) => window.caches.delete(key));
  });
};

const clearClientTechnicalStorage = () => {
  Object.keys(localStorage).forEach((key) => {
    if (TECHNICAL_CACHE_KEY_PATTERN.test(key)) localStorage.removeItem(key);
  });
  Object.keys(sessionStorage).forEach((key) => {
    if (TECHNICAL_CACHE_KEY_PATTERN.test(key)) sessionStorage.removeItem(key);
  });
};

if (localStorage.getItem(CLIENT_PRODUCT_CACHE_KEY) !== CLIENT_PRODUCT_CACHE_VERSION) {
  clearClientTechnicalStorage();
  localStorage.setItem(CLIENT_PRODUCT_CACHE_KEY, CLIENT_PRODUCT_CACHE_VERSION);
  clearClientRuntimeCaches();
  navigator.serviceWorker?.getRegistration().then((registration) => registration?.update());
}

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

navigator.serviceWorker?.getRegistrations().then((registrations) => {
  registrations.forEach((registration) => registration.unregister());
});

if (isPreviewHost || isInIframe || isClientRoute) {
  clearClientRuntimeCaches();
}

const installClientAutoUpdater = () => {
  if (!isClientRoute || isPreviewHost || isInIframe) return;

  const currentSignature = getCurrentShellSignature();
  if (currentSignature) localStorage.setItem(APP_SHELL_SIGNATURE_KEY, currentSignature);

  const refreshToLatestVersion = async () => {
    const lastReloadAt = Number(sessionStorage.getItem(UPDATE_RELOAD_KEY) || 0);
    if (Date.now() - lastReloadAt < 30000) return;
    sessionStorage.setItem(UPDATE_RELOAD_KEY, String(Date.now()));
    clearClientTechnicalStorage();
    clearClientRuntimeCaches();
    const registrations = await navigator.serviceWorker?.getRegistrations();
    await Promise.all((registrations || []).map((registration) => registration.unregister()));
    const url = new URL(window.location.href);
    url.searchParams.set("app-update", Date.now().toString());
    window.location.replace(url.toString());
  };

  const checkForPublishedUpdate = async () => {
    try {
      const response = await fetch(window.location.pathname, {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!response.ok) return;
      const html = await response.text();
      const remoteSignature = Array.from(html.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+)["']/g))
        .map((match) => new URL(match[1], window.location.origin).href)
        .sort()
        .join("|");
      const storedSignature = localStorage.getItem(APP_SHELL_SIGNATURE_KEY) || currentSignature;
      if (remoteSignature && storedSignature && remoteSignature !== storedSignature) {
        await refreshToLatestVersion();
      }
    } catch {
      // Silent: the next focus/interval check will retry.
    }
  };

  window.addEventListener("focus", checkForPublishedUpdate);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForPublishedUpdate();
  });
  window.setInterval(checkForPublishedUpdate, 60000);
};

installClientAutoUpdater();

const hideAppLoader = () => {
  const loader = document.getElementById("app-loader");
  if (loader) {
    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), 300);
  }
};

import { LanguageProvider } from './contexts/LanguageContext';

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </AppErrorBoundary>
);

hideAppLoader();
