"use strict";
var userStoreModule = require('../../store/modules/user');

Component({
  data: {
    activeTab: 'wechat',
    avatarUrl: '',
    nickName: '',
    wechatLoading: false,
    phone: '',
    password: '',
    showPassword: false,
    accountLoading: false,
    regPhone: '',
    smsCode: '',
    regPassword: '',
    regPassword2: '',
    smsCountdown: 0,
    registerLoading: false
  },

  methods: {
    onLoad: function() {
      var token = wx.getStorageSync('token');
      if (token) {
        wx.switchTab({ url: '/pages/index/index' });
        return;
      }
      this._getWechatUserInfo();
    },

    // ========== Tab切换 ==========
    switchTab: function(e) {
      var tab = e.currentTarget.dataset.tab;
      this.setData({ activeTab: tab });
      if (tab === 'wechat' && !this.data.nickName) {
        this._getWechatUserInfo();
      }
    },

    // ========== 微信登录 ==========
    _getWechatUserInfo: function() {
      var that = this;
      wx.getSetting({
        success: function(res) {
          if (res.authSetting['scope.userInfo']) {
            wx.getUserInfo({
              success: function(infoRes) {
                that.setData({
                  avatarUrl: infoRes.userInfo.avatarUrl,
                  nickName: infoRes.userInfo.nickName
                });
              }
            });
          }
        }
      });
    },

    handleWechatLogin: function() {
      var that = this;
      this.setData({ wechatLoading: true });

      if (!this.data.nickName) {
        wx.getUserProfile({
          desc: '用于完善用户资料',
          success: function(profileRes) {
            that.setData({
              avatarUrl: profileRes.userInfo.avatarUrl,
              nickName: profileRes.userInfo.nickName
            });
            that._doWechatLogin(profileRes.userInfo);
          },
          fail: function() {
            that.setData({ wechatLoading: false });
            wx.showToast({ title: '需要授权才能登录', icon: 'none' });
          }
        });
      } else {
        this._doWechatLogin();
      }
    },

    _doWechatLogin: function(userInfo) {
      var that = this;
      wx.login({
        success: function(loginRes) {
          if (loginRes.code) {
            var userStore = userStoreModule.useUserStore();
            userStore.loginViaWechat(loginRes.code, userInfo || {
              avatarUrl: that.data.avatarUrl,
              nickName: that.data.nickName
            }).then(function() {
              that.setData({ wechatLoading: false });
              wx.showToast({ title: '登录成功', icon: 'success' });
              setTimeout(function() { wx.switchTab({ url: '/pages/index/index' }); }, 1000);
            }).catch(function() {
              that.setData({ wechatLoading: false });
              wx.showToast({ title: '登录失败，请重试', icon: 'none' });
            });
          } else {
            that.setData({ wechatLoading: false });
          }
        },
        fail: function() {
          that.setData({ wechatLoading: false });
          wx.showToast({ title: '微信登录失败', icon: 'none' });
        }
      });
    },

    // ========== 手机号登录 ==========
    handleGetPhoneNumber: function(e) {
      var that = this;
      if (e.detail.errMsg !== 'getPhoneNumber:ok') {
        wx.showToast({ title: '需要手机号授权', icon: 'none' });
        return;
      }
      this.setData({ wechatLoading: true });
      wx.login({
        success: function(loginRes) {
          if (loginRes.code) {
            var userStore = userStoreModule.useUserStore();
            userStore.loginViaPhone(loginRes.code, e.detail.encryptedData, e.detail.iv).then(function() {
              that.setData({ wechatLoading: false });
              wx.showToast({ title: '登录成功', icon: 'success' });
              setTimeout(function() { wx.switchTab({ url: '/pages/index/index' }); }, 1000);
            }).catch(function() {
              that.setData({ wechatLoading: false });
              wx.showToast({ title: '登录失败', icon: 'none' });
            });
          }
        }
      });
    },

    // ========== 账号密码登录 ==========
    onPhoneInput: function(e) { this.setData({ phone: e.detail.value }); },
    onPasswordInput: function(e) { this.setData({ password: e.detail.value }); },
    togglePassword: function() { this.setData({ showPassword: !this.data.showPassword }); },

    handleAccountLogin: function() {
      var phone = this.data.phone.trim();
      var password = this.data.password;
      if (!phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!/^1[3-9]\d{9}$/.test(phone)) { wx.showToast({ title: '手机号格式不正确', icon: 'none' }); return; }
      if (!password) { wx.showToast({ title: '请输入密码', icon: 'none' }); return; }
      if (password.length < 6) { wx.showToast({ title: '密码至少6位', icon: 'none' }); return; }

      var that = this;
      this.setData({ accountLoading: true });
      var userStore = userStoreModule.useUserStore();
      userStore.loginViaAccount(phone, password).then(function() {
        that.setData({ accountLoading: false });
        wx.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(function() { wx.switchTab({ url: '/pages/index/index' }); }, 1000);
      }).catch(function(err) {
        that.setData({ accountLoading: false });
        wx.showToast({ title: err.message || '登录失败', icon: 'none' });
      });
    },

    // ========== 注册 ==========
    onRegPhoneInput: function(e) { this.setData({ regPhone: e.detail.value }); },
    onSmsCodeInput: function(e) { this.setData({ smsCode: e.detail.value }); },
    onRegPasswordInput: function(e) { this.setData({ regPassword: e.detail.value }); },
    onRegPassword2Input: function(e) { this.setData({ regPassword2: e.detail.value }); },

    sendSmsCode: function() {
      if (this.data.smsCountdown > 0) return;
      var phone = this.data.regPhone.trim();
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
        return;
      }
      wx.showToast({ title: '验证码已发送', icon: 'success' });
      this.setData({ smsCountdown: 60 });
      var that = this;
      var timer = setInterval(function() {
        if (that.data.smsCountdown <= 1) {
          clearInterval(timer);
          that.setData({ smsCountdown: 0 });
        } else {
          that.setData({ smsCountdown: that.data.smsCountdown - 1 });
        }
      }, 1000);
    },

    handleRegister: function() {
      var phone = this.data.regPhone.trim();
      var smsCode = this.data.smsCode.trim();
      var pwd = this.data.regPassword;
      var pwd2 = this.data.regPassword2;
      if (!phone) { wx.showToast({ title: '请输入手机号', icon: 'none' }); return; }
      if (!/^1[3-9]\d{9}$/.test(phone)) { wx.showToast({ title: '手机号格式不正确', icon: 'none' }); return; }
      if (!smsCode) { wx.showToast({ title: '请输入验证码', icon: 'none' }); return; }
      if (!pwd || pwd.length < 6) { wx.showToast({ title: '密码至少6位', icon: 'none' }); return; }
      if (pwd !== pwd2) { wx.showToast({ title: '两次密码不一致', icon: 'none' }); return; }

      var that = this;
      this.setData({ registerLoading: true });
      var userStore = userStoreModule.useUserStore();
      userStore.register(phone, pwd, smsCode).then(function() {
        that.setData({ registerLoading: false });
        wx.showToast({ title: '注册成功', icon: 'success' });
        setTimeout(function() { wx.switchTab({ url: '/pages/index/index' }); }, 1000);
      }).catch(function(err) {
        that.setData({ registerLoading: false });
        wx.showToast({ title: err.message || '注册失败', icon: 'none' });
      });
    }
  }
});
