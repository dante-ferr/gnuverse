.DEFAULT_GOAL := help

.PHONY: help setup dev cms site sync build preview check test typecheck test-blog test-blog-ci docs-serve

help:
	@printf '%s\n' 'GNUverse — commands' '' '  make setup       Install dependencies and prepare local environments' '  make dev         Start CMS + game + site; Ctrl+C stops all three' '  make test-blog   Seed demo data, run E2E tests, open the browser' '  make cms         Start only the CMS on CMS_PORT' '  make site        Start only the site' '  make sync        Refresh local content from the CMS' '  make build       Build the static site into out/' '  make preview     Serve the static site without the CMS' '  make check       Run tests and TypeScript checks' '  make docs-serve  Serve the method book (mdBook) at http://localhost:3003' ''

setup:
	npm ci
	npm ci --prefix cms
	npm run cms:setup
	node scripts/setup-site.mjs

dev:
	node scripts/dev.ts

cms:
	npm run cms:dev

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
