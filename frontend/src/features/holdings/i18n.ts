import i18n from '@/lib/i18n'
const resources = import.meta.glob(
  '../../vendor/wealthfolio/locales/*/*.json',
  { eager: true, import: 'default' },
)
for (const [path, content] of Object.entries(resources)) {
  const match = path.match(/locales\/([^/]+)\/([^/]+)\.json$/)
  if (!match) continue
  const [, language, name] = match
  const namespace = `wf${name[0].toUpperCase()}${name.slice(1)}`
  i18n.addResourceBundle(language, namespace, content, true, false)
}
const migrationLabels = {
  en: {
    coverage:
      'Values retain their original currencies. Allocation includes brokerage cash within each currency. Unavailable observations stay unavailable; CDB/RDB values come from contracts, not exchange quotes.',
    recordedDebt:
      'Recorded debt balances and terms. Changes do not infer payments, principal/interest splits or an amortization schedule.',
    closeRecord: 'Close record',
    closeDetails: 'Review closing details. Dated history is retained.',
  },
  'pt-BR': {
    coverage:
      'Os valores preservam a moeda original. A alocação inclui o caixa da corretora em cada moeda. Dados indisponíveis continuam indisponíveis; CDB/RDB usam contratos, não cotações de bolsa.',
    recordedDebt:
      'Saldos e condições de dívidas registrados. Alterações não presumem pagamentos, parcelas de principal/juros ou amortização.',
    closeRecord: 'Encerrar registro',
    closeDetails:
      'Revise os detalhes do encerramento. O histórico é preservado.',
  },
  'es-419': {
    coverage:
      'Los valores conservan su moneda original. La asignación incluye el efectivo de la cuenta en cada moneda. Los datos no disponibles siguen sin estar disponibles; CDB/RDB usan contratos, no cotizaciones bursátiles.',
    recordedDebt:
      'Saldos y condiciones de deuda registrados. Los cambios no infieren pagos, principal/intereses ni amortización.',
    closeRecord: 'Cerrar registro',
    closeDetails: 'Revise los detalles del cierre. Se conserva el historial.',
  },
}
for (const [language, content] of Object.entries(migrationLabels))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)
for (const [language, content] of Object.entries({
  en: {
    annualRate: 'p.a.',
    contractValue: 'Contract accrual · gross estimate',
  },
  'pt-BR': {
    annualRate: 'a.a.',
    contractValue: 'Acúmulo contratual · estimativa bruta',
  },
  'es-419': {
    annualRate: 'anual',
    contractValue: 'Devengo contractual · estimación bruta',
  },
}))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)

for (const [language, content] of Object.entries({
  en: {
    priceChange: 'Price change over selected period',
    price: 'Security price',
    contractUnit: 'Accrued contract unit value',
    exchange: 'Exchange',
    acquisitions: 'Acquisition history',
    notTaxLots:
      'Actual purchases. Positions use weighted-average cost; rows do not represent remaining tax lots.',
    executionPrice: 'Execution price',
    cashPosting: 'Cash posting',
  },
  'pt-BR': {
    priceChange: 'Variação de preço no período',
    price: 'Preço do ativo',
    contractUnit: 'Valor unitário acumulado do contrato',
    exchange: 'Bolsa',
    acquisitions: 'Histórico de aquisições',
    notTaxLots:
      'Compras registradas. As posições usam custo médio ponderado; as linhas não representam lotes fiscais remanescentes.',
    executionPrice: 'Preço de execução',
    cashPosting: 'Movimento de caixa',
  },
  'es-419': {
    priceChange: 'Cambio de precio en el período',
    price: 'Precio del activo',
    contractUnit: 'Valor unitario devengado del contrato',
    exchange: 'Bolsa',
    acquisitions: 'Historial de adquisiciones',
    notTaxLots:
      'Compras registradas. Las posiciones usan costo promedio ponderado; las filas no representan lotes fiscales restantes.',
    executionPrice: 'Precio de ejecución',
    cashPosting: 'Movimiento de efectivo',
  },
}))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)

for (const [language, content] of Object.entries({
  en: {
    inspect: 'Activity details',
    duplicateDraft: 'Copy to new draft',
    postingStatus: 'Posting status',
    posted: 'Posted',
    compact: 'Compact',
    detailed: 'Detailed',
    from: 'From',
    to: 'To',
    immutableActivity:
      'Posted activities retain their audit history. Copying creates an unposted draft. Voiding revalidates all later positions and cash before changing anything.',
  },
  'pt-BR': {
    inspect: 'Detalhes da atividade',
    duplicateDraft: 'Copiar para novo rascunho',
    postingStatus: 'Estado do lançamento',
    posted: 'Lançada',
    compact: 'Compacto',
    detailed: 'Detalhado',
    from: 'De',
    to: 'Até',
    immutableActivity:
      'As atividades lançadas preservam o histórico de auditoria. A cópia cria um rascunho. A anulação revalida posições e caixa posteriores antes de alterar qualquer registro.',
  },
  'es-419': {
    inspect: 'Detalles de actividad',
    duplicateDraft: 'Copiar a nuevo borrador',
    postingStatus: 'Estado del asiento',
    posted: 'Registrada',
    compact: 'Compacto',
    detailed: 'Detallado',
    from: 'Desde',
    to: 'Hasta',
    immutableActivity:
      'Las actividades registradas conservan su auditoría. Copiar crea un borrador. Anular revalida las posiciones y el efectivo posteriores antes de cambiar registros.',
  },
}))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)

for (const [language, content] of Object.entries({
  en: {
    recordedReduction: 'Recorded balance reduction',
    firstRecordedBalance: 'First recorded balance {{amount}}',
    all: 'All',
  },
  'pt-BR': {
    recordedReduction: 'Redução do saldo registrado',
    firstRecordedBalance: 'Primeiro saldo registrado {{amount}}',
    all: 'Todas',
  },
  'es-419': {
    recordedReduction: 'Reducción del saldo registrado',
    firstRecordedBalance: 'Primer saldo registrado {{amount}}',
    all: 'Todas',
  },
}))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)

for (const [language, content] of Object.entries({
  en: { principalUnits: '{{currency}} principal' },
  'pt-BR': { principalUnits: 'Principal em {{currency}}' },
  'es-419': { principalUnits: 'Capital en {{currency}}' },
}))
  i18n.addResourceBundle(language, 'holdingsMigration', content, true, true)
