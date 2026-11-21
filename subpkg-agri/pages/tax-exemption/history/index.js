"use strict";
const { useAgriTaxStore } = require('../../../../store/modules/agri-tax');

Component({
  data: {
    filterPeriod: '', filterTaxType: '', filterStatus: '',
    taxTypes: ['增值税', '企业所得税', '个人所得税', '附加税'],
    loading: true, allRecords: [], filteredRecords: [], totalExempted: '0.00'
  },

  methods: {
    async onShow() {
      this.setData({ loading: true });
      var store = useAgriTaxStore();
      await store.fetchRecords();
      this.setData({ allRecords: store.records });
      this._applyFilters();
      this.setData({ loading: false });
    },

    onPeriodFilterChange: function(e) {
      this.setData({ filterPeriod: e.detail.value });
      this._applyFilters();
    },

    onTaxTypeFilter: function(e) {
      this.setData({ filterTaxType: e.currentTarget.dataset.value });
      this._applyFilters();
    },

    onStatusFilter: function(e) {
      this.setData({ filterStatus: e.currentTarget.dataset.value });
      this._applyFilters();
    },

    goDetail: function(e) {
      wx.navigateTo({ url: '/subpkg-agri/pages/tax-exemption/index/index?id=' + e.currentTarget.dataset.id });
    },

    goCalc: function() {
      wx.navigateTo({ url: '/subpkg-agri/pages/tax-exemption/index/index' });
    },

    _applyFilters: function() {
      var list = this.data.allRecords.slice();
      if (this.data.filterPeriod) {
        list = list.filter(function(r) { return r.recordPeriod === this.data.filterPeriod; }.bind(this));
      }
      if (this.data.filterTaxType) {
        list = list.filter(function(r) { return r.taxType === this.data.filterTaxType; }.bind(this));
      }
      if (this.data.filterStatus) {
        list = list.filter(function(r) { return r.status === this.data.filterStatus; }.bind(this));
      }
      list.sort(function(a, b) { return b.recordPeriod.localeCompare(a.recordPeriod); });
      var total = list.reduce(function(sum, r) { return sum + (Number(r.taxExempted) || 0); }, 0);
      this.setData({
        filteredRecords: list,
        totalExempted: total.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      });
    }
  }
});
