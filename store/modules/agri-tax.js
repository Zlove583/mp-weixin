/**
 * 自产农产品免税自动核算 Store 模块
 * 适配内蒙古北疆农牧税务政策
 *
 * 功能：
 * - 基于销售数据自动匹配地方免税政策规则
 * - 自动核算免税金额、应税金额、免税额度
 * - 生成明细台账、核算报表
 * - 支持按年月查询核算记录
 * - 对接原有申报功能
 *
 * @module store/modules/agri-tax
 */

const { defineStore } = require('../../common/vendor.js');

// ============================================================
// Mock 免税政策规则数据
// 基于内蒙古北疆地区实际政策
// ============================================================
const MOCK_RULES = [
  {
    id: 1,
    ruleCode: 'NMG-VAT-001',
    ruleName: '自产农产品免征增值税',
    taxType: '增值税',
    productCategory: '*',
    exemptionType: 'full',
    exemptionRate: 1.0,
    exemptionLimit: null,
    limitPeriod: null,
    region: '内蒙古',
    legalBasis: '《中华人民共和国增值税暂行条例》第十五条第一款',
    isActive: true
  },
  {
    id: 2,
    ruleCode: 'NMG-CIT-001',
    ruleName: '畜牧业养殖所得免征企业所得税',
    taxType: '企业所得税',
    productCategory: '牛,羊,马,骆驼,猪,鸡,鸭,鹅',
    exemptionType: 'full',
    exemptionRate: 1.0,
    exemptionLimit: null,
    limitPeriod: null,
    region: '内蒙古',
    legalBasis: '《企业所得税法》第二十七条、实施条例第八十六条',
    isActive: true
  },
  {
    id: 3,
    ruleCode: 'NMG-CIT-002',
    ruleName: '农产品初加工所得免征企业所得税',
    taxType: '企业所得税',
    productCategory: '肉类,奶类,皮毛,蛋类',
    exemptionType: 'full',
    exemptionRate: 1.0,
    exemptionLimit: null,
    limitPeriod: null,
    region: '内蒙古',
    legalBasis: '《企业所得税法实施条例》第八十六条',
    isActive: true
  },
  {
    id: 4,
    ruleCode: 'NMG-IIT-001',
    ruleName: '农牧户个体经营所得个人所得税优惠',
    taxType: '个人所得税',
    productCategory: '*',
    exemptionType: 'threshold',
    exemptionRate: 1.0,
    exemptionLimit: 120000,
    limitPeriod: 'yearly',
    region: '内蒙古',
    legalBasis: '内蒙古自治区人民政府关于促进农牧民增收的若干税收优惠政策',
    isActive: true
  },
  {
    id: 5,
    ruleCode: 'NMG-SUR-001',
    ruleName: '随增值税免征附加税费',
    taxType: '附加税',
    productCategory: '*',
    exemptionType: 'full',
    exemptionRate: 1.0,
    exemptionLimit: null,
    limitPeriod: null,
    region: '内蒙古',
    legalBasis: '《城市维护建设税法》、《征收教育费附加的暂行规定》',
    isActive: true
  }
];

// ============================================================
// Mock 核算记录
// ============================================================
function generateMockRecords() {
  const now = new Date();
  const months = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  const records = [];
  let idCounter = 1;

  months.forEach(period => {
    // 增值税记录
    const vatSales = Math.round(50000 + Math.random() * 150000);
    const vatRate = 0.09; // 农产品增值税率9%
    const vatTaxable = Math.round(vatSales * 0.09);
    const vatTax = Math.round(vatTaxable * vatRate * 100) / 100;

    records.push({
      id: idCounter++,
      recordNo: 'NMG-TAX-' + period.replace('-', '') + '-' + String(idCounter).padStart(4, '0'),
      recordPeriod: period,
      taxType: '增值税',
      productCategory: '牛,羊',
      totalSalesAmount: vatSales,
      taxableAmount: 0,
      exemptionAmount: vatSales,
      taxRate: vatRate,
      taxPayable: vatTax,
      taxExempted: vatTax,
      actualTax: 0,
      appliedRuleIds: [1],
      appliedRuleSnapshot: MOCK_RULES[0],
      status: i === 0 ? 'draft' : 'confirmed',
      declaredAt: i > 0 ? period + '-20' : null,
      notes: '自产牛羊肉销售，全额免征增值税',
      createdAt: period + '-05',
      updatedAt: period + '-05'
    });

    // 企业所得税记录
    const citIncome = Math.round(300000 + Math.random() * 500000);
    records.push({
      id: idCounter++,
      recordNo: 'NMG-TAX-' + period.replace('-', '') + '-' + String(idCounter).padStart(4, '0'),
      recordPeriod: period,
      taxType: '企业所得税',
      productCategory: '牛,羊,马',
      totalSalesAmount: citIncome,
      taxableAmount: 0,
      exemptionAmount: citIncome,
      taxRate: 0.25,
      taxPayable: Math.round(citIncome * 0.25 * 100) / 100,
      taxExempted: Math.round(citIncome * 0.25 * 100) / 100,
      actualTax: 0,
      appliedRuleIds: [2, 3],
      appliedRuleSnapshot: { rules: [MOCK_RULES[1], MOCK_RULES[2]] },
      status: i === 0 ? 'draft' : 'confirmed',
      declaredAt: i > 0 ? period + '-22' : null,
      notes: '畜牧业养殖所得全额免征企业所得税',
      createdAt: period + '-08',
      updatedAt: period + '-08'
    });
  });

  return records;
}

// ============================================================
// 核心核算引擎（前端Mock版）
// ============================================================
function calculateExemption(salesData, rules) {
  const results = {
    totalSalesAmount: 0,
    taxableAmount: 0,
    exemptionAmount: 0,
    taxRate: 0,
    taxPayable: 0,
    taxExempted: 0,
    actualTax: 0,
    appliedRules: [],
    calculationLog: []
  };

  // 汇总销售数据
  results.totalSalesAmount = salesData.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  results.calculationLog.push({
    step: '销售数据汇总',
    detail: '汇总当期农产品销售收入',
    value: results.totalSalesAmount
  });

  // 匹配适用规则
  const applicableRules = rules.filter(rule => rule.isActive);
  results.calculationLog.push({
    step: '规则匹配',
    detail: '匹配到' + applicableRules.length + '条有效免税规则',
    rules: applicableRules.map(r => r.ruleCode)
  });

  // 按优先级执行规则
  applicableRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));

  let remainingAmount = results.totalSalesAmount;

  applicableRules.forEach(rule => {
    if (remainingAmount <= 0) return;

    let ruleExemptedAmount = 0;

    switch (rule.exemptionType) {
      case 'full':
        // 全额免税
        ruleExemptedAmount = remainingAmount;
        break;

      case 'partial':
        // 部分免税
        ruleExemptedAmount = remainingAmount * (rule.exemptionRate || 0);
        break;

      case 'threshold':
        // 额度内免税
        const limit = rule.exemptionLimit || 0;
        ruleExemptedAmount = Math.min(remainingAmount, limit);
        break;
    }

    results.exemptionAmount += ruleExemptedAmount;
    remainingAmount -= ruleExemptedAmount;

    if (ruleExemptedAmount > 0) {
      results.appliedRules.push({
        ruleCode: rule.ruleCode,
        ruleName: rule.ruleName,
        exemptionRate: rule.exemptionRate,
        exemptedAmount: ruleExemptedAmount,
        legalBasis: rule.legalBasis
      });
    }

    results.calculationLog.push({
      step: '应用规则: ' + rule.ruleCode,
      ruleName: rule.ruleName,
      exemptionType: rule.exemptionType,
      exemptedAmount: ruleExemptedAmount,
      remainingAfter: remainingAmount
    });
  });

  // 计算应税金额
  results.taxableAmount = remainingAmount;

  // 根据税种确定税率
  // 增值税：农产品9%，小规模纳税人3%
  // 企业所得税：25%
  // 个人所得税：累进税率简化按5%估算
  const taxType = salesData[0]?.taxType || '增值税';
  switch (taxType) {
    case '增值税':
      results.taxRate = 0.09;
      break;
    case '企业所得税':
      results.taxRate = 0.25;
      break;
    case '个人所得税':
      results.taxRate = 0.05;
      break;
    default:
      results.taxRate = 0.09;
  }

  results.taxPayable = Math.round(results.taxableAmount * results.taxRate * 100) / 100;
  results.taxExempted = Math.round(results.exemptionAmount * results.taxRate * 100) / 100;
  results.actualTax = Math.round(Math.max(0, results.taxPayable - results.taxExempted) * 100) / 100;

  results.calculationLog.push({
    step: '计算完成',
    totalSales: results.totalSalesAmount,
    taxableAmount: results.taxableAmount,
    exemptionAmount: results.exemptionAmount,
    taxRate: results.taxRate,
    taxPayable: results.taxPayable,
    taxExempted: results.taxExempted,
    actualTax: results.actualTax
  });

  return results;
}

// ============================================================
// Pinia Store 定义
// ============================================================
exports.useAgriTaxStore = defineStore('agriTax', {
  // ==========================================
  // State
  // ==========================================
  state: () => ({
    rules: [],
    records: [],
    currentRecord: null,
    loading: false,
    summary: {
      totalSales: 0,
      totalExemption: 0,
      totalTaxSaved: 0,
      byPeriod: []
    },
    quota: {
      totalLimit: 120000,
      usedAmount: 0,
      remaining: 120000,
      period: ''
    },
    filters: {
      period: '',
      taxType: '',
      status: '',
      page: 1,
      pageSize: 20
    },
    // 核算结果缓存（内存中暂存，避免重复计算）
    calculationCache: {}
  }),

  // ==========================================
  // Getters
  // ==========================================
  getters: {
    /**
     * 可用免税规则列表
     */
    activeRules: state => state.rules.filter(r => r.isActive),

    /**
     * 按税种分组的规则
     */
    rulesByTaxType: state => {
      const map = {};
      state.rules.forEach(r => {
        if (!map[r.taxType]) map[r.taxType] = [];
        map[r.taxType].push(r);
      });
      return map;
    },

    /**
     * 已确认的核算记录
     */
    confirmedRecords: state => state.records.filter(r => r.status === 'confirmed'),

    /**
     * 草稿核算记录
     */
    draftRecords: state => state.records.filter(r => r.status === 'draft'),

    /**
     * 本月累计免税金额
     */
    monthExemptionTotal: state => {
      const now = new Date();
      const thisMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      return state.records
        .filter(r => r.recordPeriod === thisMonth && r.status !== 'draft')
        .reduce((sum, r) => sum + (Number(r.taxExempted) || 0), 0);
    },

    /**
     * 本年累计免税金额
     */
    yearExemptionTotal: state => {
      const year = new Date().getFullYear();
      return state.records
        .filter(r => r.recordPeriod.startsWith(String(year)) && r.status !== 'draft')
        .reduce((sum, r) => sum + (Number(r.taxExempted) || 0), 0);
    }
  },

  // ==========================================
  // Actions
  // ==========================================
  actions: {
    // --------------------------------------------------------
    // 获取免税政策规则
    // --------------------------------------------------------
    async fetchRules() {
      if (this.rules.length === 0) {
        this.rules = MOCK_RULES;
      }
      return this.rules;
    },

    // --------------------------------------------------------
    // 执行免税核算
    // --------------------------------------------------------
    async calculate(params = {}) {
      this.loading = true;
      const period = params.period || (
        new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0')
      );
      const taxType = params.taxType || '增值税';

      // 检查缓存
      const cacheKey = period + '_' + taxType;
      if (this.calculationCache[cacheKey] && !params.forceRefresh) {
        this.currentRecord = this.calculationCache[cacheKey];
        this.loading = false;
        return this.currentRecord;
      }

      // 确保规则已加载
      await this.fetchRules();

      // Mock 销售数据（实际应从 accounting store 或 API 获取）
      const mockSalesData = [
        { id: 1, productName: '活牛（西门塔尔）', category: '牛', amount: 120000, date: period + '-05', taxType },
        { id: 2, productName: '活羊（蒙古羊）', category: '羊', amount: 45000, date: period + '-10', taxType },
        { id: 3, productName: '羊肉（冷冻分割）', category: '肉类', amount: 28000, date: period + '-15', taxType },
        { id: 4, productName: '牛皮（盐渍）', category: '皮毛', amount: 8500, date: period + '-18', taxType },
        { id: 5, productName: '鲜牛奶', category: '奶类', amount: 36000, date: period + '-22', taxType }
      ];

      // 筛选匹配品类的规则
      const relevantRules = this.rules.filter(rule => {
        if (rule.taxType !== taxType) return false;
        if (rule.productCategory === '*') return true;
        // 简化匹配逻辑：检查销售数据品类是否在规则涵盖范围内
        return true; // 对于Demo，所有规则都适用
      });

      // 执行核算
      const calcResult = calculateExemption(mockSalesData, relevantRules);

      // 生成核算记录编号
      const recordCount = this.records.length + 1;
      const recordNo = 'NMG-TAX-' + period.replace('-', '') + '-' + String(recordCount).padStart(4, '0');

      // 构建完整核算记录
      const record = {
        id: this.records.length > 0 ? Math.max(...this.records.map(r => r.id)) + 1 : 1,
        recordNo,
        recordPeriod: period,
        taxType,
        productCategory: '牛,羊,肉类,皮毛,奶类',
        totalSalesAmount: calcResult.totalSalesAmount,
        taxableAmount: calcResult.taxableAmount,
        exemptionAmount: calcResult.exemptionAmount,
        taxRate: calcResult.taxRate,
        taxPayable: calcResult.taxPayable,
        taxExempted: calcResult.taxExempted,
        actualTax: calcResult.actualTax,
        appliedRuleIds: calcResult.appliedRules.map(r => {
          const found = this.rules.find(rr => rr.ruleCode === r.ruleCode);
          return found ? found.id : null;
        }).filter(Boolean),
        appliedRuleSnapshot: { rules: calcResult.appliedRules },
        salesDetailIds: mockSalesData.map(s => s.id),
        calculationLog: calcResult.calculationLog,
        status: 'draft',
        declaredAt: null,
        notes: '',
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      };

      // 缓存结果
      this.calculationCache[cacheKey] = record;
      this.currentRecord = record;

      // 检查是否已存在同周期同税种记录，如果存在则替换
      const existIdx = this.records.findIndex(r => r.recordPeriod === period && r.taxType === taxType);
      if (existIdx >= 0) {
        record.id = this.records[existIdx].id;
        this.records[existIdx] = record;
      } else {
        this.records.unshift(record);
      }

      this.loading = false;
      return record;
    },

    // --------------------------------------------------------
    // 获取核算记录列表
    // --------------------------------------------------------
    async fetchRecords(params = {}) {
      this.loading = true;
      if (this.records.length === 0) {
        this.records = generateMockRecords();
      }
      if (params.period !== undefined) this.filters.period = params.period;
      if (params.taxType !== undefined) this.filters.taxType = params.taxType;
      if (params.status !== undefined) this.filters.status = params.status;
      await new Promise(resolve => setTimeout(resolve, 150));
      this.loading = false;
      return this.records;
    },

    // --------------------------------------------------------
    // 获取核算记录详情
    // --------------------------------------------------------
    async fetchRecordDetail(id) {
      let record = this.records.find(r => r.id === Number(id));
      if (!record && this.records.length === 0) {
        await this.fetchRecords();
        record = this.records.find(r => r.id === Number(id));
      }
      this.currentRecord = record || null;
      return this.currentRecord;
    },

    // --------------------------------------------------------
    // 确认核算结果
    // --------------------------------------------------------
    async confirmRecord(id) {
      const idx = this.records.findIndex(r => r.id === Number(id));
      if (idx >= 0) {
        this.records[idx].status = 'confirmed';
        this.records[idx].updatedAt = new Date().toISOString().split('T')[0];
      }
      if (this.currentRecord && this.currentRecord.id === Number(id)) {
        this.currentRecord.status = 'confirmed';
      }
      return { success: true };
    },

    // --------------------------------------------------------
    // 提交申报
    // --------------------------------------------------------
    async submitToDeclaration(id) {
      const idx = this.records.findIndex(r => r.id === Number(id));
      if (idx >= 0) {
        this.records[idx].status = 'declared';
        this.records[idx].declaredAt = new Date().toISOString().split('T')[0].replace('T', ' ');
        this.records[idx].updatedAt = new Date().toISOString().split('T')[0];
      }
      return { success: true };
    },

    // --------------------------------------------------------
    // 获取汇总统计数据
    // --------------------------------------------------------
    async fetchSummary() {
      if (this.records.length === 0) {
        await this.fetchRecords();
      }

      const confirmedRecords = this.records.filter(r => r.status !== 'draft');
      this.summary.totalSales = confirmedRecords.reduce((sum, r) => sum + (Number(r.totalSalesAmount) || 0), 0);
      this.summary.totalExemption = confirmedRecords.reduce((sum, r) => sum + (Number(r.exemptionAmount) || 0), 0);
      this.summary.totalTaxSaved = confirmedRecords.reduce((sum, r) => sum + (Number(r.taxExempted) || 0), 0);

      // 按周期分组
      const periodMap = {};
      confirmedRecords.forEach(r => {
        if (!periodMap[r.recordPeriod]) {
          periodMap[r.recordPeriod] = { period: r.recordPeriod, sales: 0, exemption: 0, taxSaved: 0 };
        }
        periodMap[r.recordPeriod].sales += Number(r.totalSalesAmount) || 0;
        periodMap[r.recordPeriod].exemption += Number(r.exemptionAmount) || 0;
        periodMap[r.recordPeriod].taxSaved += Number(r.taxExempted) || 0;
      });
      this.summary.byPeriod = Object.values(periodMap).sort((a, b) => b.period.localeCompare(a.period));

      return this.summary;
    },

    // --------------------------------------------------------
    // 获取免税额度信息
    // --------------------------------------------------------
    async fetchQuota(period) {
      const p = period || (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0'));
      const year = p.split('-')[0];

      // 计算当年已使用额度
      const yearRecords = this.records.filter(r =>
        r.recordPeriod.startsWith(year) && r.status !== 'draft'
      );
      const usedAmount = yearRecords.reduce((sum, r) => sum + (Number(r.exemptionAmount) || 0), 0);

      this.quota = {
        totalLimit: 120000,
        usedAmount: Math.round(usedAmount * 100) / 100,
        remaining: Math.round(Math.max(0, 120000 - usedAmount) * 100) / 100,
        period: p
      };

      return this.quota;
    },

    // --------------------------------------------------------
    // 重置筛选
    // --------------------------------------------------------
    resetFilters() {
      this.filters = {
        period: '',
        taxType: '',
        status: '',
        page: 1,
        pageSize: 20
      };
    },

    // --------------------------------------------------------
    // 清除核算缓存
    // --------------------------------------------------------
    clearCache() {
      this.calculationCache = {};
    }
  }
});
