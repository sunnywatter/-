const storage = require('../../utils/storage');
const { DEFAULT_SYSTEM_PROMPT, QUICK_REPLIES } = require('../../utils/prompts');
const { chatCompletion, chatCompletionStream } = require('../../utils/request');

// 获取当前时间
function getCurrentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

Page({
  data: {
    // 聊天相关
    messages: [],
    inputText: '',
    sending: false,
    scrollIntoView: '',
    
    // 设置相关
    contextSize: 10,
    
    // UI状态
    inputFocused: false,
    showQuickReplies: false,
    
    // 快捷回复
    quickReplies: QUICK_REPLIES.slice(0, 4),
    
    // 背景装饰
    clouds: []
  },

  onLoad() {
    console.log('聊天页面加载');
    this.initializePage();
  },

  onShow() {
    console.log('聊天页面显示');
    this.refreshSettings();
  },

  onUnload() {
    // 页面卸载时停止流式请求
    this.stopCurrentRequest();
  },

  // 初始化页面
  initializePage() {
    try {
      // 加载聊天记录
      const savedMessages = storage.getChat() || [];
      
      // 加载设置
      const settings = storage.getSettings() || {};
      
      // 生成背景云朵
      this.generateClouds();
      
      // 设置数据
      this.setData({
        messages: savedMessages,
        contextSize: Number(settings.contextSize || 10),
        showQuickReplies: savedMessages.length === 0
      });
      
      // 滚动到底部
      this.scrollToBottom();
      
      // 检查API配置
      this.checkApiConfiguration(settings);
      
    } catch (error) {
      console.error('初始化页面失败:', error);
      wx.showToast({
        title: '初始化失败',
        icon: 'error'
      });
    }
  },

  // 刷新设置
  refreshSettings() {
    try {
      const settings = storage.getSettings() || {};
      this.setData({
        contextSize: Number(settings.contextSize || 10)
      });
    } catch (error) {
      console.error('刷新设置失败:', error);
    }
  },

  // 检查API配置
  checkApiConfiguration(settings) {
    if (!settings.deepseekApiKey) {
      const welcomeMessage = {
        id: Date.now(),
        role: 'assistant',
        content: '👋 欢迎使用像素陪伴精灵！\n\n为了开始对话，请先配置你的 DeepSeek API Key：\n\n1. 点击右上角设置按钮\n2. 访问 https://platform.deepseek.com 获取API密钥\n3. 在设置页面填入API密钥\n\n配置完成后就可以和我聊天了！✨',
        time: getCurrentTime()
      };
      
      this.addMessage(welcomeMessage, false);
    }
  },

  // 生成背景云朵
  generateClouds() {
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      clouds.push({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 60 + 10,
        delay: Math.random() * 20
      });
    }
    this.setData({ clouds });
  },

  // 输入框事件
  onInputChange(e) {
    this.setData({
      inputText: e.detail.value
    });
  },

  onInputFocus() {
    this.setData({ inputFocused: true });
    setTimeout(() => {
      this.scrollToBottom();
    }, 300);
  },

  onInputBlur() {
    this.setData({ inputFocused: false });
  },

  // 发送消息
  onSendMessage() {
    if (this.data.sending) {
      console.log('正在发送中，忽略重复点击');
      return;
    }

    const text = this.data.inputText.trim();
    if (!text) {
      wx.showToast({
        title: '请输入消息内容',
        icon: 'none'
      });
      return;
    }

    console.log('开始发送消息:', text);
    this.sendUserMessage(text);
  },

  // 发送用户消息
  sendUserMessage(text) {
    // 创建用户消息
    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: text,
      time: getCurrentTime()
    };

    // 添加到消息列表
    this.addMessage(userMessage);

    // 清空输入框
    this.setData({
      inputText: '',
      sending: true,
      showQuickReplies: false
    });

    // 请求AI回复
    this.requestAIResponse();
  },

  // 添加消息到列表
  addMessage(message, save = true) {
    const messages = [...this.data.messages, message];
    this.setData({ messages });
    
    if (save) {
      storage.setChat(messages);
    }
    
    this.scrollToBottom();
  },

  // 更新消息内容
  updateMessage(messageId, content) {
    const messages = this.data.messages.map(msg => 
      msg.id === messageId ? { ...msg, content } : msg
    );
    
    this.setData({ messages });
    storage.setChat(messages);
  },

  // 请求AI回复
  async requestAIResponse() {
    try {
      const settings = storage.getSettings() || {};
      
      // 检查API密钥
      if (!settings.deepseekApiKey) {
        this.handleApiError(new Error('请先配置API密钥'));
        return;
      }

      // 构建请求体
      const requestBody = this.buildRequestBody(settings);
      console.log('构建请求体完成');

      // 创建AI回复消息
      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: '',
        time: getCurrentTime()
      };
      
      this.addMessage(aiMessage);

      // 尝试流式请求
      await this.tryStreamRequest(requestBody, aiMessage.id);

    } catch (error) {
      console.error('请求AI回复失败:', error);
      this.handleApiError(error);
    }
  },

  // 构建请求体
  buildRequestBody(settings) {
    const systemPrompt = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const contextMessages = this.data.messages.slice(-this.data.contextSize);
    
    const messages = [
      { role: 'system', content: systemPrompt },
      ...contextMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];

    return {
      model: settings.model || 'deepseek-chat',
      messages: messages,
      temperature: Number(settings.temperature || 0.7),
      max_tokens: 2000,
      stream: true
    };
  },

  // 尝试流式请求
  async tryStreamRequest(requestBody, messageId) {
    let hasStreamContent = false;
    let accumulatedContent = '';

    try {
      const controller = chatCompletionStream(requestBody, {
        onMessage: (delta) => {
          accumulatedContent += delta;
          hasStreamContent = true;
          this.updateMessage(messageId, accumulatedContent);
          this.scrollToBottom();
        },
        onDone: async () => {
          console.log('流式请求完成，有内容:', hasStreamContent);
          if (!hasStreamContent) {
            // 流式请求没有内容，回退到普通请求
            await this.fallbackToNormalRequest(requestBody, messageId);
          }
          this.setData({ sending: false });
        },
        onError: async (error) => {
          console.warn('流式请求失败，回退到普通请求:', error);
          await this.fallbackToNormalRequest(requestBody, messageId);
        }
      });

      // 保存控制器，用于取消请求
      this.streamController = controller;

    } catch (error) {
      console.error('创建流式请求失败:', error);
      await this.fallbackToNormalRequest(requestBody, messageId);
    }
  },

  // 回退到普通请求
  async fallbackToNormalRequest(requestBody, messageId) {
    try {
      console.log('开始普通请求');
      const response = await chatCompletion({ ...requestBody, stream: false });
      
      if (response && response.choices && response.choices[0]) {
        const content = response.choices[0].message.content;
        this.updateMessage(messageId, content);
        console.log('普通请求成功');
      } else {
        throw new Error('API返回数据格式错误');
      }
      
    } catch (error) {
      console.error('普通请求也失败:', error);
      this.handleApiError(error, messageId);
    } finally {
      this.setData({ sending: false });
    }
  },

  // 处理API错误
  handleApiError(error, messageId = null) {
    const errorMessage = error.message || String(error);
    let userFriendlyMessage = '';

    if (errorMessage.includes('余额不足') || errorMessage.includes('402')) {
      userFriendlyMessage = '💰 API余额不足\n\n请前往 DeepSeek 平台充值后继续使用。';
    } else if (errorMessage.includes('API密钥') || errorMessage.includes('401')) {
      userFriendlyMessage = '🔑 API密钥问题\n\n请检查设置中的API密钥是否正确。';
    } else if (errorMessage.includes('请求过于频繁') || errorMessage.includes('429')) {
      userFriendlyMessage = '⏰ 请求过于频繁\n\n请稍后再试。';
    } else if (errorMessage.includes('网络')) {
      userFriendlyMessage = '🌐 网络连接问题\n\n请检查网络连接后重试。';
    } else {
      userFriendlyMessage = '😅 出现了一些问题\n\n' + errorMessage;
    }

    if (messageId) {
      this.updateMessage(messageId, userFriendlyMessage);
    } else {
      const errorMsg = {
        id: Date.now(),
        role: 'assistant',
        content: userFriendlyMessage,
        time: getCurrentTime()
      };
      this.addMessage(errorMsg);
    }

    this.setData({ sending: false });
  },

  // 快捷回复
  onQuickReply(e) {
    const text = e.currentTarget.dataset.text;
    this.setData({ inputText: text });
    this.sendUserMessage(text);
  },

  // 清空聊天记录
  onClearChat() {
    wx.showModal({
      title: '清空聊天记录',
      content: '确定要清空所有聊天记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.setData({ 
            messages: [],
            showQuickReplies: true
          });
          storage.setChat([]);
          console.log('聊天记录已清空');
        }
      }
    });
  },

  // 停止当前请求
  stopCurrentRequest() {
    if (this.streamController) {
      this.streamController.abort();
      this.streamController = null;
      this.setData({ sending: false });
      console.log('已停止当前请求');
    }
  },

  // 跳转到设置页面
  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/index'
    });
  },

  // 滚动到底部
  scrollToBottom() {
    const scrollId = 'message-bottom-' + Date.now();
    this.setData({
      scrollIntoView: scrollId
    });
    
    // 延迟一下确保滚动生效
    setTimeout(() => {
      this.setData({
        scrollIntoView: scrollId
      });
    }, 100);
  }
});