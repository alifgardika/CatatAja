# Income Transaction Type Design

## Goal

Record money received, such as `gaji masuk 5jt`, as income instead of an
expense while preserving the existing payment-method field.

## Spreadsheet Model

Keep the existing `Expenses` sheet for compatibility and append a ninth column:

| Column | Field | Values |
| --- | --- | --- |
| A-H | Existing fields | Unchanged |
| I | Jenis | `Income`, `Expense`, or `Transfer` |

`Transaksi` remains the payment method (`Transfer` or `Cash`). Appending the
field avoids shifting existing formulas, dropdowns, and historical data. The
sheet header and its data validation must be updated before deploying the
script.

## Parsing and Classification

Both text and image Gemini prompts will request a `jenis` field. The shared
recording function will normalize it before writing:

- `gaji`, `terima`, `dapat`, `bayaran`, `pemasukan`, `masuk`, and `cair` map to
  `Income` when present in text or an image caption.
- A valid explicit AI value is used when no income keyword applies.
- Missing or invalid values default to `Expense` to preserve current behavior.
- `Transfer` is reserved for money moved between the user's own accounts; it is
  not inferred merely because the payment method is `Transfer`.

The parser will continue to choose a payment method and bank independently.
For example, `gaji masuk 5jt JAGO` becomes `Income`, `Transfer`, `JAGO`, and
`5000000`.

## Recording and User Feedback

The shared `recordTransaction` path will pass `Jenis` to `addDataToSheet`, so
natural-language transactions, Telegram images, and Shortcut image requests
all write the same data. The confirmation message will display the type and
payment method separately.

The manual command will accept the new six-part format:

```
/tambahdata Income;Transfer;gaji masuk;Gaji;JAGO;5000000
```

The existing five-part form remains accepted and is recorded as `Expense`, so
existing shortcuts and habits do not break.

## Categories and Documentation

Add `Gaji` to the default categories so salary is not classified as
`Tabungan`. Update Indonesian and English documentation, command help, and
spreadsheet setup instructions to describe the new `Jenis` column and manual
format.

## Error Handling

If the Google Sheet has not been updated with column I, writing the row should
fail through the existing error path instead of silently losing the type. The
documentation will explicitly call out the one-time header and validation
change required before deployment.

## Tests

Extend the Node VM test harness with focused tests for the normalizer and the
shared record path. At minimum verify salary text becomes `Income`, ordinary
purchases remain `Expense`, explicit valid types are retained, and a row is
written with `Jenis` in column I.
