"use strict";
const { useLivestockStore } = require('../../../store/modules/livestock');
const { useAgriTaxStore } = require('../../../store/modules/agri-tax');

Component({
  data: {
    summary: { aliveCount: 0, soldCount: 0, deadCount: 0, totalValue: 0, byCategory: [] },
    recentList: [],
    policies: [
      { id: 1, text: '自产农产品销售免征增值税（增值税暂行条例第十五条）' },
      { id: 2, text: '牲畜、家禽饲养所得免征企业所得税（企业所得税法实施条例第八十六条）' },
      { id: 3, text: '内蒙古农牧户经营所得个人所得税优惠（年应纳税所得≤12万免征）' },
      { id: 4, text: '农产品初加工服务所得免征企业所得税' }
    ],
    loading: true
  },

  methods: {
    async onShow() {
      const livestockStore = useLivestockStore();
      const agriTaxStore = useAgriTaxStore();
      await livestockStore.fetchList();
      await livestockStore.fetchSummary();
      await agriTaxStore.fetchQuota();
      const summary = livestockStore.summary;
      const recentList = livestockStore.list.slice(0, 5).map(function(item) {
        var title, amount, amountClass, dotClass;
        if (item.currentStatus === '存栏') {
          title = '新增' + item.category + ' - ' + (item.breed || item.livestockNo);
          amount = '¥' + (item.purchasePrice || 0);
          amountClass = 'text-warning'; dotClass = 'alive';
        } else if (item.currentStatus === '出栏') {
          title = item.category + '出栏 - ' + (item.breed || item.livestockNo);
          amount = '+¥' + (item.salePrice || 0);
          amountClass = 'text-success'; dotClass = 'sold';
        } else {
          title = item.category + '死亡 - ' + (item.breed || item.livestockNo);
          amount = '-' + (item.deathCause || '未知原因');
          amountClass = 'text-danger'; dotClass = 'dead';
        }
        return { id: item.id, title: title, amount: amount, amountClass: amountClass, dotClass: dotClass, time: item.updatedAt };
      });
      this.setData({ summary: summary, recentList: recentList, loading: false });
    },

    formatK: function(val) {
      if (!val) return '0';
      if (val >= 10000) return (val / 10000).toFixed(1) + '万';
      return Number(val).toLocaleString();
    },

    goLivestock: function() { wx.navigateTo({ url: '/subpkg-agri/pages/livestock/index/index' }); },
    goTaxExemption: function() { wx.navigateTo({ url: '/subpkg-agri/pages/tax-exemption/index/index' }); },
    goAddLivestock: function() { wx.navigateTo({ url: '/subpkg-agri/pages/livestock/form/form' }); },
    goQuickCalc: function() { wx.navigateTo({ url: '/subpkg-agri/pages/tax-exemption/index/index' }); }
  }
});
