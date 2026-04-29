import { formatDateInput, parseDateBR, formatDateISO, getAge } from "@/lib/utils";

describe("formatDateInput", () => {
  it("retorna vazio para string vazia", () => {
    expect(formatDateInput("")).toBe("");
  });

  it("formata até 2 dígitos sem separador", () => {
    expect(formatDateInput("15")).toBe("15");
  });

  it("adiciona / após o dia", () => {
    expect(formatDateInput("1503")).toBe("15/03");
  });

  it("formata data completa com separadores", () => {
    expect(formatDateInput("15031990")).toBe("15/03/1990");
  });

  it("ignora caracteres não numéricos", () => {
    expect(formatDateInput("15/03/1990")).toBe("15/03/1990");
  });

  it("limita a 8 dígitos", () => {
    expect(formatDateInput("150319901234")).toBe("15/03/1990");
  });
});

describe("parseDateBR", () => {
  it("converte data válida para ISO", () => {
    expect(parseDateBR("15/03/1990")).toBe("1990-03-15");
  });

  it("retorna null para formato inválido", () => {
    expect(parseDateBR("15/03/90")).toBeNull();
    expect(parseDateBR("1503")).toBeNull();
    expect(parseDateBR("")).toBeNull();
  });

  it("retorna null para mês inválido", () => {
    expect(parseDateBR("01/13/2020")).toBeNull();
  });

  it("retorna null para dia inválido", () => {
    expect(parseDateBR("00/01/2020")).toBeNull();
  });

  it("retorna null para ano inválido", () => {
    expect(parseDateBR("01/01/1800")).toBeNull();
  });

  it("adiciona zero à esquerda no dia e mês", () => {
    expect(parseDateBR("05/03/2020")).toBe("2020-03-05");
  });
});

describe("formatDateISO", () => {
  it("formata data ISO para DD/MM/YYYY", () => {
    expect(formatDateISO("1990-03-15")).toBe("15/03/1990");
  });

  it("retorna — para undefined", () => {
    expect(formatDateISO(undefined)).toBe("—");
  });

  it("retorna — para string vazia", () => {
    expect(formatDateISO("")).toBe("—");
  });
});

describe("getAge", () => {
  it("retorna null para data undefined", () => {
    expect(getAge(undefined)).toBeNull();
  });

  it("retorna meses para pet com menos de 1 ano", () => {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const iso = threeMonthsAgo.toISOString().split("T")[0];
    expect(getAge(iso)).toBe("3 meses");
  });

  it("retorna 1 mês no singular", () => {
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const iso = oneMonthAgo.toISOString().split("T")[0];
    expect(getAge(iso)).toBe("1 mês");
  });

  it("retorna anos para pet com mais de 1 ano", () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const iso = twoYearsAgo.toISOString().split("T")[0];
    expect(getAge(iso)).toBe("2 anos");
  });

  it("retorna 1 ano no singular", () => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const iso = oneYearAgo.toISOString().split("T")[0];
    expect(getAge(iso)).toBe("1 ano");
  });
});
