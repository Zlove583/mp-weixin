'use strict'

function normalizeMonth(month) {
  if (/^\d{4}-\d{2}$/.test(month || '')) return month
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function previousMonth(month) {
  const normalized = normalizeMonth(month)
  const [year, monthNumber] = normalized.split('-').map(Number)
  const date = new Date(year, monthNumber - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month) {
  const normalized = normalizeMonth(month)
  const [year, monthNumber] = normalized.split('-')
  return `${year}年${Number(monthNumber)}月`
}

function summarize(vouchers, month) {
  const normalized = normalizeMonth(month)
  const items = (vouchers || []).filter((item) => (
    item.status !== 'draft' && String(item.date || '').slice(0, 7) === normalized
  ))
  const incomeCategories = {}
  const expenseCategories = {}
  let totalIncome = 0
  let totalExpense = 0

  items.forEach((item) => {
    const amount = Number(item.amount) || 0
    const category = item.category || '未分类'
    if (item.type === 'income') {
      totalIncome += amount
      incomeCategories[category] = (incomeCategories[category] || 0) + amount
    } else if (item.type === 'expense') {
      totalExpense += amount
      expenseCategories[category] = (expenseCategories[category] || 0) + amount
    }
  })

  const toCategories = (source, total) => Object.keys(source)
    .map((name) => ({
      name,
      amount: Number(source[name].toFixed(2)),
      percent: total > 0 ? Number((source[name] * 100 / total).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  const profit = totalIncome - totalExpense
  return {
    month: normalized,
    label: monthLabel(normalized),
    count: items.length,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    profitMargin: totalIncome > 0 ? Number((profit * 100 / totalIncome).toFixed(1)) : 0,
    incomeCategories: toCategories(incomeCategories, totalIncome),
    expenseCategories: toCategories(expenseCategories, totalExpense),
  }
}

function buildMonthlyReport(vouchers, month) {
  const current = summarize(vouchers, month)
  const previous = summarize(vouchers, previousMonth(current.month))
  const comparedLastMonth = previous.profit === 0
    ? null
    : Number(((current.profit - previous.profit) * 100 / Math.abs(previous.profit)).toFixed(1))
  return { ...current, comparedLastMonth, previousProfit: previous.profit }
}

exports.normalizeMonth = normalizeMonth
exports.previousMonth = previousMonth
exports.monthLabel = monthLabel
exports.summarize = summarize
exports.buildMonthlyReport = buildMonthlyReport
