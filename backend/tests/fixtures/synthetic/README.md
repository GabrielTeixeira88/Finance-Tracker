# Fictional bank-export fixtures

Every row is synthetic. These files are not personal bank exports.

| File | Explicit import settings / purpose |
| --- | --- |
| br-bom.csv | UTF-8 BOM, semicolon, DD/MM/YYYY, decimal comma, no thousands |
| legacy.csv | Windows-1252, comma, YYYY-MM-DD, decimal point |
| us.csv | UTF-8, comma, YYYY-MM-DD, decimal point, thousands comma, quoted fields |
| debit-credit.csv | UTF-8, comma, separate debit and credit columns |
| review-workflow.csv | UTF-8, comma, signed amount; rules, schedules, twins, transfers/payments/refund, invalid rows |
| bank-sgml.ofx | Fictional legacy SGML bank statement with FITID |
| bank-xml.ofx | Same fictional event in XML with FITID |
| repeated-fitid.ofx | Same FITID twice; only one economic event |
| card.ofx | Fictional card purchase |

CSV columns are date, description, amount unless named debit/credit. All files have
headers. Missing currency uses the explicitly selected account's BRL currency.
Set up a Netflix payee/rule and an expected October 7, 2026 expense of 55 on the
same synthetic account to inspect schedule suggestions in review-workflow.csv.
No fixture is loaded automatically. Do not place real financial exports here.
