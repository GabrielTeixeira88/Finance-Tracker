# Official public observations

`brazil-2024-2026.json` contains public market/index observations, **not personal
financial data or fictional rates**. Fictional holdings are generated separately
by `app.demo.real_market`. Do not replace these observations with generated curves.

- Banco Central do Brasil, SGS 12 (daily CDI, percent per business day) and SGS
  4389 (annualized CDI, percent per year, 252-day basis). Retrieved November 3,
  2026 using the official BCData API. Reuse/attribution basis: the BCB's
  [open-data policy](https://www.bcb.gov.br/acessoinformacao/dadosabertos).
  Source URLs and raw-response SHA-256 hashes are retained in the JSON.
- Tesouro Nacional / CODIP, **Taxas dos Títulos Ofertados pelo Tesouro Direto**,
  filtered to Tesouro Selic maturing March 1, 2029, October 2024–September 2026.
  Retrieved November 3, 2026. Morning purchase, sale and base PUs are preserved;
  they are not exchange closing prices. The source database and this extracted
  Treasury database are available under
  [Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  [Official dataset and license](https://www.tesourotransparente.gov.br/ckan/dataset/taxas-dos-titulos-ofertados-pelo-tesouro-direto).
  Preserve this notice and the ODbL attribution/share-alike obligations when
  distributing or modifying the extracted Treasury database. The code's license
  does not replace the source database's license.

No ETF price history is redistributed here. Authorized private exports belong in
ignored `data/real-market-snapshot/`. See [setup, conventions and limitations](../../../../docs/REAL_MARKET_DEMO.md).
