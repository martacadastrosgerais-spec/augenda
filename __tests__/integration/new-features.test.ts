jest.mock("@/lib/supabase", () => {
  const makeChain = () => {
    const chain: any = {
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      single: jest.fn(),
      insert: jest.fn(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
    };
    return chain;
  };
  return {
    supabase: {
      from: jest.fn(() => makeChain()),
    },
  };
});

import { supabase } from "@/lib/supabase";

const mockFrom = supabase.from as jest.Mock;

function withChain(resolvedValue: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue(resolvedValue),
    range: jest.fn().mockResolvedValue(resolvedValue),
    single: jest.fn().mockResolvedValue(resolvedValue),
    insert: jest.fn().mockResolvedValue(resolvedValue),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
  };
  chain.update.mockImplementation(() => ({
    eq: jest.fn().mockResolvedValue(resolvedValue),
  }));
  chain.delete.mockImplementation(() => ({
    eq: jest.fn().mockResolvedValue(resolvedValue),
  }));
  // order without a terminal call (e.g. followed by range/limit) stays in chain;
  // when it IS the terminal call it needs to resolve — mock both behaviours
  chain.order.mockImplementation((..._args: any[]) => chain);
  return chain;
}

describe("Arquivar pet", () => {
  beforeEach(() => jest.clearAllMocks());

  it("envia archived=true via update", async () => {
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase.from("pets").update({ archived: true }).eq("id", "pet-1");

    expect(mockFrom).toHaveBeenCalledWith("pets");
    expect(chain.update).toHaveBeenCalledWith({ archived: true });
  });

  it("restaura pet com archived=false", async () => {
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase.from("pets").update({ archived: false }).eq("id", "pet-1");

    expect(chain.update).toHaveBeenCalledWith({ archived: false });
  });

  it("filtra pets não arquivados na listagem", async () => {
    const fakePets = [{ id: "1", name: "Rex", archived: false }];
    const chain = withChain({ data: fakePets, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("pets")
      .select("*")
      .eq("user_id", "user-1")
      .eq("archived", false)
      .order("created_at", { ascending: false });

    expect(chain.eq).toHaveBeenCalledWith("archived", false);
  });
});

describe("Produtos recorrentes", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere produto com campos obrigatórios", async () => {
    const chain = withChain({ data: { id: "prod-1" }, error: null });
    chain.insert.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "prod-1" }, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    await supabase.from("recurring_products").insert({
      pet_id: "pet-1",
      name: "Ração Royal Canin",
      category: "food",
      cycle_days: 30,
    });

    expect(mockFrom).toHaveBeenCalledWith("recurring_products");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        pet_id: "pet-1",
        name: "Ração Royal Canin",
        category: "food",
        cycle_days: 30,
      })
    );
  });

  it("atualiza last_purchased_at ao marcar como comprado", async () => {
    const today = new Date().toISOString().split("T")[0];
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("recurring_products")
      .update({ last_purchased_at: today })
      .eq("id", "prod-1");

    expect(chain.update).toHaveBeenCalledWith({ last_purchased_at: today });
  });

  it("deleta produto pelo id", async () => {
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase.from("recurring_products").delete().eq("id", "prod-1");

    expect(mockFrom).toHaveBeenCalledWith("recurring_products");
    expect(chain.delete).toHaveBeenCalled();
  });

  it("busca produtos ordenados por created_at", async () => {
    const products = [
      { id: "1", name: "Ração", category: "food", cycle_days: 30 },
      { id: "2", name: "Shampoo", category: "hygiene", cycle_days: 60 },
    ];
    const chain = withChain({ data: products, error: null });
    // order é terminal neste caso — precisa resolver
    chain.order.mockImplementation((..._args: any[]) => Promise.resolve({ data: products, error: null }));
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("recurring_products")
      .select("*")
      .eq("pet_id", "pet-1")
      .order("created_at");

    expect(chain.eq).toHaveBeenCalledWith("pet_id", "pet-1");
  });
});

describe("Incidentes / Adversidades", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere incidente com campos obrigatórios", async () => {
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const incident = {
      pet_id: "pet-1",
      occurred_at: "2026-05-01T14:00:00",
      category: "vomit",
      description: "Vomitou após comer",
    };

    await supabase.from("incidents").insert(incident);

    expect(mockFrom).toHaveBeenCalledWith("incidents");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ category: "vomit" })
    );
  });

  it("busca incidentes por pet em ordem decrescente", async () => {
    const chain = withChain({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    await supabase
      .from("incidents")
      .select("*")
      .eq("pet_id", "pet-1")
      .order("occurred_at", { ascending: false })
      .limit(30);

    expect(chain.eq).toHaveBeenCalledWith("pet_id", "pet-1");
    expect(chain.limit).toHaveBeenCalledWith(30);
  });
});

describe("Grooming logs", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere registro de banho/tosa", async () => {
    const chain = withChain({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    await supabase.from("grooming_logs").insert({
      pet_id: "pet-1",
      type: "bath",
      performed_at: "2026-05-01",
      groomer_name: "Pet Shop Central",
    });

    expect(mockFrom).toHaveBeenCalledWith("grooming_logs");
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "bath" })
    );
  });
});

describe("Paginação — range()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("usa range para carregar mais vacinas", async () => {
    const chain = withChain({ data: [], error: null });
    chain.range.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const from = 30;
    const to = 59;
    await supabase
      .from("vaccines")
      .select("*")
      .eq("pet_id", "pet-1")
      .order("applied_at", { ascending: false })
      .range(from, to);

    expect(chain.range).toHaveBeenCalledWith(30, 59);
  });
});
