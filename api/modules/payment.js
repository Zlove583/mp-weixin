'use strict'

const PAYMENT_API = {
  createOrder(params) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'payment',
        data: { action: 'createOrder', plan: params.plan, period: params.period },
        success: (res) => {
          const result = res.result || {}
          if (result.code !== 0 || !result.data) {
            reject(new Error(result.msg || result.message || '创建订单失败'))
            return
          }
          const prices = {
            standard: { month: 9900, year: 99900 },
            premium: { month: 39800, year: 398000 },
          }
          const payment = result.data.payment || result.data.payInfo
          if (!payment) {
            reject(new Error('支付订单缺少支付参数'))
            return
          }
          resolve({
            outTradeNo: result.data.outTradeNo,
            amount: result.data.amount || prices[params.plan][params.period],
            payment,
            plan: params.plan,
            period: params.period,
          })
        },
        fail: (error) => {
          console.error('[支付] 云函数调用失败', error)
          reject(new Error('支付服务连接失败，请检查云函数部署和云环境配置'))
        },
      })
    })
  },

  queryOrder(outTradeNo) {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'payment', data: { action: 'queryOrder', outTradeNo },
        success: (res) => {
          const result = res.result || {}
          result.code === 0 ? resolve(result.data) : reject(new Error(result.msg || result.message || '查询订单失败'))
        },
        fail: reject,
      })
    })
  },
}

module.exports = { PAYMENT_API }
