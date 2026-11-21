"use strict";
const { useLivestockStore } = require('../../../../store/modules/livestock');

Component({
  data: { item: null, loading: true },

  methods: {
    async onLoad(options) {
      if (!options || !options.id) {
        wx.showToast({ title: '参数错误', icon: 'none' });
        setTimeout(function() { wx.navigateBack(); }, 1500);
        return;
      }
      var store = useLivestockStore();
      var item = await store.fetchDetail(Number(options.id));
      if (!item) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        setTimeout(function() { wx.navigateBack(); }, 1500);
        return;
      }
      this.setData({ item: item, loading: false });
    },

    async onShow() {
      if (this.data.item) {
        var store = useLivestockStore();
        var item = await store.fetchDetail(this.data.item.id);
        if (item) this.setData({ item: item });
      }
    },

    goEdit: function() {
      wx.navigateTo({ url: '/subpkg-agri/pages/livestock/form/form?id=' + this.data.item.id });
    },

    onSoldClick: function() {
      var that = this;
      var item = this.data.item;
      wx.showModal({
        title: '标记出栏',
        content: '确认将 ' + (item.breed || item.livestockNo) + ' 标记为出栏？',
        editable: true, placeholderText: '出栏售价（元）',
        success: async function(res) {
          if (res.confirm) {
            var salePrice = parseFloat(res.content) || 0;
            var store = useLivestockStore();
            await store.markAsSold(item.id, { salePrice: salePrice, saleDate: new Date().toISOString().split('T')[0] });
            var updated = await store.fetchDetail(item.id);
            that.setData({ item: updated });
            wx.showToast({ title: '已标记出栏', icon: 'success' });
          }
        }
      });
    },

    onDeadClick: function() {
      var that = this;
      var item = this.data.item;
      wx.showModal({
        title: '标记死亡',
        content: '确认将 ' + (item.breed || item.livestockNo) + ' 标记为死亡？请填写死亡原因。',
        editable: true, placeholderText: '死亡原因（如：疾病、自然灾害等）',
        success: async function(res) {
          if (res.confirm) {
            var deathCause = res.content || '未记录原因';
            var store = useLivestockStore();
            await store.markAsDead(item.id, { deathCause: deathCause });
            var updated = await store.fetchDetail(item.id);
            that.setData({ item: updated });
            wx.showToast({ title: '已标记死亡', icon: 'success' });
          }
        }
      });
    },

    onDeleteClick: function() {
      var that = this;
      var item = this.data.item;
      wx.showModal({
        title: '确认删除', confirmColor: '#FA5151',
        content: '删除后将无法恢复，确认删除 ' + (item.breed || item.livestockNo) + ' 的记录？',
        success: async function(res) {
          if (res.confirm) {
            var store = useLivestockStore();
            await store.delete(item.id);
            wx.showToast({ title: '已删除', icon: 'success' });
            setTimeout(function() { wx.navigateBack(); }, 1500);
          }
        }
      });
    }
  }
});
