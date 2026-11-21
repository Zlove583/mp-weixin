/**
 * 牲畜存栏台账 API 模块
 * 提供牲畜台账的增删改查、统计等全部后端接口
 * 所有接口自动携带用户登录态，后端根据 user_id 做数据隔离
 *
 * @module api/modules/livestock
 */

const { http } = require('../request');

// ============================================================
// 接口基础路径
// ============================================================
const BASE = '/agri/livestock';

// ============================================================
// 导出 API 方法集合
// ============================================================
exports.LIVESTOCK_API = {

  // ----------------------------------------------------------
  // 台账列表查询（分页 + 筛选）
  // ----------------------------------------------------------
  /**
   * 查询牲畜台账列表
   * @param {Object} params - 查询参数
   * @param {string}  params.keyword    - 关键词搜索（编号/品种）
   * @param {string}  params.category   - 牲畜种类筛选：牛/羊/马/骆驼/猪
   * @param {string}  params.status     - 状态筛选：存栏/出栏/死亡/丢失
   * @param {string}  params.source     - 来源筛选：购入/自繁/赠予
   * @param {number}  params.page       - 页码，默认1
   * @param {number}  params.pageSize   - 每页条数，默认20
   * @returns {Promise<{list:Array, total:number, page:number, pageSize:number}>}
   */
  getList(params = {}) {
    return http.get(BASE + '/list', params);
  },

  // ----------------------------------------------------------
  // 台账详情
  // ----------------------------------------------------------
  /**
   * 获取单条牲畜台账详情
   * @param {number} id - 台账记录ID
   * @returns {Promise<Object>} 完整的牲畜信息对象
   */
  getDetail(id) {
    return http.get(BASE + '/detail/' + id);
  },

  // ----------------------------------------------------------
  // 新增台账
  // ----------------------------------------------------------
  /**
   * 新增牲畜台账记录
   * @param {Object} data - 牲畜信息
   * @param {string}  data.livestock_no   - 牲畜编号/耳标号（必填）
   * @param {string}  data.category       - 种类（必填）
   * @param {string}  data.breed          - 品种
   * @param {number}  data.gender         - 性别 0母/1公
   * @param {string}  data.birth_date     - 出生日期 YYYY-MM-DD
   * @param {string}  data.source         - 来源方式
   * @param {number}  data.purchase_price - 购入价格
   * @param {string}  data.purchase_date  - 购入日期
   * @param {string}  data.purchase_from  - 购入来源
   * @param {number}  data.weight_kg      - 体重
   * @param {string}  data.feed_type      - 饲料类型
   * @param {string}  data.vaccination    - 疫苗接种记录
   * @param {string}  data.health_status  - 健康状况
   * @param {string}  data.notes          - 备注
   * @param {Array}   data.image_urls     - 图片URL列表
   * @returns {Promise<{id:number}>}
   */
  create(data) {
    return http.post(BASE + '/create', data);
  },

  // ----------------------------------------------------------
  // 编辑台账
  // ----------------------------------------------------------
  /**
   * 更新牲畜台账信息
   * @param {number} id   - 台账记录ID
   * @param {Object} data - 要更新的字段
   * @returns {Promise<Object>}
   */
  update(id, data) {
    return http.put(BASE + '/update/' + id, data);
  },

  // ----------------------------------------------------------
  // 删除台账（软删除）
  // ----------------------------------------------------------
  /**
   * 删除牲畜台账（软删除，deleted_at标记）
   * @param {number} id - 台账记录ID
   * @returns {Promise<Object>}
   */
  delete(id) {
    return http.delete(BASE + '/delete/' + id);
  },

  // ----------------------------------------------------------
  // 批量更新状态（出栏/死亡）
  // ----------------------------------------------------------
  /**
   * 批量更新牲畜状态（出栏/死亡标记）
   * @param {Object} data
   * @param {Array<number>} data.ids        - 台账ID数组
   * @param {string}        data.new_status - 新状态：出栏/死亡
   * @param {Object}        data.extra      - 额外信息
   *   - {number} sale_price   - 出栏售价
   *   - {string} sale_date    - 出栏日期
   *   - {string} sale_to      - 出栏去向
   *   - {string} death_cause  - 死亡原因
   * @returns {Promise<{affected:number}>}
   */
  batchUpdateStatus(data) {
    return http.put(BASE + '/batch-status', data);
  },

  // ----------------------------------------------------------
  // 存栏统计
  // ----------------------------------------------------------
  /**
   * 获取当前用户的存栏统计汇总
   * @param {Object} params
   * @param {string} params.category - 可选，按种类筛选
   * @returns {Promise<{
   *   total_count: number,      // 总数量
   *   alive_count: number,      // 存栏数量
   *   sold_count: number,       // 出栏数量
   *   dead_count: number,       // 死亡数量
   *   total_value: number,      // 存栏总价值
   *   by_category: Array<{category:string, count:number, value:number}>
   * }>}
   */
  getSummary(params = {}) {
    return http.get(BASE + '/summary', params);
  },

  // ----------------------------------------------------------
  // 导出台账数据
  // ----------------------------------------------------------
  /**
   * 导出台账数据为Excel
   * @param {Object} params - 同getList的筛选参数
   * @returns {Promise<{file_url:string}>}
   */
  exportData(params = {}) {
    return http.get(BASE + '/export', params);
  }
};
