"use strict";
const { useLivestockStore } = require('../../../../store/modules/livestock');

Component({
  data: {
    keyword: '',
    activeCategory: '',
    activeStatus: '',
    categories: ['牛', '羊', '马', '骆驼', '猪'],
    statuses: ['存栏', '出栏', '死亡', '丢失'],
    loading: true,
    filteredList: [],
    filteredTotal: 0,
    pagedList: [],
    summary: { aliveCount: 0, soldCount: 0, deadCount: 0 },
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  methods: {
    async onShow() {
      var store = useLivestockStore();
      await store.fetchList();
      await store.fetchSummary();
      this._applyFilters();
      this.setData({ summary: store.summary, loading: false });
    },

    onSearchInput: function(e) {
      this.setData({ keyword: e.detail.value });
      this._applyFilters();
    },

    onFilterCategory: function(e) {
      this.setData({ activeCategory: e.currentTarget.dataset.category, page: 1 });
      this._applyFilters();
    },

    onFilterStatus: function(e) {
      this.setData({ activeStatus: e.currentTarget.dataset.status, page: 1 });
      this._applyFilters();
    },

    loadMore: function() {
      if (!this.data.hasMore) return;
      this.setData({ page: this.data.page + 1 });
      this._paginate();
    },

    goDetail: function(e) {
      wx.navigateTo({ url: '/subpkg-agri/pages/livestock/detail/detail?id=' + e.currentTarget.dataset.id });
    },

    goAdd: function() {
      wx.navigateTo({ url: '/subpkg-agri/pages/livestock/form/form' });
    },

    _applyFilters: function() {
      var store = useLivestockStore();
      var list = store.list.slice();
      var kw = this.data.keyword.toLowerCase();
      if (kw) {
        list = list.filter(function(item) {
          return (item.livestockNo && item.livestockNo.toLowerCase().indexOf(kw) >= 0) ||
                 (item.breed && item.breed.toLowerCase().indexOf(kw) >= 0) ||
                 (item.purchaseFrom && item.purchaseFrom.toLowerCase().indexOf(kw) >= 0);
        });
      }
      if (this.data.activeCategory) {
        list = list.filter(function(item) { return item.category === this.data.activeCategory; }.bind(this));
      }
      if (this.data.activeStatus) {
        list = list.filter(function(item) { return item.currentStatus === this.data.activeStatus; }.bind(this));
      }
      this.setData({ filteredList: list, filteredTotal: list.length, page: 1, hasMore: list.length > this.data.pageSize });
      this._paginate();
    },

    _paginate: function() {
      var end = this.data.page * this.data.pageSize;
      this.setData({
        pagedList: this.data.filteredList.slice(0, end),
        hasMore: end < this.data.filteredList.length
      });
    }
  }
});
