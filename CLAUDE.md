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

---

### 🔴 Crítico

| Tipo | Item | Status |
|------|------|--------|
| Técnico | T5: Error boundaries — erros derrubavam o app inteiro | ✅ |

---

### 🟠 Alto

| Tipo | Item | Status |
|------|------|--------|
| Técnico | T3: `jest-expo` versão incompatível com Expo SDK 54 | ✅ |
| Produto | Tela de Procedimentos (consultas, cirurgias, exames) | [ ] |
| Produto | Tela de Perfil (nome do usuário, trocar senha) | [ ] |

---

### 🟡 Médio

| Tipo | Item | Status |
|------|------|--------|
| Produto | T2: Upload de foto dos pets | [ ] |
| Produto | Agenda/Calendário interno (próximas doses, meds ativos) | [ ] |
| Produto | Documentos (upload de exames PDF/foto) | [ ] |
| Produto | Notificações (lembrete vacina e medicamento) | [ ] |
| Técnico | T4: Paginação nas listas de vacinas e medicamentos | [ ] |
| Técnico | T6: CI/CD com GitHub Actions (rodar testes no push) | [ ] |

---

### 🟢 Baixo / Futuro

| Tipo | Item | Status |
|------|------|--------|
| Produto | OCR de carteira de vacina (Claude Vision API) | [ ] |
| Produto | Integração com calendário nativo (iOS/Google/Android) | [ ] |
| Técnico | T8: Push notifications (infra — FCM/APNs) | [ ] |
| Técnico | T9: Modo offline básico | [ ] |
| Técnico | T11: i18n para expansão além do Brasil | [ ] |

---

## Infra e Credenciais

- Credenciais em `.env.local` (nunca commitar)
- Conexão DB: `postgresql://postgres@db.grevhraelwmrttbtdhie.supabase.co:5432/postgres`
- NVM necessário: `export NVM_DIR="$HOME/.nvm" && \. "$NVM_DIR/nvm.sh" && nvm use 20`
- Pooler JWT auth **não funciona** — usar conexão direta acima para migrations
