"use strict";
const { useLivestockStore } = require('../../../../store/modules/livestock');

Component({
  data: {
    isEdit: false,
    editId: null,
    currentItem: null,
    categories: ['牛', '羊', '马', '骆驼', '猪'],
    sources: ['购入', '自繁', '赠予', '其他'],
    healthStatuses: ['健康', '观察', '治疗中'],
    sourceIndex: 0,
    todayStr: '',
    form: {
      livestockNo: '', category: '牛', breed: '', gender: 0,
      birthDate: '', source: '购入', purchasePrice: '', purchaseDate: '',
      purchaseFrom: '', weightKg: '', feedType: '', vaccination: '',
      healthStatus: '健康', notes: ''
    },
    canSubmit: false
  },

  methods: {
    onLoad: function(options) {
      var today = new Date();
      var ts = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
      this.setData({ todayStr: ts });
      if (options && options.id) {
        this.setData({ isEdit: true, editId: Number(options.id) });
        this._loadItem(Number(options.id));
      }
    },

    async _loadItem(id) {
      var store = useLivestockStore();
      await store.fetchList();
      var item = store.list.find(function(t) { return t.id === id; });
      if (item) {
        var srcIdx = ['购入', '自繁', '赠予', '其他'].indexOf(item.source || '购入');
        this.setData({
          currentItem: item,
          sourceIndex: srcIdx >= 0 ? srcIdx : 0,
          form: {
            livestockNo: item.livestockNo || '', category: item.category || '牛',
            breed: item.breed || '', gender: item.gender !== undefined ? item.gender : 0,
            birthDate: item.birthDate || '', source: item.source || '购入',
            purchasePrice: item.purchasePrice ? String(item.purchasePrice) : '',
            purchaseDate: item.purchaseDate || '', purchaseFrom: item.purchaseFrom || '',
            weightKg: item.weightKg ? String(item.weightKg) : '', feedType: item.feedType || '',
            vaccination: item.vaccination || '', healthStatus: item.healthStatus || '健康',
            notes: item.notes || ''
          }
        });
        this._checkCanSubmit();
      }
    },

    onFieldInput: function(e) {
      var field = e.currentTarget.dataset.field;
      var d = {}; d['form.' + field] = e.detail.value;
      this.setData(d);
      this._checkCanSubmit();
    },

    onCategorySelect: function(e) {
      this.setData({ 'form.category': e.currentTarget.dataset.value });
      this._checkCanSubmit();
    },

    onGenderSelect: function(e) {
      this.setData({ 'form.gender': Number(e.currentTarget.dataset.value) });
    },

    onSourceChange: function(e) {
      var idx = Number(e.detail.value);
      this.setData({ 'form.source': this.data.sources[idx], sourceIndex: idx });
    },

    onDateChange: function(e) {
      var field = e.currentTarget.dataset.field;
      var d = {}; d['form.' + field] = e.detail.value;
      this.setData(d);
    },

    onHealthSelect: function(e) {
      this.setData({ 'form.healthStatus': e.currentTarget.dataset.value });
    },

    _checkCanSubmit: function() {
      var f = this.data.form;
      this.setData({ canSubmit: !!(f.livestockNo.trim() && f.category) });
    },

    async onSubmit() {
      var f = this.data.form;
      if (!f.livestockNo.trim()) { wx.showToast({ title: '请输入牲畜编号', icon: 'none' }); return; }
      if (!f.category) { wx.showToast({ title: '请选择牲畜种类', icon: 'none' }); return; }
      var store = useLivestockStore();
      var data = {
        livestockNo: f.livestockNo.trim(), category: f.category, breed: f.breed.trim(),
        gender: f.gender, birthDate: f.birthDate, source: f.source,
        purchasePrice: Number(f.purchasePrice) || 0, purchaseDate: f.purchaseDate,
        purchaseFrom: f.purchaseFrom.trim(), weightKg: Number(f.weightKg) || null,
        feedType: f.feedType.trim(), vaccination: f.vaccination.trim(),
        healthStatus: f.healthStatus, notes: f.notes.trim()
      };
      try {
        if (this.data.isEdit) { await store.update(this.data.editId, data); wx.showToast({ title: '保存成功', icon: 'success' }); }
        else { await store.create(data); wx.showToast({ title: '登记成功', icon: 'success' }); }
        setTimeout(function() { wx.navigateBack(); }, 1500);
      } catch (err) { wx.showToast({ title: '操作失败，请重试', icon: 'none' }); }
    },

    onMarkSold: function() {
      var that = this;
      if (!this.data.currentItem || this.data.currentItem.currentStatus !== '存栏') return;
      wx.showModal({
        title: '标记出栏', content: '确认将此牲畜标记为出栏？请确保已填写出栏信息。',
        editable: true, placeholderText: '出栏售价（元）',
        success: async function(res) {
          if (res.confirm) {
            var salePrice = parseFloat(res.content) || 0;
            var store = useLivestockStore();
            await store.markAsSold(that.data.editId, { salePrice: salePrice, saleDate: that.data.todayStr });
            wx.showToast({ title: '已标记出栏', icon: 'success' });
            setTimeout(function() { wx.navigateBack(); }, 1500);
          }
        }
      });
    }
  }
});
