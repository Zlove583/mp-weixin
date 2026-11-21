/**
 * 牲畜存栏台账 Store 模块
 * 面向农牧户、畜牧合作社，支持牲畜信息全流程管理
 *
 * 功能：
 * - 牲畜台账的增删改查
 * - 存栏数量实时统计
 * - 按种类/状态/来源等多维度筛选
 * - 分页加载
 * - 数据绑定用户ID（通过API层自动携带）
 *
 * @module store/modules/livestock
 */

const { defineStore } = require('../../common/vendor.js');

// ============================================================
// Mock 数据生成器
// ============================================================
function generateMockLivestockData() {
  const now = new Date();
  const fmt = d => d.toISOString().split('T')[0];
  const ago = days => {
    const d = new Date(now);
    d.setDate(d.getDate() - days);
    return fmt(d);
  };

  return [
    {
      id: 1,
      livestockNo: 'NM-2026001',
      category: '牛',
      breed: '西门塔尔牛',
      gender: 0,
      birthDate: '2025-03-15',
      source: '购入',
      purchasePrice: 18500,
      purchaseDate: '2025-06-20',
      purchaseFrom: '通辽市科尔沁牛市',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 580,
      feedType: '青贮玉米+苜蓿草+精料',
      vaccination: '口蹄疫疫苗(2026-03)、牛结节性皮肤病疫苗(2026-01)',
      healthStatus: '健康',
      notes: '体型良好，预计2026年底可出栏',
      imageUrls: [],
      createdAt: ago(120),
      updatedAt: ago(3)
    },
    {
      id: 2,
      livestockNo: 'NM-2026002',
      category: '牛',
      breed: '安格斯牛',
      gender: 0,
      birthDate: '2025-01-20',
      source: '自繁',
      purchasePrice: 0,
      purchaseDate: '2025-01-20',
      purchaseFrom: '自家牧场繁育',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 650,
      feedType: '天然牧场放牧+冬季补饲',
      vaccination: '口蹄疫疫苗(2026-03)、布鲁氏菌疫苗(2025-12)',
      healthStatus: '健康',
      notes: '纯种安格斯，肉质优良',
      imageUrls: [],
      createdAt: ago(100),
      updatedAt: ago(5)
    },
    {
      id: 3,
      livestockNo: 'NM-2026003',
      category: '羊',
      breed: '蒙古羊',
      gender: 0,
      birthDate: '2025-08-10',
      source: '购入',
      purchasePrice: 1200,
      purchaseDate: '2025-10-05',
      purchaseFrom: '锡林郭勒盟种羊场',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 45,
      feedType: '天然草场放牧',
      vaccination: '羊三联四防疫苗(2026-04)',
      healthStatus: '健康',
      notes: '毛质优良，适合本地气候',
      imageUrls: [],
      createdAt: ago(90),
      updatedAt: ago(7)
    },
    {
      id: 4,
      livestockNo: 'NM-2026004',
      category: '羊',
      breed: '蒙古羊',
      gender: 0,
      birthDate: '2025-07-22',
      source: '购入',
      purchasePrice: 980,
      purchaseDate: '2025-09-18',
      purchaseFrom: '呼伦贝尔市牧户合作社',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 42,
      feedType: '天然草场放牧',
      vaccination: '羊三联四防疫苗(2026-04)',
      healthStatus: '健康',
      notes: '',
      imageUrls: [],
      createdAt: ago(85),
      updatedAt: ago(7)
    },
    {
      id: 5,
      livestockNo: 'NM-2026005',
      category: '牛',
      breed: '西门塔尔牛',
      gender: 1,
      birthDate: '2024-11-08',
      source: '购入',
      purchasePrice: 22000,
      purchaseDate: '2025-04-12',
      purchaseFrom: '赤峰市巴林右旗牛市',
      currentStatus: '出栏',
      statusDate: '2026-06-15',
      salePrice: 32000,
      saleDate: '2026-06-15',
      saleTo: '呼和浩特市蒙牛屠宰加工厂',
      deathCause: '',
      weightKg: 720,
      feedType: '青贮玉米+豆粕+预混料',
      vaccination: '口蹄疫疫苗(2025-09)',
      healthStatus: '健康',
      notes: '育肥效果好，出栏体重达标',
      imageUrls: [],
      createdAt: ago(200),
      updatedAt: ago(28)
    },
    {
      id: 6,
      livestockNo: 'NM-2026006',
      category: '马',
      breed: '蒙古马',
      gender: 1,
      birthDate: '2023-05-01',
      source: '自繁',
      purchasePrice: 0,
      purchaseDate: '2023-05-01',
      purchaseFrom: '自家牧场繁育',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 380,
      feedType: '天然草原放牧',
      vaccination: '马传贫疫苗(2025-07)',
      healthStatus: '健康',
      notes: '优良骑乘品种，用于放牧管理',
      imageUrls: [],
      createdAt: ago(400),
      updatedAt: ago(15)
    },
    {
      id: 7,
      livestockNo: 'NM-2026007',
      category: '牛',
      breed: '西门塔尔牛',
      gender: 0,
      birthDate: '2024-08-25',
      source: '购入',
      purchasePrice: 15600,
      purchaseDate: '2025-03-10',
      purchaseFrom: '兴安盟扎赉特旗牲畜交易市场',
      currentStatus: '死亡',
      statusDate: '2026-02-20',
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '极端寒潮导致肺炎并发症',
      weightKg: 450,
      feedType: '青贮+干草+精料',
      vaccination: '口蹄疫疫苗(2025-08)',
      healthStatus: '死亡',
      notes: '冬季保暖不足需加强棚圈建设',
      imageUrls: [],
      createdAt: ago(180),
      updatedAt: ago(140)
    },
    {
      id: 8,
      livestockNo: 'NM-2026008',
      category: '羊',
      breed: '蒙古羊',
      gender: 0,
      birthDate: '2025-06-15',
      source: '自繁',
      purchasePrice: 0,
      purchaseDate: '2025-06-15',
      purchaseFrom: '自家牧场繁育',
      currentStatus: '存栏',
      statusDate: null,
      salePrice: null,
      saleDate: null,
      saleTo: '',
      deathCause: '',
      weightKg: 38,
      feedType: '天然草场放牧',
      vaccination: '羊三联四防疫苗(2026-04)',
      healthStatus: '健康',
      notes: '',
      imageUrls: [],
      createdAt: ago(75),
      updatedAt: ago(10)
    }
  ];
}

// ============================================================
// 种类/来源/状态 配置常量
// ============================================================
const CATEGORIES = ['牛', '羊', '马', '骆驼', '猪'];
const SOURCES = ['购入', '自繁', '赠予', '其他'];
const STATUSES = ['存栏', '出栏', '死亡', '丢失'];
const HEALTH_STATUSES = ['健康', '观察', '治疗中'];
const GENDERS = [
  { value: 0, label: '母' },
  { value: 1, label: '公' }
];

// ============================================================
// Pinia Store 定义
// ============================================================
exports.useLivestockStore = defineStore('livestock', {
  // ==========================================
  // State
  // ==========================================
  state: () => ({
    list: [],
    total: 0,
    currentItem: null,
    loading: false,
    summary: {
      totalCount: 0,
      aliveCount: 0,
      soldCount: 0,
      deadCount: 0,
      totalValue: 0,
      byCategory: []
    },
    filters: {
      keyword: '',
      category: '',
      status: '',
      source: '',
      page: 1,
      pageSize: 20
    },
    // 配置常量暴露给前端
    CATEGORIES,
    SOURCES,
    STATUSES,
    HEALTH_STATUSES,
    GENDERS
  }),

  // ==========================================
  // Getters
  // ==========================================
  getters: {
    /**
     * 存栏列表（仅状态为"存栏"的）
     */
    aliveList: state => state.list.filter(item => item.currentStatus === '存栏'),

    /**
     * 按种类分组的存栏统计
     */
    categoryStats: state => {
      const map = {};
      state.list.forEach(item => {
        if (!map[item.category]) {
          map[item.category] = { category: item.category, total: 0, alive: 0, value: 0 };
        }
        map[item.category].total++;
        if (item.currentStatus === '存栏') {
          map[item.category].alive++;
          map[item.category].value += item.purchasePrice || 0;
        }
      });
      return Object.values(map);
    },

    /**
     * 本月新增数量
     */
    monthNewCount: state => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      return state.list.filter(item => item.createdAt >= monthStart).length;
    },

    /**
     * 是否有数据
     */
    hasData: state => state.list.length > 0,

    /**
     * 过滤后的列表（前端二次筛选）
     */
    filteredList: state => {
      let result = [...state.list];
      if (state.filters.keyword) {
        const kw = state.filters.keyword.toLowerCase();
        result = result.filter(item =>
          item.livestockNo.toLowerCase().includes(kw) ||
          item.breed.toLowerCase().includes(kw) ||
          item.purchaseFrom.toLowerCase().includes(kw)
        );
      }
      if (state.filters.category) {
        result = result.filter(item => item.category === state.filters.category);
      }
      if (state.filters.status) {
        result = result.filter(item => item.currentStatus === state.filters.status);
      }
      if (state.filters.source) {
        result = result.filter(item => item.source === state.filters.source);
      }
      return result;
    }
  },

  // ==========================================
  // Actions
  // ==========================================
  actions: {
    // --------------------------------------------------------
    // 获取台账列表（Mock）
    // --------------------------------------------------------
    async fetchList(params = {}) {
      this.loading = true;
      // 首次加载时填充 mock 数据
      if (this.list.length === 0) {
        this.list = generateMockLivestockData();
        this.total = this.list.length;
      }
      // 模拟异步延迟
      await new Promise(resolve => setTimeout(resolve, 200));
      // 更新筛选条件
      if (params.keyword !== undefined) this.filters.keyword = params.keyword;
      if (params.category !== undefined) this.filters.category = params.category;
      if (params.status !== undefined) this.filters.status = params.status;
      if (params.source !== undefined) this.filters.source = params.source;
      if (params.page !== undefined) this.filters.page = params.page;
      this.loading = false;
    },

    // --------------------------------------------------------
    // 获取台账详情
    // --------------------------------------------------------
    async fetchDetail(id) {
      // 先从 list 中查找
      let item = this.list.find(t => t.id === Number(id));
      if (!item) {
        // 兼容：如果list还没加载，先加载
        if (this.list.length === 0) {
          await this.fetchList();
          item = this.list.find(t => t.id === Number(id));
        }
      }
      this.currentItem = item || null;
      return this.currentItem;
    },

    // --------------------------------------------------------
    // 新增牲畜台账
    // --------------------------------------------------------
    async create(data) {
      const maxId = this.list.reduce((max, item) => Math.max(max, item.id), 0);
      const now = new Date().toISOString().split('T')[0];
      const newItem = {
        id: maxId + 1,
        livestockNo: data.livestockNo || ('NM-' + new Date().getFullYear() + String(maxId + 1).padStart(4, '0')),
        category: data.category || '牛',
        breed: data.breed || '',
        gender: data.gender !== undefined ? data.gender : 0,
        birthDate: data.birthDate || '',
        source: data.source || '购入',
        purchasePrice: Number(data.purchasePrice) || 0,
        purchaseDate: data.purchaseDate || now,
        purchaseFrom: data.purchaseFrom || '',
        currentStatus: '存栏',
        statusDate: null,
        salePrice: null,
        saleDate: null,
        saleTo: '',
        deathCause: '',
        weightKg: Number(data.weightKg) || null,
        feedType: data.feedType || '',
        vaccination: data.vaccination || '',
        healthStatus: data.healthStatus || '健康',
        notes: data.notes || '',
        imageUrls: data.imageUrls || [],
        createdAt: now,
        updatedAt: now
      };
      this.list.unshift(newItem);
      this.total = this.list.length;
      await this._refreshSummary();
      return { id: newItem.id };
    },

    // --------------------------------------------------------
    // 更新牲畜台账
    // --------------------------------------------------------
    async update(id, data) {
      const idx = this.list.findIndex(item => item.id === Number(id));
      if (idx >= 0) {
        const now = new Date().toISOString().split('T')[0];
        // 仅更新允许的字段
        const allowedFields = [
          'livestockNo', 'category', 'breed', 'gender', 'birthDate',
          'source', 'purchasePrice', 'purchaseDate', 'purchaseFrom',
          'weightKg', 'feedType', 'vaccination', 'healthStatus',
          'notes', 'imageUrls'
        ];
        allowedFields.forEach(field => {
          if (data[field] !== undefined) {
            this.list[idx][field] = data[field];
          }
        });
        this.list[idx].updatedAt = now;
        // 同步更新 currentItem
        if (this.currentItem && this.currentItem.id === Number(id)) {
          this.currentItem = { ...this.list[idx] };
        }
      }
      return { success: true };
    },

    // --------------------------------------------------------
    // 删除台账（软删除）
    // --------------------------------------------------------
    async delete(id) {
      this.list = this.list.filter(item => item.id !== Number(id));
      this.total = this.list.length;
      if (this.currentItem && this.currentItem.id === Number(id)) {
        this.currentItem = null;
      }
      await this._refreshSummary();
      return { success: true };
    },

    // --------------------------------------------------------
    // 标记出栏
    // --------------------------------------------------------
    async markAsSold(id, saleData = {}) {
      const idx = this.list.findIndex(item => item.id === Number(id));
      if (idx >= 0) {
        const now = new Date().toISOString().split('T')[0];
        this.list[idx].currentStatus = '出栏';
        this.list[idx].statusDate = saleData.saleDate || now;
        this.list[idx].salePrice = Number(saleData.salePrice) || 0;
        this.list[idx].saleDate = saleData.saleDate || now;
        this.list[idx].saleTo = saleData.saleTo || '';
        this.list[idx].updatedAt = now;
      }
      await this._refreshSummary();
      return { success: true };
    },

    // --------------------------------------------------------
    // 标记死亡
    // --------------------------------------------------------
    async markAsDead(id, deathData = {}) {
      const idx = this.list.findIndex(item => item.id === Number(id));
      if (idx >= 0) {
        const now = new Date().toISOString().split('T')[0];
        this.list[idx].currentStatus = '死亡';
        this.list[idx].statusDate = now;
        this.list[idx].deathCause = deathData.deathCause || '';
        this.list[idx].healthStatus = '死亡';
        this.list[idx].updatedAt = now;
      }
      await this._refreshSummary();
      return { success: true };
    },

    // --------------------------------------------------------
    // 获取存栏统计汇总
    // --------------------------------------------------------
    async fetchSummary() {
      await this._refreshSummary();
      return this.summary;
    },

    // --------------------------------------------------------
    // 内部：刷新统计数据
    // --------------------------------------------------------
    async _refreshSummary() {
      const totalCount = this.list.length;
      const aliveCount = this.list.filter(item => item.currentStatus === '存栏').length;
      const soldCount = this.list.filter(item => item.currentStatus === '出栏').length;
      const deadCount = this.list.filter(item => item.currentStatus === '死亡').length;
      const totalValue = this.list
        .filter(item => item.currentStatus === '存栏')
        .reduce((sum, item) => sum + (Number(item.purchasePrice) || 0), 0);

      // 按种类分组
      const catMap = {};
      this.list.forEach(item => {
        if (!catMap[item.category]) {
          catMap[item.category] = { category: item.category, count: 0, alive: 0, value: 0 };
        }
        catMap[item.category].count++;
        if (item.currentStatus === '存栏') {
          catMap[item.category].alive++;
          catMap[item.category].value += Number(item.purchasePrice) || 0;
        }
      });

      this.summary = {
        totalCount,
        aliveCount,
        soldCount,
        deadCount,
        totalValue,
        byCategory: Object.values(catMap)
      };
    },

    // --------------------------------------------------------
    // 重置筛选条件
    // --------------------------------------------------------
    resetFilters() {
      this.filters = {
        keyword: '',
        category: '',
        status: '',
        source: '',
        page: 1,
        pageSize: 20
      };
    }
  }
});
