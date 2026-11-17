# 5. Pendências, riscos aceitos e checklist final

## Pendências divididas por frente

### A. Código do Blog (detalhes técnicos em [06-implementacao-blog.md](06-implementacao-blog.md))
- [x] Evoluir `/blog/` e `/artigos/` (filtro por categorias e capa nos cards via `BlogExplorer`, link `← Voltar ao blog` em `/artigos/[slug]/`, mantendo `/artigos/` compatível).
- [x] Separar papéis `author`, `reviewer` e `admin` no Payload CMS (`cms/src/access.ts`, `Users.ts`, `Articles.ts`), bloqueando publicação direta e edição de terceiros por autores inclusive via API.
- [x] Implementar fluxo de revisão (`draft -> in_review -> changes_requested / approved -> published`), `reviewNotes` privados, `owner` e migração PostgreSQL em `cms/src/migrations/`.
- [x] Implementar cadastro público de autores e painel colapsável de submissão em `/blog/` (`SubmissionPanel`), com `CORS`/`CSRF` (`CMS_ALLOWED_ORIGINS`), `NEXT_PUBLIC_CMS_URL` e timeout de 120 s para cold start.
- [ ] Configurar adaptador **SMTP** no Payload para recuperação de senha por e-mail e revisar proteção anti-spam/rate limit antes de abrir cadastro amplamente ao público externo.

### B. Infraestrutura e Nuvem
- [ ] Criar projeto no **Supabase** (PostgreSQL Session Pooler + bucket e chaves S3).
- [ ] Subir `cms/` no **Render Free**, configurar `CMS_ALLOWED_ORIGINS` (URL do Cloudflare Pages), rodar migrações e criar o `admin` inicial.
- [ ] Subir o site estático no **Cloudflare Pages** com `CMS_CONTENT_MODE=live`, `CMS_URL` e `NEXT_PUBLIC_CMS_URL`, configurar `SITE_DEPLOY_HOOK_URL` e validar ciclo completo (submeter em `/blog/`, revisar/publicar no `/admin`, editar, despublicar, excluir e capa).
- [ ] Definir hospedagem sempre ligada + volume persistente para `game-server/`, ajustar `GAME_HOST=0.0.0.0` + `GAME_ALLOWED_ORIGINS` e rebuildar o site com `NEXT_PUBLIC_GAME_API_URL`.

### C. Conteúdo, equipe e entrega acadêmica ([planejamento.md](../planejamento.md))
- [ ] Criar contas dos outros 6 integrantes no CMS (`author`/`reviewer`) e orientar troca de senha.
- [ ] Produzir, revisar de forma cruzada e publicar os **14 posts** da equipe (2 por integrante, fundamentados em pelo menos 2 palestras e fontes verificadas).
- [x] Atualizar docs antigos ([arquitetura-cms.md](../arquitetura-cms.md) e [planejamento.md](../planejamento.md)) quanto à existência do `game-server/` e ao fluxo atual do blog.
- [ ] Testar acessibilidade, celular e diário de bordo coletivo/individual antes do congelamento de escopo (**30/11**) e entrega (**02/12 até 17h**).

---

## Riscos e limitações técnicas já conhecidas e aceitas

1. **Cold start do CMS no Render Free:** o CMS dorme quando ocioso.
   - Leitores dos artigos publicados em `/blog/` e `/artigos/[slug]/` **não** sofrem com isso (tudo vem estático de `out/`).
   - O build do Cloudflare espera até **120 segundos** por requisição ao CMS (`scripts/sync-content.mjs`). Se estourar o tempo ou falhar, o build aborta e a versão anterior do site continua no ar.
   - Quem abre o painel de submissão em `/blog/` (`SubmissionPanel`) faz requisições diretas do navegador ao CMS no Render; por isso a interface usa timeout de 120 s e avisa que a primeira resposta pode levar até cerca de 1 minuto.
2. **Atraso entre clique em "Publicar" e mudança no ar:** o site só atualiza após o build do Cloudflare concluir. Um artigo recém-despublicado continua visível até o novo deploy terminar.
3. **Deploy hook sem fila e sem retry:** `cms/src/hooks/deploy-site.ts` tenta um único `POST` com timeout de 10 s. Se falhar, exige deploy manual no Cloudflare.
4. **Cota de builds do Cloudflare Pages:** cada publicação/edição publicada/exclusão dispara 1 build. Combine revisões antes de publicar em massa.
5. **Editar imagem na coleção `Media` não dispara build:** só alterações em `Articles` têm o hook. Após trocar uma capa, republique os artigos que a utilizam.
6. **Biblioteca de imagens é pública:** `Media.ts` tem `read: () => true` para permitir o sync sem login. Não faça upload de imagens privadas ou rascunhos sensíveis antes da hora.
7. **Limites do protótipo do `game-server`:** instância única SQLite, rate-limit de login/cadastro (15 req/min/IP) em memória (zera ao reiniciar), sem verificação de e-mail nem paginação de histórico.
8. **Nuvem não validada ainda:** Supabase, S3 real, `CMS_ALLOWED_ORIGINS` em produção e Deploy Hook real ainda não foram testados fora de ambiente local.
