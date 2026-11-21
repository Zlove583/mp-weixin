'use strict'

const assert = require('node:assert/strict')
const { buildMonthlyReport, previousMonth } = require('../utils/monthly-report')

const vouchers = [
  { type: 'income', category: '销售收入', amount: 1000, date: '2026-07-02' },
  { type: 'income', category: '其他收入', amount: 200, date: '2026-07-12' },
  { type: 'expense', category: '采购成本', amount: 300, date: '2026-07-03' },
  { type: 'expense', category: '采购成本', amount: 100, date: '2026-07-20' },
  { type: 'income', category: '其他收入', amount: 9999, date: '2026-07-25', status: 'draft' },
  { type: 'income', category: '销售收入', amount: 800, date: '2026-06-02' },
  { type: 'expense', category: '采购成本', amount: 300, date: '2026-06-03' },
]

assert.equal(previousMonth('2026-01'), '2025-12')

const report = buildMonthlyReport(vouchers, '2026-07')
assert.equal(report.label, '2026年7月')
assert.equal(report.count, 4)
assert.equal(report.totalIncome, 1200)
assert.equal(report.totalExpense, 400)
assert.equal(report.profit, 800)
assert.equal(report.profitMargin, 66.7)
assert.equal(report.comparedLastMonth, 60)
assert.deepEqual(report.incomeCategories, [
  { name: '销售收入', amount: 1000, percent: 83.3 },
  { name: '其他收入', amount: 200, percent: 16.7 },
])
assert.deepEqual(report.expenseCategories, [
  { name: '采购成本', amount: 400, percent: 100 },
])

const emptyPrevious = buildMonthlyReport(vouchers, '2026-05')
assert.equal(emptyPrevious.comparedLastMonth, null)

console.log('monthly-report tests passed')
