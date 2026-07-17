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

test("income keywords override an explicit Transfer type", () => {
  const { context } = loadScript();

  assert.equal(context.normalizeJenis("Transfer", "gaji masuk ke rekening sendiri"), "Income");
});

function submitManualTransaction(command) {
  const { context } = loadScript();
  const rows = [];
  context.USERS = [123456789];
  context.addDataToSheet = (data) => rows.push(JSON.parse(JSON.stringify(data)));
  context.sendMessage = () => {};

  context.handleCommands({
    message: {
      chat: { id: 123456789, first_name: "Test" },
      text: command
    }
  });

  return rows[0];
}

test("manual input keeps legacy five fields and defaults Jenis to Expense", () => {
  const data = submitManualTransaction("/tambahdata Cash;kopi;Makanan;CASH;25000");

  assert.equal(data.Jenis, "Expense");
  assert.equal(data.Transaksi, "Cash");
  assert.equal(data.Nilai, "25000");
});

test("manual input accepts six fields with Jenis first", () => {
  const data = submitManualTransaction("/tambahdata Income;Transfer;gaji;Tabungan;JAGO;5000000");

  assert.equal(data.Jenis, "Income");
  assert.equal(data.Transaksi, "Transfer");
  assert.equal(data.Uraian, "gaji");
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
