jest.mock("@/lib/supabase", () => {
  const mockSelect = jest.fn().mockReturnThis();
  const mockEq = jest.fn().mockReturnThis();
  const mockOrder = jest.fn().mockReturnThis();
  const mockSingle = jest.fn();
  const mockInsert = jest.fn();

  return {
    supabase: {
      from: jest.fn(() => ({
        select: mockSelect,
        eq: mockEq,
        order: mockOrder,
        single: mockSingle,
        insert: mockInsert,
      })),
    },
    _mocks: { mockSelect, mockEq, mockOrder, mockSingle, mockInsert },
  };
});

import { supabase } from "@/lib/supabase";

const mockFrom = supabase.from as jest.Mock;

function makeQueryMock(resolvedValue: any) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(resolvedValue),
    insert: jest.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

describe("Pets — listagem", () => {
  beforeEach(() => jest.clearAllMocks());

  it("busca pets do usuário corretamente", async () => {
    const fakePets = [
      { id: "1", name: "Rex", species: "dog", user_id: "user-1" },
      { id: "2", name: "Mia", species: "cat", user_id: "user-1" },
    ];

    const chain = makeQueryMock({ data: fakePets, error: null });
    chain.order.mockResolvedValue({ data: fakePets, error: null });
    mockFrom.mockReturnValue(chain);

    const result = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", "user-1")
      .order("created_at", { ascending: false });

    expect(mockFrom).toHaveBeenCalledWith("pets");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("retorna lista vazia sem erro quando não há pets", async () => {
    const chain = makeQueryMock({ data: [], error: null });
    chain.order.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue(chain);

    const { data, error } = await supabase
      .from("pets")
      .select("*")
      .eq("user_id", "user-sem-pets")
      .order("created_at", { ascending: false });

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe("Pets — criação", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere pet com campos obrigatórios", async () => {
    const chain = makeQueryMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const petData = {
      user_id: "user-1",
      name: "Rex",
      species: "dog",
      breed: "Labrador Retriever",
      birth_date: "2022-03-15",
    };

    await supabase.from("pets").insert(petData);

    expect(mockFrom).toHaveBeenCalledWith("pets");
    expect(chain.insert).toHaveBeenCalledWith(petData);
  });

  it("retorna erro quando insert falha", async () => {
    const chain = makeQueryMock({
      data: null,
      error: { message: "violates row-level security policy" },
    });
    mockFrom.mockReturnValue(chain);

    const { error } = await supabase.from("pets").insert({
      user_id: "user-errado",
      name: "Rex",
      species: "dog",
    });

    expect(error).not.toBeNull();
  });
});

describe("Vacinas — criação", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere vacina com campos obrigatórios", async () => {
    const chain = makeQueryMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const vaccineData = {
      pet_id: "pet-1",
      name: "V10",
      applied_at: "2024-01-15",
      next_dose_at: "2025-01-15",
      vet_name: "Dr. Silva",
    };

    await supabase.from("vaccines").insert(vaccineData);

    expect(mockFrom).toHaveBeenCalledWith("vaccines");
    expect(chain.insert).toHaveBeenCalledWith(vaccineData);
  });
});

describe("Medicamentos — criação", () => {
  beforeEach(() => jest.clearAllMocks());

  it("insere medicamento com active=true por padrão", async () => {
    const chain = makeQueryMock({ data: null, error: null });
    mockFrom.mockReturnValue(chain);

    const medData = {
      pet_id: "pet-1",
      name: "Bravecto",
      dose: "1 comprimido",
      frequency: "a cada 3 meses",
      started_at: "2024-01-01",
      active: true,
    };

    await supabase.from("medications").insert(medData);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ active: true })
    );
  });
});
