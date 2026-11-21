'use strict'

const { index: wx } = require('../common/vendor.js')

// “我的”页是已编译产物，保留旧事件入口并转到真实导出页面。
const originalShowToast = wx.showToast.bind(wx)
wx.showToast = (options = {}) => {
  if (options.title === '导出功能开发中') {
    wx.navigateTo({ url: '/pages/ledger-export/index' })
    return
  }
  return originalShowToast(options)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const RETRYABLE_STATUS = [408, 429, 500, 502, 503, 504]

class HttpClient {
  constructor() {
    this.baseUrl = ''
    this.timeout = 15000
    this.retryCount = 2
  }

  buildOptions(options) {
    const token = wx.getStorageSync('token')
    return {
      ...options,
      method: options.method || 'GET',
      timeout: options.timeout || this.timeout,
      header: {
        'Content-Type': 'application/json',
        'X-Client-Version': '1.0.0',
        'X-Client-Platform': 'mp-weixin',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {}),
      },
    }
  }

  requestOnce(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: this.baseUrl + options.url,
        method: options.method,
        data: options.data,
        header: options.header,
        timeout: options.timeout,
        success: (response) => {
          const { statusCode, data } = response
          if (statusCode >= 200 && statusCode < 300 && data && data.code === 0) return resolve(data.data)
          const error = new Error((data && data.message) || `网络请求失败 (${statusCode})`)
          error.statusCode = statusCode
          error.response = response
          reject(error)
        },
        fail: (error) => {
          const requestError = new Error(error.errMsg || '网络连接失败')
          requestError.networkError = true
          reject(requestError)
        },
      })
    })
  }

  shouldRetry(error, attempt, maxRetries) {
    return attempt < maxRetries && (error.networkError || RETRYABLE_STATUS.includes(error.statusCode))
  }

  async request(options) {
    const requestOptions = this.buildOptions(options)
    const maxRetries = options.retryCount === undefined ? this.retryCount : options.retryCount
    let lastError

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.requestOnce(requestOptions)
      } catch (error) {
        lastError = error
        if (!this.shouldRetry(error, attempt, maxRetries)) break
        // 400ms、800ms：避免短暂网络波动或服务端繁忙导致直接失败。
        await sleep(400 * Math.pow(2, attempt))
      }
    }

    const message = lastError && lastError.statusCode === 401
      ? '登录已过期，请重新登录'
      : '网络连接失败，请稍后重试'
    wx.showToast({ title: message, icon: 'none', duration: 2000 })
    throw lastError || new Error(message)
  }

  get(url, data = {}, options = {}) { return this.request({ url, method: 'GET', data, ...options }) }
  post(url, data = {}, options = {}) { return this.request({ url, method: 'POST', data, ...options }) }
  put(url, data = {}, options = {}) { return this.request({ url, method: 'PUT', data, ...options }) }
  delete(url, data = {}, options = {}) { return this.request({ url, method: 'DELETE', data, ...options }) }

  upload(url, filePath, formData = {}) {
    return new Promise((resolve, reject) => {
      const token = wx.getStorageSync('token')
      wx.uploadFile({
        url: this.baseUrl + url,
        filePath,
        name: 'file',
        formData,
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (response) => {
          try {
            const data = JSON.parse(response.data)
            if (data.code === 0) resolve(data.data)
            else reject(new Error(data.message || '上传失败'))
          } catch (error) { reject(error) }
        },
        fail: reject,
      })
    })
  }
}

exports.http = new HttpClient()
