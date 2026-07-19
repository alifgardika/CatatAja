# Income Source Routing Design

## Goal

Record Indonesian income messages in the correct source row and month of the
primary income summary table.

## Source detection

The parser will recognize common income wording, including `pendapatan`,
`duit masuk`, `uang masuk`, `gaji`, `bayaran`, `pemasukan`, `terima`, `dapat`,
and `cair`.

`gaji` maps to the source label `Gaji`. For project-based messages, filler
words such as `dari` and `project` are removed and the remaining project name
is title-cased. For example:

- `duit masuk dari project beam 300k` -> `Beam`
- `pendapatan project tao 705k` -> `Tao`
- `duit masuk gaji 5jt` -> `Gaji`

## Table routing

The primary income table is the first table whose header row contains the
income/month headings. Its source area begins on the next row and ends at the
first `Total` row in column A after that header. Later allocation, notes, and
other `Total` rows are outside this table and must not be used.

The bot searches source labels in that source area case-insensitively. It adds
the transaction amount to the row's column for the transaction month. Thus,
an existing `Beam` balance of Rp200.000 in July becomes Rp500.000 after a new
Rp300.000 income.

If the source is absent, the bot writes it into an empty source-row slot before
`Total`. If there is no empty slot, it inserts exactly one row immediately
before this primary `Total` row. The source and month value are written on that
row.

## Errors and validation

The bot continues to reject a missing Income sheet, a missing target-month
header, or a primary income table without a `Total` row. It must not write to
the ordinary Expenses sheet for an Income transaction when this configuration
is invalid.

## Tests

Tests will cover source extraction for the supported wording, case-insensitive
monthly accumulation, filling an empty source slot, insertion when the source
area is full, and ignoring a later `Total` outside the primary income table.
