import './render';
import DataBus from './databus';
import LevelSelect from './scene/levelSelect';
import GameScene from './scene/gameScene';
import { SCREEN_WIDTH, SCREEN_HEIGHT, DPR } from './render';

const ctx = canvas.getContext('2d');

// 高清适配：缩放 context，后续所有绘图坐标使用逻辑像素
ctx.scale(DPR, DPR);

// 关闭图片平滑（像素画/小图标更清晰；大图片不受影响因为用原始分辨率）
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high';

// 文字渲染优化提示（部分环境支持）
if (ctx.textDrawingMode !== undefined) {
  ctx.textDrawingMode = 'glyph';
}

GameGlobal.databus = new DataBus();

/**
 * 游戏主函数
 * 管理场景切换和主循环
 */
export default class Main {
  constructor() {
    this.databus = GameGlobal.databus;

    // 开屏状态
    this.splashDone = false;
    this.splashTimer = 0;
    this.splashDuration = 120; // 2秒（60fps × 2）
    this.splashImg = wx.createImage();
    this.splashImg.src = 'images/welcome.jpg';
    this.splashFadeOut = false;
    this.splashAlpha = 1;

    // 开屏点击跳过
    this._splashTapHandler = () => {
      this.splashFadeOut = true;
    };
    wx.onTouchStart(this._splashTapHandler);

    // 初始化关卡选择场景（延迟绑定触摸，等开屏结束）
    this.levelSelect = new LevelSelect();
    this.levelSelect.onLevelSelected = this.onLevelSelected.bind(this);
    this.levelSelect.unbindTouch(); // 开屏期间不响应关卡触摸

    // 初始化游戏场景（延迟创建）
    this.gameScene = null;

    // 启动游戏主循环
    this.raf = null;

    // 通过云函数获取用户信息并缓存
    this._fetchUserFromCloud();

    this.loop();
  }

  /**
   * 开屏结束，进入关卡选择
   */
  _endSplash() {
    this.splashDone = true;
    wx.offTouchStart(this._splashTapHandler);
    this.levelSelect._bindTouch();
  }

  /**
   * 通过云函数获取用户openid和信息，缓存到本地
   */
  _fetchUserFromCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    try {
      const cached = wx.getStorageSync('ppq_user_info');
      if (cached && cached.openid) return; // 已有完整缓存
    } catch (e) { /* ignore */ }

    wx.cloud.callFunction({
      name: 'getUserInfo',
      data: {},
      success: (res) => {
        const result = res.result;
        if (result && result.code === 0) {
          const userInfo = {
            openid: result.openid,
            nickName: result.nickName || '',
            avatarUrl: result.avatarUrl || '',
          };
          wx.setStorageSync('ppq_user_info', userInfo);
          console.log('用户信息获取成功:', result);
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败:', err);
      },
    });
  }

  /**
   * 当玩家选择关卡时，切换到游戏场景
   */
  onLevelSelected(levelNum) {
    // 解绑关卡选择的触摸事件
    this.levelSelect.unbindTouch();

    // 创建游戏场景
    this.gameScene = new GameScene();
    this.gameScene.onBackToMenu = this.onBackToMenu.bind(this);
    this.gameScene.onGameOver = () => { };
    this.gameScene.onLevelComplete = (level, stars) => {
      // 特殊模式不保存进度
      if (level > 0) {
        this.levelSelect.completeLevel(level, stars);
      }
    };
    this.gameScene.initLevel(levelNum);

    // 切换场景
    this.databus.startLevel(levelNum);
  }

  /**
   * 返回关卡选择菜单
   */
  onBackToMenu() {
    if (this.gameScene) {
      this.gameScene.unbindTouch();
      this.gameScene = null;
    }

    // 重新绑定关卡选择触摸
    this.levelSelect._bindTouch();
    this.databus.goToLevelSelect();
  }

  /**
   * 游戏主循环
   */
  loop() {
    // 重置变换矩阵再缩放，确保高清渲染无累积误差
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 开屏画面
    if (!this.splashDone) {
      this.splashTimer++;

      // 到时间或点击后开始淡出
      if (this.splashTimer >= this.splashDuration) {
        this.splashFadeOut = true;
      }

      if (this.splashFadeOut) {
        this.splashAlpha -= 0.05;
        if (this.splashAlpha <= 0) {
          this._endSplash();
        }
      }

      // 绘制开屏图片
      if (!this.splashDone) {
        ctx.globalAlpha = this.splashAlpha;
        if (this.splashImg.width > 0) {
          // 居中铺满绘制
          const imgRatio = this.splashImg.width / this.splashImg.height;
          const screenRatio = SCREEN_WIDTH / SCREEN_HEIGHT;
          let dw, dh, dx, dy;
          if (imgRatio > screenRatio) {
            dh = SCREEN_HEIGHT;
            dw = dh * imgRatio;
            dx = (SCREEN_WIDTH - dw) / 2;
            dy = 0;
          } else {
            dw = SCREEN_WIDTH;
            dh = dw / imgRatio;
            dx = 0;
            dy = (SCREEN_HEIGHT - dh) / 2;
          }
          ctx.drawImage(this.splashImg, dx, dy, dw, dh);
        } else {
          // 图片还没加载完，显示黑屏
          ctx.fillStyle = '#0a0e27';
          ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
        }

        // 底部提示文字
        ctx.fillStyle = '#ffffff';
        ctx.font = `${12 * (SCREEN_WIDTH / 375)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('点击屏幕开始游戏', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40 * (SCREEN_WIDTH / 375));
        ctx.globalAlpha = 1;

        this.raf = requestAnimationFrame(this.loop.bind(this));
        return;
      }
    }

    const scene = this.databus.scene;

    if (scene === 'levelSelect') {
      this.levelSelect.update();
      this.levelSelect.render(ctx);
    } else if (scene === 'playing' && this.gameScene) {
      this.gameScene.update();
      this.gameScene.render(ctx);
    }

    this.databus.frame++;
    this.raf = requestAnimationFrame(this.loop.bind(this));
  }
}
