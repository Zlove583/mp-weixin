'use strict'

const { useAccountingStore } = require('../../store/modules/accounting.js')
const { buildXLSX } = require('../../utils/xlsx-builder.js')
const { buildMonthlyReport, normalizeMonth } = require('../../utils/monthly-report.js')

const COLORS = ['#1A6FE8', '#07A66A', '#F59E0B', '#E5484D', '#7C6F64', '#64748B']

function textCell(value, style) {
  return { v: value, t: 's', s: style === undefined ? 0 : style }
}

function numberCell(value) {
  return { v: Number(value) || 0, t: 'n', s: 2 }
}

Page({
  data: {
    selectedMonth: normalizeMonth(),
    report: null,
    incomeCategories: [],
    expenseCategories: [],
    vouchers: [],
    exporting: false,
  },

  async onShow() {
    const store = useAccountingStore()
    if (!store.voucherList.length) await store.fetchVoucherList()
    this.refreshReport()
  },

  onMonthChange(event) {
    this.setData({ selectedMonth: event.detail.value }, () => this.refreshReport())
  },

  refreshReport() {
    const store = useAccountingStore()
    const report = buildMonthlyReport(store.voucherList, this.data.selectedMonth)
    const decorate = (categories) => categories.map((item, index) => ({
      ...item,
      color: COLORS[index % COLORS.length],
      amountText: this.formatMoney(item.amount),
    }))
    const vouchers = store.voucherList.filter((item) => (
      item.status !== 'draft' && String(item.date || '').slice(0, 7) === report.month
    ))
    this.setData({
      report: {
        ...report,
        totalIncomeText: this.formatMoney(report.totalIncome),
        totalExpenseText: this.formatMoney(report.totalExpense),
        profitText: this.formatMoney(report.profit),
        compareDirection: report.comparedLastMonth !== null && report.comparedLastMonth >= 0 ? '↑' : '↓',
        compareAbsolute: report.comparedLastMonth === null ? '' : Math.abs(report.comparedLastMonth),
      },
      incomeCategories: decorate(report.incomeCategories),
      expenseCategories: decorate(report.expenseCategories),
      vouchers,
    })
  },

  formatMoney(value) {
    return Number(value || 0).toLocaleString('zh-CN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  },

  exportReport() {
    const { report, vouchers } = this.data
    if (!report || report.count === 0) {
      wx.showToast({ title: '所选月份暂无数据', icon: 'none' })
      return
    }

    this.setData({ exporting: true })
    try {
      const summaryRows = [
        [textCell(`${report.label}经营报表`, 1)],
        [],
        [textCell('指标', 1), textCell('金额/比例', 1)],
        [textCell('营业收入'), numberCell(report.totalIncome)],
        [textCell('营业支出'), numberCell(report.totalExpense)],
        [textCell('净利润'), numberCell(report.profit)],
        [textCell('利润率'), textCell(`${report.profitMargin}%`)],
        [textCell('净利润环比'), textCell(report.comparedLastMonth === null ? '暂无对比' : `${report.comparedLastMonth}%`)],
        [],
        [textCell('收入分类', 1), textCell('金额（元）', 1), textCell('占比', 1)],
        ...report.incomeCategories.map((item) => [textCell(item.name), numberCell(item.amount), textCell(`${item.percent}%`)]),
        [],
        [textCell('支出分类', 1), textCell('金额（元）', 1), textCell('占比', 1)],
        ...report.expenseCategories.map((item) => [textCell(item.name), numberCell(item.amount), textCell(`${item.percent}%`)]),
      ]
      const detailRows = [
        [textCell('日期', 1), textCell('凭证号', 1), textCell('类型', 1), textCell('分类', 1), textCell('摘要', 1), textCell('金额（元）', 1)],
        ...vouchers.map((item) => [
          textCell(item.date),
          textCell(item.voucherNo || ''),
          textCell(item.type === 'income' ? '收入' : '支出'),
          textCell(item.category || '未分类'),
          textCell(item.summary || ''),
          numberCell(item.amount),
        ]),
      ]
      const buffer = buildXLSX([
        { name: '月度汇总', rows: summaryRows, colWidths: [22, 18, 14], merges: ['A1:C1'] },
        { name: '凭证明细', rows: detailRows, colWidths: [14, 22, 12, 18, 34, 16], merges: [] },
      ])
      const filePath = `${wx.env.USER_DATA_PATH}/经营报表_${report.month}.xlsx`
      wx.getFileSystemManager().writeFile({
        filePath,
        data: buffer,
        success: () => {
          wx.openDocument({
            filePath,
            fileType: 'xlsx',
            showMenu: true,
            fail: (error) => {
              console.error('[report] 打开文件失败', error)
              wx.showModal({ title: '报表已生成', content: '当前手机无法直接预览，请稍后重试或升级微信。', showCancel: false })
            },
          })
        },
        fail: (error) => {
          console.error('[report] 写入文件失败', error)
          wx.showToast({ title: '文件生成失败', icon: 'none' })
        },
        complete: () => this.setData({ exporting: false }),
      })
    } catch (error) {
      console.error('[report] 导出失败', error)
      this.setData({ exporting: false })
      wx.showToast({ title: '导出失败', icon: 'none' })
    }
  },
})
