const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadScript(options = {}) {
  const writes = [];
  const income = options.income;
  const sheet = {
    header: options.header || "",
    headerWrites: 0,
    maxColumns: options.maxColumns || 9,
    insertedColumns: 0,
    validation: null,
    jenisValues: options.jenisValues || Array.from({ length: 998 }, () => [""]),
    jenisFormulas: options.jenisFormulas || Array.from({ length: 998 }, () => [""])
  };
  const incomeSheet = income && {
    values: income.values.map((row) => row.slice()),
    insertions: []
  };
  if (incomeSheet) {
    incomeSheet.getLastRow = () => incomeSheet.values.length;
    incomeSheet.getLastColumn = () => Math.max(...incomeSheet.values.map((row) => row.length));
    incomeSheet.getRange = (row, column, rows = 1, columns = 1) => ({
      getValues() {
        return Array.from({ length: rows }, (_, rowOffset) => Array.from({ length: columns }, (_, columnOffset) =>
          incomeSheet.values[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""
        ));
      },
      getValue() {
        return incomeSheet.values[row - 1]?.[column - 1] ?? "";
      },
      setValue(value) {
        while (incomeSheet.values.length < row) incomeSheet.values.push([]);
        while (incomeSheet.values[row - 1].length < column) incomeSheet.values[row - 1].push("");
        incomeSheet.values[row - 1][column - 1] = value;
      }
    });
    incomeSheet.insertRowsBefore = (row, howMany) => {
      incomeSheet.insertions.push({ row, howMany });
      incomeSheet.values.splice(row - 1, 0, ...Array.from({ length: howMany }, () => []));
    };
  }
  const context = {
    SpreadsheetApp: {
      newDataValidation() {
        return {
          requireValueInList(values, showDropdown) {
            this.values = values;
            this.showDropdown = showDropdown;
            return this;
          },
          setAllowInvalid(allowInvalid) {
            this.allowInvalid = allowInvalid;
            return this;
          },
          build() {
            return {
              values: this.values,
              showDropdown: this.showDropdown,
              allowInvalid: this.allowInvalid
            };
          }
        };
      },
      getActiveSpreadsheet() {
        return {
          getSheetByName() {
            if (arguments[0] === "Income") return incomeSheet;
            return {
              getMaxColumns() {
                return sheet.maxColumns;
              },
              insertColumnsAfter(column, howMany) {
                sheet.insertedColumns += howMany;
                sheet.maxColumns += howMany;
              },
              getRange(a1OrRow, column, rows, columns) {
                if (typeof a1OrRow === "string") {
                  if (a1OrRow === "I2:I999") {
                    return {
                      getValues() {
                        return sheet.jenisValues;
                      },
                      getFormulas() {
                        return sheet.jenisFormulas;
                      },
                      setDataValidation(validation) {
                        sheet.validation = validation;
                      }
                    };
                  }
                  return {
                    getValues() {
                      return Array.from({ length: 998 }, () => Array(9).fill(""));
                    }
                  };
                }
                if (a1OrRow === 1 && column === 9 && rows === undefined) {
                  return {
                    getValue() {
                      return sheet.header;
                    },
                    setValue(value) {
                      sheet.headerWrites++;
                      sheet.header = value;
                    }
                  };
                }
                return {
                  setValues(values) {
                    writes.push({ a1OrRow, column, rows, columns, values });
                  }
                };
              }
            };
          }
        };
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("Kode.gs", "utf8"), context);
  return { context, writes, sheet, incomeSheet };
}

function incomeTable({
  includeSheet = true,
  includeMonth = true,
  includeTotal = true,
  source = "Gaji",
  emptySourceRows = 0,
  includeLaterTotal = false
} = {}) {
  if (!includeSheet) return undefined;
  const headers = ["Income", "Januari", "Februari", "Maret", "April", "Mei", "Juni", includeMonth ? "Juli" : "Agustus"];
  const rows = [["Laporan Income"], [], headers, [source, 0, 0, 0, 0, 0, 0, 0]];
  rows.push(...Array.from({ length: emptySourceRows }, () => Array(8).fill("")));
  if (includeTotal) rows.push(["Total", 0, 0, 0, 0, 0, 0, 0]);
  if (includeLaterTotal) rows.push(["Alokasi"], ["Total", 0, 0, 0, 0, 0, 0, 0]);
  return { values: rows };
}

test("classifies gaji masuk as Income even if AI says Expense", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis("Expense", "gaji masuk 5jt"), "Income");
});

test("defaults an ordinary purchase to Expense", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis(undefined, "beli kopi 25k"), "Expense");
});

test("retains an explicit valid Transfer type", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis("Transfer", "pindah saldo antar rekening sendiri"), "Transfer");
});

test("income keywords override an explicit Transfer type", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis("Transfer", "gaji masuk ke rekening sendiri"), "Income");
});

test("recognizes pendapatan and extracts a project source", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis("Expense", "pendapatan dari project beam 300k"), "Income");
  assert.equal(context.normalizeIncomeSource({ SumberIncome: "duit masuk dari project beam 300k" }), "Beam");
  assert.equal(context.normalizeIncomeSource({ SumberIncome: "duit masuk gaji 5jt" }), "Gaji");
});

function submitManualTransaction(command) {
  const { context } = loadScript();
  const rows = [];
  const messages = [];
  context.USERS = [123456789];
  context.addDataToSheet = (data) => rows.push(JSON.parse(JSON.stringify(data)));
  context.sendMessage = (message) => messages.push(message.text);

  context.handleCommands({
    message: {
      chat: { id: 123456789, first_name: "Test" },
      text: command
    }
  });

  return { data: rows[0], messages };
}

test("manual input keeps legacy five fields and defaults Jenis to Expense", () => {
  const { data } = submitManualTransaction("/tambahdata Cash;kopi;Makanan;CASH;25000");

  assert.equal(data.Jenis, "Expense");
  assert.equal(data.Transaksi, "Cash");
  assert.equal(data.Nilai, "25000");
});

test("legacy manual input stays Expense when its description contains income keywords", () => {
  const { data } = submitManualTransaction("/tambahdata Transfer;gaji masuk;Tabungan;JAGO;5000000");

  assert.equal(data.Jenis, "Expense");
});

test("manual input accepts six fields with Jenis first", () => {
  const { data } = submitManualTransaction("/tambahdata Income;Transfer;gaji;Tabungan;JAGO;5000000");

  assert.equal(data.Jenis, "Income");
  assert.equal(data.Transaksi, "Transfer");
  assert.equal(data.Uraian, "gaji");
});

test("manual confirmation displays the resolved Jenis", () => {
  const { messages } = submitManualTransaction("/tambahdata Cash;kopi;Makanan;CASH;25000");

  assert.match(messages[0], /Jenis: Expense/);
});

test("confirmation displays Jenis separately", () => {
  const { context } = loadScript();
  const messages = [];
  context.Utilities = { formatDate: () => "2026-07-17" };
  context.addDataToSheet = () => {};
  context.addIncomeToSheet = () => ({ source: "Gaji", month: "Juli" });
  context.editOrSend = (chatId, msgId, text) => messages.push(text);

  context.recordTransaction(123456789, 1, {
    jenis: "Income",
    transaksi: "Transfer",
    uraian: "gaji",
    kategori: "Tabungan",
    bank: "JAGO",
    nilai: "5000000",
    date: "2026-07-17"
  }, undefined, "gaji masuk");

  assert.match(messages[0], /Jenis: Income/);
});

test("salary income accumulates in a case-insensitive Gaji row for Juli", () => {
  const { context, writes, incomeSheet } = loadScript({ income: incomeTable({ source: "gAjI" }) });
  const messages = [];
  context.Utilities = { formatDate: () => "2026-07-17" };
  context.editOrSend = (chatId, msgId, text) => messages.push(text);

  context.recordTransaction(123456789, 1, {
    jenis: "Income", transaksi: "Transfer", uraian: "gaji bulanan", kategori: "Tabungan", bank: "JAGO", nilai: "5000000", date: "2026-07-17"
  }, undefined, "gaji masuk");

  assert.equal(writes.length, 0);
  assert.equal(incomeSheet.values[3][7], 5000000);
  assert.match(messages[0], /Gaji.*Juli/);
});

test("adds Beam income to its existing July balance", () => {
  const { context, incomeSheet } = loadScript({ income: incomeTable({ source: "bEaM" }) });
  incomeSheet.values[3][7] = 200000;

  context.addIncomeToSheet({
    Bulan: "07",
    SumberIncome: "duit masuk dari project beam 300k",
    Nilai: "300000"
  });

  assert.equal(incomeSheet.insertions.length, 0);
  assert.equal(incomeSheet.values[3][7], 500000);
});

test("uses an empty source row before the primary Total", () => {
  const { context, incomeSheet } = loadScript({ income: incomeTable({ emptySourceRows: 1 }) });

  context.addIncomeToSheet({
    Bulan: "07",
    SumberIncome: "pendapatan project beam 300k",
    Nilai: "300000"
  });

  assert.equal(incomeSheet.insertions.length, 0);
  assert.equal(incomeSheet.values[4][0], "Beam");
  assert.equal(incomeSheet.values[4][7], 300000);
  assert.equal(incomeSheet.values[5][0], "Total");
});

test("inserts above the primary Total and ignores a later Total", () => {
  const { context, incomeSheet } = loadScript({ income: incomeTable({ includeLaterTotal: true }) });

  context.addIncomeToSheet({
    Bulan: "07",
    SumberIncome: "duit masuk dari project beam 300k",
    Nilai: "300000"
  });

  assert.deepEqual(JSON.parse(JSON.stringify(incomeSheet.insertions)), [{ row: 5, howMany: 1 }]);
  assert.equal(incomeSheet.values[4][0], "Beam");
  assert.equal(incomeSheet.values[5][0], "Total");
  assert.equal(incomeSheet.values[7][0], "Total");
});

test("income creates a title-cased source row immediately before Total", () => {
  const { context, incomeSheet } = loadScript({ income: incomeTable() });

  context.addIncomeToSheet({ Bulan: "07", Uraian: "jual server", Nilai: "150000" });

  assert.deepEqual(JSON.parse(JSON.stringify(incomeSheet.insertions)), [{ row: 5, howMany: 1 }]);
  assert.equal(incomeSheet.values[4][0], "Jual server");
  assert.equal(incomeSheet.values[4][7], 150000);
  assert.equal(incomeSheet.values[5][0], "Total");
});

test("repeated dynamic income source accumulates in its existing row", () => {
  const { context, incomeSheet } = loadScript({ income: incomeTable() });

  context.addIncomeToSheet({ Bulan: "07", Uraian: "jual server", Nilai: "150000" });
  context.addIncomeToSheet({ Bulan: "07", Uraian: "JUAL SERVER", Nilai: "50000" });

  assert.equal(incomeSheet.insertions.length, 1);
  assert.equal(incomeSheet.values[4][7], 200000);
});

test("income requires an Income sheet", () => {
  const { context } = loadScript();

  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "07", Uraian: "jual server", Nilai: "150000" }),
    /Konfigurasi Income: sheet 'Income' tidak ditemukan/
  );
});

test("income rejects missing input data", () => {
  const { context } = loadScript({ income: incomeTable() });

  assert.throws(
    () => context.addIncomeToSheet(),
    /Data pemasukan tidak tersedia/
  );
});

test("income rejects missing month and value", () => {
  const { context } = loadScript({ income: incomeTable() });

  assert.throws(
    () => context.addIncomeToSheet({ Nilai: "300000" }),
    /Field 'Bulan' tidak tersedia/
  );
  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "07" }),
    /Field 'Nilai' tidak tersedia/
  );
});

test("income rejects invalid month and value", () => {
  const { context } = loadScript({ income: incomeTable() });

  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "13", Nilai: "300000" }),
    /Bulan tidak valid: 13/
  );
  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "07", Nilai: "tiga ratus ribu" }),
    /Nilai tidak valid: tiga ratus ribu/
  );
});

test("income requires the target month header", () => {
  const { context } = loadScript({ income: incomeTable({ includeMonth: false }) });

  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "07", Uraian: "jual server", Nilai: "150000" }),
    /Konfigurasi Income: header bulan 'Juli' tidak ditemukan/
  );
});

test("income requires a Total row", () => {
  const { context } = loadScript({ income: incomeTable({ includeTotal: false }) });

  assert.throws(
    () => context.addIncomeToSheet({ Bulan: "07", Uraian: "jual server", Nilai: "150000" }),
    /Konfigurasi Income: baris 'Total' tidak ditemukan/
  );
});

test("writes Jenis to column I", () => {
  const { context, writes } = loadScript();

  context.addDataToSheet({
    Tanggal: "17",
    Bulan: "7",
    Tahun: "2026",
    Jenis: "Income",
    Transaksi: "Transfer",
    Uraian: "gaji masuk",
    Kategori: "Tabungan",
    Bank: "JAGO",
    Nilai: "5000000"
  });

  assert.equal(writes[0].columns, 9);
  assert.equal(writes[0].values[0][8], "Income");
});

test("initializes a blank Jenis header and validation before writing", () => {
  const { context, sheet } = loadScript({ maxColumns: 8 });

  context.addDataToSheet({ Tanggal: "17", Bulan: "7", Jenis: "Income", Transaksi: "Transfer", Nilai: "5000000" });

  assert.equal(sheet.maxColumns, 9);
  assert.equal(sheet.insertedColumns, 1);
  assert.equal(sheet.header, "Jenis");
  assert.deepEqual(JSON.parse(JSON.stringify(sheet.validation.values)), ["Income", "Expense", "Transfer"]);
  assert.equal(sheet.validation.allowInvalid, false);
});

test("rejects a blank Jenis header when column I already has a value", () => {
  const { context, writes, sheet } = loadScript({ jenisValues: [["legacy type"]] });

  assert.throws(
    () => context.addDataToSheet({ Tanggal: "17", Bulan: "7", Jenis: "Income", Transaksi: "Transfer", Nilai: "5000000" }),
    /Kolom I.*data atau formula/
  );
  assert.equal(sheet.headerWrites, 0);
  assert.equal(sheet.validation, null);
  assert.equal(writes.length, 0);
});

test("rejects a blank Jenis header when column I already has a formula", () => {
  const { context, writes, sheet } = loadScript({ jenisFormulas: [["=H2"]] });

  assert.throws(
    () => context.addDataToSheet({ Tanggal: "17", Bulan: "7", Jenis: "Income", Transaksi: "Transfer", Nilai: "5000000" }),
    /Kolom I.*data atau formula/
  );
  assert.equal(sheet.headerWrites, 0);
  assert.equal(sheet.validation, null);
  assert.equal(writes.length, 0);
});

test("applies validation without rewriting a preexisting Jenis header", () => {
  const { context, sheet } = loadScript({ header: "Jenis" });

  context.addDataToSheet({ Tanggal: "17", Bulan: "7", Jenis: "Income", Transaksi: "Transfer", Nilai: "5000000" });

  assert.equal(sheet.headerWrites, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(sheet.validation.values)), ["Income", "Expense", "Transfer"]);
  assert.equal(sheet.validation.allowInvalid, false);
});

test("rejects a conflicting column I header without overwriting it", () => {
  const { context, writes, sheet } = loadScript({ header: "Notes" });

  assert.throws(
    () => context.addDataToSheet({ Tanggal: "17", Bulan: "7", Jenis: "Income", Transaksi: "Transfer", Nilai: "5000000" }),
    /Kolom I.*Notes/
  );
  assert.equal(sheet.header, "Notes");
  assert.equal(sheet.headerWrites, 0);
  assert.equal(writes.length, 0);
});
