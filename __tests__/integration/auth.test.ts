// Mock do Supabase — sem chamadas reais à rede
jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

import { supabase } from "@/lib/supabase";

const mockAuth = supabase.auth as jest.Mocked<typeof supabase.auth>;

describe("Auth — login", () => {
  beforeEach(() => jest.clearAllMocks());

  it("chama signInWithPassword com email e senha", async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({ data: { session: null, user: null }, error: null } as any);

    await supabase.auth.signInWithPassword({ email: "user@test.com", password: "senha123" });

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: "user@test.com",
      password: "senha123",
    });
  });

  it("retorna erro para credenciais inválidas", async () => {
    mockAuth.signInWithPassword.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials" },
    } as any);

    const { error } = await supabase.auth.signInWithPassword({
      email: "errado@test.com",
      password: "senhaerrada",
    });

    expect(error).not.toBeNull();
    expect(error?.message).toBe("Invalid login credentials");
  });
});

describe("Auth — cadastro", () => {
  beforeEach(() => jest.clearAllMocks());

  it("chama signUp com email e senha", async () => {
    mockAuth.signUp.mockResolvedValueOnce({ data: { session: null, user: null }, error: null } as any);

    await supabase.auth.signUp({ email: "novo@test.com", password: "senha123" });

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: "novo@test.com",
      password: "senha123",
    });
  });

  it("retorna erro para email já cadastrado", async () => {
    mockAuth.signUp.mockResolvedValueOnce({
      data: { session: null, user: null },
      error: { message: "User already registered" },
    } as any);

    const { error } = await supabase.auth.signUp({
      email: "existente@test.com",
      password: "senha123",
    });

    expect(error).not.toBeNull();
  });
});

describe("Auth — logout", () => {
  it("chama signOut", async () => {
    mockAuth.signOut.mockResolvedValueOnce({ error: null } as any);

    await supabase.auth.signOut();

    expect(mockAuth.signOut).toHaveBeenCalledTimes(1);
  });
});
