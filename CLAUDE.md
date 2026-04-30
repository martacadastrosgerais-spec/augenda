# AUgenda — Diretrizes de Agentes

## Contexto
App multiplatforma (iOS/Android/Web) de saúde pet.
Proprietária: Marta Magalhães
Stack: Expo SDK 54 · Expo Router ~6 · NativeWind v4 · Supabase · Jest
Repositório: https://github.com/martacadastrosgerais-spec/augenda
**Objetivo principal:** colocar app em produção com usuários reais — priorizar estabilidade sobre features novas.

---

## Sistema de 3 Agentes

### 🧑‍💼 Gestor
Avaliação, priorização e validação. Atua no início e no fim de cada ciclo autônomo.
- Lê estado atual (testes, git, backlog em memória)
- Escolhe a task mais urgente considerando o objetivo de produção
- Valida o trabalho feito antes de commitar
- Atualiza memória com o que foi concluído

### 👨‍💻 Engenheiro Sênior
Decisões técnicas complexas. Usar quando:
- Políticas RLS / migrations de banco
- Auth, segurança, performance
- Features que cruzam múltiplas camadas (DB + API + UI)
- Debugging não-óbvio, error boundaries, CI/CD

### 👩‍💻 Engenheiro Júnior
Tasks simples e bem definidas. Usar quando:
- Atualizar versões de dependências com upgrade path claro
- Corrigir warnings e typos conhecidos
- Telas simples (perfil, about)
- Escrever/atualizar testes unitários
- Ajustes de estilo e layout

---

## Regras Autônomas (sempre seguir)

1. **Rodar testes** antes de qualquer commit. Não commitar se falharem.
2. **Não alterar auth, RLS ou schema** sem analisar impacto no banco primeiro via psql.
3. **Commitar e fazer push** após cada task concluída (ler GITHUB_TOKEN e SUPABASE_DB_PASSWORD do `.env.local`).
4. **Atualizar memória** em `~/.claude/projects/-Users-martamagalhaes/memory/project_pending_tasks.md` após cada ciclo.
5. **Foco em estabilidade** — bugs e dívidas técnicas têm prioridade sobre features novas.
6. **Uma task por ciclo** — concluir completamente antes de iniciar outra.

---

## Backlog

> **Produto** = o que o usuário vê e usa. Decisão de negócio, afeta UX.
> **Técnico** = infraestrutura, qualidade, segurança. Invisível ao usuário mas essencial para produção.
>
> Prioridades: **P0** = bloqueador / diferencial crítico · **P1** = alto valor · **P2** = melhoria · **P3** = futuro

---

### P0 — Crítico / Diferencial de Produto

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Técnico | Infra | Error boundaries — erros derrubavam o app inteiro | ✅ |
| Técnico | Infra | `jest-expo` compatível com Expo SDK 54 | ✅ |
| Produto | Epic 8 | **Cartão de emergência** — perfil público acessível sem login | [ ] |
| Produto | Epic 8 | Campos pet: sexo, microchip, castrado, alergias, condições crônicas | [ ] |
| Produto | Epic 8 | Contatos de emergência (tutor + veterinário com telefone) | [ ] |
| Produto | Epic 8 | URL pública do cartão (sem login) + QR code gerado no app | [ ] |

**Notas Epic 8:** EmergencyProfile entity no banco. URL: `/emergency/[petId]` pública. Exibe: nome, espécie, raça, idade, peso, condições crônicas, medicamentos ativos, veterinário, contato de emergência. Leitura sem auth via RLS policy pública.

---

### P1 — Alto Valor

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | Epic 1 | Tela de Procedimentos (consultas, cirurgias, exames) | ✅ |
| Produto | Epic 1 | Tela de Perfil (nome do usuário, trocar senha) | ✅ |
| Produto | Epic 1 | Agenda/Calendário com integração calendário nativo | ✅ |
| Produto | Epic 9 | **Dashboard "hoje"** — tarefas do dia, atrasadas, próximas 7 dias | [ ] |
| Produto | Epic 2 | **Timeline unificada** — feed cronológico de todos os eventos de todos os pets | [ ] |
| Produto | Epic 3 | **Lembretes com recorrência** — vacinas, medicamentos, procedimentos | [ ] |
| Produto | Epic 3 | Push notifications (FCM/APNs) vinculados aos lembretes | [ ] |
| Produto | Epic 4 | **Confirmação de dose** — registrar quem administrou e quando cada dose | [ ] |
| Técnico | Infra | CI/CD com GitHub Actions (rodar testes no push) | [ ] |

**Notas Epic 9 (Dashboard):** Substituir ou complementar a tela inicial. Mostra: medicamentos a dar hoje, vacinas vencidas/próximas, procedimentos agendados. Usa dados já existentes, sem novo schema.

**Notas Epic 2 (Timeline):** Entidade `HealthEvent` view ou tabela materializada agregando vaccines, medications, procedures. UI: FlatList com badges por tipo, filtro por pet.

**Notas Epic 3 (Lembretes):** Tabela `reminders` (pet_id, type, title, next_at, recurrence_rule, enabled). Recorrência: diária, semanal, mensal, personalizada. Integração com expo-notifications.

**Notas Epic 4 (Doses):** Tabela `medication_doses` (medication_id, administered_at, administered_by, notes). UI: botão "Registrar dose" na tela do medicamento ativo. Histórico de aderência.

---

### P2 — Melhoria

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | Epic 1 | Upload de foto dos pets (Supabase Storage) | [ ] |
| Produto | Epic 6 | **Diário clínico / log de sintomas** — notas livres com data e hora | [ ] |
| Produto | Epic 6 | Vincular sintoma a evento existente ou registro standalone | [ ] |
| Produto | Epic 10 | **Condições crônicas** — cadastro e vinculação a meds/procedimentos | [ ] |
| Produto | Epic 1 | Documentos — upload de exames PDF/foto | [ ] |
| Produto | Epic 1 | OCR de carteira de vacina (Claude Vision API) | [ ] |
| Produto | Epic 1 | Arquivar pet (sem deletar histórico) | [ ] |
| Técnico | Infra | Paginação nas listas de vacinas e medicamentos | [ ] |
| Técnico | Infra | Modo offline básico (cache local) | [ ] |

**Notas Epic 6 (Diário):** Tabela `symptom_logs` (pet_id, noted_at, description, severity, related_event_id?). UI: botão "+" na tela do pet, similar a add-procedure.

**Notas Epic 10 (Crônicas):** Tabela `chronic_conditions` (pet_id, name, diagnosed_at, notes). Exibidas no perfil do pet e no cartão de emergência. Listar nas alergias do cartão de emergência.

---

### P2 — Melhoria (continuação)

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | Epic 11 | **Lembrete de recompra de medicamento** — ao cadastrar med, opção de lembrar quando estiver acabando | [ ] |
| Produto | Epic 11 | **Busca no Mercado Livre** — a partir do lembrete de recompra, buscar produto no ML e adicionar ao carrinho | [ ] |

**Notas Epic 11 (Recompra):** Adicionar campo `restock_reminder_days` (int, nullable) no cadastro de medicamento. Quando preenchido, calcular data de alerta = `ends_at - restock_reminder_days` e criar um reminder automático. Para busca ML: usar ML Search API (`https://api.mercadolibre.com/sites/MLB/search?q=<nome_med>`) — retorna lista de produtos. UI: modal com resultados + botão "Ver no Mercado Livre" que abre a URL do produto (`product.permalink`). Adicionar ao carrinho requer OAuth ML — por ora, abrir o produto no browser e deixar o usuário adicionar.

---

### P3 — Futuro

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | — | Compartilhamento social / relatório para veterinário | [ ] |
| Técnico | Infra | i18n para expansão além do Brasil | [ ] |
| Técnico | Infra | Analytics de uso (Posthog ou similar) | [ ] |

---

### Schema Pendente (novas tabelas)

| Tabela | Descrição | Epic | Prioridade |
|--------|-----------|------|------------|
| `reminders` | Lembretes recorrentes por pet | 3 | P1 |
| `medication_doses` | Registro de cada dose administrada | 4 | P1 |
| `symptom_logs` | Diário clínico / sintomas | 6 | P2 |
| `chronic_conditions` | Condições crônicas do pet | 10 | P2 |
| `emergency_profiles` | Perfil de emergência público | 8 | P0 |
| Campos em `pets` | sex, microchip, neutered, allergies, weight, vet_name, vet_phone, emergency_contact_name, emergency_contact_phone | 8 | P0 |

---

## Infra e Credenciais

- Credenciais em `.env.local` (nunca commitar)
- Conexão DB: `postgresql://postgres@db.grevhraelwmrttbtdhie.supabase.co:5432/postgres`
- NVM necessário: `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 20`
- Pooler JWT auth **não funciona** — usar conexão direta acima para migrations
