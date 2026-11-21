'use strict'

const { buildXLSX } = require('../../utils/xlsx-builder.js')
const { useAccountingStore } = require('../../store/modules/accounting.js')

function asCell(value, numeric) { return { v: value, t: numeric ? 'n' : 's', s: numeric ? 2 : 0 } }

Page({
  data: { startDate: '', endDate: '', count: 0, exporting: false },
  onShow() {
    const store = useAccountingStore()
    if (!store.voucherList.length) store.fetchVoucherList().then(() => this.refreshCount())
    else this.refreshCount()
  },
  vouchers() {
    const store = useAccountingStore()
    return store.voucherList.filter((item) => (!this.data.startDate || item.date >= this.data.startDate) && (!this.data.endDate || item.date <= this.data.endDate))
  },
  refreshCount() { this.setData({ count: this.vouchers().length }) },
  onStartDate(event) { this.setData({ startDate: event.detail.value }, () => this.refreshCount()) },
  onEndDate(event) { this.setData({ endDate: event.detail.value }, () => this.refreshCount()) },
  exportLedger() {
    const rows = [[asCell('日期'), asCell('凭证号'), asCell('类型'), asCell('分类'), asCell('摘要'), asCell('金额（元）')]]
    this.vouchers().forEach((item) => rows.push([asCell(item.date), asCell(item.voucherNo), asCell(item.type === 'income' ? '收入' : '支出'), asCell(item.category || ''), asCell(item.summary || ''), asCell(Number(item.amount || 0), true)]))
    if (rows.length === 1) { wx.showToast({ title: '所选日期没有账单', icon: 'none' }); return }
    this.setData({ exporting: true })
    try {
      const buffer = buildXLSX([{ name: '账单明细', rows, colWidths: [14, 22, 12, 18, 34, 16], merges: [] }])
      const filePath = `${wx.env.USER_DATA_PATH}/账单明细_${new Date().toISOString().slice(0, 10)}.xlsx`
      wx.getFileSystemManager().writeFile({
        filePath, data: buffer,
        success: () => wx.openDocument({ filePath, fileType: 'xlsx', showMenu: true, fail: () => wx.showToast({ title: '文件已生成，请在文件管理中查看', icon: 'none' }) }),
        fail: () => wx.showToast({ title: '文件生成失败', icon: 'none' }),
        complete: () => this.setData({ exporting: false }),
      })
    } catch (error) { this.setData({ exporting: false }); wx.showToast({ title: '导出失败', icon: 'none' }); console.error(error) }
  },
})
