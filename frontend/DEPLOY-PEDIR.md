# Deploy só do app de Pedidos Online

O **app de pedidos online** (delivery/retirada) pode ser colocado no ar para os clientes. O **restante do PDV** (caixa, cozinha, churrasqueira, bar, cardápio, relatórios) fica rodando **localmente** para ser mais rápido.

## Build do app “Pedir”

```bash
cd frontend
# API em produção (obrigatório para o site chamar o backend)
export VITE_API_URL=https://sua-api.com
npm run build:pedir
```

A pasta gerada é **`dist-pedir`**. Ela contém `index.html` (e `pedir.html`) para a URL raiz. Suba **só a pasta `dist-pedir`** no deploy (Vercel, Netlify, etc.).

## Rodar o app “Pedir” em desenvolvimento

```bash
cd frontend
npm run dev:pedir
```

Abre em `http://localhost:5174/pedir.html`. O proxy aponta `/api` para `http://localhost:3001` (backend local).

## Backend em produção

O site de pedidos (deploy) precisa de um backend acessível na internet:

1. Faça o deploy do **backend** (pasta `backend`) em algum serviço (Railway, Render, Fly.io, etc.).
2. Na hora do **build:pedir**, defina a URL desse backend:
   ```bash
   export VITE_API_URL=https://sua-api.herokuapp.com
   npm run build:pedir
   ```

## PDV local (mais rápido)

- **Frontend PDV**: `npm run dev` na pasta `frontend` (ou use o build completo com `npm run build` e sirva a pasta `dist`).
- **Backend**: pode ser o mesmo em produção (basta configurar `VITE_API_URL` no `.env` local apontando para a API) ou rodar o backend localmente (`npm start` na pasta `backend`) e deixar `VITE_API_URL` vazio para usar o proxy do Vite.

Assim, só a parte de **fazer pedidos** (delivery) sobe para deploy; o restante continua rodando localmente e mais rápido.
