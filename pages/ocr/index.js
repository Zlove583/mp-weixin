/**
 * 票据OCR识别页面（v2 - 纯云端模式，零Mock数据）
 *
 * 支持三种票据:
 *   vat_invoice   — 增值税发票（专票/普票）
 *   einvoice      — 电子发票
 *   bank_receipt  — 银行回单
 *
 * 流程: 选类型 → 拍照 → 上传云存储 → 云函数识别 → 结果渲染
 * 失败策略: 直接显示错误，绝不显示假数据
 */
'use strict'

const { DOC_TYPES, FIELD_CONFIGS, formatFieldValue, getDocTypeConfig } = require('../../utils/ocr-fields')
const { useAccountingStore } = require('../../store/modules/accounting')

Page({
  data: {
    // 票据类型
    docTypes: DOC_TYPES,
    activeDocType: 'vat_invoice',

    // 图片
    imagePath: '',       // 本地临时路径
    cloudFileID: '',     // 云存储 fileID

    // 状态
    isRecognizing: false,
    ocrResult: null,     // 云函数返回结果 { docType, docTypeName, fields, source }
    fieldConfig: null,   // 当前票据的字段配置

    // 错误状态
    ocrError: '',        // 识别/上传失败的错误消息，非空时显示错误面板

    // 编辑
    editingField: null,  // 正在编辑的字段 key
    editingValue: '',    // 编辑中的值

    // 凭证预览
    voucherPreview: null,

    // 历史记录
    historyRecords: [],
    showHistory: false,
  },

  onLoad() {
    if (!wx.cloud) {
      console.error('[OCR] 云开发未初始化，OCR功能不可用')
    }
  },

  onShow() {
    this.loadHistory()
  },

  // ═══════════════════════════════════════════
  // 票据类型切换
  // ═══════════════════════════════════════════
  switchDocType(e) {
    const type = e.currentTarget.dataset.type
    if (type === this.data.activeDocType) return

    this.setData({
      activeDocType: type,
      imagePath: '',
      cloudFileID: '',
      ocrResult: null,
      fieldConfig: null,
      voucherPreview: null,
      editingField: null,
      ocrError: '',
    })
  },

  // ═══════════════════════════════════════════
  // 拍照 / 选图
  // ═══════════════════════════════════════════
  chooseImage() {
    const options = {
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera', 'album'],
      success: (res) => {
        const path = res.tempFiles && res.tempFiles[0]
          ? res.tempFiles[0].tempFilePath
          : res.tempFilePaths && res.tempFilePaths[0]
        if (!path) {
          wx.showToast({ title: '未获取到图片，请重新选择', icon: 'none' })
          return
        }
        this.setData({
          imagePath: path,
          cloudFileID: '',
          ocrResult: null,
          fieldConfig: null,
          voucherPreview: null,
          editingField: null,
          ocrError: '',
        })
      },
      fail: (err) => {
        console.error('[OCR] 选择图片失败', err)
        const message = (err && err.errMsg) || ''
        if (message.includes('cancel')) return
        if (message.includes('api scope is not declared')) {
          wx.showModal({
            title: '隐私接口未配置',
            content: '请管理员在微信公众平台的隐私保护指引中声明选择图片和摄像头用途。',
            showCancel: false,
          })
          return
        }
        if (message.includes('auth deny') || message.includes('authorize') || message.includes('permission')) {
          wx.showModal({
            title: '需要相机或相册权限',
            content: '请在小程序设置中允许使用相机或相册后重试。',
            confirmText: '去设置',
            success: (result) => result.confirm && wx.openSetting(),
          })
          return
        }
        wx.showToast({ title: '选择图片失败，请重试', icon: 'none' })
      },
    }
    const selectImage = () => {
      wx.chooseImage(options)
    }

    if (!wx.getPrivacySetting || !wx.requirePrivacyAuthorize) {
      selectImage()
      return
    }
    wx.getPrivacySetting({
      success: (result) => {
        if (!result.needAuthorization) {
          selectImage()
          return
        }
        wx.requirePrivacyAuthorize({
          success: selectImage,
          fail: (error) => {
            const message = (error && error.errMsg) || ''
            if (!message.includes('cancel')) {
              wx.showToast({ title: '请同意隐私保护指引后选择图片', icon: 'none' })
            }
          },
        })
      },
      fail: selectImage,
    })
  },

  // ═══════════════════════════════════════════
  // 预览原图
  // ═══════════════════════════════════════════
  previewImage() {
    const src = this.data.cloudFileID || this.data.imagePath
    if (!src) return

    if (this.data.cloudFileID && wx.cloud) {
      wx.cloud.getTempFileURL({
        fileList: [this.data.cloudFileID],
        success: (res) => {
          if (res.fileList[0] && res.fileList[0].tempFileURL) {
            wx.previewImage({
              urls: [res.fileList[0].tempFileURL],
              current: res.fileList[0].tempFileURL,
            })
          }
        },
        fail: () => {
          // 降级：直接用本地路径预览
          wx.previewImage({ urls: [this.data.imagePath], current: this.data.imagePath })
        },
      })
    } else {
      wx.previewImage({ urls: [this.data.imagePath], current: this.data.imagePath })
    }
  },

  // ═══════════════════════════════════════════
  // 上传图片到云存储 + 调用云函数识别（纯云端，无Mock）
  // ═══════════════════════════════════════════
  async startOCR() {
    if (!this.data.imagePath) {
      wx.showToast({ title: '请先拍摄或选择票据图片', icon: 'none' })
      return
    }

    // 检查云开发是否可用
    if (!wx.cloud) {
      this.setData({
        ocrError: '云开发环境未初始化。请在微信开发者工具中点击"云开发"按钮开通云开发，并确保 app.js 中的环境ID配置正确。'
      })
      return
    }

    // ── 诊断日志：输出环境信息 ──
    console.log('[OCR诊断] wx.cloud 已初始化')
    console.log('[OCR诊断] 环境ID:', wx.cloud.env || '未知')
    console.log('[OCR诊断] 图片路径:', this.data.imagePath)
    console.log('[OCR诊断] 图片路径是否存在:', this.data.imagePath ? '是' : '否')

    // 检查图片文件是否能被读取（验证路径有效）
    try {
      const fs = wx.getFileSystemManager()
      const stat = fs.statSync(this.data.imagePath)
      console.log('[OCR诊断] 图片文件大小:', stat.size, 'bytes')
      if (stat.size === 0) {
        throw new Error('图片文件大小为0，请重新拍照')
      }
      if (stat.size > 10 * 1024 * 1024) {
        throw new Error('图片过大（' + (stat.size / 1024 / 1024).toFixed(1) + 'MB），请使用压缩后的图片')
      }
    } catch (fsErr) {
      if (fsErr.message && fsErr.message.includes('图片')) {
        // 我们自己的错误，直接抛出
        this.setData({ isRecognizing: false, ocrError: fsErr.message })
        return
      }
      console.warn('[OCR诊断] 无法读取文件信息:', fsErr.message)
    }

    this.setData({ isRecognizing: true, ocrError: '' })

    try {
      // ═══ Step 1: 上传图片到云存储（必须成功） ═══
      console.log('[OCR] 开始上传图片到云存储...')
      const cloudPath = `ocr/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`

      let fileID = ''
      try {
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath,
          filePath: this.data.imagePath,
        })
        fileID = uploadRes.fileID
        this.setData({ cloudFileID: fileID })
        console.log('[OCR] 云存储上传成功, fileID:', fileID)
      } catch (uploadErr) {
        // 输出完整错误对象，便于诊断
        console.error('[OCR] 云存储上传失败 - 完整错误:', JSON.stringify(uploadErr))
        console.error('[OCR] 云存储上传失败 - errMsg:', uploadErr.errMsg)
        console.error('[OCR] 云存储上传失败 - errCode:', uploadErr.errCode)

        const rawMsg = uploadErr.errMsg || uploadErr.message || String(uploadErr)

        // ── 分类诊断 ──
        let hint = ''
        if (rawMsg.includes('env') || rawMsg.includes('invalid')) {
          hint = '\n\n【环境ID错误】app.js 或 project.config.json 中云开发环境ID配置不完整。请确认环境ID带完整后缀（如 cloud1-xxxxxxxxx），可在微信开发者工具 → 云开发控制台 → 概览 中查看。'
        } else if (rawMsg.includes('permission') || rawMsg.includes('not authorized')) {
          hint = '\n\n【权限不足】请检查云开发控制台 → 存储 → 权限设置：读权限设为"所有用户可读"，写权限设为"仅创建者及管理员可写"。'
        } else if (rawMsg.includes('not found') || rawMsg.includes('NOT_FOUND')) {
          hint = '\n\n【云存储未开通】请确认已在微信开发者工具中开通云开发 → 存储服务。'
        } else if (rawMsg.includes('network') || rawMsg.includes('timeout') || rawMsg.includes('fail')) {
          hint = '\n\n【网络问题】可能是：1) 手机/开发者工具网络不通 2) 真机调试2.0模式不支持云开发，请切换到预览模式或真机调试1.0。'
        } else if (rawMsg.includes('size') || rawMsg.includes('too large')) {
          hint = '\n\n【图片过大】尝试换一张更小的图片，或在拍照时选择压缩模式。'
        } else if (rawMsg.includes('cloud init') || rawMsg.includes('not init')) {
          hint = '\n\n【云开发未初始化】请确认 wx.cloud.init() 已在 app.js 中正确调用，且环境ID填写正确。'
        }

        throw new Error('云存储上传失败: ' + rawMsg + hint)
      }

      // ═══ Step 2: 调用云函数识别（必须成功） ═══
      console.log('[OCR] 开始调用云函数, docType:', this.data.activeDocType, 'fileID:', fileID)

      const fnRes = await wx.cloud.callFunction({
        name: 'ocr',
        data: {
          action: 'recognize',
          docType: this.data.activeDocType,
          fileID: fileID,
        },
      })

      console.log('[OCR] 云函数返回:', JSON.stringify(fnRes).slice(0, 500))

      // 检查云函数返回结果
      if (!fnRes || !fnRes.result) {
        throw new Error('云函数返回为空，请检查云函数是否已部署')
      }

      if (fnRes.result.code !== 0) {
        // 云函数返回了错误（例如 OCR 识别失败）
        throw new Error(fnRes.result.message || '票据识别失败')
      }

      if (!fnRes.result.data) {
        throw new Error('云函数返回数据为空')
      }

      // ═══ Step 3: 获取结果和字段配置 ═══
      const result = fnRes.result.data
      result.source = 'cloud'  // 标记为云端识别

      const fieldConfig = FIELD_CONFIGS[this.data.activeDocType]
      if (!fieldConfig || !fieldConfig.groups) {
        throw new Error('未找到票据类型 ' + this.data.activeDocType + ' 的字段配置')
      }

      this.setData({
        isRecognizing: false,
        ocrResult: result,
        fieldConfig: fieldConfig,
        ocrError: '',
      })

      wx.showToast({ title: '识别完成', icon: 'success' })
      console.log('[OCR] 识别成功, docType:', result.docType, 'fields count:', Object.keys(result.fields || {}).length)

    } catch (err) {
      // ═══ 统一错误处理：直接显示错误，绝不降级Mock ═══
      const errMsg = err.message || String(err)
      console.error('[OCR] 识别失败:', errMsg)

      this.setData({
        isRecognizing: false,
        ocrResult: null,
        fieldConfig: null,
        ocrError: errMsg,
      })

      wx.showToast({ title: '识别失败', icon: 'none' })
    }
  },

  // ═══════════════════════════════════════════
  // 字段编辑
  // ═══════════════════════════════════════════
  startEditField(e) {
    const key = e.currentTarget.dataset.key
    const fieldDef = this.findFieldDef(key)
    if (!fieldDef || !fieldDef.editable) return

    const currentValue = this.data.ocrResult.fields[key]
    this.setData({
      editingField: key,
      editingValue: currentValue !== undefined && currentValue !== null ? String(currentValue) : '',
    })
  },

  onEditInput(e) {
    this.setData({ editingValue: e.detail.value })
  },

  saveEditField() {
    const key = this.data.editingField
    if (!key) return

    const fieldDef = this.findFieldDef(key)
    let value = this.data.editingValue

    // 类型转换
    if (fieldDef && fieldDef.type === 'money') {
      value = parseFloat(value) || 0
    }

    const ocrResult = { ...this.data.ocrResult }
    ocrResult.fields = { ...ocrResult.fields, [key]: value }

    this.setData({
      ocrResult: ocrResult,
      editingField: null,
      editingValue: '',
    })

    wx.showToast({ title: '已更新', icon: 'success', duration: 1000 })
  },

  cancelEdit() {
    this.setData({ editingField: null, editingValue: '' })
  },

  findFieldDef(key) {
    const config = this.data.fieldConfig
    if (!config || !config.groups) return null
    for (const group of config.groups) {
      const found = group.fields.find(f => f.key === key)
      if (found) return found
    }
    return null
  },

  // ═══════════════════════════════════════════
  // 生成记账凭证
  // ═══════════════════════════════════════════
  createVoucher() {
    const { ocrResult, fieldConfig } = this.data
    if (!ocrResult || !fieldConfig.voucherMapping) return

    const voucher = fieldConfig.voucherMapping(ocrResult.fields)

    this.setData({ voucherPreview: voucher })

    wx.showToast({ title: '凭证已生成', icon: 'success' })
  },

  confirmVoucher() {
    const store = useAccountingStore()
    const { voucherPreview } = this.data

    store.createVoucher({
      type: voucherPreview.type,
      amount: voucherPreview.amount,
      summary: voucherPreview.summary,
      category: voucherPreview.type === 'expense' ? '采购成本' : '销售收入',
    })

    wx.showToast({ title: '凭证已生成并保存', icon: 'success', duration: 2000 })

    setTimeout(() => {
      this.reset()
    }, 1500)
  },

  // ═══════════════════════════════════════════
  // 历史记录
  // ═══════════════════════════════════════════
  async loadHistory() {
    if (!wx.cloud) return

    try {
      const res = await wx.cloud.callFunction({
        name: 'ocr',
        data: { action: 'history' },
      })

      if (res.result && res.result.code === 0) {
        const records = (res.result.data && res.result.data.records) || []
        this.setData({ historyRecords: records })
      }
    } catch (err) {
      console.error('[OCR] 加载历史记录失败', err)
    }
  },

  toggleHistory() {
    this.setData({ showHistory: !this.data.showHistory })
  },

  loadHistoryRecord(e) {
    const record = e.currentTarget.dataset.record
    if (!record) return

    const fieldConfig = FIELD_CONFIGS[record.docType]
    this.setData({
      activeDocType: record.docType,
      ocrResult: { docType: record.docType, docTypeName: record.docTypeName, fields: record.fields, source: 'cloud' },
      fieldConfig: fieldConfig,
      imagePath: '',
      showHistory: false,
      voucherPreview: null,
      ocrError: '',
    })
  },

  async deleteHistory(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return

    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: '确定要删除这条识别记录吗？',
        success: (res) => resolve(res.confirm),
      })
    })

    if (!confirm) return

    try {
      if (wx.cloud) {
        await wx.cloud.callFunction({
          name: 'ocr',
          data: { action: 'delete', recordId: id },
        })
      }
      const records = this.data.historyRecords.filter(r => r._id !== id)
      this.setData({ historyRecords: records })
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (err) {
      console.error('[OCR] 删除失败', err)
    }
  },

  // ═══════════════════════════════════════════
  // 重置
  // ═══════════════════════════════════════════
  reset() {
    this.setData({
      imagePath: '',
      cloudFileID: '',
      isRecognizing: false,
      ocrResult: null,
      fieldConfig: null,
      editingField: null,
      editingValue: '',
      voucherPreview: null,
      ocrError: '',
    })
  },
})
