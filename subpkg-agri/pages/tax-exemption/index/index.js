"use strict";
const { useAgriTaxStore } = require('../../../../store/modules/agri-tax');

Component({
  data: {
    calcPeriod: '',
    calcTaxType: '增值税',
    taxTypes: ['增值税', '企业所得税', '个人所得税', '附加税'],
    calculating: false,
    result: null,
    quota: null
  },

  methods: {
    async onShow() {
      var store = useAgriTaxStore();
      await store.fetchRules();
      await store.fetchRecords();
      var now = new Date();
      var period = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      var quota = await store.fetchQuota(period);
      this.setData({ calcPeriod: period, quota: quota });
    },

    onPeriodChange: function(e) {
      this.setData({ calcPeriod: e.detail.value });
    },

    onTaxTypeSelect: function(e) {
      this.setData({ calcTaxType: e.currentTarget.dataset.value });
    },

    async onCalculate() {
      if (!this.data.calcPeriod) {
        wx.showToast({ title: '请选择核算周期', icon: 'none' });
        return;
      }
      this.setData({ calculating: true });
      var store = useAgriTaxStore();
      try {
        var result = await store.calculate({
          period: this.data.calcPeriod, taxType: this.data.calcTaxType, forceRefresh: true
        });
        this.setData({ result: result, calculating: false });
        var quota = await store.fetchQuota(this.data.calcPeriod);
        this.setData({ quota: quota });
      } catch (err) {
        this.setData({ calculating: false });
        wx.showToast({ title: '核算失败，请重试', icon: 'none' });
      }
    },

    onConfirm: function() {
      var that = this;
      if (!this.data.result) return;
      wx.showModal({
        title: '确认核算结果',
        content: '确认后将锁定核算数据并生成正式台账记录。',
        success: async function(res) {
          if (res.confirm) {
            var store = useAgriTaxStore();
            await store.confirmRecord(that.data.result.id);
            that.setData({ 'result.status': 'confirmed' });
            wx.showToast({ title: '核算已确认', icon: 'success' });
          }
        }
      });
    },

    onDeclare: function() {
      var that = this;
      if (!this.data.result || this.data.result.status !== 'confirmed') return;
      wx.showModal({
        title: '推送至税务申报',
        content: '确认将核算结果推送至税务申报系统？推送后可在"财税→税务申报"中查看。',
        success: async function(res) {
          if (res.confirm) {
            var store = useAgriTaxStore();
            await store.submitToDeclaration(that.data.result.id);
            that.setData({
              'result.status': 'declared',
              'result.declaredAt': new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
            wx.showToast({ title: '已推送至申报系统', icon: 'success' });
          }
        }
      });
    },

    onRecalculate: function() {
      this.setData({ result: null });
    },

    formatNum: function(val) {
      if (val === null || val === undefined) return '0';
      return Number(val).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
});
