'use strict'
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// 套餐价格 单位：分
const PLAN_PRICES = {
  standard: { month: 9900, year: 99900 },
  premium:  { month: 39800, year: 398000 },
}
const PLAN_NAMES = { standard: '标准版', premium: '高端定制版' }
const PERIOD_NAMES = { month: '月付', year: '年付' }

// 生成唯一订单号
function generateOutTradeNo() {
  const date = new Date()
  const ymd = date.getFullYear().toString().slice(2) +
    String(date.getMonth()+1).padStart(2,'0') +
    String(date.getDate()).padStart(2,'0')
  const time = date.getHours().toString().padStart(2,'0') +
    date.getMinutes().toString().padStart(2,'0') +
    date.getSeconds().toString().padStart(2,'0')
  const random = Math.floor(Math.random()*10000).toString().padStart(4,'0')
  return ymd + time + random
}

// 云函数入口
exports.main = async (event, context) => {
  const { action, plan, period, outTradeNo } = event
  const { OPENID } = cloud.getWXContext()

  switch (action) {
    case 'createOrder':
      return await createPayOrder(OPENID, plan, period)
    case 'queryOrder':
      return await queryOrderStatus(OPENID, outTradeNo)
    default:
      return { code: -1, msg: '未知请求类型' }
  }
}

// 创建真实微信支付订单
async function createPayOrder(openid, plan, period) {
  if(!plan || !period) return { code: -1, msg: '参数缺失' }
  const priceInfo = PLAN_PRICES[plan]
  if(!priceInfo) return { code: -1, msg: '套餐不存在' }
  const totalFee = priceInfo[period]
  if(!totalFee) return { code: -1, msg: '付费周期错误' }

  const outTradeNo = generateOutTradeNo()
  const goodsName = `${PLAN_NAMES[plan]}${PERIOD_NAMES[period]}会员`

  try {
    // 调用云开发官方微信支付下单
    const payRes = await cloud.cloudPay.unifiedOrder({
      body: goodsName,
      outTradeNo: outTradeNo,
      totalFee: totalFee,
      spbillCreateIp: '127.0.0.1',
      subMchId: '',
      tradeType: 'JSAPI',
      openid: openid
    })

    // 写入订单 初始状态待支付
    await db.collection('orders').add({
      openid,
      outTradeNo,
      plan,
      period,
      totalFee,
      goodsName,
      status: 'pending',
      createdAt: db.serverDate(),
      paidAt: null
    })

    return {
      code: 0,
      msg: '订单创建成功',
      data: {
        outTradeNo,
        payInfo: payRes.payment
      }
    }
  } catch (e) {
    console.error('支付下单失败', e)
    return { code: -1, msg: '发起支付失败', err: e.message }
  }
}

// 查询订单状态（纯真实，无任何自动Mock通过）
async function queryOrderStatus(openid, outTradeNo) {
  if(!outTradeNo) return { code: -1, msg: '订单号不能为空' }
  try {
    // 查询本地订单
    const orderRes = await db.collection('orders')
      .where({ openid, outTradeNo })
      .get()
    if(orderRes.data.length === 0) return { code: -1, msg: '订单不存在' }
    const order = orderRes.data[0]

    // 调用微信官方接口查真实支付状态
    const queryRes = await cloud.cloudPay.queryOrder({ outTradeNo })

    // 同步真实状态
    if(queryRes.tradeState === 'SUCCESS' && order.status !== 'success'){
      await db.collection('orders').doc(order._id).update({
        data: { status: 'success', paidAt: db.serverDate() }
      })
      order.status = 'success'
    }
    if(queryRes.tradeState === 'CLOSED' && order.status !== 'closed'){
      await db.collection('orders').doc(order._id).update({
        data: { status: 'closed' }
      })
      order.status = 'closed'
    }

    return {
      code: 0,
      msg: '查询成功',
      data: { order, wxPayState: queryRes.tradeState }
    }
  } catch (e) {
    console.error('查询订单异常',e)
    return { code: -1, msg: '查询订单失败' }
  }
}