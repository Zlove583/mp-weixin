/**
 * 自产农产品免税核算 API 模块
 * 提供免税核算、历史查询、规则匹配等全部后端接口
 * 适配内蒙古北疆地区税务政策
 *
 * @module api/modules/agri-tax
 */

const { http } = require('../request');

// ============================================================
// 接口基础路径
// ============================================================
const BASE = '/agri/tax-exemption';

// ============================================================
// 导出 API 方法集合
// ============================================================
exports.AGRI_TAX_API = {

  // ----------------------------------------------------------
  // 免税核算 - 执行核算计算
  // ----------------------------------------------------------
  /**
   * 执行免税自动核算
   * 后端根据用户当期销售数据 + 匹配的免税规则，自动计算免税金额
   *
   * @param {Object} params
   * @param {string} params.period          - 核算周期 YYYY-MM（必填）
   * @param {string} params.tax_type        - 税种，默认"增值税"
   * @param {string} params.product_category - 产品品类（可选，默认核算全部）
   * @param {Array<number>} params.sales_ids - 指定纳入核算的销售数据ID列表（可选）
   * @returns {Promise<{
   *   record_no: string,              // 核算记录编号
   *   total_sales_amount: number,     // 销售总额
   *   taxable_amount: number,         // 应税收入额
   *   exemption_amount: number,       // 免税收入额
   *   tax_rate: number,               // 适用税率
   *   tax_payable: number,            // 应缴税额
   *   tax_exempted: number,           // 免除税额
   *   actual_tax: number,             // 实缴税额
   *   applied_rules: Array<{          // 应用的免税规则列表
   *     rule_code: string,
   *     rule_name: string,
   *     exemption_rate: number,
   *     exempted_amount: number
   *   }>,
   *   calculation_log: Object         // 详细计算过程
   * }>}
   */
  calculate(params) {
    return http.post(BASE + '/calculate', params);
  },

  // ----------------------------------------------------------
  // 核算记录列表查询
  // ----------------------------------------------------------
  /**
   * 查询免税核算记录列表
   * @param {Object} params
   * @param {string} params.period   - 核算周期 YYYY-MM（可选）
   * @param {string} params.tax_type - 税种筛选（可选）
   * @param {string} params.status   - 状态筛选：draft/confirmed/declared
   * @param {number} params.page     - 页码
   * @param {number} params.pageSize - 每页条数
   * @returns {Promise<{list:Array, total:number}>}
   */
  getRecords(params = {}) {
    return http.get(BASE + '/records', params);
  },

  // ----------------------------------------------------------
  // 核算记录详情
  // ----------------------------------------------------------
  /**
   * 获取单条核算记录详情
   * @param {number} id - 记录ID
   * @returns {Promise<Object>} 完整核算记录，含计算过程
   */
  getRecordDetail(id) {
    return http.get(BASE + '/record/' + id);
  },

  // ----------------------------------------------------------
  // 确认核算结果
  // ----------------------------------------------------------
  /**
   * 确认核算结果（草稿→已确认）
   * @param {number} id - 记录ID
   * @returns {Promise<Object>}
   */
  confirmRecord(id) {
    return http.put(BASE + '/record/' + id + '/confirm');
  },

  // ----------------------------------------------------------
  // 核算结果对接申报
  // ----------------------------------------------------------
  /**
   * 将已确认的核算记录推送至税务申报系统
   * 对接原有 subpkg-tax 申报功能
   *
   * @param {number} id - 核算记录ID
   * @returns {Promise<Object>}
   */
  submitToDeclaration(id) {
    return http.post(BASE + '/record/' + id + '/declare');
  },

  // ----------------------------------------------------------
  // 批量核算（多品类一次核算）
  // ----------------------------------------------------------
  /**
   * 批量执行多品类免税核算
   * @param {Object} params
   * @param {string} params.period        - 核算周期
   * @param {Array<string>} params.categories - 品类列表
   * @returns {Promise<{records:Array, summary:Object}>}
   */
  batchCalculate(params) {
    return http.post(BASE + '/batch-calculate', params);
  },

  // ----------------------------------------------------------
  // 免税额度查询
  // ----------------------------------------------------------
  /**
   * 查询当前免税额度使用情况
   * @param {Object} params
   * @param {string} params.period - 查询周期
   * @param {string} params.tax_type - 税种
   * @returns {Promise<{
   *   total_limit: number,        // 总额度
   *   used_amount: number,        // 已使用额度
   *   remaining: number,          // 剩余额度
   *   period: string
   * }>}
   */
  getQuota(params = {}) {
    return http.get(BASE + '/quota', params);
  },

  // ----------------------------------------------------------
  // 免税政策规则查询
  // ----------------------------------------------------------
  /**
   * 查询适用的免税政策规则列表
   * @param {Object} params
   * @param {string} params.tax_type        - 税种筛选
   * @param {string} params.product_category - 产品品类
   * @returns {Promise<Array<Object>>} 规则列表
   */
  getRules(params = {}) {
    return http.get(BASE + '/rules', params);
  },

  // ----------------------------------------------------------
  // 核算汇总统计
  // ----------------------------------------------------------
  /**
   * 免税核算汇总统计
   * @param {Object} params
   * @param {string} params.start_period - 起始周期 YYYY-MM
   * @param {string} params.end_period   - 结束周期 YYYY-MM
   * @returns {Promise<{
   *   total_sales: number,
   *   total_exemption: number,
   *   total_tax_saved: number,
   *   by_period: Array<{period:string, sales:number, exemption:number, tax_saved:number}>
   * }>}
   */
  getSummary(params = {}) {
    return http.get(BASE + '/summary', params);
  }
};
