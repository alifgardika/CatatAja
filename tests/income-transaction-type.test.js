const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadScript(options = {}) {
  const writes = [];
  const sheet = {
    header: options.header || "",
    headerWrites: 0,
    maxColumns: options.maxColumns || 9,
    insertedColumns: 0,
    validation: null,
    jenisValues: options.jenisValues || Array.from({ length: 998 }, () => [""]),
    jenisFormulas: options.jenisFormulas || Array.from({ length: 998 }, () => [""])
  };
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
  return { context, writes, sheet };
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
