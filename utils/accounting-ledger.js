"use strict";

/**
 * accounting-ledger.js — 会计明细账导出模块
 * 分层设计：
 *   1. 科目表与会计分录映射层
 *   2. 四类账簿数据生成层
 *   3. Excel 模板渲染层（基于 xlsx-builder.js）
 */

var xlsx = require("./xlsx-builder.js");

/* ================================================================
 * 第一部分：科目表与会计分录映射
 * ================================================================
 */

/**
 * 基础科目表（一级科目）
 */
var ACCOUNT_CHART = {
  // 资产类
  "库存商品":     { code: "1405", type: "asset",  category: "存货" },
  "固定资产":     { code: "1601", type: "asset",  category: "固定资产" },
  "累计折旧":     { code: "1602", type: "asset",  category: "固定资产", contra: true },
  "银行存款":     { code: "1002", type: "asset",  category: "货币资金" },
  "库存现金":     { code: "1001", type: "asset",  category: "货币资金" },
  // 负债类
  "应付账款":     { code: "2202", type: "liability", category: "应付" },
  // 成本类
  "材料采购":     { code: "1401", type: "cost",   category: "采购" },
  // 损益类
  "主营业务成本": { code: "6401", type: "expense", category: "成本" },
  "管理费用":     { code: "6602", type: "expense", category: "管理" },
  "销售费用":     { code: "6601", type: "expense", category: "销售" }
};

/**
 * 物料类别到会计科目的映射规则
 * 入库时：借：库存商品（按类别） 贷：银行存款/应付账款
 * 出库时：借：主营业务成本    贷：库存商品（按类别）
 */
var MATERIAL_CATEGORY_SUBJECT = {
  "饮料":   "库存商品",
  "食品":   "库存商品",
  "调味品": "库存商品",
  "日化":   "库存商品",
  "办公用品": "库存商品"
};

var DEFAULT_SUBJECT = "库存商品";

/**
 * 根据物料分类获取对应会计科目
 */
function getSubjectByCategory(category) {
  return MATERIAL_CATEGORY_SUBJECT[category] || DEFAULT_SUBJECT;
}

/**
 * 生成凭证号：PZ-YYYYMMDD-XXX
 */
function generateVoucherNo(date) {
  var d = date || new Date();
  var ds = d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  var seq = String(Math.floor(Math.random() * 900) + 100);
  return "PZ-" + ds + "-" + seq;
}

/**
 * 将物料出入库交易映射为标准会计分录
 * @param {Object} tx - 交易对象
 *   { type, materialId, materialName, category, quantity, price, totalAmount, unit, createdAt }
 * @returns {Array} 会计分录数组
 *   [{ voucherNo, date, summary, debitSubject, creditSubject, debitAmount, creditAmount, materialName, quantity, unit, type }]
 */
function mapTransactionToEntries(tx) {
  var subject = getSubjectByCategory(tx.category);
  var date = tx.createdAt ? tx.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  var voucherNo = generateVoucherNo(new Date(tx.createdAt));

  var entries = [];

  if (tx.type === "in") {
    // 入库：借：库存商品（物料类别） 贷：银行存款/应付账款
    var summary = "采购" + tx.materialName + " " + tx.quantity + tx.unit;
    entries.push({
      voucherNo: voucherNo,
      date: date,
      summary: summary,
      debitSubject: subject,
      creditSubject: "银行存款",
      debitAmount: tx.totalAmount || (tx.quantity * tx.price),
      creditAmount: tx.totalAmount || (tx.quantity * tx.price),
      materialName: tx.materialName,
      quantity: tx.quantity,
      unit: tx.unit,
      type: "in"
    });
  } else if (tx.type === "out") {
    // 出库：借：主营业务成本  贷：库存商品（物料类别）
    var summary = "销售" + tx.materialName + " " + tx.quantity + tx.unit;
    entries.push({
      voucherNo: voucherNo,
      date: date,
      summary: summary,
      debitSubject: "主营业务成本",
      creditSubject: subject,
      debitAmount: tx.totalAmount || (tx.quantity * tx.price),
      creditAmount: tx.totalAmount || (tx.quantity * tx.price),
      materialName: tx.materialName,
      quantity: tx.quantity,
      unit: tx.unit,
      type: "out"
    });
  }

  return entries;
}

/**
 * 从交易列表生成完整的序时账
 */
function generateJournal(transactions) {
  var journal = [];
  for (var i = 0; i < transactions.length; i++) {
    var entries = mapTransactionToEntries(transactions[i]);
    journal = journal.concat(entries);
  }
  // 按日期排序
  journal.sort(function(a, b) { return a.date.localeCompare(b.date) || a.voucherNo.localeCompare(b.voucherNo); });
  return journal;
}

/* ================================================================
 * 第二部分：四类账簿数据生成
 * ================================================================
 */

/**
 * 计算余额（按科目分组逐步累加）
 */
function calculateBalances(entries, subjectFilter) {
  var balance = 0;
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (subjectFilter && e.debitSubject !== subjectFilter && e.creditSubject !== subjectFilter) continue;
    if (e.debitSubject === subjectFilter) balance += e.debitAmount;
    if (e.creditSubject === subjectFilter) balance -= e.creditAmount;
    e.balance = Math.round(balance * 100) / 100;
  }
}

/**
 * 1. 三栏式明细账数据
 * 格式：日期 | 凭证号 | 摘要 | 借方(千百分列) | 贷方(千百分列) | 余额(千百分列)
 */
function buildThreeColumnLedger(entries, subject, startDate, endDate) {
  var filtered = entries.filter(function(e) {
    return (e.debitSubject === subject || e.creditSubject === subject) &&
      (!startDate || e.date >= startDate) &&
      (!endDate || e.date <= endDate);
  });
  calculateBalances(filtered, subject);

  var rows = [];
  // 标题行
  rows.push([
    { v: "三栏式明细账", t: "s", s: 1 }
  ]);
  // 空行
  rows.push([]);
  // 科目信息
  var subjectInfo = ACCOUNT_CHART[subject] || { code: "" };
  rows.push([
    { v: "科目：", t: "s", s: 0 },
    { v: subject + " (" + subjectInfo.code + ")", t: "s", s: 0 }
  ]);
  if (startDate && endDate) {
    rows.push([
      { v: "期间：", t: "s", s: 0 },
      { v: startDate + " ~ " + endDate, t: "s", s: 0 }
    ]);
  }
  rows.push([]);

  // 表头
  var headerRow = [
    { v: "日期", t: "s", s: 1 },
    { v: "凭证号", t: "s", s: 1 },
    { v: "摘要", t: "s", s: 1 },
  ];
  // 借方（11列）
  var debitHeaders = ["借方"];
  for (var h = 0; h < 11; h++) debitHeaders.push("");
  // 贷方（11列）
  var creditHeaders = ["贷方"];
  for (var h = 0; h < 11; h++) creditHeaders.push("");
  // 余额（11列）
  var balanceHeaders = ["余额"];
  for (var h = 0; h < 11; h++) balanceHeaders.push("");

  headerRow.push({ v: "借方", t: "s", s: 1 });
  var debitSub = ["亿","千万","百万","十万","万","千","百","十","元","角","分"];
  for (var d = 0; d < 11; d++) headerRow.push({ v: debitSub[d], t: "s", s: 1 });

  headerRow.push({ v: "贷方", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: debitSub[d], t: "s", s: 1 });

  headerRow.push({ v: "余额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: debitSub[d], t: "s", s: 1 });

  rows.push(headerRow);

  // 数据行
  for (var i = 0; i < filtered.length; i++) {
    var e = filtered[i];
    var debitAmount = e.debitSubject === subject ? e.debitAmount : 0;
    var creditAmount = e.creditSubject === subject ? e.creditAmount : 0;

    var row = [
      { v: e.date, t: "s", s: 0 },
      { v: e.voucherNo, t: "s", s: 0 },
      { v: e.summary, t: "s", s: 0 },
      { v: "", t: "s", s: 0 }
    ];

    // 借方分列
    var debitSplit = xlsx.splitAmount(debitAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: debitSplit[d] !== '' ? debitSplit[d] : '', t: debitSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    row.push({ v: "", t: "s", s: 0 });

    // 贷方分列
    var creditSplit = xlsx.splitAmount(creditAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: creditSplit[d] !== '' ? creditSplit[d] : '', t: creditSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    row.push({ v: "", t: "s", s: 0 });

    // 余额分列
    var balanceSplit = xlsx.splitAmount(e.balance);
    for (var d = 0; d < 11; d++) {
      row.push({ v: balanceSplit[d] !== '' ? balanceSplit[d] : '', t: balanceSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    rows.push(row);
  }

  // 列宽：日期(12) 凭证号(16) 摘要(30) + 3组(1标题+11数字位)
  var colWidths = [12, 16, 30];
  for (var g = 0; g < 3; g++) {
    colWidths.push(6); // 标题列
    for (var d = 0; d < 11; d++) colWidths.push(4.5); // 数字位
  }

  // 合并单元格（标题）
  var merges = [];
  merges.push("A1:" + xlsx.colRef(colWidths.length - 1) + "1");

  return {
    name: "三栏式明细账",
    rows: rows,
    colWidths: colWidths,
    merges: merges
  };
}

/**
 * 2. 数量金额式存货明细账（物料入库专用）
 * 格式：日期 | 凭证号 | 摘要 | 收入(数量+单价+金额分列) | 发出(数量+单价+金额分列) | 结存(数量+单价+金额分列)
 */
function buildInventoryLedger(transactions, materialId, startDate, endDate) {
  var filtered = transactions.filter(function(tx) {
    return (!materialId || tx.materialId == materialId) &&
      (!startDate || (tx.createdAt || tx.date) >= startDate) &&
      (!endDate || (tx.createdAt || tx.date) <= endDate);
  });
  // 按日期排序
  filtered.sort(function(a, b) { return (a.createdAt || a.date).localeCompare(b.createdAt || b.date); });

  var rows = [];
  // 标题
  rows.push([
    { v: "数量金额式存货明细账", t: "s", s: 1 }
  ]);
  rows.push([]);

  var materialName = filtered.length > 0 ? filtered[0].materialName : "";
  rows.push([
    { v: "物料名称：", t: "s", s: 0 },
    { v: materialName, t: "s", s: 0 }
  ]);
  if (startDate && endDate) {
    rows.push([
      { v: "期间：", t: "s", s: 0 },
      { v: startDate + " ~ " + endDate, t: "s", s: 0 }
    ]);
  }
  rows.push([]);

  // 表头
  var subHeader = ["亿","千万","百万","十万","万","千","百","十","元","角","分"];
  var headerRow = [
    { v: "日期", t: "s", s: 1 },
    { v: "凭证号", t: "s", s: 1 },
    { v: "摘要", t: "s", s: 1 },
  ];
  // 收入：数量 + 单价 + 金额（11列）
  headerRow.push({ v: "收入", t: "s", s: 1 });
  headerRow.push({ v: "数量", t: "s", s: 1 });
  headerRow.push({ v: "单价", t: "s", s: 1 });
  headerRow.push({ v: "金额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });

  // 发出：数量 + 单价 + 金额（11列）
  headerRow.push({ v: "发出", t: "s", s: 1 });
  headerRow.push({ v: "数量", t: "s", s: 1 });
  headerRow.push({ v: "单价", t: "s", s: 1 });
  headerRow.push({ v: "金额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });

  // 结存：数量 + 单价 + 金额（11列）
  headerRow.push({ v: "结存", t: "s", s: 1 });
  headerRow.push({ v: "数量", t: "s", s: 1 });
  headerRow.push({ v: "单价", t: "s", s: 1 });
  headerRow.push({ v: "金额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });

  rows.push(headerRow);

  // 计算累积结存
  var cumQty = 0;
  var cumAmount = 0;

  for (var i = 0; i < filtered.length; i++) {
    var tx = filtered[i];
    var inQty = tx.type === "in" ? tx.quantity : 0;
    var outQty = tx.type === "out" ? tx.quantity : 0;
    var inAmount = tx.type === "in" ? (tx.totalAmount || tx.quantity * tx.price) : 0;
    var outAmount = tx.type === "out" ? (tx.totalAmount || tx.quantity * tx.price) : 0;

    cumQty += inQty - outQty;
    cumAmount += inAmount - outAmount;

    var row = [
      { v: tx.createdAt ? tx.createdAt.slice(0, 10) : "", t: "s", s: 0 },
      { v: "", t: "s", s: 0 }, // 暂无可用的凭证号
      { v: (tx.type === "in" ? "采购" : "销售") + tx.materialName, t: "s", s: 0 },
    ];

    // 收入区
    row.push({ v: "收入", t: "s", s: 0 });
    row.push({ v: inQty > 0 ? inQty : "", t: inQty > 0 ? "n" : "s", s: 0 });
    row.push({ v: tx.price || 0, t: "n", s: 2 });
    row.push({ v: "", t: "s", s: 0 });
    var incomeSplit = xlsx.splitAmount(inAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: incomeSplit[d] !== '' ? incomeSplit[d] : '', t: incomeSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    // 发出区
    row.push({ v: "发出", t: "s", s: 0 });
    row.push({ v: outQty > 0 ? outQty : "", t: outQty > 0 ? "n" : "s", s: 0 });
    row.push({ v: tx.price || 0, t: "n", s: 2 });
    row.push({ v: "", t: "s", s: 0 });
    var outcomeSplit = xlsx.splitAmount(outAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: outcomeSplit[d] !== '' ? outcomeSplit[d] : '', t: outcomeSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    // 结存区
    row.push({ v: "结存", t: "s", s: 0 });
    row.push({ v: cumQty, t: "n", s: 0 });
    row.push({ v: cumQty > 0 ? Math.round(cumAmount / cumQty * 100) / 100 : 0, t: "n", s: 2 });
    row.push({ v: "", t: "s", s: 0 });
    var balanceSplit = xlsx.splitAmount(cumAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: balanceSplit[d] !== '' ? balanceSplit[d] : '', t: balanceSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    rows.push(row);
  }

  // 列宽
  var colWidths = [12, 16, 24];
  // 标题列 x 3 (收入/发出/结存) + 数量x3 + 单价x3 + 分隔x3 + 11位数字x3
  colWidths.push(6); // 收入标签
  colWidths.push(10); // 收入数量
  colWidths.push(10); // 收入单价
  colWidths.push(6); // 收入金额标签
  for (var d = 0; d < 11; d++) colWidths.push(4.5); // 收入金额分列

  colWidths.push(6); // 发出标签
  colWidths.push(10); // 发出数量
  colWidths.push(10); // 发出单价
  colWidths.push(6); // 发出金额标签
  for (var d = 0; d < 11; d++) colWidths.push(4.5); // 发出金额分列

  colWidths.push(6); // 结存标签
  colWidths.push(10); // 结存数量
  colWidths.push(10); // 结存单价
  colWidths.push(6); // 结存金额标签
  for (var d = 0; d < 11; d++) colWidths.push(4.5); // 结存金额分列

  var merges = ["A1:" + xlsx.colRef(colWidths.length - 1) + "1"];

  return {
    name: "数量金额式存货明细账",
    rows: rows,
    colWidths: colWidths,
    merges: merges
  };
}

/**
 * 3. 多栏式明细账
 * 适用于费用类科目（管理费用、销售费用等），按明细科目分列
 */
function buildMultiColumnLedger(entries, subject, startDate, endDate) {
  var filtered = entries.filter(function(e) {
    return (e.debitSubject === subject || e.creditSubject === subject) &&
      (!startDate || e.date >= startDate) &&
      (!endDate || e.date <= endDate);
  });
  calculateBalances(filtered, subject);

  var rows = [];
  rows.push([{ v: "多栏式明细账", t: "s", s: 1 }]);
  rows.push([]);
  rows.push([
    { v: "科目：", t: "s", s: 0 },
    { v: subject, t: "s", s: 0 }
  ]);
  if (startDate && endDate) {
    rows.push([
      { v: "期间：", t: "s", s: 0 },
      { v: startDate + " ~ " + endDate, t: "s", s: 0 }
    ]);
  }
  rows.push([]);

  var subHeader = ["亿","千万","百万","十万","万","千","百","十","元","角","分"];

  // 表头
  var headerRow = [
    { v: "日期", t: "s", s: 1 },
    { v: "凭证号", t: "s", s: 1 },
    { v: "摘要", t: "s", s: 1 },
    { v: "借方金额", t: "s", s: 1 },
    { v: "贷方金额", t: "s", s: 1 },
  ];
  // 借方子栏目分列
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  // 贷方子栏目分列
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  // 余额
  headerRow.push({ v: "余额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });

  rows.push(headerRow);

  for (var i = 0; i < filtered.length; i++) {
    var e = filtered[i];
    var debitAmount = e.debitSubject === subject ? e.debitAmount : 0;
    var creditAmount = e.creditSubject === subject ? e.creditAmount : 0;

    var row = [
      { v: e.date, t: "s", s: 0 },
      { v: e.voucherNo, t: "s", s: 0 },
      { v: e.summary, t: "s", s: 0 },
      { v: "", t: "s", s: 0 },
      { v: "", t: "s", s: 0 }
    ];

    // 借方分列
    var debitSplit = xlsx.splitAmount(debitAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: debitSplit[d] !== '' ? debitSplit[d] : '', t: debitSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    // 贷方分列
    var creditSplit = xlsx.splitAmount(creditAmount);
    for (var d = 0; d < 11; d++) {
      row.push({ v: creditSplit[d] !== '' ? creditSplit[d] : '', t: creditSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    // 余额
    row.push({ v: "", t: "s", s: 0 });
    var balanceSplit = xlsx.splitAmount(e.balance);
    for (var d = 0; d < 11; d++) {
      row.push({ v: balanceSplit[d] !== '' ? balanceSplit[d] : '', t: balanceSplit[d] !== '' ? 'n' : 's', s: 0 });
    }

    rows.push(row);
  }

  var colWidths = [12, 16, 30, 10, 10];
  for (var g = 0; g < 3; g++) {
    for (var d = 0; d < 11; d++) colWidths.push(4.5);
  }

  var merges = ["A1:" + xlsx.colRef(colWidths.length - 1) + "1"];
  return {
    name: "多栏式明细账",
    rows: rows,
    colWidths: colWidths,
    merges: merges
  };
}

/**
 * 4. 固定资产明细账
 * 格式：日期 | 凭证号 | 资产名称 | 原值 | 折旧(月) | 已提折旧 | 净值 | 折旧分项
 */
function buildFixedAssetLedger(entries, startDate, endDate) {
  // 模拟固定资产数据
  var fixedAssets = [
    { name: "货架 A-001", originalValue: 5000, purchaseDate: "2026-01-15", lifeMonths: 60, salvageRate: 0.05 },
    { name: "收银机 B-002", originalValue: 3500, purchaseDate: "2026-02-01", lifeMonths: 36, salvageRate: 0.05 },
    { name: "空调 C-003", originalValue: 6000, purchaseDate: "2026-03-10", lifeMonths: 60, salvageRate: 0.05 }
  ];

  var rows = [];
  rows.push([{ v: "固定资产明细账", t: "s", s: 1 }]);
  rows.push([]);
  if (startDate && endDate) {
    rows.push([
      { v: "期间：", t: "s", s: 0 },
      { v: startDate + " ~ " + endDate, t: "s", s: 0 }
    ]);
  }
  rows.push([]);

  var subHeader = ["亿","千万","百万","十万","万","千","百","十","元","角","分"];

  // 表头
  var headerRow = [
    { v: "日期", t: "s", s: 1 },
    { v: "资产名称", t: "s", s: 1 },
    { v: "原值", t: "s", s: 1 },
  ];
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  headerRow.push({ v: "月折旧额", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  headerRow.push({ v: "累计折旧", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  headerRow.push({ v: "净值", t: "s", s: 1 });
  for (var d = 0; d < 11; d++) headerRow.push({ v: subHeader[d], t: "s", s: 1 });
  headerRow.push({ v: "使用月数", t: "s", s: 1 });
  headerRow.push({ v: "备注", t: "s", s: 1 });

  rows.push(headerRow);

  var now = new Date();
  for (var i = 0; i < fixedAssets.length; i++) {
    var asset = fixedAssets[i];
    var salvageValue = asset.originalValue * asset.salvageRate;
    var depreciableBase = asset.originalValue - salvageValue;
    var monthlyDep = Math.round(depreciableBase / asset.lifeMonths * 100) / 100;

    var purchaseDate = new Date(asset.purchaseDate);
    var monthsUsed = (now.getFullYear() - purchaseDate.getFullYear()) * 12 + (now.getMonth() - purchaseDate.getMonth());
    if (monthsUsed < 0) monthsUsed = 0;
    var accDep = Math.round(Math.min(monthsUsed * monthlyDep, depreciableBase) * 100) / 100;
    var netValue = Math.round((asset.originalValue - accDep) * 100) / 100;

    var row = [
      { v: asset.purchaseDate, t: "s", s: 0 },
      { v: asset.name, t: "s", s: 0 },
      { v: "", t: "s", s: 0 },
    ];
    var origSplit = xlsx.splitAmount(asset.originalValue);
    for (var d = 0; d < 11; d++) row.push({ v: origSplit[d] !== '' ? origSplit[d] : '', t: origSplit[d] !== '' ? 'n' : 's', s: 0 });

    row.push({ v: "", t: "s", s: 0 });
    var depSplit = xlsx.splitAmount(monthlyDep);
    for (var d = 0; d < 11; d++) row.push({ v: depSplit[d] !== '' ? depSplit[d] : '', t: depSplit[d] !== '' ? 'n' : 's', s: 0 });

    row.push({ v: "", t: "s", s: 0 });
    var accDepSplit = xlsx.splitAmount(accDep);
    for (var d = 0; d < 11; d++) row.push({ v: accDepSplit[d] !== '' ? accDepSplit[d] : '', t: accDepSplit[d] !== '' ? 'n' : 's', s: 0 });

    row.push({ v: "", t: "s", s: 0 });
    var netSplit = xlsx.splitAmount(netValue);
    for (var d = 0; d < 11; d++) row.push({ v: netSplit[d] !== '' ? netSplit[d] : '', t: netSplit[d] !== '' ? 'n' : 's', s: 0 });

    row.push({ v: monthsUsed, t: "n", s: 0 });
    row.push({ v: "残值率" + (asset.salvageRate * 100) + "%，使用年限" + Math.round(asset.lifeMonths / 12) + "年", t: "s", s: 0 });

    rows.push(row);
  }

  var colWidths = [12, 20, 8];
  for (var g = 0; g < 4; g++) {
    for (var d = 0; d < 11; d++) colWidths.push(4.5);
  }
  colWidths.push(10);
  colWidths.push(28);

  var merges = ["A1:" + xlsx.colRef(colWidths.length - 1) + "1"];
  return {
    name: "固定资产明细账",
    rows: rows,
    colWidths: colWidths,
    merges: merges
  };
}

/* ================================================================
 * 第三部分：导出主函数
 * ================================================================
 */

/**
 * 导出会计明细账 Excel
 * @param {string} ledgerType - 账簿类型: 'threeColumn' | 'inventory' | 'multiColumn' | 'fixedAsset'
 * @param {Object} filters - 筛选条件 { subject, materialId, startDate, endDate }
 * @param {Array} transactions - 物料交易数据
 * @param {Array} journalEntries - 会计分录数据（可选）
 * @returns {ArrayBuffer} .xlsx 文件的 ArrayBuffer
 */
function exportLedger(ledgerType, filters, transactions, journalEntries) {
  // 如果没有传入会计分录，自动从交易数据生成
  var journal = journalEntries || generateJournal(transactions);
  var startDate = filters.startDate;
  var endDate = filters.endDate;
  var subject = filters.subject || "库存商品";
  var materialId = filters.materialId;

  var sheet;

  switch (ledgerType) {
    case "threeColumn":
      sheet = buildThreeColumnLedger(journal, subject, startDate, endDate);
      break;
    case "inventory":
      sheet = buildInventoryLedger(transactions, materialId, startDate, endDate);
      break;
    case "multiColumn":
      sheet = buildMultiColumnLedger(journal, subject, startDate, endDate);
      break;
    case "fixedAsset":
      sheet = buildFixedAssetLedger(journal, startDate, endDate);
      break;
    default:
      sheet = buildThreeColumnLedger(journal, "库存商品", startDate, endDate);
  }

  return xlsx.buildXLSX([sheet]);
}

/**
 * 在 WeChat 小程序中保存文件
 */
function saveXLSX(arrayBuffer, fileName, successCallback) {
  var fs = wx.getFileSystemManager();
  var tempPath = wx.env.USER_DATA_PATH + "/" + fileName + ".xlsx";
  fs.writeFile({
    filePath: tempPath,
    data: arrayBuffer,
    encoding: undefined,
    success: function() {
      wx.openDocument({
        filePath: tempPath,
        fileType: "xlsx",
        showMenu: true,
        success: successCallback || function() {
          wx.showToast({ title: "文件已打开", icon: "success" });
        },
        fail: function() {
          wx.showToast({ title: "打开文件失败", icon: "none" });
        }
      });
    },
    fail: function() {
      wx.showToast({ title: "保存文件失败", icon: "none" });
    }
  });
}

/* ================================================================
 * 导出模块接口
 * ================================================================
 */
exports.ACCOUNT_CHART = ACCOUNT_CHART;
exports.MATERIAL_CATEGORY_SUBJECT = MATERIAL_CATEGORY_SUBJECT;
exports.getSubjectByCategory = getSubjectByCategory;
exports.generateVoucherNo = generateVoucherNo;
exports.mapTransactionToEntries = mapTransactionToEntries;
exports.generateJournal = generateJournal;
exports.calculateBalances = calculateBalances;
exports.buildThreeColumnLedger = buildThreeColumnLedger;
exports.buildInventoryLedger = buildInventoryLedger;
exports.buildMultiColumnLedger = buildMultiColumnLedger;
exports.buildFixedAssetLedger = buildFixedAssetLedger;
exports.exportLedger = exportLedger;
exports.saveXLSX = saveXLSX;
