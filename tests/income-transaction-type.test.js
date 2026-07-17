const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");

function loadScript() {
  const writes = [];
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet() {
        return {
          getSheetByName() {
            return {
              getRange(a1OrRow, column, rows, columns) {
                if (typeof a1OrRow === "string") {
                  return {
                    getValues() {
                      return Array.from({ length: 998 }, () => Array(9).fill(""));
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
  return { context, writes };
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
