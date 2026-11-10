import '../holdings/i18n'

// Upstream Goals resources are loaded into wfGoals by the shared source loader.
// Keep local domain explanations distinct from upstream/source/user labels.
import i18n from '@/lib/i18n'
const resources = {
  en: {
    invalidGoal: 'Enter a title, valid currency and ordered dates.',
    manualFunding: 'Manual progress',
    editFunding: 'Edit goal funding',
    fundingNote:
      'These reservations reference existing savings. They never move money or add assets to Net Worth.',
    effectiveDate: 'Effective date',
    amount: 'Amount',
    direction: 'Entry type',
    contribution: 'Contribution',
    withdrawal: 'Withdrawal',
    available: 'Available to this goal',
    releaseAmount: 'Release allocation',
    wholeAccount: 'Whole investment account',
    allocationLimit: 'The allocation exceeds available same-currency savings.',
    fundingDetails: 'Funding details',
    sharedSavings: 'Shared savings',
    account: 'Account',
    balance: 'Balance',
    allocated: 'Allocated',
    history: 'Recorded funding history',
    voided: 'Voided · retained in history',
    voidReason:
      'Why are you voiding this goal entry? Financial transactions stay unchanged.',
    voidEntry: 'Void entry',
    pauseNote:
      'Retain recorded progress and funding while pausing the planning scenario.',
    completionNote:
      'Explicit completion preserves recorded progress and existing funding semantics.',
    deleted:
      'This goal was deleted. Its funding history and financial records are retained.',
    restore: 'Restore goal',
    resume: 'Resume goal',
    pause: 'Pause goal',
    discardDraft:
      'Discard unsaved goal planning changes? No financial transaction will be changed.',
    exactValues: 'Exact chart values',

    completed: 'Completed',
    paused: 'Paused',
    fixedFunding: 'Fixed allocations',
    exclusiveFunding: 'Whole investment account · gross dated value',
    returnsDeferred:
      'Return assumptions are not enabled. This scenario assumes zero return.',
    releaseWarning:
      'Archiving or deleting releases funding. Restoring requires explicit new allocations.',
    invalidAmount:
      'Enter a valid nonnegative amount within the supported range.',
    actual: 'Recorded progress',
    scenario: 'Hypothetical monthly savings; no assumed investment return.',
    unknownTiming: 'Reached; date unavailable',
    observed: 'First recorded {{date}}',
    estimated: 'Estimated {{date}}',
    noEstimate: 'Not reached in this scenario',
    unavailable: 'Progress unavailable',
  },
  'pt-BR': {
    invalidGoal: 'Informe um título, moeda válida e datas em ordem.',
    manualFunding: 'Progresso manual',
    editFunding: 'Editar financiamento da meta',
    fundingNote:
      'Estas reservas usam valores já existentes. Não movimentam dinheiro nem acrescentam patrimônio.',
    effectiveDate: 'Data de vigência',
    amount: 'Valor',
    direction: 'Tipo de registro',
    contribution: 'Aporte',
    withdrawal: 'Retirada',
    available: 'Disponível para esta meta',
    releaseAmount: 'Liberar reserva',
    wholeAccount: 'Conta de investimento integral',
    allocationLimit: 'A reserva excede os valores disponíveis na mesma moeda.',
    fundingDetails: 'Detalhes das reservas',
    sharedSavings: 'Economias compartilhadas',
    account: 'Conta',
    balance: 'Saldo',
    allocated: 'Reservado',
    history: 'Histórico das reservas',
    voided: 'Anulado · mantido no histórico',
    voidReason:
      'Por que anular este registro da meta? As transações financeiras não serão alteradas.',
    voidEntry: 'Anular registro',
    pauseNote:
      'Preservar o progresso e as reservas enquanto o cenário fica pausado.',
    completionNote:
      'A conclusão explícita preserva o progresso e as regras atuais das reservas.',
    deleted:
      'Esta meta foi excluída. O histórico e os registros financeiros foram preservados.',
    restore: 'Restaurar meta',
    resume: 'Retomar meta',
    pause: 'Pausar meta',
    discardDraft:
      'Descartar alterações não salvas no plano? Nenhuma transação será alterada.',
    exactValues: 'Valores exatos do gráfico',

    completed: 'Concluído',
    paused: 'Pausado',
    fixedFunding: 'Reservas fixas',
    exclusiveFunding: 'Conta de investimento integral · valor bruto na data',
    returnsDeferred:
      'Hipóteses de retorno não estão habilitadas. Este cenário assume retorno zero.',
    releaseWarning:
      'Arquivar ou excluir libera as reservas. Restaurar exige novas reservas explícitas.',
    invalidAmount:
      'Informe um valor não negativo válido dentro do limite permitido.',
    actual: 'Progresso registrado',
    scenario:
      'Poupança mensal hipotética; sem retorno de investimento presumido.',
    unknownTiming: 'Atingido; data indisponível',
    observed: 'Primeiro registro em {{date}}',
    estimated: 'Estimativa: {{date}}',
    noEstimate: 'Não atingido neste cenário',
    unavailable: 'Progresso indisponível',
  },
  'es-419': {
    invalidGoal: 'Introduce un título, moneda válida y fechas ordenadas.',
    manualFunding: 'Progreso manual',
    editFunding: 'Editar financiación de la meta',
    fundingNote:
      'Estas asignaciones usan ahorros existentes. No mueven dinero ni añaden patrimonio.',
    effectiveDate: 'Fecha efectiva',
    amount: 'Importe',
    direction: 'Tipo de registro',
    contribution: 'Aportación',
    withdrawal: 'Retiro',
    available: 'Disponible para esta meta',
    releaseAmount: 'Liberar asignación',
    wholeAccount: 'Cuenta de inversión completa',
    allocationLimit:
      'La asignación supera los ahorros disponibles en la misma moneda.',
    fundingDetails: 'Detalles de financiación',
    sharedSavings: 'Ahorros compartidos',
    account: 'Cuenta',
    balance: 'Saldo',
    allocated: 'Asignado',
    history: 'Historial de financiación',
    voided: 'Anulado · conservado en el historial',
    voidReason:
      '¿Por qué anulas este registro? Las transacciones financieras no cambiarán.',
    voidEntry: 'Anular registro',
    pauseNote:
      'Conservar progreso y financiación mientras se pausa el escenario.',
    completionNote:
      'La finalización explícita conserva el progreso y las reglas actuales de financiación.',
    deleted:
      'Esta meta fue eliminada. Se conservan su historial y los registros financieros.',
    restore: 'Restaurar meta',
    resume: 'Reanudar meta',
    pause: 'Pausar meta',
    discardDraft:
      '¿Descartar los cambios no guardados del plan? No cambiará ninguna transacción.',
    exactValues: 'Valores exactos del gráfico',

    completed: 'Completado',
    paused: 'Pausado',
    fixedFunding: 'Asignaciones fijas',
    exclusiveFunding: 'Cuenta de inversión completa · valor bruto a la fecha',
    returnsDeferred:
      'Las hipótesis de rendimiento no están habilitadas. Este escenario supone rendimiento cero.',
    releaseWarning:
      'Archivar o eliminar libera las asignaciones. Restaurar requiere nuevas asignaciones explícitas.',
    invalidAmount:
      'Introduce un importe no negativo válido dentro del rango permitido.',
    actual: 'Progreso registrado',
    scenario:
      'Ahorro mensual hipotético; sin rendimiento de inversión supuesto.',
    unknownTiming: 'Alcanzado; fecha no disponible',
    observed: 'Primer registro: {{date}}',
    estimated: 'Estimado: {{date}}',
    noEstimate: 'No alcanzado en este escenario',
    unavailable: 'Progreso no disponible',
  },
}
for (const [language, labels] of Object.entries(resources))
  i18n.addResourceBundle(language, 'goalsMigration', labels, true, false)
