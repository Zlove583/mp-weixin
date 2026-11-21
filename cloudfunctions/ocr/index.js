'use strict'

const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SECRET_ID = 'AKIDU8jIj5PYddcbaP0dCmBYkhRxFKAmBMK6'
const SECRET_KEY = 'bAZmkV6ZpsiRzJPJ0ZCrbGk4NgmfO4dJ'
const HOST = 'ocr.tencentcloudapi.com'

// ── HMAC-SHA256 签名 ──
function sha256Hex(data, key) {
  const h = key ? crypto.createHmac('sha256', key).update(data) : crypto.createHash('sha256').update(data)
  return h.digest('hex')
}
function sha256(data, key) {
  return (key ? crypto.createHmac('sha256', key).update(data) : crypto.createHash('sha256').update(data)).digest()
}

// ── 腾讯云 API v3 签名 ──
function signV3(action, payload, ts) {
  const date = new Date(ts * 1000).toISOString().slice(0, 10)
  const service = 'ocr'
  const credScope = `${date}/${service}/tc3_request`
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\nx-tc-action:${action.toLowerCase()}\n`
  const signedHeaders = 'content-type;host;x-tc-action'
  const canonicalRequest = [
    'POST', '/', '', canonicalHeaders, signedHeaders, sha256Hex(payload)
  ].join('\n')
  const stringToSign = [
    'TC3-HMAC-SHA256', String(ts), credScope, sha256Hex(canonicalRequest)
  ].join('\n')
  const kDate = sha256(date, 'TC3' + SECRET_KEY)
  const kService = sha256(service, kDate)
  const kSigning = sha256('tc3_request', kService)
  const signature = sha256Hex(stringToSign, kSigning)
  return `TC3-HMAC-SHA256 Credential=${SECRET_ID}/${credScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

// ── 调用腾讯云 API ──
function callApi(action, params) {
  return new Promise((resolve, reject) => {
    const ts = Math.floor(Date.now() / 1000)
    const body = JSON.stringify(params)
    const req = require('https').request({
      hostname: HOST, port: 443, path: '/', method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8', 'Host': HOST,
        'X-TC-Action': action, 'X-TC-Version': '2018-11-19',
        'X-TC-Timestamp': String(ts), 'X-TC-Region': 'ap-guangzhou',
        'Authorization': signV3(action, body, ts),
      },
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const r = JSON.parse(data)
          if (r.Response && r.Response.Error) return reject(new Error(r.Response.Error.Message))
          resolve(r.Response)
        } catch (e) {
          reject(new Error('响应解析失败: ' + data.slice(0, 300)))
        }
      })
    })
    req.on('error', e => reject(e))
    req.setTimeout(100000, () => { req.destroy(); reject(new Error('请求超时')) })
    req.write(body); req.end()
  })
}

// ── 从云存储下载图片并转为 base64 ──
async function getBase64(fileID) {
  const r = await cloud.downloadFile({ fileID })
  return r.fileContent.toString('base64')
}

// ═══════════════════════════════════════════════
// 字段映射函数
// VatInvoiceInfos 是 [{Name, Value, Polygon}, ...] 的键值对列表
// ═══════════════════════════════════════════════

function parseFinancial(str) {
  if (!str) return { bank: '', account: '' }
  const m = str.match(/^(.+?)\s*(\d[\d\s-]{8,})$/)
  if (m) return { bank: m[1].trim(), account: m[2].replace(/\s/g, '') }
  return { bank: str.trim(), account: '' }
}

/** 从 VatInvoiceInfos 键值对数组中提取指定字段的值 */
function getField(infos, name) {
  const item = infos.find(i => i.Name === name)
  return item ? item.Value : ''
}

/** 将 VatInvoiceInfos 转为 { Name: Value } 的查找表 */
function buildLookup(infos) {
  const map = {}
  for (const item of infos) {
    map[item.Name] = item.Value
  }
  return map
}

/** 从多个候选中解析金额（自动去掉 ¥ ￥ 逗号空格） */
function parseMoney(...sources) {
  for (const s of sources) {
    if (!s) continue
    const cleaned = String(s).replace(/[¥￥,\s]/g, '')
    const val = parseFloat(cleaned)
    if (!isNaN(val) && val > 0) return val
  }
  return 0
}

function mapVat(resp) {
  const infos = resp.VatInvoiceInfos || []
  const g = buildLookup(infos)
  const items = resp.Items || []
  const item = items[0] || {}

  // 从发票名称/发票类型判断
  const invoiceName = g['发票名称'] || g['发票类型'] || ''
  let docTypeName = invoiceName
  if (!docTypeName) {
    docTypeName = '增值税发票'
  }

  const pretaxAmount = parseMoney(g['金额'], item.AmountWithoutTax, g['合计金额'])
  const taxAmount = parseMoney(g['税额'], item.TaxAmount, g['合计税额'])
  const totalAmount = parseMoney(g['小写金额'], g['价税合计']) || (pretaxAmount + taxAmount)

  // 解析开户行及账号: "浦发行深圳科技园支行79210154740015474"
  const selFin = parseFinancial(g['销售方开户行及账号'] || '')
  const buyFin = parseFinancial(g['购买方开户行及账号'] || '')

  // 解析地址电话: "深圳市南山区...0755-86315454"
  const sellerAddrTel = g['销售方地址、电话'] || ''
  const buyerAddrTel = g['购买方地址、电话'] || ''

  // 货物明细从 Items 取
  const goodsNames = items.length ? items.map(i => i.Name || '').filter(Boolean).join('、') : (g['货物或应税劳务、服务名称'] || '')

  return {
    docType: 'vat_invoice',
    docTypeName: docTypeName,
    source: 'cloud', rawResponse: JSON.stringify(resp).slice(0, 3000),
    fields: {
      invoiceType: g['发票类型'] || g['发票名称'] || '',
      invoiceNo: (g['发票号码'] || '').replace(/^No/i, ''),
      invoiceCode: g['发票代码'] || '',
      invoiceDate: (g['开票日期'] || '').replace(/[年月]/g, '-').replace(/日$/, ''),
      checkCode: g['校验码'] || '',
      amount: pretaxAmount,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      sellerName: g['销售方名称'] || '',
      sellerTaxNo: g['销售方识别号'] || '',
      sellerAddress: sellerAddrTel,
      sellerBank: selFin.bank,
      sellerBankAccount: selFin.account,
      buyerName: g['购买方名称'] || '',
      buyerTaxNo: g['购买方识别号'] || '',
      buyerAddress: buyerAddrTel,
      buyerBank: buyFin.bank,
      buyerBankAccount: buyFin.account,
      goodsName: item.Name || goodsNames,
      spec: g['规格型号'] || item.Spec || '',
      quantity: parseInt(g['数量'] || item.Quantity || '0') || items.length || 1,
      unitPrice: parseFloat(g['单价'] || item.UnitPrice || '0') || 0,
      unit: g['单位'] || item.Unit || '',
      remark: g['备注'] || item.Remark || goodsNames,
    },
  }
}

function mapEinvoice(resp) {
  const infos = resp.VatInvoiceInfos || []
  const g = buildLookup(infos)
  const items = resp.Items || []

  const invoiceName = g['发票名称'] || g['发票类型'] || ''
  const docTypeName = invoiceName || '增值税电子普通发票'

  const pretaxAmount = parseMoney(g['金额'], g['合计金额'])
  const taxAmount = parseMoney(g['税额'], g['合计税额'])
  const totalAmount = parseMoney(g['小写金额'], g['价税合计']) || (pretaxAmount + taxAmount)

  return {
    docType: 'einvoice', docTypeName: docTypeName, source: 'cloud',
    rawResponse: JSON.stringify(resp).slice(0, 3000),
    fields: {
      invoiceType: g['发票类型'] || g['发票名称'] || '增值税电子普通发票',
      invoiceNo: (g['发票号码'] || '').replace(/^No/i, ''),
      invoiceCode: g['发票代码'] || '',
      invoiceDate: (g['开票日期'] || '').replace(/[年月]/g, '-').replace(/日$/, ''),
      checkCode: g['校验码'] || '',
      eInvoiceCode: g['全电号码'] || g['校验码'] || '',
      amount: pretaxAmount,
      taxAmount: taxAmount,
      totalAmount: totalAmount,
      sellerName: g['销售方名称'] || '',
      sellerTaxNo: g['销售方识别号'] || '',
      buyerName: g['购买方名称'] || '',
      buyerTaxNo: g['购买方识别号'] || '',
      goodsSummary: items.map(i => i.Name || '').filter(Boolean).join('、') || g['货物或应税劳务、服务名称'] || '',
      remark: g['备注'] || '',
    },
  }
}

function mapBank(resp) {
  const lines = (resp.TextDetections || []).map(t => t.DetectedText || '')
  const all = lines.join('\n')
  const find = (...kws) => {
    for (const l of lines) for (const k of kws) if (l.includes(k)) return l
    return ''
  }
  const amounts = lines
    .filter(l => /[¥￥元金额CNY]/.test(l) && /\d/.test(l))
    .map(l => { const m = l.match(/[\d,]+\.?\d{0,2}/); return m ? parseFloat(m[0].replace(/,/g, '')) : 0 })
    .filter(a => a > 0)
  const amt = amounts.length ? Math.max(...amounts) : 0
  const dl = find('日期', '交易日期', '记账日期')
  const dm = dl.match(/(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})/)
  const banks = lines.filter(l => /银行|支行|分行/.test(l))
  const accts = lines.filter(l => /\d{10,}/.test(l.replace(/\s/g, '')))
  const tno = (find('流水号', '交易流水').match(/[A-Za-z0-9]{10,}/) || [''])[0]
  const ti = (find('时间').match(/(\d{1,2}:\d{2}(:\d{2})?)/) || [''])[0]

  return {
    docType: 'bank_receipt', docTypeName: '银行电子回单', source: 'cloud',
    rawResponse: JSON.stringify(resp).slice(0, 3000),
    fields: {
      payerName: find('付款人', '付款方', '汇款人', '付款'),
      payerAccount: (accts[0] || '').replace(/[^\d]/g, '').slice(0, 20),
      payerBank: banks[0] || '',
      payeeName: find('收款人', '收款方', '汇入方', '收款'),
      payeeAccount: (accts[1] || '').replace(/[^\d]/g, '').slice(0, 20),
      payeeBank: banks[1] || '',
      amount: amt, currency: /USD/i.test(all) ? 'USD' : 'CNY',
      tradeDate: dm ? dm[1].replace(/[年月]/g, '-').replace(/\//g, '-') : '',
      tradeTime: ti,
      tradeNo: tno,
      summary: find('用途', '摘要', '附言').replace(/用途|摘要|附言[:：\s]*/g, '') || lines[0] || all.slice(0, 30),
      paymentMethod: '转账汇款', fee: 0, status: '交易成功',
    },
  }
}

// ═══════════════════════════════════════════════
// 主入口（已彻底删除所有Mock模拟票据）
// ═══════════════════════════════════════════════
exports.main = async (event, context) => {
  const { action, docType, fileID, recordId } = event
  const { OPENID } = cloud.getWXContext()
  const db = cloud.database()

  if (action === 'history') {
    const r = await db.collection('ocr_records').where({ openid: OPENID }).orderBy('createdAt', 'desc').limit(20).get()
    return { code: 0, data: { records: r.data } }
  }
  if (action === 'delete') {
    if (!recordId) return { code: -1, message: '缺少记录ID' }
    await db.collection('ocr_records').where({ _id: recordId, openid: OPENID }).remove()
    return { code: 0, message: '已删除' }
  }
  if (action !== 'recognize') return { code: -1, message: `未知操作: ${action}` }
  if (!docType) return { code: -1, message: '请选择票据类型' }

  try {
    if (!fileID) throw new Error('缺少图片fileID')

    const b64 = await getBase64(fileID)
    console.log('[OCR] 下载云存储文件成功，base64长度:', b64.length)

    let result, resp
    if (docType === 'vat_invoice' || docType === 'einvoice') {
      resp = await callApi('VatInvoiceOCR', { ImageBase64: b64 })
      console.log('[OCR诊断] VatInvoiceOCR 完整原始响应:', JSON.stringify(resp))
      console.log('[OCR诊断] VatInvoiceInfos 数量:', (resp.VatInvoiceInfos || []).length)
      if (resp.VatInvoiceInfos && resp.VatInvoiceInfos.length > 0) {
        console.log('[OCR诊断] VatInvoiceInfos[0].Name:', resp.VatInvoiceInfos[0].Name)
        console.log('[OCR诊断] VatInvoiceInfos[0] 所有key:', Object.keys(resp.VatInvoiceInfos[0]))
      }
      result = docType === 'einvoice' ? mapEinvoice(resp) : mapVat(resp)
    } else if (docType === 'bank_receipt') {
      resp = await callApi('GeneralBasicOCR', { ImageBase64: b64 })
      console.log('[OCR诊断] GeneralBasicOCR 完整原始响应:', JSON.stringify(resp))
      result = mapBank(resp)
    } else {
      throw new Error('不支持的票据类型: ' + docType)
    }
    console.log('[OCR诊断] 最终结果 fields:', JSON.stringify(result.fields))

    await db.collection('ocr_records').add({
      data: {
        openid: OPENID, docType: result.docType,
        docTypeName: result.docTypeName, fields: result.fields,
        createdAt: db.serverDate(),
      },
    })

    return { code: 0, message: '识别完成', data: result }
  } catch (e) {
    console.error('[OCR错误]', e.message)
    // 直接返回真实错误，不再返回任何模拟票据数据
    return { code: -1, message: '票据识别失败：' + e.message }
  }
}
