/**
 * OCR 票据字段定义
 *
 * 定义三种票据的识别字段、显示标签、图标、排序
 * 新增票据类型只需在此文件中添加配置
 */
'use strict'

// ──────────────────────────────────────────────
// 票据类型定义
// ──────────────────────────────────────────────
const DOC_TYPES = [
  {
    key: 'vat_invoice',
    label: '增值税发票',
    icon: '🧾',
    desc: '增值税专票/普票',
    tips: '拍摄发票正面，确保四角完整、字迹清晰',
  },
  {
    key: 'einvoice',
    label: '电子发票',
    icon: '📧',
    desc: '电子普通发票',
    tips: '截图或拍照电子发票PDF/图片，确保二维码清晰',
  },
  {
    key: 'bank_receipt',
    label: '银行回单',
    icon: '🏦',
    desc: '银行转账回单',
    tips: '拍摄银行回单/对账单，确保金额和账号清晰可辨',
  },
]

// ──────────────────────────────────────────────
// 各票据类型识别字段定义
// order: 显示顺序  editable: 是否可编辑  type: text | money | date
// ──────────────────────────────────────────────
const FIELD_CONFIGS = {
  vat_invoice: {
    title: '增值税发票信息',
    groups: [
      {
        label: '票据基本信息',
        fields: [
          { key: 'invoiceType',   label: '发票类型',   icon: '📋', editable: true,  type: 'text' },
          { key: 'invoiceNo',     label: '发票号码',   icon: '🔢', editable: false, type: 'text' },
          { key: 'invoiceCode',   label: '发票代码',   icon: '🏷️', editable: false, type: 'text' },
          { key: 'invoiceDate',   label: '开票日期',   icon: '📅', editable: true,  type: 'date' },
          { key: 'checkCode',     label: '校验码',     icon: '✅', editable: false, type: 'text' },
        ],
      },
      {
        label: '金额信息',
        fields: [
          { key: 'amount',        label: '金额（不含税）', icon: '💰', editable: true,  type: 'money' },
          { key: 'taxAmount',     label: '税额',         icon: '🧮', editable: true,  type: 'money' },
          { key: 'totalAmount',   label: '价税合计',     icon: '💵', editable: true,  type: 'money' },
        ],
      },
      {
        label: '销售方信息',
        fields: [
          { key: 'sellerName',        label: '名称',   icon: '🏢', editable: true, type: 'text' },
          { key: 'sellerTaxNo',       label: '税号',   icon: '🆔', editable: true, type: 'text' },
          { key: 'sellerAddress',     label: '地址',   icon: '📍', editable: true, type: 'text' },
          { key: 'sellerBank',        label: '开户行', icon: '🏦', editable: true, type: 'text' },
          { key: 'sellerBankAccount', label: '银行账号', icon: '💳', editable: true, type: 'text' },
        ],
      },
      {
        label: '购买方信息',
        fields: [
          { key: 'buyerName',        label: '名称',   icon: '🏪', editable: true, type: 'text' },
          { key: 'buyerTaxNo',       label: '税号',   icon: '🆔', editable: true, type: 'text' },
          { key: 'buyerAddress',     label: '地址',   icon: '📍', editable: true, type: 'text' },
          { key: 'buyerBank',        label: '开户行', icon: '🏦', editable: true, type: 'text' },
          { key: 'buyerBankAccount', label: '银行账号', icon: '💳', editable: true, type: 'text' },
        ],
      },
      {
        label: '货物信息',
        fields: [
          { key: 'goodsName',  label: '货物名称', icon: '📦', editable: true, type: 'text' },
          { key: 'spec',       label: '规格型号', icon: '📏', editable: true, type: 'text' },
          { key: 'quantity',   label: '数量',     icon: '🔢', editable: true, type: 'text' },
          { key: 'unitPrice',  label: '单价',     icon: '💲', editable: true, type: 'money' },
          { key: 'unit',       label: '单位',     icon: '📐', editable: true, type: 'text' },
          { key: 'remark',     label: '备注',     icon: '📝', editable: true, type: 'text' },
        ],
      },
    ],
    // 生成记账凭证时的映射
    voucherMapping(fields) {
      return {
        summary: `${fields.sellerName || '供应商'} 采购-${fields.goodsName || '货物'}`,
        amount: fields.totalAmount || fields.amount || 0,
        type: 'expense',
        debitSubject: '库存商品',
        creditSubject: '银行存款',
      }
    },
  },

  einvoice: {
    title: '电子发票信息',
    groups: [
      {
        label: '票据信息',
        fields: [
          { key: 'invoiceType',   label: '发票类型',     icon: '📋', editable: true,  type: 'text' },
          { key: 'invoiceNo',     label: '发票号码',     icon: '🔢', editable: false, type: 'text' },
          { key: 'invoiceCode',   label: '发票代码',     icon: '🏷️', editable: false, type: 'text' },
          { key: 'invoiceDate',   label: '开票日期',     icon: '📅', editable: true,  type: 'date' },
          { key: 'checkCode',     label: '校验码',       icon: '✅', editable: false, type: 'text' },
          { key: 'eInvoiceCode',  label: '电子票据代码', icon: '🔑', editable: false, type: 'text' },
        ],
      },
      {
        label: '金额信息',
        fields: [
          { key: 'amount',       label: '金额',     icon: '💰', editable: true, type: 'money' },
          { key: 'taxAmount',    label: '税额',     icon: '🧮', editable: true, type: 'money' },
          { key: 'totalAmount',  label: '价税合计', icon: '💵', editable: true, type: 'money' },
        ],
      },
      {
        label: '交易双方',
        fields: [
          { key: 'sellerName',   label: '销售方',   icon: '🏢', editable: true, type: 'text' },
          { key: 'sellerTaxNo',  label: '销售方税号', icon: '🆔', editable: true, type: 'text' },
          { key: 'buyerName',    label: '购买方',   icon: '🏪', editable: true, type: 'text' },
          { key: 'buyerTaxNo',   label: '购买方税号', icon: '🆔', editable: true, type: 'text' },
        ],
      },
      {
        label: '货物清单',
        fields: [
          { key: 'goodsSummary', label: '货物清单', icon: '📦', editable: true, type: 'text' },
          { key: 'remark',       label: '备注',     icon: '📝', editable: true, type: 'text' },
        ],
      },
    ],
    voucherMapping(fields) {
      return {
        summary: `${fields.sellerName || '供应商'} ${fields.remark || '采购'}`,
        amount: fields.totalAmount || fields.amount || 0,
        type: 'expense',
        debitSubject: '管理费用',
        creditSubject: '银行存款',
      }
    },
  },

  bank_receipt: {
    title: '银行回单信息',
    groups: [
      {
        label: '付款方信息',
        fields: [
          { key: 'payerName',    label: '付款方名称', icon: '🏪', editable: true, type: 'text' },
          { key: 'payerAccount', label: '付款方账号', icon: '💳', editable: true, type: 'text' },
          { key: 'payerBank',    label: '开户行',     icon: '🏦', editable: true, type: 'text' },
        ],
      },
      {
        label: '收款方信息',
        fields: [
          { key: 'payeeName',    label: '收款方名称', icon: '🏢', editable: true, type: 'text' },
          { key: 'payeeAccount', label: '收款方账号', icon: '💳', editable: true, type: 'text' },
          { key: 'payeeBank',    label: '开户行',     icon: '🏦', editable: true, type: 'text' },
        ],
      },
      {
        label: '交易信息',
        fields: [
          { key: 'amount',         label: '交易金额', icon: '💰', editable: true,  type: 'money' },
          { key: 'currency',       label: '币种',     icon: '💱', editable: false, type: 'text' },
          { key: 'tradeDate',      label: '交易日期', icon: '📅', editable: true,  type: 'date' },
          { key: 'tradeTime',      label: '交易时间', icon: '🕐', editable: false, type: 'text' },
          { key: 'tradeNo',        label: '流水号',   icon: '🔢', editable: false, type: 'text' },
          { key: 'summary',        label: '摘要/用途', icon: '📝', editable: true, type: 'text' },
          { key: 'paymentMethod',  label: '支付方式', icon: '💸', editable: false, type: 'text' },
          { key: 'fee',            label: '手续费',   icon: '🧾', editable: false, type: 'money' },
          { key: 'status',         label: '交易状态', icon: '✅', editable: false, type: 'text' },
        ],
      },
    ],
    voucherMapping(fields) {
      const isOutgoing = fields.payerName && fields.payerName.includes('张记')
      return {
        summary: `${fields.summary || '银行转账'}（${fields.payeeName || ''}）`,
        amount: fields.amount || 0,
        type: isOutgoing ? 'expense' : 'income',
        debitSubject: isOutgoing ? '管理费用' : '银行存款',
        creditSubject: isOutgoing ? '银行存款' : '主营业务收入',
      }
    },
  },
}

/**
 * 格式化字段值（根据类型）
 */
function formatFieldValue(value, type) {
  if (value === undefined || value === null || value === '') return '-'
  switch (type) {
    case 'money':
      return '¥' + Number(value).toFixed(2)
    case 'date':
      return String(value)
    default:
      return String(value)
  }
}

/**
 * 获取文档类型配置
 */
function getDocTypeConfig(docType) {
  return DOC_TYPES.find(d => d.key === docType) || null
}

module.exports = {
  DOC_TYPES,
  FIELD_CONFIGS,
  formatFieldValue,
  getDocTypeConfig,
}
