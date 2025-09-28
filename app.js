// 像素陪伴精灵 - 小程序入口文件
App({
  globalData: {
    settings: {},
    userInfo: null
  },

  onLaunch(options) {
    console.log('像素陪伴精灵启动', options);
    
    // 初始化云开发（如果需要）
    try {
      if (wx.cloud) {
        wx.cloud.init({
          // 如果没有配置云开发环境，这里可以留空
          // env: 'your-env-id', // 替换为你的云开发环境ID
          traceUser: true
        });
        console.log('云开发初始化成功');
      }
    } catch (e) {
      console.warn('云开发初始化失败，将使用直接API调用:', e);
    }

    // 检查基础库版本
    this.checkBaseLibVersion();
    
    // 初始化设置
    this.initSettings();
  },

  onShow(options) {
    console.log('小程序显示', options);
  },

  onHide() {
    console.log('小程序隐藏');
  },

  onError(msg) {
    console.error('小程序错误', msg);
  },

  // 检查基础库版本
  checkBaseLibVersion() {
    try {
      // 使用新的API获取版本信息
      let version = '';
      if (wx.getSystemSetting) {
        const systemInfo = wx.getSystemSetting();
        version = systemInfo.SDKVersion || '';
      }
      
      // 如果新API不可用，回退到旧API
      if (!version && wx.getSystemInfoSync) {
        const systemInfo = wx.getSystemInfoSync();
        version = systemInfo.SDKVersion || '';
      }
      
      if (version && this.compareVersion(version, '2.31.0') < 0) {
        wx.showModal({
          title: '提示',
          content: '当前微信版本过低，部分功能可能无法正常使用，请升级到最新微信版本后重试。',
          showCancel: false
        });
      }
    } catch (e) {
      console.warn('检查基础库版本失败:', e);
    }
  },

  // 版本比较
  compareVersion(v1, v2) {
    
    v1 = v1.split('.');
    v2 = v2.split('.');
    const len = Math.max(v1.length, v2.length);

    while (v1.length < len) {
      v1.push('0');
    }
    while (v2.length < len) {
      v2.push('0');
    }

    for (let i = 0; i < len; i++) {
      const num1 = parseInt(v1[i]);
      const num2 = parseInt(v2[i]);

      if (num1 > num2) {
        return 1;
      } else if (num1 < num2) {
        return -1;
      }
    }

    return 0;
  },

  // 初始化设置
  initSettings() {
    try {
      const settings = wx.getStorageSync('storage:settings') || {};
      this.globalData.settings = settings;
    } catch (e) {
      console.warn('读取设置失败', e);
    }
  },

  // 获取用户信息
  getUserProfile() {
    return new Promise((resolve, reject) => {
      wx.getUserProfile({
        desc: '用于完善会员资料',
        success: (res) => {
          this.globalData.userInfo = res.userInfo;
          resolve(res.userInfo);
        },
        fail: reject
      });
    });
  }
});
