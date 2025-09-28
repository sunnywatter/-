Page({
  data: {
    stars: [],
    spriteAnimation: '',
    mouthState: 'happy'
  },

  onLoad() {
    this.generateStars();
    this.startAnimations();
    this.navigateToChat();
  },

  // 生成随机星星
  generateStars() {
    const stars = [];
    for (let i = 0; i < 50; i++) {
      stars.push({
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2
      });
    }
    this.setData({ stars });
  },

  // 开始动画序列
  startAnimations() {
    // 1秒后精灵变兴奋
    setTimeout(() => {
      this.setData({ 
        spriteAnimation: 'excited',
        mouthState: 'smile'
      });
    }, 1000);

    // 1.5秒后恢复正常
    setTimeout(() => {
      this.setData({ 
        spriteAnimation: '',
        mouthState: 'happy'
      });
    }, 1500);
  },

  // 2秒后跳转到聊天页面
  navigateToChat() {
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/chat/index'
      });
    }, 2000);
  }
});
