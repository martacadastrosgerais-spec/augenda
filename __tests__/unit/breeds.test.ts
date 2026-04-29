import { DOG_BREEDS, CAT_BREEDS } from "@/constants/breeds";

describe("DOG_BREEDS", () => {
  it("contém raças populares no Brasil", () => {
    expect(DOG_BREEDS).toContain("Labrador Retriever");
    expect(DOG_BREEDS).toContain("Golden Retriever");
    expect(DOG_BREEDS).toContain("Shih Tzu");
    expect(DOG_BREEDS).toContain("Viralata / SRD");
  });

  it("está ordenado alfabeticamente", () => {
    const sorted = [...DOG_BREEDS].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(DOG_BREEDS).toEqual(sorted);
  });

  it("não contém duplicatas", () => {
    const unique = new Set(DOG_BREEDS);
    expect(unique.size).toBe(DOG_BREEDS.length);
  });

  it("todas as entradas são strings não vazias", () => {
    DOG_BREEDS.forEach((breed) => {
      expect(typeof breed).toBe("string");
      expect(breed.trim().length).toBeGreaterThan(0);
    });
  });
});

describe("CAT_BREEDS", () => {
  it("contém raças populares", () => {
    expect(CAT_BREEDS).toContain("Persa");
    expect(CAT_BREEDS).toContain("Siamês");
    expect(CAT_BREEDS).toContain("Viralata / SRD");
  });

  it("está ordenado alfabeticamente", () => {
    const sorted = [...CAT_BREEDS].sort((a, b) => a.localeCompare(b, "pt-BR"));
    expect(CAT_BREEDS).toEqual(sorted);
  });

  it("não contém duplicatas", () => {
    const unique = new Set(CAT_BREEDS);
    expect(unique.size).toBe(CAT_BREEDS.length);
  });
});
