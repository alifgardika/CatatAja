# Income Summary Sheet Design

## Goal

Store income in the monthly `Income` summary sheet instead of the `Expenses`
ledger. A message such as `masuk gaji 5jt` updates the `Gaji` row in the
matching month column.

## Sheet Contract

The Apps Script uses the sheet named `Income`. It locates the month headers by
their Indonesian names (`Januari` through `Desember`) and source rows by their
labels in the first column. It does not depend on fixed row or column numbers.

The sheet must contain a `Total` row. New income-source rows are inserted
immediately before that row, preserving the total as the final summary row.

## Income Routing

- Transactions classified as `Income` no longer write to `Expenses`.
- Income containing the word `gaji` uses the existing `Gaji` row.
- Other income uses the parsed description as its source label, for example
  `duit masuk jual server 5jt` uses `Jual server`.
- If the source row already exists, comparison is case-insensitive and the
  amount is added to the month cell rather than overwriting it.
- If it does not exist, the script inserts a row before `Total`, writes the
  source label, and initializes the matching month cell with the amount.

## Parser and Feedback

Gemini continues to return `jenis`, payment method, description, and date.
The deterministic income keyword normalizer remains the final guard for
salary and received-money phrases. Income confirmations state the source,
amount, and target month rather than presenting an expense-ledger record.

## Errors and Compatibility

If the `Income` sheet, a required month header, or the `Total` row is missing,
the bot reports a clear configuration error and does not write an expense
record as a fallback. Existing expense and transfer behavior stays on the
`Expenses` sheet.

## Tests

The Node VM tests will cover salary routing, dynamic `Jual server` row
creation, repeated-source accumulation, case-insensitive row matching, and
the missing-sheet/header/total error paths.
