"use strict";
Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

// 引入uni全局工具对象
const uni = require("./common/vendor.js");
// 当前小程序后台已开通的云开发环境ID
const CLOUD_ENV_ID = "	cloud1-d1g045cvsbb5ea9a8";
// 是否开启用户访问追踪
const ENABLE_TRACE_USER = true;

/**
 * 初始化微信云开发环境
 * 同时兼容uni封装云对象、原生wx.cloud两套初始化
 */
function initCloudEnvironment() {
    // uni封装云开发初始化
    if (uni.index.cloud) {
        uni.index.cloud.init({
            env: CLOUD_ENV_ID,
            traceUser: ENABLE_TRACE_USER
        });
        console.log("[蒙小账] uni云开发初始化完成");
    } else {
        console.warn("[蒙小账] 云开发未可用，请在开发者工具中检查云开发版本、基础库以及项目AppID配置");
    }

    // 原生微信小程序云开发兜底初始化
    if (typeof wx !== "undefined" && wx.cloud) {
        wx.cloud.init({
            env: CLOUD_ENV_ID,
            traceUser: ENABLE_TRACE_USER
        });
        console.log("[蒙小账] 原生wx.cloud初始化完成");
    }
}

/**
 * App全局生命周期配置 + 内部业务方法
 */
const appOptions = {
    /**
     * 小程序/APP应用启动时执行
     */
    onLaunch() {
        console.log("[蒙小账] App Launch 应用启动");
        // 校验登录状态
        this.checkLoginStatus();
        // 获取设备系统信息存入本地缓存
        this.getSystemInfo();
    },

    /**
     * 应用切入前台
     */
    onShow() {
        console.log("[蒙小账] App Show 进入前台");
    },

    /**
     * 应用切入后台
     */
    onHide() {
        console.log("[蒙小账] App Hide 切入后台");
    },

    methods: {
        /**
         * 校验本地登录凭证，未登录则强制跳转登录页
         */
        checkLoginStatus() {
            const token = uni.index.getStorageSync("token");
            const userInfo = uni.index.getStorageSync("userInfo");

            // 本地无token同时无用户信息，判定未登录，重定向登录页面
            if (!token && !userInfo) {
                uni.index.reLaunch({
                    url: "/pages/login/index"
                });
            }
        },

        /**
         * 获取当前设备系统信息并持久化至本地缓存
         */
        getSystemInfo() {
            const systemInfo = uni.index.getSystemInfoSync();
            uni.index.setStorageSync("systemInfo", systemInfo);
        }
    }
};

/**
 * 创建Vue应用实例、挂载Pinia、全局异常捕获
 * @returns {{app: Vue实例, pinia: Pinia实例}}
 */
function createApp() {
    // 创建SSR模式Vue应用
    const vueApp = uni.createSSRApp(appOptions);
    // 创建Pinia实例
    const pinia = uni.createPinia();

    // 挂载状态管理
    vueApp.use(pinia);

    // 全局捕获Vue运行时异常
    vueApp.config.errorHandler = (error, instance, info) => {
        console.error("[蒙小账] 全局捕获运行异常：", error, instance, info);
        uni.index.showToast({
            title: "出了一点小问题，请重试",
            icon: "none",
            duration: 2000
        });
    };

    return {
        app: vueApp,
        pinia: pinia
    };
}

// 执行云环境初始化
initCloudEnvironment();

// 初始化应用并挂载至页面根节点
const { app } = createApp();
app.mount("#app");

// 向外导出创建应用的工厂方法
exports.createApp = createApp;