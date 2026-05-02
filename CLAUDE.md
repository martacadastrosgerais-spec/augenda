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
| Técnico | Infra | Error boundaries | ✅ |
| Técnico | Infra | `jest-expo` compatível com Expo SDK 54 | ✅ |
| Produto | Epic 8 | Cartão de emergência público + QR code | ✅ |
| Produto | Epic 8 | Campos pet: sexo, microchip, castrado, alergias, foto, peso por data | ✅ |
| Produto | Epic 8 | Contatos de emergência (tutor + veterinário) | ✅ |

---

### P1 — Alto Valor

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | Epic 1 | Procedimentos, Perfil, Calendário | ✅ |
| Produto | Epic 2 | Timeline unificada no calendário | ✅ |
| Produto | Epic 4 | Confirmação de dose de medicamento | ✅ |
| Produto | Epic 9 | Dashboard "hoje" com alertas e lembretes | ✅ |
| Técnico | Infra | CI/CD com GitHub Actions | ✅ |
| Produto | Epic 3 | Push notifications remotas (FCM/APNs) | [ ] Aguarda `eas init` |
| Produto | Epic 14 | **Registro de adversidades/incidentes com foto** — vômito, lesão, comportamento anormal | ✅ |

**Notas Epic 14 (Adversidades):** Tutora registra um evento inesperado (vômito, diarreia, ferida, comportamento) com descrição, foto opcional, data/hora e categoria. Objetivo: ter histórico preciso para contar ao veterinário. Tabela `incidents` (pet_id, occurred_at, category, description, photo_url, created_at). Categorias: `vomit | diarrhea | wound | behavior | allergy_reaction | other`. Upload de foto no bucket `pet-incidents` (Supabase Storage). Aparece na timeline do pet e pode ser referenciado no diário clínico.

---

### P2 — Melhoria

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | Epic 6 | Diário clínico / log de sintomas | ✅ |
| Produto | Epic 10 | Condições crônicas | ✅ |
| Produto | Epic 1 | OCR de carteira de vacinas (Claude Vision) | ✅ |
| Produto | Epic 11 | Lembrete de recompra de medicamento | ✅ |
| Produto | Epic 12 | **Controle de banho e tosa** — registro e lembrete recorrente | ✅ |
| Produto | Epic 11 | **ML Wishlist** — busca real + adicionar à lista de desejos do ML | [ ] Aguarda credenciais ML |
| Produto | Epic 13 | **Agente conversacional** — cadastro por linguagem natural | ✅ |
| Produto | Epic 1 | Documentos — upload de exames PDF/foto | ✅ |
| Produto | Epic 1 | Arquivar pet (sem deletar histórico) | ✅ |
| Técnico | Infra | Paginação nas listas | ✅ |
| Técnico | Infra | Modo offline básico (cache local) | ✅ |

**Notas Epic 12 (Banho e Tosa):** Tabela `grooming_logs` (pet_id, type [`bath`|`grooming`|`both`], performed_at, groomer_name, notes, next_at). UI: aba ou seção na tela do pet. Lembrete recorrente automático baseado em `next_at`. Integra com a tabela `reminders`.

**Notas Epic 11 ML Wishlist:** Requer app registrado em developers.mercadolivre.com.br → `client_id` + `client_secret`. Fluxo: (1) client_credentials token para busca com preço/avaliação real; (2) OAuth do usuário via `expo-auth-session` com redirect `augenda://ml-callback`; (3) `POST /users/{user_id}/wishlist/add_item` para salvar produto na conta ML da tutora. Aguarda Marta criar o app ML e fornecer as credenciais.

**Notas Epic 13 (Agente conversacional):** Usar Claude API (já configurada). Tutora digita em linguagem natural: *"Pipo tomou Bravecto hoje"* ou *"Bento vomitou às 14h, tirei uma foto"*. Claude extrai entidade (pet, tipo de registro, dados) e confirma antes de salvar. Reduz atrito de navegação tela-a-tela. UI: botão de chat flutuante (+) ou tela dedicada. Backend: chamada à API Anthropic com contexto dos pets da tutora + histórico recente.

---

### P3 — Futuro

| Tipo | Epic | Item | Status |
|------|------|------|--------|
| Produto | — | Relatório para veterinário (compartilhamento) | ✅ |
| Produto | Epic 11 | Produtos recorrentes (ração, petisco) com ciclo estimado | ✅ |
| Técnico | Infra | i18n para expansão além do Brasil | [ ] |
| Técnico | Infra | Analytics de uso (Posthog ou similar) | ✅ HTTP API, ativa com EXPO_PUBLIC_POSTHOG_KEY |

---

### Schema Pendente (novas tabelas)

| Tabela | Descrição | Epic | Prioridade |
|--------|-----------|------|------------|
| `incidents` | Adversidades/incidentes com foto | 14 | ✅ |
| `grooming_logs` | Banho, tosa, próxima data | 12 | ✅ |
| `attachments` | Documentos anexados a procedimentos | 1 | ✅ |
| `weight_logs` | Histórico de peso por data | — | ✅ |

---

## Infra e Credenciais

- Credenciais em `.env.local` (nunca commitar)
- Conexão DB: `postgresql://postgres@db.grevhraelwmrttbtdhie.supabase.co:5432/postgres`
- NVM necessário: `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 20`
- Pooler JWT auth **não funciona** — usar conexão direta acima para migrations
