import { formatDateInput, parseDateBR, formatDateISO, getAge, nextPurchaseDate } from "@/lib/utils";

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
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2024, 5, 15, 12, 0, 0)); // June 15 local noon — avoids timezone day shift
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retorna null para data undefined", () => {
    expect(getAge(undefined)).toBeNull();
  });

  it("retorna dias para pet com menos de 1 mês", () => {
    expect(getAge("2024-06-05")).toBe("10 dias");
  });

  it("retorna 1 dia no singular", () => {
    expect(getAge("2024-06-14")).toBe("1 dia");
  });

  it("retorna apenas meses quando dias = 0", () => {
    expect(getAge("2024-03-15")).toBe("3 meses");
  });

  it("retorna 1 mês no singular", () => {
    expect(getAge("2024-05-15")).toBe("1 mês");
  });

  it("retorna meses e dias", () => {
    expect(getAge("2024-03-10")).toBe("3 meses e 5 dias");
  });

  it("retorna apenas anos quando meses e dias = 0", () => {
    expect(getAge("2022-06-15")).toBe("2 anos");
  });

  it("retorna 1 ano no singular", () => {
    expect(getAge("2023-06-15")).toBe("1 ano");
  });

  it("retorna anos e meses quando dias = 0", () => {
    expect(getAge("2022-03-15")).toBe("2 anos e 3 meses");
  });

  it("retorna anos, meses e dias", () => {
    expect(getAge("2022-03-10")).toBe("2 anos, 3 meses e 5 dias");
  });

  it("retorna anos e dias quando meses = 0", () => {
    expect(getAge("2022-06-10")).toBe("2 anos e 5 dias");
  });
});

describe("nextPurchaseDate", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-05-01T12:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calcula data corretamente para ciclo de 30 dias", () => {
    const { dateStr } = nextPurchaseDate("2026-04-01", 30);
    expect(dateStr).toBe("01/05/2026");
  });

  it("calcula dias restantes positivos no futuro", () => {
    const { daysLeft } = nextPurchaseDate("2026-04-20", 30);
    // próxima = 2026-05-20, hoje = 2026-05-01, diff ≈ 19 dias
    expect(daysLeft).toBeGreaterThan(0);
    expect(daysLeft).toBeLessThanOrEqual(19);
  });

  it("retorna daysLeft negativo para produto vencido", () => {
    const { daysLeft } = nextPurchaseDate("2026-03-01", 30);
    // próxima = 2026-03-31, já passou
    expect(daysLeft).toBeLessThan(0);
  });

  it("retorna daysLeft próximo de 0 para produto vencendo hoje/ontem", () => {
    const { daysLeft } = nextPurchaseDate("2026-04-01", 30);
    // próxima = 2026-05-01 = hoje; pode ser 0 ou -1 dependendo do timezone
    expect(Math.abs(daysLeft)).toBeLessThanOrEqual(1);
  });

  it("formata dateStr como DD/MM/YYYY", () => {
    const { dateStr } = nextPurchaseDate("2026-01-05", 10);
    expect(dateStr).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(dateStr).toBe("15/01/2026");
  });

  it("funciona com ciclo de 365 dias", () => {
    const { dateStr } = nextPurchaseDate("2025-05-01", 365);
    expect(dateStr).toBe("01/05/2026");
  });
});
