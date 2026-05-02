import AsyncStorage from "@react-native-async-storage/async-storage";
import { cacheGet, cacheSet } from "@/lib/cache";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

const PREFIX = "augenda_cache_";

describe("cacheSet / cacheGet", () => {
  beforeEach(() => {
    (AsyncStorage.clear as jest.Mock)();
  });

  it("retorna null para chave inexistente", async () => {
    const result = await cacheGet("missing_key");
    expect(result).toBeNull();
  });

  it("armazena e recupera valor", async () => {
    await cacheSet("test_key", { name: "Pipo" });
    const result = await cacheGet<{ name: string }>("test_key");
    expect(result).toEqual({ name: "Pipo" });
  });

  it("adiciona o prefix correto ao AsyncStorage", async () => {
    await cacheSet("meu_pet", [1, 2, 3]);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      PREFIX + "meu_pet",
      expect.any(String)
    );
  });

  it("retorna null para cache expirado (TTL > 7 dias)", async () => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000 - 1;
    await AsyncStorage.setItem(
      PREFIX + "old_key",
      JSON.stringify({ data: { x: 1 }, ts: sevenDaysAgo })
    );
    const result = await cacheGet("old_key");
    expect(result).toBeNull();
  });

  it("retorna valor para cache ainda válido", async () => {
    const recentTs = Date.now() - 60 * 1000; // 1 minuto atrás
    await AsyncStorage.setItem(
      PREFIX + "fresh_key",
      JSON.stringify({ data: { x: 42 }, ts: recentTs })
    );
    const result = await cacheGet<{ x: number }>("fresh_key");
    expect(result).toEqual({ x: 42 });
  });

  it("retorna null se AsyncStorage lançar erro", async () => {
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error("Storage error"));
    const result = await cacheGet("any_key");
    expect(result).toBeNull();
  });

  it("ignora silenciosamente erro no cacheSet", async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error("Storage full"));
    await expect(cacheSet("key", "value")).resolves.toBeUndefined();
  });

  it("aceita null como dado armazenado", async () => {
    await cacheSet("null_key", null);
    const result = await cacheGet("null_key");
    expect(result).toBeNull();
  });

  it("aceita arrays e objetos aninhados", async () => {
    const data = { pets: [{ id: "1", name: "Bento" }, { id: "2", name: "Dobby" }] };
    await cacheSet("pets", data);
    const result = await cacheGet<typeof data>("pets");
    expect(result).toEqual(data);
  });
});
