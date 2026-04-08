## Plano de Reestruturação do Módulo Financeiro

### Fase 1 — Reorganizar abas (prioridade alta)
Refatorar `Financial.tsx` para ter 7 abas internas:
1. **Resumo** — Dashboard com KPIs + gráficos (Receita vs Despesa, evolução mensal, fluxo de caixa) usando recharts
2. **Fluxo de Caixa** — Extrato consolidado com entradas, saídas, saldo acumulado e previsão
3. **Receitas** — Lista de receitas automáticas (contratos com sinal pago) + entradas manuais, com filtros
4. **Despesas** — Lista de despesas com filtros, categorias e ações em lote
5. **Funcionários** — Já existente (EmployeesTab) com pequenos ajustes
6. **Reservas** — Já existente com categorias expandidas (Marketing, Investimento, Manutenção, Outros)
7. **Importar Extrato** — Importação profissional com classificação por tipo/categoria e vinculação a contrato ou funcionário

### Fase 2 — Gráficos no Resumo
- Gráfico Receita vs Despesa (barras)
- Evolução mensal (linha 12 meses)
- Fluxo de caixa (área)

### Fase 3 — Importação inteligente de extrato
- Ao importar, permitir classificar cada entrada (receita, comissão, marketing, despesa fixa, investimento)
- Vincular a contrato ou funcionário
- Detecção de duplicidade (valores e datas iguais)

### Fase 4 — Validações e integração
- Não pagar funcionário sem sinal pago ✅ (já implementado)
- Contratos de 2 dias = 2 unidades ✅ (já implementado)
- Receita automática via sinal pago ✅ (já implementado via payments)
- Ticket médio baseado em contratos pagos

### O que NÃO será alterado:
- Lógica de contratos existente (já funciona)
- Store.ts (já adequado)
- EmployeesTab (ajustes mínimos)

### Arquivos afetados:
- `src/pages/Financial.tsx` — refatorar completamente, dividir em componentes menores
- Criar: `src/components/financial/FinancialSummary.tsx`
- Criar: `src/components/financial/FinancialCashFlow.tsx`
- Criar: `src/components/financial/FinancialRevenue.tsx`
- Criar: `src/components/financial/FinancialExpenses.tsx`
- Criar: `src/components/financial/FinancialReserves.tsx`
- Criar: `src/components/financial/FinancialImport.tsx`
- Manter: `src/components/EmployeesTab.tsx`
