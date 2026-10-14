# GNUverse

Base local do site interativo para o Projeto Multimodal de MATA68 (2026.2).
GNUverse é o nome do projeto. Tema: software livre como forma de democratizar o acesso à tecnologia. Público, recorte, tese e identidade visual final serão discutidos pelo grupo.

## Executar

Requer Node.js >= 20.9 e npm. As versões instaladas estão fixadas no `package-lock.json`.

```bash
npm ci
npm run dev
```

Abra http://localhost:3000.

```bash
npm run typecheck
npm run build
npm start
```

## Estrutura

- `src/app/page.tsx`: página provisória.
- `src/app/layout.tsx`: idioma e metadados.
- `src/app/globals.css`: Tailwind, cores, rede ilustrativa e duas animações iniciais com respeito à preferência por movimento reduzido.
- `docs/planejamento.md`: divisão de trabalho e cronograma proposto.
- `docs/diario-de-bordo.md`: modelo de registro coletivo e individual.

Stack: Next.js App Router, React, TypeScript em modo estrito e Tailwind CSS via PostCSS.
Configuração baseada na [documentação do Next.js](https://nextjs.org/docs/app/getting-started/installation) e na [integração oficial do Tailwind](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Limite desta etapa

Somente uma base visual e técnica. Sem conteúdo acadêmico final, backend, biblioteca de animação ou publicação. A aparência inicial é uma proposta reversível. Interações e animações mais elaboradas serão discutidas depois de definir a narrativa.

## Colaboração

Cada tarefa tem uma pessoa responsável e outra revisora, mas as decisões de tema, público e tese são coletivas. Quem não programa pode desenvolver conteúdo, roteiro, mídia, storyboard e testes de compreensão. Registrar contribuições e uso de IA no diário.

O Git local foi encontrado vazio em `main`. Nenhum repositório remoto foi criado. Após definir onde o grupo vai colaborar, conectar o remoto e compartilhar o acesso.
