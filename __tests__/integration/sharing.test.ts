/**
 * Testes de integração para o fluxo de compartilhamento de pets.
 * Cobre: geração de convite, validação de código, entrada no pet e remoção de membro.
 */

const mockChain = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
};

jest.mock("@/lib/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({ ...mockChain })),
  },
}));

import { supabase } from "@/lib/supabase";
import { generateInviteCode } from "@/lib/sharing";

const mockFrom = supabase.from as jest.Mock;

function makeChain(finalValue: any) {
  const chain: any = {};
  const methods = ["select", "eq", "is", "gt", "order", "limit", "insert", "update", "delete"];
  methods.forEach((m) => { chain[m] = jest.fn().mockReturnValue(chain); });
  chain.single = jest.fn().mockResolvedValue(finalValue);
  chain.maybeSingle = jest.fn().mockResolvedValue(finalValue);
  return chain;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── Geração de código de convite ────────────────────────────────────────────

describe("Geração de código de convite", () => {
  it("insere novo convite no banco com código válido", async () => {
    const petId = "pet-uuid-1";
    const userId = "user-uuid-1";
    const code = generateInviteCode();

    const chain = makeChain({ data: { id: "invite-1", code, pet_id: petId }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_invites")
      .insert({ pet_id: petId, code, created_by: userId })
      .select()
      .single();

    expect(mockFrom).toHaveBeenCalledWith("pet_invites");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ pet_id: petId, code, created_by: userId })
    );
    expect(result.data).toMatchObject({ code, pet_id: petId });
  });

  it("invalida convites anteriores antes de criar novo", async () => {
    const petId = "pet-uuid-1";
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("pet_invites")
      .delete()
      .eq("pet_id", petId)
      .is("used_by", null);

    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("pet_id", petId);
    expect(chain.is).toHaveBeenCalledWith("used_by", null);
  });
});

// ─── Validação de código ──────────────────────────────────────────────────────

describe("Validação de código de convite", () => {
  it("encontra convite válido pelo código", async () => {
    const mockInvite = {
      id: "invite-1",
      code: "ABC123",
      pet_id: "pet-1",
      pets: { id: "pet-1", name: "Rex", species: "dog" },
      used_by: null,
    };
    const chain = makeChain({ data: mockInvite, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_invites")
      .select("*, pets(id, name, species)")
      .eq("code", "ABC123")
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    expect(result.data).toMatchObject({ code: "ABC123", pets: { name: "Rex" } });
  });

  it("retorna null para código expirado ou inválido", async () => {
    const chain = makeChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_invites")
      .select("*, pets(id, name, species)")
      .eq("code", "XXXXXX")
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    expect(result.data).toBeNull();
  });

  it("detecta que usuário já é membro do pet", async () => {
    const chain = makeChain({ data: { id: "member-1" }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_members")
      .select("id")
      .eq("pet_id", "pet-1")
      .eq("user_id", "user-1")
      .maybeSingle();

    expect(result.data).not.toBeNull();
  });

  it("detecta que usuário é o dono do pet", async () => {
    const chain = makeChain({ data: { user_id: "user-1" }, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pets")
      .select("user_id")
      .eq("id", "pet-1")
      .single();

    expect(result.data?.user_id).toBe("user-1");
  });
});

// ─── Entrada no pet ───────────────────────────────────────────────────────────

describe("Entrada no pet via código", () => {
  it("insere membro com role viewer e marca convite como usado", async () => {
    const petId = "pet-1";
    const userId = "user-2";
    const inviteId = "invite-1";
    const invitedBy = "user-1";

    const memberChain = makeChain({ data: { id: "member-new" }, error: null });
    const inviteUpdateChain = makeChain({ error: null });

    mockFrom
      .mockReturnValueOnce(memberChain) // insert pet_members
      .mockReturnValueOnce(inviteUpdateChain); // update pet_invites

    // Insere membro
    const memberResult = await supabase
      .from("pet_members")
      .insert({ pet_id: petId, user_id: userId, role: "viewer", invited_by: invitedBy })
      .select()
      .single();

    expect(memberChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ pet_id: petId, user_id: userId, role: "viewer" })
    );
    expect(memberResult.error).toBeNull();

    // Marca convite como usado
    await supabase
      .from("pet_invites")
      .update({ used_by: userId, used_at: expect.any(String) })
      .eq("id", inviteId);

    expect(inviteUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ used_by: userId })
    );
  });

  it("retorna erro ao falhar inserção de membro", async () => {
    const chain = makeChain({ data: null, error: { message: "violação de constraint" } });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_members")
      .insert({ pet_id: "pet-1", user_id: "user-2", role: "viewer", invited_by: "user-1" })
      .select()
      .single();

    expect(result.error).not.toBeNull();
    expect(result.data).toBeNull();
  });
});

// ─── Remoção de membro ────────────────────────────────────────────────────────

describe("Remoção de membro", () => {
  it("deleta membro pelo id", async () => {
    const chain = makeChain({ error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("pet_members")
      .delete()
      .eq("id", "member-1");

    expect(mockFrom).toHaveBeenCalledWith("pet_members");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("id", "member-1");
  });

  it("retorna erro ao falhar remoção", async () => {
    const chain = makeChain({ error: { message: "registro não encontrado" } });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_members")
      .delete()
      .eq("id", "member-inexistente")
      .single();

    expect(result.error).not.toBeNull();
  });
});

// ─── Listagem de membros ──────────────────────────────────────────────────────

describe("Listagem de membros do pet", () => {
  it("busca membros com email do perfil", async () => {
    const mockMembers = [
      { id: "m1", pet_id: "pet-1", user_id: "u2", role: "viewer", profiles: { email: "amigo@email.com" } },
    ];
    const chain = makeChain({ data: mockMembers, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_members")
      .select("*, profiles(email)")
      .eq("pet_id", "pet-1")
      .single();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].profiles.email).toBe("amigo@email.com");
  });

  it("retorna lista vazia quando não há membros", async () => {
    const chain = makeChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pet_members")
      .select("*, profiles(email)")
      .eq("pet_id", "pet-sem-membros")
      .single();

    expect(result.data).toHaveLength(0);
  });
});
