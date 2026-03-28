import { useState, useCallback, useEffect } from "react";
import type { AppConfig } from "./useConfig";

/**
 * Web Push subscription via ntfy.
 *
 * How it works:
 * 1. PWA asks browser for Notification permission
 * 2. Browser creates a PushSubscription (endpoint + keys)
 * 3. PWA sends this subscription to ntfy via POST /topic/web-push/subscribe
 * 4. ntfy stores it and uses it to wake the Service Worker when a message arrives
 * 5. Service Worker shows a native notification — even if the app is closed
 *
 * No database on our side. ntfy handles subscription storage.
 */

type PushState = "prompt" | "granted" | "denied" | "unsupported" | "subscribing" | "subscribed" | "error";

interface UseWebPushReturn {
  state: PushState;
  error: string;
  subscribe: () => Promise<void>;
}

// ntfy exposes its VAPID public key at GET /v1/webpush
async function fetchVapidKey(ntfyUrl: string): Promise<string | null> {
  try {
    const resp = await fetch(`${ntfyUrl}/v1/webpush`);
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.public_key || null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeTopic(
  ntfyUrl: string,
  topic: string,
  subscription: PushSubscription
): Promise<boolean> {
  try {
    const resp = await fetch(`${ntfyUrl}/${topic}/web-push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

export function useWebPush(config: AppConfig): UseWebPushReturn {
  const [state, setState] = useState<PushState>(() => {
    if (!("Notification" in window) || !("PushManager" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission === "granted") return "granted";
    return "prompt";
  });
  const [error, setError] = useState("");

  // Check if already subscribed on mount
  useEffect(() => {
    if (state !== "granted") return;

    navigator.serviceWorker?.ready.then((reg) => {
      reg.pushManager.getSubscription().then((sub) => {
        if (sub) setState("subscribed");
      });
    });
  }, [state]);

  const subscribe = useCallback(async () => {
    if (!config.ntfyUrl) {
      setError("Configure ntfy URL first");
      return;
    }

    setState("subscribing");
    setError("");

    try {
      // 1. Ask permission
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }

      // 2. Get VAPID public key from ntfy
      const vapidKey = await fetchVapidKey(config.ntfyUrl);
      if (!vapidKey) {
        setError("Web Push not configured on ntfy server (missing VAPID keys)");
        setState("error");
        return;
      }

      // 3. Get Service Worker registration
      const registration = await navigator.serviceWorker.ready;

      // 4. Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      });

      // 5. Register subscription with ntfy for each topic
      const results = await Promise.all([
        config.opsTopic
          ? subscribeTopic(config.ntfyUrl, config.opsTopic, subscription)
          : true,
        config.devTopic
          ? subscribeTopic(config.ntfyUrl, config.devTopic, subscription)
          : true,
      ]);

      if (results.every(Boolean)) {
        setState("subscribed");
      } else {
        setError("Failed to register push subscription with ntfy");
        setState("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Push subscription failed");
      setState("error");
    }
  }, [config.ntfyUrl, config.opsTopic, config.devTopic]);

  return { state, error, subscribe };
}
