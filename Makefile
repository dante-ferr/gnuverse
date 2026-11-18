.DEFAULT_GOAL := help

.PHONY: help setup dev cms site sync build preview check test typecheck mailpit cms-reset cms-seed cms-fresh cms-set-host-admin test-blog test-blog-ci docs-serve elements-serve

help:
	@printf '%s\n' 'GNUverse — commands' '' \
		'  make setup       Install deps, prepare env files, bootstrap+seed CMS DB if missing' \
		'  make dev         Start CMS + game + site; Ctrl+C stops all three' \
		'  make test-blog   Seed demo data, run E2E tests, open the browser' \
		'  make cms         Start only the CMS on CMS_PORT' \
		'  make mailpit     Start local Mailpit (SMTP 1025, UI 8025; auto-picks free UI port)' \
		'  make cms-reset   Wipe the local CMS SQLite DB/media, then apply the demo seed' \
		'  make cms-seed    Re-apply the local CMS demo seed without wiping' \
		'  make cms-fresh   Alias of cms-reset (wipe, then seed)' \
		'  make cms-set-host-admin  Create/update host admin from HOST_ADMIN_* (prod-safe)' \
		'  make site        Start only the site' \
		'  make sync        Refresh local content from the CMS' \
		'  make build       Build the static site into out/' \
		'  make preview     Serve the static site without the CMS' \
		'  make check       Run tests and TypeScript checks' \
		'  make docs-serve  Serve the method book (mdBook) at http://localhost:3003' \
		'  make elements-serve  Element recipe page at http://127.0.0.1:3010 (reload TOML on refresh)' ''

setup:
	npm ci
	npm ci --prefix cms
	npm run cms:setup
	node scripts/setup-site.mjs
	npm run cms:bootstrap

dev:
	node scripts/dev.ts

cms:
	npm run cms:dev

mailpit:
	@ui="$${MAILPIT_UI_PORT:-8025}"; \
	smtp="$${MAILPIT_SMTP_PORT:-1025}"; \
	if [ -z "$${MAILPIT_UI_PORT:-}" ] && command -v ss >/dev/null 2>&1 && \
		ss -ltn | awk '{print $$4}' | grep -Eq "(^|:|])$${ui}$$"; then \
		ui=8026; \
		echo "Port 8025 is already in use; publishing the Mailpit UI on $${ui} instead."; \
		echo "Override with MAILPIT_UI_PORT=<port> make mailpit."; \
	fi; \
	MAILPIT_UI_PORT="$${ui}" MAILPIT_SMTP_PORT="$${smtp}" docker compose -f compose.mailpit.yml up -d && \
	echo "Mailpit UI: http://127.0.0.1:$${ui}  SMTP: 127.0.0.1:$${smtp}"

cms-reset:
	npm run cms:reset-db
	npm run cms:seed

cms-seed:
	npm run cms:seed

cms-fresh: cms-reset

cms-set-host-admin:
	npm run cms:set-host-admin

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

test-blog:
	node scripts/test-blog.ts

test-blog-ci:
	node scripts/test-blog.ts --once --no-browser

docs-serve:
	@which mdbook > /dev/null || (echo "mdBook is not installed. Install from https://github.com/rust-lang/mdBook/releases or with cargo install mdbook" && exit 1)
	@echo "Documentation server at http://localhost:3003"
	mdbook serve docs -p 3003

elements-serve:
	npm run elements:serve
