.DEFAULT_GOAL := help

.PHONY: help setup dev cms site sync build preview check test typecheck mailpit cms-reset

help:
	@printf '%s\n' 'GNUverse — comandos' '' '  make setup    Instala as dependências e prepara os ambientes locais' '  make dev      Inicia CMS + jogo + site; Ctrl+C encerra os três' '  make cms      Inicia somente o painel na porta definida em CMS_PORT' '  make mailpit  Inicia o Mailpit local (SMTP 1025, UI 8025)' '  make cms-reset Apaga o SQLite do CMS para recriar o primeiro admin' '  make site     Inicia somente o site' '  make sync     Atualiza o conteúdo local a partir do CMS' '  make build    Gera o site estático em out/' '  make preview  Serve o site estático, sem precisar do CMS' '  make check    Executa testes e verifica TypeScript' ''

setup:
	npm ci
	npm ci --prefix cms
	npm run cms:setup
	node scripts/setup-site.mjs

dev:
	node scripts/dev.ts

cms:
	npm run cms:dev

mailpit:
	docker compose -f compose.mailpit.yml up -d

cms-reset:
	node cms/scripts/reset-local-db.mjs

site:
	npm run dev -- --webpack

sync:
	npm run content:sync

build:
	npm run build

preview:
	npm start

check:
	$(MAKE) test
	$(MAKE) typecheck

test:
	npm test
	npm --prefix cms test

typecheck:
	npm run typecheck
	npm run cms:typecheck
