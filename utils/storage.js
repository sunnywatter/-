// 本地存储封装工具
const KEYS = {
  CHAT: 'storage:chat_history',
  SETTINGS: 'storage:settings',
  QUICK: 'storage:quick_prompts'
};

// 安全的存储读取
function safeGet(key, fallback) {
  try { 
    const value = wx.getStorageSync(key); 
    if (value === undefined || value === null || value === '') {
      return fallback;
    }
    return value; 
  } catch(error) { 
    console.warn('读取存储失败:', key, error);
    return fallback; 
  }
}

// 安全的存储写入
function safeSet(key, value) {
  try { 
    wx.setStorageSync(key, value); 
  } catch(e) {
    console.warn('写入存储失败:', key, e);
  }
}

module.exports = {
  KEYS,
  
  // 聊天记录相关
  getChat() { 
    return safeGet(KEYS.CHAT, []); 
  },
  setChat(list) { 
    safeSet(KEYS.CHAT, list); 
  },
  
  // 设置相关
  getSettings() { 
    return safeGet(KEYS.SETTINGS, {}); 
  },
  setSettings(settings) { 
    safeSet(KEYS.SETTINGS, settings); 
  },
  
  // 快捷提示相关
  getQuickPrompts() { 
    return safeGet(KEYS.QUICK, [
      '我在呢，先抱抱你，慢慢和我说发生了什么 🤗',
      '你已经很努力了，今天也辛苦啦 ✨',
      '给你一点能量补给：深呼吸一下，我们一起想办法 💪',
      '可以和我分享一件让你开心的小事吗？ 😊',
      '遇到挫折不代表不行，只是还在路上～ 🌟',
      '给自己一个小点赞吧，你真的做得不错 👏',
      '现在最想被怎么陪伴？倾听/鼓励/一起分析？ 💭',
      '不着急回答，我会一直在，等你准备好 💝',
      '要不要一起做个3分钟放松呼吸？吸—停—呼— 🌸',
      '我很好奇今天的你，想从哪件小事聊起？ ✨'
    ]); 
  },
  setQuickPrompts(list) { 
    safeSet(KEYS.QUICK, list); 
  },
  
  // 清除所有数据
  clearAll() {
    try {
      wx.removeStorageSync(KEYS.CHAT);
      wx.removeStorageSync(KEYS.SETTINGS);
      wx.removeStorageSync(KEYS.QUICK);
    } catch(e) {
      console.warn('清除存储失败:', e);
    }
  },
  
  // 获取存储使用情况
  getStorageInfo() {
    try {
      return wx.getStorageInfoSync();
    } catch(e) {
      console.warn('获取存储信息失败:', e);
      return { keys: [], currentSize: 0, limitSize: 0 };
    }
  }
};
