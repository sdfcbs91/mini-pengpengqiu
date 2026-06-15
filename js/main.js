import './render';
import DataBus from './databus';
import LevelSelect from './scene/levelSelect';
import GameScene from './scene/gameScene';
import devLog from './runtime/devLog';
import { SCREEN_WIDTH, SCREEN_HEIGHT, DPR } from './render';

// ============ 开发调试开关 ============
// 设置为 false 则不生成 dev 调试工具（提升性能、避免误触）
const DEV_ENABLED = false; // ← 改这里：true=开启 / false=关闭
// ===============================================

// 将开关暴露到全局，供 devLog 读取
GameGlobal.DEV_ENABLED = DEV_ENABLED;

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

    // 条件初始化 devLog（直接引用已导入的实例）
    this.devLog = DEV_ENABLED ? devLog : null;
    // 暴露到全局，供各场景访问（避免导入问题）
    GameGlobal.devLog = this.devLog;

    // 强制显示dev面板（调试用）
    if (this.devLog) {
      this.devLog.visible = true;
      wx.showToast({
        title: 'DevLog已初始化',
        icon: 'none',
        duration: 2000
      });
    }

    // 注册统一的触摸事件分发器（确保 dev 组件在最上层）
    // 这是唯一的触摸事件入口，确保层拦截生效
    this._touchDispatcher = {
      start: (e) => this._dispatchTouch('start', e),
      move: (e) => this._dispatchTouch('move', e),
      end: (e) => this._dispatchTouch('end', e),
    };
    wx.onTouchStart(this._touchDispatcher.start);
    wx.onTouchMove(this._touchDispatcher.move);
    wx.onTouchEnd(this._touchDispatcher.end);

    // 初始化关卡选择场景
    // 触摸事件由 main.js 统一分发，不需要单独绑定/解绑
    this.levelSelect = new LevelSelect();
    this.levelSelect.onLevelSelected = this.onLevelSelected.bind(this);

    // 初始化游戏场景（延迟创建）
    this.gameScene = null;

    // 启动游戏主循环
    this.raf = null;

    this.loop();
  }

  /**
   * 开屏结束，进入关卡选择
   */
  _endSplash() {
    this.splashDone = true;
    // 触摸事件现在由 main.js 统一分发，不需要再绑定到 levelSelect
    // 开屏期间的触摸处理已经在 _dispatchTouch 中通过 !this.splashDone 判断来处理
  }

  /**
   * 当玩家选择关卡时，切换到游戏场景
   */
  onLevelSelected(levelNum) {
    // 创建游戏场景（触摸事件由 main.js 统一分发，不需要单独绑定）
    this.gameScene = new GameScene();
    this.gameScene.onBackToMenu = this.onBackToMenu.bind(this);
    this.gameScene.onGameOver = () => { };
    this.gameScene.onLevelComplete = (level, stars, score) => {
      // 特殊模式不保存进度
      if (level > 0) {
        this.levelSelect.completeLevel(level, stars, score);
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
      this.gameScene = null;
    }

    // 重置导航栏选中态为"闯关"
    this.levelSelect.navItems.forEach((item, i) => { item.active = i === 0; });
    this.levelSelect.showSettings = false;
    this.levelSelect.showRank = false;
    this.databus.goToLevelSelect();

    // 显示关卡选择界面，检查是否需要获取用户信息
    this.levelSelect.show();
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
        ctx.font = `${12 * (SCREEN_HEIGHT / 375)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('点击屏幕开始游戏', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 40 * (SCREEN_HEIGHT / 375));
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

    // 条件渲染 dev 组件
    if (DEV_ENABLED && this.devLog) {
      this.devLog.render(ctx);
    }

    this.databus.frame++;
    this.raf = requestAnimationFrame(this.loop.bind(this));
  }

  /**
   * 处理 dev 组件触摸事件（条件检查）
   */
  _handleDevTouch(x, y) {
    return DEV_ENABLED && this.devLog && this.devLog.handleTouch(x, y);
  }

  /**
   * 统一触摸事件分发器（实现层概念：dev组件在最上层）
   * 这是唯一的触摸事件入口，确保层拦截生效
   */
  _dispatchTouch(eventType, e) {
    // touchEnd 使用 changedTouches，其他使用 touches
    let touch;
    if (eventType === 'end') {
      if (!e || !e.changedTouches || !e.changedTouches[0]) return;
      touch = e.changedTouches[0];
    } else {
      if (!e || !e.touches || !e.touches[0]) return;
      touch = e.touches[0];
    }
    const { clientX, clientY } = touch;

    // 开屏期间特殊处理
    if (!this.splashDone) {
      if (eventType === 'start') {
        // 检查是否点击了 dev 组件（层拦截）
        if (this.devLog && this.devLog.handleTouch(clientX, clientY)) return;
        this.splashFadeOut = true;
      }
      return;
    }

    // 如果 dev 面板正在显示，所有触摸都由 dev 组件处理（拦截+滚动）
    if (this.devLog && this.devLog.showPanel) {
      if (eventType === 'start') this.devLog.handleTouchStart(clientX, clientY);
      else if (eventType === 'move') this.devLog.handleTouchMove(clientX, clientY);
      else if (eventType === 'end') this.devLog.handleTouchEnd();
      return; // 完全拦截，不再分发到场景
    }

    // 层拦截：先检查 dev 组件（最上层）
    // 如果 dev 组件处理了触摸，则完全拦截，不再分发到场景
    if (this.devLog && this.devLog.handleTouch(clientX, clientY)) {
      return; // dev组件处理了触摸，拦截掉所有后续处理
    }

    // 分发到当前场景
    const scene = this.databus.scene;
    if (scene === 'levelSelect' && this.levelSelect) {
      if (eventType === 'start') this.levelSelect.handleTouchStart(clientX, clientY);
      else if (eventType === 'move') this.levelSelect.handleTouchMove(clientX, clientY);
      else if (eventType === 'end') this.levelSelect.handleTouchEnd(clientX, clientY);
    } else if (scene === 'playing' && this.gameScene) {
      if (eventType === 'start') this.gameScene.handleTouchStart(clientX, clientY);
      else if (eventType === 'move') this.gameScene.handleTouchMove(clientX, clientY);
      else if (eventType === 'end') this.gameScene.handleTouchEnd();
    }
  }
}
