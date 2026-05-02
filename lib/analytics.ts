import Constants from "expo-constants";

const HOST = "https://app.posthog.com";

let _distinctId: string | null = null;

function getKey(): string | undefined {
  return Constants.expoConfig?.extra?.posthogKey as string | undefined;
}

export function setAnalyticsUser(userId: string) {
  _distinctId = userId;
}

export function clearAnalyticsUser() {
  _distinctId = null;
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  const KEY = getKey();
  if (!KEY || !_distinctId) return;
  fetch(`${HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: KEY,
      event,
      distinct_id: _distinctId,
      timestamp: new Date().toISOString(),
      properties: { ...properties, $lib: "augenda-rn" },
    }),
  }).catch(() => {});
}
