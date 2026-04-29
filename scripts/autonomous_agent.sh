#!/bin/bash
# AUgenda — Autonomous Agent
# Roda a cada 3h via crontab. Lê CLAUDE.md e executa o ciclo de backlog.

export NVM_DIR="$HOME/.nvm"
\. "$NVM_DIR/nvm.sh"
nvm use 20

LOGFILE="$HOME/augenda_agent.log"
echo "=== $(date) ===" >> "$LOGFILE"

cd /Users/martamagalhaes/augenda

/Users/martamagalhaes/.nvm/versions/node/v20.20.2/bin/claude \
  --dangerously-skip-permissions \
  -p "Você é o sistema de 3 agentes do projeto AUgenda. Execute um ciclo autônomo completo seguindo as instruções do CLAUDE.md no projeto em /Users/martamagalhaes/augenda.

PASSO 1 — Gestor: leia o CLAUDE.md e o backlog em memória (~/.claude/projects/-Users-martamagalhaes/memory/project_pending_tasks.md), rode os testes (npx jest --no-coverage) e o typecheck (npx tsc --noEmit) para entender o estado atual.

PASSO 2 — Gestor: escolha UMA task do backlog priorizado. Prefira estabilidade: bugs e dívidas técnicas antes de features novas.

PASSO 3 — Implemente como Sênior ou Júnior conforme a complexidade da task.

PASSO 4 — Gestor: rode os testes novamente. Se falharem, corrija ou reverta. NÃO commite com testes quebrando.

PASSO 5 — Commite e faça push:
  cd /Users/martamagalhaes/augenda
  git add -A
  git commit -m 'descrição da task'
  GITHUB_TOKEN=\$(grep GITHUB_TOKEN .env.local | cut -d= -f2) && git push https://\${GITHUB_TOKEN}@github.com/martacadastrosgerais-spec/augenda.git master

PASSO 6 — Atualize o CLAUDE.md (marque a task como concluída) e a memória em ~/.claude/projects/-Users-martamagalhaes/memory/project_pending_tasks.md." \
  >> "$LOGFILE" 2>&1

echo "=== fim do ciclo ===" >> "$LOGFILE"
