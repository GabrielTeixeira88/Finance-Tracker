import '../holdings/i18n'
import i18n from '@/lib/i18n'
const labels = {
  en: {
    eventPlanning: 'Event plan and recorded costs',
    baselineUnavailable:
      'A complete positive recorded baseline is unavailable; no comparative lift is claimed.',
    confirmEventRange:
      'Extend this event’s dates to include its already-linked transactions? No ledger entries will be changed.',
    cashFlowSummary: 'Cash flow summary',
    negativeCarryComposition:
      'Signed carryover makes part of the available target negative; totals are shown without a positive-only composition bar.',
    dailyDetails: 'Daily spending details',
    dailySpending: 'Daily spending',
    safeGroupDeletion:
      'Referenced groups remain protected. Move categories first; historical target versions are never deleted.',
    addTarget: 'Add target',
    saved: 'Saved',
    groupOrder: 'Group order',
    payeeSpending: 'Payee spending',
    noTargets: 'No monthly targets yet',
    weekdayTotal: 'Weekday total',
    heatmapLegend:
      'Each cell is a recorded calendar day. More intense cells indicate larger amounts; net-refund days use the positive color.',
    hideBalances: 'Hide balances',
    monthlyTargetContext:
      'This budget comparison uses whole-month {{month}} targets and recorded spending. Cash flow above uses the selected period.',
    filter_all: 'All',
    filter_over: 'Over target',
    filter_movers: 'Movers',
    filter_no_budget: 'No target',
    exactChartValues: 'Exact chart values',
    groupCategories: 'Group categories',
    negativeComposition:
      'Net refunds are shown as signed amounts; a positive-only map cannot represent this period.',
    excludedCurrencies:
      'Other currencies excluded without conversion: {{currencies}}',
    targetDetails: 'Target details & appearance',
    confirmCopy:
      'Replace existing targets for this month? Prior months and ledger history stay unchanged.',
    effectiveMonth:
      'Defaults effective from {{month}} until the next saved version.',
    categoryAppearance: 'Category appearance',
    recordedIncome:
      'Recorded income for this month. These are actual receipts, not planned income targets.',
    enableTarget: 'Enable target',
    disableTarget: 'Disable target',
    afterSaving: 'After saving',
    carryover: 'Carryover',
    available: 'Available target',
    recordedDays: 'Based on recorded dates; transaction hours are unavailable.',
    newGroup: 'New group',
    incomeReference:
      'Compared with recorded income; targets are voluntary spending guidelines.',
  },
  'pt-BR': {
    eventPlanning: 'Plano e custos registrados do evento',
    baselineUnavailable:
      'Não há uma base registrada positiva completa; a comparação fica indisponível.',
    confirmEventRange:
      'Ampliar as datas para incluir as transações já vinculadas? Os lançamentos não serão alterados.',
    cashFlowSummary: 'Resumo do fluxo de caixa',
    negativeCarryComposition:
      'O saldo acumulado torna parte das metas disponíveis negativa; os totais não usam uma barra apenas positiva.',
    dailyDetails: 'Detalhes dos gastos diários',
    dailySpending: 'Gastos diários',
    safeGroupDeletion:
      'Grupos referenciados são protegidos. Mova as categorias primeiro; versões históricas de metas são preservadas.',
    addTarget: 'Adicionar meta',
    saved: 'Salvo',
    groupOrder: 'Ordem do grupo',
    payeeSpending: 'Gastos por favorecido',
    noTargets: 'Ainda não há metas mensais',
    weekdayTotal: 'Total por dia da semana',
    heatmapLegend:
      'Cada célula é um dia registrado. Maior intensidade indica valores maiores; dias com reembolso líquido usam a cor positiva.',
    hideBalances: 'Ocultar valores',
    monthlyTargetContext:
      'Esta comparação usa metas e gastos registrados do mês {{month}} inteiro. O fluxo acima usa o período selecionado.',
    filter_all: 'Todas',
    filter_over: 'Acima da meta',
    filter_movers: 'Variações',
    filter_no_budget: 'Sem meta',
    exactChartValues: 'Valores exatos do gr�fico',
    groupCategories: 'Agrupar categorias',
    negativeComposition:
      'Reembolsos l�quidos aparecem com sinal; o mapa positivo n�o representa este per�odo.',
    excludedCurrencies: 'Moedas exclu�das sem convers�o: {{currencies}}',
    targetDetails: 'Detalhes e apar�ncia da meta',
    confirmCopy:
      'Substituir as metas deste m�s? Meses anteriores e hist�rico financeiro ser�o preservados.',
    effectiveMonth:
      'Padr�es a partir de {{month}}, at� a pr�xima vers�o salva.',
    categoryAppearance: 'Apar�ncia da categoria',
    recordedIncome:
      'Renda registrada neste mês. São recebimentos reais, não metas de renda.',
    enableTarget: 'Ativar meta',
    disableTarget: 'Desativar meta',
    afterSaving: 'Após poupar',
    carryover: 'Saldo acumulado',
    available: 'Meta disponível',
    recordedDays:
      'Baseado nas datas registradas; os horários das transações não estão disponíveis.',
    newGroup: 'Novo grupo',
    incomeReference:
      'Comparação com a renda registrada; as metas são orientações de gastos voluntárias.',
  },
  'es-419': {
    eventPlanning: 'Plan y costes registrados del evento',
    baselineUnavailable:
      'No hay una base registrada positiva completa; la comparación no está disponible.',
    confirmEventRange:
      '¿Ampliar las fechas para incluir las transacciones ya vinculadas? No se cambian los movimientos.',
    cashFlowSummary: 'Resumen del flujo de caja',
    negativeCarryComposition:
      'El arrastre hace negativo parte del objetivo disponible; los totales no usan una barra solo positiva.',
    dailyDetails: 'Detalles de gastos diarios',
    dailySpending: 'Gastos diarios',
    safeGroupDeletion:
      'Los grupos referenciados están protegidos. Mueva las categorías primero; se conserva el historial de objetivos.',
    addTarget: 'Añadir objetivo',
    saved: 'Guardado',
    groupOrder: 'Orden del grupo',
    payeeSpending: 'Gastos por beneficiario',
    noTargets: 'Todavía no hay objetivos mensuales',
    weekdayTotal: 'Total por día de la semana',
    heatmapLegend:
      'Cada celda es una fecha registrada. Más intensidad indica importes mayores; reembolsos netos usan el color positivo.',
    hideBalances: 'Ocultar valores',
    monthlyTargetContext:
      'Esta comparación usa objetivos y gastos del mes completo {{month}}. El flujo de arriba usa el período seleccionado.',
    filter_all: 'Todas',
    filter_over: 'Sobre objetivo',
    filter_movers: 'Cambios',
    filter_no_budget: 'Sin objetivo',
    exactChartValues: 'Valores exactos del gr�fico',
    groupCategories: 'Agrupar categor�as',
    negativeComposition:
      'Los reembolsos netos se muestran con signo; el mapa positivo no representa este per�odo.',
    excludedCurrencies: 'Monedas excluidas sin conversi�n: {{currencies}}',
    targetDetails: 'Detalles y apariencia del objetivo',
    confirmCopy:
      '�Reemplazar objetivos de este mes? Los meses anteriores y el historial se conservan.',
    effectiveMonth:
      'Valores desde {{month}} hasta la pr�xima versi�n guardada.',
    categoryAppearance: 'Apariencia de la categor�a',
    recordedIncome:
      'Ingresos registrados este mes. Son cobros reales, no metas de ingresos.',
    enableTarget: 'Activar meta',
    disableTarget: 'Desactivar meta',
    afterSaving: 'Después de ahorrar',
    carryover: 'Saldo acumulado',
    available: 'Meta disponible',
    recordedDays:
      'Basado en fechas registradas; las horas de las transacciones no están disponibles.',
    newGroup: 'Nuevo grupo',
    incomeReference:
      'Comparación con ingresos registrados; las metas son límites de gasto voluntarios.',
  },
}
for (const [language, resource] of Object.entries(labels))
  i18n.addResourceBundle(language, 'spendingMigration', resource, true, false)
