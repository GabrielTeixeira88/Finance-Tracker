export type Exact = string | null
export type MonetaryValue = { local: Exact; base: Exact }
export type Account = { id: string; name: string }
export type AccountScope =
  | { type: 'all' }
  | { type: 'account'; accountId: string }
  | { type: 'accounts'; accountIds: string[] }
  | { type: 'portfolio'; portfolioId: string }
export type HoldingCategoryFilterId = 'investments' | 'assets' | 'liabilities'
export type AlternativeAssetHolding = {
  id: string
  name: string
  kind: string
  currency: string
  marketValue: Exact
  unrealizedGain: Exact
  unrealizedGainPct: Exact
  valuationDate: string | null
}
export const ALTERNATIVE_ASSET_KIND_DISPLAY_NAMES = {
  PROPERTY: 'Property',
  VEHICLE: 'Vehicle',
  COLLECTIBLE: 'Collectible',
  PRECIOUS_METAL: 'Precious metal',
  OTHER: 'Other',
  LIABILITY: 'Liability',
} as const
export type Holding = {
  id: string
  holdingType: 'SECURITY' | 'CASH'
  isClosed: boolean
  quantity: string
  averagePrice: Exact
  price: Exact
  priceDate: string | null
  priceSource: string | null
  localCurrency: string
  baseCurrency: string
  accountNames: string[]
  accountIds: string[]
  instrument: {
    id: string
    symbol: string
    name: string
    currency: string
    exchangeMic: string
    instrumentType: string
    quoteMode: string
    classifications: { assetType: { key: string; name: string } }
  } | null
  marketValue: MonetaryValue
  costBasis: MonetaryValue
  realizedGain: MonetaryValue
  unrealizedGain: MonetaryValue
  totalGain: MonetaryValue
  totalReturn: MonetaryValue
  returnBasis: MonetaryValue
  income: MonetaryValue
  dayChange: MonetaryValue
  dayChangePct: Exact
  weight: Exact
  realizedGainPct: Exact
  unrealizedGainPct: Exact
  totalGainPct: Exact
  totalReturnPct: Exact
  contractMultiplier: string
  contract: {
    instrument_type: string
    maturity_date: string
    liquidity: string
    cdi_percent: string
    annual_rate: string
  } | null
}
