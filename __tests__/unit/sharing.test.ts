import { generateInviteCode, formatCode, hoursUntilExpiry } from "@/lib/sharing";

describe("generateInviteCode", () => {
  it("gera código com 6 caracteres", () => {
    expect(generateInviteCode()).toHaveLength(6);
  });

  it("usa apenas caracteres do alfabeto permitido (sem 0, O, 1, I)", () => {
    const FORBIDDEN = /[01OI]/;
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).not.toMatch(FORBIDDEN);
    }
  });

  it("usa apenas letras maiúsculas e dígitos 2-9", () => {
    const ALLOWED = /^[A-HJ-NP-Z2-9]{6}$/;
    for (let i = 0; i < 50; i++) {
      expect(generateInviteCode()).toMatch(ALLOWED);
    }
  });

  it("gera códigos diferentes a cada chamada (probabilístico)", () => {
    const codes = new Set(Array.from({ length: 20 }, generateInviteCode));
    expect(codes.size).toBeGreaterThan(1);
  });
});

describe("formatCode", () => {
  it("converte para maiúsculas", () => {
    expect(formatCode("abc123")).toBe("ABC123");
  });

  it("remove caracteres não alfanuméricos", () => {
    expect(formatCode("AB-CD EF")).toBe("ABCDEF");
  });

  it("limita a 6 caracteres", () => {
    expect(formatCode("ABCDEFGHIJ")).toBe("ABCDEF");
  });

  it("retorna string vazia para entrada vazia", () => {
    expect(formatCode("")).toBe("");
  });

  it("lida com entrada com símbolos e espaços", () => {
    expect(formatCode("  A B. C ")).toBe("ABC");
  });

  it("não altera código já formatado", () => {
    expect(formatCode("XYZW45")).toBe("XYZW45");
  });
});

describe("hoursUntilExpiry", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("retorna horas corretas quando expira no futuro", () => {
    const expiresAt = "2024-01-01T14:00:00.000Z"; // 2 horas a frente
    expect(hoursUntilExpiry(expiresAt)).toBe(2);
  });

  it("retorna 0 quando já expirou", () => {
    const expiresAt = "2024-01-01T10:00:00.000Z"; // 2 horas atrás
    expect(hoursUntilExpiry(expiresAt)).toBe(0);
  });

  it("arredonda para baixo (floor)", () => {
    const expiresAt = "2024-01-01T13:59:00.000Z"; // 1h59m
    expect(hoursUntilExpiry(expiresAt)).toBe(1);
  });

  it("retorna 48 para convite recém-criado com 48h de validade", () => {
    const expiresAt = "2024-01-03T12:00:00.000Z"; // exatos 48h
    expect(hoursUntilExpiry(expiresAt)).toBe(48);
  });

  it("retorna 0 exatamente no momento de expiração", () => {
    const expiresAt = "2024-01-01T12:00:00.000Z"; // agora
    expect(hoursUntilExpiry(expiresAt)).toBe(0);
  });
});
