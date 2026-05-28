# Tarefas - Cadastro de Clientes e Controle de Contas Assinadas (Fiado)

- [x] **Banco de Dados (Prisma)**
  - [x] Adicionar os modelos `Customer` e `CustomerTransaction` no `schema.prisma`
  - [x] Adicionar o relacionamento opcional de `customer` e `customerId` no modelo `Order`
  - [x] Executar `npx prisma db push` para atualizar a estrutura sem perda de dados existentes
  - [x] Executar `npx prisma generate` para atualizar o cliente do Prisma

- [x] **Backend (API Express)**
  - [x] Implementar rotas CRUD de clientes (`GET /api/customers`, `POST /api/customers`, `DELETE /api/customers/:id`)
  - [x] Garantir no Seed do servidor que a forma de pagamento "Conta Assinada" exista no banco de dados
  - [x] Implementar rota de histórico de transações (`GET /api/customers/:id/transactions`)
  - [x] Implementar rota de reembolso/pagamento de fiado (`POST /api/customers/:id/repay`) com integração opcional no Caixa como `suprimento` se pago em dinheiro
  - [x] Atualizar rotas de checkout (`POST /api/orders/:id/checkout` e `/api/orders/:id/partial-checkout`) para:
    - [x] Validar limite de crédito da "Conta Assinada" para o cliente indicado
    - [x] Atualizar saldo devedor (`signedBalance`) e criar a transação correspondente
    - [x] Vincular a comanda ao cliente

- [x] **Frontend (React)**
  - [x] Criar aba de "Gestão de Clientes" na Retaguarda (Aba de Configurações):
    - [x] Listar clientes com buscas por nome/telefone
    - [x] Modais de Criar/Editar Cliente
    - [x] Modal de Extrato do Cliente (Auditoria de compras e pagamentos)
    - [x] Modal de Registrar Repagamento/Amortização de dívida
    - [x] Implementar botões para copiar contatos em formato limpo ou números por vírgula para WhatsApp Marketing
  - [x] Atualizar o Modal de Checkout (Pagamento):
    - [x] Exibir seleção de cliente ao escolher "Conta Assinada"
    - [x] Mostrar limite restante e bloquear conclusão se o saldo for insuficiente
    - [x] Adicionar botão de cadastro rápido "+ Novo Cliente" para criar na hora sem sair do fluxo de venda

- [x] **Validação e Compilação**
  - [x] Testar fluxos de venda e abatimento de fiado
  - [x] Rodar `npm run build` para garantir integridade do front-end compilado
  - [x] Criar/atualizar documentação no `walkthrough.md`
