# Bosque da Carne - Pedir Online

Este repositório contém apenas o frontend do fluxo de pedido online (`/pedir`), pronto para deploy na Vercel.

## Stack

- React + Vite
- TailwindCSS (via plugin Vite)

## Rodar local

```bash
cd frontend
npm install
npm run dev:pedir
```

Abrir: `http://localhost:5174/pedir.html`

## Build para produção

```bash
cd frontend
npm run build:pedir
```

Saída: `frontend/dist-pedir`

## Deploy na Vercel

- Root Directory: `frontend`
- Build Command: `npm run build:pedir`
- Output Directory: `dist-pedir`
- Environment Variable:
  - `VITE_API_URL=https://sua-api-publica.exemplo.com`

## Observações

- O app depende de uma API externa para cardápio, envio de pedido e imagens.
- O item **Prato Feito** exige seleção de espetinho no modal antes de adicionar ao carrinho.
