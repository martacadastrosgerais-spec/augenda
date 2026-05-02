import Constants from "expo-constants";

const KEY = Constants.expoConfig?.extra?.posthogKey as string | undefined;
const HOST = "https://app.posthog.com";

let _distinctId: string | null = null;

export function setAnalyticsUser(userId: string) {
  _distinctId = userId;
}

export function clearAnalyticsUser() {
  _distinctId = null;
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
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
