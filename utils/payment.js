'use strict'

// 当前版本暂不接入微信支付。保留统一入口，后续接回支付时页面无需改动。
const PLAN_NAMES = {
  standard: '标准版',
  premium: '高端定制版',
}

const PERIOD_NAMES = {
  month: { label: '月付', divisor: 1 },
  year: { label: '年付', divisor: 12 },
}

const PRICES = {
  standard: { month: 9900, year: 99900 },
  premium: { month: 39800, year: 398000 },
}

function formatAmount(amountInCents) {
  return `¥${(Number(amountInCents || 0) / 100).toFixed(amountInCents % 100 === 0 ? 0 : 2)}`
}

async function requestPayment({ plan, period }) {
  const amount = getPlanPrice(plan, period)
  if (!PLAN_NAMES[plan] || !PERIOD_NAMES[period] || !amount) {
    throw new Error('套餐或付费周期无效')
  }

  // 直接开通：不创建订单、不请求云函数、不调用微信支付。
  return {
    success: true,
    plan,
    period,
    amount,
    directActivation: true,
  }
}

function getPlanPrice(plan, period) {
  return (PRICES[plan] && PRICES[plan][period]) || 0
}

module.exports = {
  requestPayment,
  formatAmount,
  getPlanPrice,
  PLAN_NAMES,
  PERIOD_NAMES,
}
