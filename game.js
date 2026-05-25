import Main from './js/main';

// 隐私协议授权处理（必须在游戏初始化前完成）
if (typeof wx !== 'undefined' && wx.requirePrivacyAuthorize) {
  wx.requirePrivacyAuthorize({
    success: () => {
      console.log('隐私协议已授权');
      initGame();
    },
    fail: () => {
      console.log('隐私协议未授权');
      initGame(); // 仍然初始化游戏，但部分功能可能受限
    },
  });
} else {
  initGame();
}

function initGame() {
  // 初始化云开发环境
  if (wx.cloud) {
    wx.cloud.init({
      env: 'cloud1-9g207fcz5a5bb520',  // 替换为你的云开发环境ID
      traceUser: true,
    });
  }

  new Main();
}
