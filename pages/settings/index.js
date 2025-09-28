const storage = require('../../utils/storage');
const { DEFAULT_SYSTEM_PROMPT } = require('../../utils/prompts');
const { chatCompletion } = require('../../utils/request');

Page({
  data: {
    stars: [],
    contextSize: 10,
    temperature: 0.7,
    deepseekApiKey: '',
    systemPrompt: DEFAULT_SYSTEM_PROMPT
  },

  onLoad() {
    this.generateStars();
    const s = storage.getSettings();
    this.setData({
      contextSize: Number(s.contextSize || 10),
      temperature: Number(s.temperature || 0.7),
      deepseekApiKey: s.deepseekApiKey || '',
      systemPrompt: s.systemPrompt || DEFAULT_SYSTEM_PROMPT
    });
  },

  // 生成背景星星
  generateStars() {
    const stars = [];
    for (let i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 3
      });
    }
    this.setData({ stars });
  },

  // 输入事件处理
  onKeyInput(e) { 
    this.setData({ deepseekApiKey: e.detail.value }); 
  },
  
  onPromptInput(e) { 
    this.setData({ systemPrompt: e.detail.value }); 
  },

  // 滑块事件处理
  onContextChange(e) { 
    this.setData({ contextSize: Number(e.detail.value) }); 
  },
  
  onTempChange(e) { 
    this.setData({ temperature: Number(e.detail.value) / 100 }); 
  },

  // 保存设置
  onSave() {
    const settings = {
      contextSize: this.data.contextSize,
      model: 'deepseek-chat',
      temperature: this.data.temperature,
      deepseekApiKey: this.data.deepseekApiKey.trim(),
      systemPrompt: this.data.systemPrompt
    };
    
    storage.setSettings(settings);
    
    // 更新全局数据
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.settings = settings;
    }
    
    wx.showToast({ 
      title: '设置已保存 ✨', 
      icon: 'success',
      duration: 2000
    });
  },

  // 测试API连接
  async onTest() {
    if (!this.data.deepseekApiKey.trim()) {
      wx.showToast({
        title: '请先输入API Key',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({ title: '测试连接中...', mask: true });
    
    try {
      const body = {
        model: 'deepseek-chat',
        temperature: this.data.temperature,
        messages: [
          { role: 'system', content: this.data.systemPrompt },
          { role: 'user', content: '你好，请简单介绍一下自己' }
        ]
      };
      
      const data = await chatCompletion(body);
      const reply = data?.choices?.[0]?.message?.content || '无返回内容';
      
      wx.hideLoading();
      wx.showModal({ 
        title: '🎉 连接成功', 
        content: `AI回复：${reply.slice(0, 150)}${reply.length > 150 ? '...' : ''}`,
        showCancel: false,
        confirmText: '好的'
      });
    } catch (e) {
      wx.hideLoading();
      wx.showModal({ 
        title: '❌ 连接失败', 
        content: `错误信息：${String(e).slice(0, 200)}`,
        showCancel: false,
        confirmText: '知道了'
      });
    }
  },

  // 恢复默认设置
  onReset() {
    wx.showModal({
      title: '确认重置',
      content: '是否恢复所有设置为默认值？此操作不可撤销。',
      success: (res) => {
        if (res.confirm) {
          this.setData({
            contextSize: 10,
            temperature: 0.7,
            deepseekApiKey: '',
            systemPrompt: DEFAULT_SYSTEM_PROMPT
          });
          
          // 清除存储的设置
          storage.setSettings({});
          
          wx.showToast({
            title: '已恢复默认设置',
            icon: 'success'
          });
        }
      }
    });
  },

  // 加载预设提示词模板
  onLoadPreset(e) {
    const type = e.currentTarget.dataset.type;
    let presetPrompt = '';

    switch (type) {
      case 'companion':
        presetPrompt = `你是"像素陪伴精灵"，一个温暖贴心的数字朋友。

🎭 性格特点：
- 温暖、善解人意、充满同理心
- 积极乐观，善于发现生活中的美好
- 耐心倾听，不批判，给予用户安全感
- 幽默风趣，能在适当时候调节气氛

💬 对话风格：
- 语言温暖自然，像朋友聊天一样
- 适当使用表情符号增加亲和力（✨💫🌟💝等）
- 回复长度适中，不要过长或过短

🤗 互动原则：
- 倾听优先：认真听取用户的情感表达
- 情感共鸣：通过理解和回应表达共情
- 积极鼓励：在用户遇到困难时给予支持
- 生活陪伴：对用户分享的日常生活表现关心

⚠️ 注意事项：
- 不要给出专业的心理治疗建议
- 遇到严重心理问题时，温和建议寻求专业帮助
- 保持边界感，不要过度介入用户私人生活`;
        break;

      case 'advisor':
        presetPrompt = `你是一位温和的心理支持顾问，专门为用户提供情感疏导和心理支持。

🎭 角色定位：
- 专业而温暖的心理支持者
- 善于倾听和分析情感问题
- 提供建设性的建议和指导

💬 对话特点：
- 语言专业但不失温度
- 善于提出启发性问题
- 帮助用户理清思路和情感

🤗 服务方式：
- 认真倾听用户的困扰和问题
- 帮助用户分析情感和行为模式
- 提供实用的心理调节建议
- 鼓励用户建立积极的思维模式

⚠️ 专业边界：
- 明确说明这是支持性对话，非专业治疗
- 遇到严重心理问题建议寻求专业帮助
- 不诊断心理疾病，不开具处方`;
        break;

      case 'friend':
        presetPrompt = `你是用户最贴心的朋友，总是在他们需要的时候给予支持和陪伴。

🎭 朋友特质：
- 真诚、可靠、值得信赖
- 幽默风趣，能带来欢乐
- 善解人意，总能理解用户的感受
- 无条件支持，永远站在用户这边

💬 聊天风格：
- 轻松自然，就像老朋友聊天
- 会开玩笑，也会认真倾听
- 用词亲切，多用"我们"、"咱们"
- 经常使用表情符号和网络用语

🤗 陪伴方式：
- 分享用户的喜怒哀乐
- 在困难时给予鼓励和安慰
- 在开心时一起庆祝和分享
- 提供朋友式的建议和看法

⚠️ 朋友原则：
- 保守秘密，值得信赖
- 诚实但不伤害感情
- 支持但不盲从，会给出真诚建议`;
        break;

      case 'mentor':
        presetPrompt = `你是一位智慧的人生导师，用丰富的人生阅历和智慧指导用户成长。

🎭 导师品质：
- 睿智、博学、有人生阅历
- 善于从不同角度看问题
- 能够启发用户思考和成长
- 既严格又慈祥，像长辈般关怀

💬 指导风格：
- 语言深刻但易懂
- 善用比喻和故事来说明道理
- 提出启发性问题让用户思考
- 分享人生智慧和经验

🤗 指导方式：
- 帮助用户建立正确的人生观和价值观
- 在迷茫时提供方向指引
- 在挫折时给予鼓励和支持
- 教导用户如何面对人生的各种挑战

⚠️ 导师责任：
- 以用户的成长和福祉为重
- 不强加自己的观点，而是引导思考
- 承认知识的局限性，保持谦逊`;
        break;

      default:
        presetPrompt = DEFAULT_SYSTEM_PROMPT;
    }

    wx.showModal({
      title: '加载预设模板',
      content: '确定要加载这个预设模板吗？当前内容将被替换。',
      success: (res) => {
        if (res.confirm) {
          this.setData({ systemPrompt: presetPrompt });
          wx.showToast({
            title: '模板已加载',
            icon: 'success'
          });
        }
      }
    });
  }
});