jest.mock("expo-constants", () => ({
  __esModule: true,
  default: { expoConfig: { extra: { posthogKey: undefined } } },
}));

global.fetch = jest.fn();

import { setAnalyticsUser, clearAnalyticsUser, trackEvent } from "@/lib/analytics";
import Constants from "expo-constants";

// typed handle so tests can mutate the key
const mockExtra = (Constants as any).expoConfig.extra as { posthogKey: string | undefined };

describe("analytics — sem chave configurada", () => {
  beforeEach(() => {
    mockExtra.posthogKey = undefined;
    (fetch as jest.Mock).mockClear();
    setAnalyticsUser("user-123");
  });

  it("não dispara fetch quando posthogKey não está definido", () => {
    trackEvent("pet_viewed");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("não dispara fetch para nenhum tipo de evento", () => {
    trackEvent("vaccine_added", { pet_id: "pet-1" });
    trackEvent("incident_logged", { category: "vomit" });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("analytics — sem usuário autenticado", () => {
  beforeEach(() => {
    mockExtra.posthogKey = "phc_test_key";
    (fetch as jest.Mock).mockClear();
    clearAnalyticsUser();
  });

  it("não dispara fetch quando distinctId é null", () => {
    trackEvent("pet_viewed");
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("analytics — com chave e usuário", () => {
  beforeEach(() => {
    mockExtra.posthogKey = "phc_test_key";
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    (fetch as jest.Mock).mockClear();
    setAnalyticsUser("user-abc");
  });

  afterEach(() => {
    clearAnalyticsUser();
  });

  it("dispara fetch para o endpoint correto", () => {
    trackEvent("pet_viewed");
    expect(fetch).toHaveBeenCalledWith(
      "https://app.posthog.com/capture/",
      expect.any(Object)
    );
  });

  it("envia método POST com Content-Type JSON", () => {
    trackEvent("vaccine_added");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("inclui api_key, event e distinct_id no payload", () => {
    trackEvent("dose_confirmed", { pet_id: "pet-1" });
    const [, options] = (fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.api_key).toBe("phc_test_key");
    expect(body.event).toBe("dose_confirmed");
    expect(body.distinct_id).toBe("user-abc");
  });

  it("inclui properties customizadas no payload", () => {
    trackEvent("incident_logged", { category: "vomit", pet_id: "pet-99" });
    const [, options] = (fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.properties.category).toBe("vomit");
    expect(body.properties.pet_id).toBe("pet-99");
    expect(body.properties.$lib).toBe("augenda-rn");
  });

  it("inclui timestamp no formato ISO", () => {
    trackEvent("pet_created");
    const [, options] = (fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("não lança erro se fetch falhar (fire-and-forget)", async () => {
    (fetch as jest.Mock).mockRejectedValueOnce(new Error("Network error"));
    expect(() => trackEvent("pet_viewed")).not.toThrow();
  });
});

describe("setAnalyticsUser / clearAnalyticsUser", () => {
  beforeEach(() => {
    mockExtra.posthogKey = "phc_test_key";
    (fetch as jest.Mock).mockResolvedValue({ ok: true });
    (fetch as jest.Mock).mockClear();
  });

  it("dispara evento após setAnalyticsUser", () => {
    clearAnalyticsUser();
    trackEvent("pet_viewed");
    expect(fetch).not.toHaveBeenCalled();

    setAnalyticsUser("user-xyz");
    trackEvent("pet_viewed");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("para de disparar após clearAnalyticsUser", () => {
    setAnalyticsUser("user-xyz");
    trackEvent("pet_viewed");
    expect(fetch).toHaveBeenCalledTimes(1);

    clearAnalyticsUser();
    (fetch as jest.Mock).mockClear();
    trackEvent("pet_viewed");
    expect(fetch).not.toHaveBeenCalled();
  });
});
