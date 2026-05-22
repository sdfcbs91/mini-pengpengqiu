import Main from './js/main';

// 初始化云开发环境
if (wx.cloud) {
  wx.cloud.init({
    env: 'cloud1-9g207fcz5a5bb520',  // 替换为你的云开发环境ID
    traceUser: true,
  });
}

new Main();
