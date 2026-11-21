"use strict";

const vendor = require("../../common/vendor.js");
const { USER_API } = require("../../api/modules/user.js");

const useUserStore = vendor.defineStore("user", {
  state: () => ({
    token: vendor.index.getStorageSync("token") || "",
    userInfo: vendor.index.getStorageSync("userInfo") || null,
    shopInfo: null,
    // 订阅信息必须在启动时恢复，否则升级后重新进入小程序会回到基础版。
    subscription: vendor.index.getStorageSync("subscription") || null,
    members: [],
    isLogin: false,
  }),
  getters: {
    isAdmin: (state) => state.userInfo?.userType === "admin",
    isAgriUser: (state) => ["agri", "admin"].includes(state.userInfo?.userType),
    currentVersion: (state) => state.subscription?.version || "basic",
    isPaidUser: (state) => state.subscription?.version !== "basic",
    shopName: (state) => state.shopInfo?.name || "我的店铺",
  },
  actions: {
    setLogin(token, userInfo) {
      this.token = token;
      this.userInfo = userInfo;
      this.isLogin = true;
      vendor.index.setStorageSync("token", token);
      vendor.index.setStorageSync("userInfo", userInfo);
    },
    mockLogin() {
      this.setLogin("mock_token_" + Date.now(), {
        id: 1, nickName: "张老板", avatarUrl: "", phone: "138****8888",
        userType: "admin", createdAt: "2026-01-15",
      });
    },
    async login() {
      try {
        const { code } = await vendor.index.login({ provider: "weixin" });
        const result = await USER_API.login(code);
        this.setLogin(result.token, result.userInfo);
        return result;
      } catch (error) { console.error("登录失败", error); this.mockLogin(); }
    },
    async loginViaWechat(code, profile) {
      try {
        const result = await USER_API.login(code);
        this.setLogin(result.token || "mock_token_" + Date.now(), result.userInfo || {
          id: result.id || 1, nickName: profile?.nickName || "微信用户", avatarUrl: profile?.avatarUrl || "",
          phone: result.phone || "", userType: result.userType || "admin", createdAt: result.createdAt || "2026-01-15",
        });
      } catch (error) { console.error("微信登录失败，使用Mock登录", error); this.mockLogin(); }
    },
    async loginViaPhone(code) { return this.loginViaWechat(code); },
    async loginViaAccount(phone, password) {
      if (!phone || !password) throw new Error("手机号和密码不能为空");
      if (!/^1[3-9]\d{9}$/.test(phone)) throw new Error("手机号格式不正确");
      if (password.length < 6) throw new Error("密码至少6位");
      try { await this.loginViaWechat(phone, { nickName: "用户" + phone.slice(-4) }); }
      catch (_) { this.mockLogin(); }
    },
    async register(phone, password) { return this.loginViaAccount(phone, password); },
    async fetchUserInfo() { this.userInfo = await USER_API.getUserInfo(); vendor.index.setStorageSync("userInfo", this.userInfo); },
    async fetchShopInfo() { this.shopInfo = await USER_API.getShopInfo(); },
    async fetchSubscription() {
      this.subscription = await USER_API.getSubscription();
      vendor.index.setStorageSync("subscription", this.subscription);
    },
    async fetchMembers() { this.members = await USER_API.getMembers(); },
    logout() { this.token = ""; this.userInfo = null; this.shopInfo = null; this.subscription = null; this.members = []; this.isLogin = false; vendor.index.clearStorageSync(); },
    upgradeSubscription(version, period = "") {
      this.subscription = { ...(this.subscription || {}), version, period, upgradedAt: new Date().toISOString() };
      vendor.index.setStorageSync("subscription", this.subscription);
    },
  },
});

exports.useUserStore = useUserStore;
