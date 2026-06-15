import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { COLORS, SCALE, TOTAL_LEVELS, LEVEL_GRID_COLS, LEVEL_GRID_ROWS, LEVELS_PER_PAGE, SAFE_LEFT, SAFE_RIGHT } from '../config';
import { LevelProgress } from '../data/levelData';

/**
 * 关卡选择页面
 * 霓虹风格的关卡网格，支持滑动翻页
 * 每个关卡格子显示关卡号、星级（0-3星）、锁定状态
 */
export default class LevelSelect {
  constructor() {
    // 关卡进度数据（从本地存储加载）
    this.progress = new LevelProgress();
    this.levelData = this.progress.getAllData();

    // 当前页（根据最高解锁关卡定位）
    this.totalPages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);
    const maxUnlocked = this.progress.getMaxUnlocked();
    this.currentPage = Math.min(Math.floor((maxUnlocked - 1) / LEVELS_PER_PAGE), this.totalPages - 1);

    // 滑动相关
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.isDragging = false;
    this.isSwiping = false;

    // 页面滑动动画（像素偏移，正值=往右拖=看前一页）
    this.slideOffset = 0;       // 当前实际偏移
    this.slideTarget = 0;       // 动画目标偏移（松手后吸附到0）
    this.slideVelocity = 0;     // 松手时的速度
    this.isSlideAnimating = false;

    // 霓虹动画计时器
    this.glowPhase = 0;

    // 布局计算
    this._calculateLayout();

    // 选中的关卡（-1表示未选中）
    this.selectedLevel = -1;

    // 回调
    this.onLevelSelected = null;

    // 底部导航栏项
    this.navItems = [
      { label: '闯关', active: true },
      { label: '150球' },
      { label: '设置' },
    ];

    // 排行榜状态
    this.showRank = false;
    this._openDataCanvas = null;

    // 设置面板状态
    this.showSettings = false;
    this.soundOn = true; // 声音开关
    this.showGameIntro = false; // 游戏介绍弹窗
    this._introScrollY = 0;    // 游戏介绍弹窗滚动偏移
    this._introScrollVelocity = 0;  // 惯性滚动速度
    this._introScrolling = false;   // 是否正在手动拖动
    this.showPropsGuide = false; // 道具介绍弹窗
    this._propsGuidePage = 0; // 当前道具页码
    this._propsSwipeStartX = 0; // 滑动起始X
    this._showAuthPrompt = false; // 授权昵称弹窗
    this._showPrivacyPrompt = false; // 隐私协议弹窗

    // 检查是否已同意隐私协议，未同意则弹窗提示
    this._checkPrivacyAndInit();
  }

  /**
   * 显示关卡选择界面
   * 检查是否需要获取用户信息
   */
  show() {
    // 检查游戏结束后是否需要获取用户信息
    if (GameGlobal._needAuthPrompt) {
      GameGlobal._needAuthPrompt = false;
      this._requestUserProfile();
    }
  }

  /**
   * 检查隐私协议状态，决定是否弹窗
   * 微信规范要求：处理用户个人信息前必须以弹窗方式提示用户阅读同意隐私协议
   */
  _checkPrivacyAndInit() {
    if (typeof wx === 'undefined' || !wx.getPrivacySetting) {
      // 不支持隐私接口，直接初始化
      this._doAfterPrivacyAgreed();
      return;
    }

    // 检查本地是否已记录同意
    try {
      const agreed = wx.getStorageSync('ppq_privacy_agreed');
      if (agreed) {
        // 已同意过，直接初始化
        this._doAfterPrivacyAgreed();
        return;
      }
    } catch (e) { /* ignore */ }

    // 调用微信接口检查是否需要授权
    wx.getPrivacySetting({
      success: (res) => {
        if (res.needAuthorization) {
          // 需要用户同意隐私协议，显示弹窗
          this._showPrivacyPrompt = true;
        } else {
          // 已授权，记录并初始化
          try { wx.setStorageSync('ppq_privacy_agreed', true); } catch (e) { /* ignore */ }
          this._doAfterPrivacyAgreed();
        }
      },
      fail: () => {
        // 获取失败，显示弹窗让用户确认
        this._showPrivacyPrompt = true;
      },
    });
  }

  /**
   * 用户同意隐私协议后执行的初始化操作
   */
  _doAfterPrivacyAgreed() {
    // 同步本地进度到云端
    this._syncProgressToCloud();
    // 写入开放数据（排行榜数据源）
    this._updateOpenData();

    // 检查是否已有昵称，没有则弹出授权昵称弹窗
    try {
      const cached = wx.getStorageSync('ppq_user_info') || {};
      const refused = wx.getStorageSync('ppq_auth_refused');
      if (!cached.nickName && !refused) {
        this._showAuthPrompt = true;
      }
    } catch (e) { /* ignore */ }
  }

  /**
   * 隐私协议弹窗 - 用户点击同意
   */
  _onPrivacyAgree() {
    this._showPrivacyPrompt = false;

    if (typeof wx !== 'undefined' && wx.requirePrivacyAuthorize) {
      wx.requirePrivacyAuthorize({
        success: () => {
          try { wx.setStorageSync('ppq_privacy_agreed', true); } catch (e) { /* ignore */ }
          this._doAfterPrivacyAgreed();
        },
        fail: () => {
          // 用户在系统弹窗中拒绝了，提示后仍可继续游戏（不获取个人信息）
          this._toastText = '需同意隐私协议才能使用排行榜等功能';
          this._toastTimer = 90;
        },
      });
    } else {
      // 不支持 requirePrivacyAuthorize，直接记录同意
      try { wx.setStorageSync('ppq_privacy_agreed', true); } catch (e) { /* ignore */ }
      this._doAfterPrivacyAgreed();
    }
  }

  /**
   * 隐私协议弹窗 - 用户点击拒绝
   */
  _onPrivacyReject() {
    this._showPrivacyPrompt = false;
    // 拒绝后仍可玩游戏，但不同步云端数据
    this._toastText = '您可以稍后在设置中同意隐私协议';
    this._toastTimer = 90;
  }

  _calculateLayout() {
    const s = SCALE;

    // 横屏左侧安全边距（刘海屏/异形屏安全区）
    this.safeLeft = SAFE_LEFT;
    // 横屏右侧安全边距（胶囊按钮区域）
    this.safeRight = SAFE_RIGHT;
    // 内容区域（去掉左右安全边距后的可用宽度）
    this.contentLeft = this.safeLeft;
    this.contentWidth = SCREEN_WIDTH - this.safeLeft - this.safeRight;
    this.contentCenterX = this.safeLeft + this.contentWidth / 2;

    // 顶部标题区域（横屏模式下紧凑布局）
    this.titleY = 8 * s;
    this.titleHeight = 50 * s;

    // 底部导航栏（圆角胶囊样式）
    this.navHeight = 44 * s;
    this.navY = SCREEN_HEIGHT - this.navHeight - 8 * s;

    // 关卡网格区域
    this.gridTop = this.titleY + this.titleHeight + 8 * s;
    this.gridBottom = this.navY - 20 * s;
    this.gridHeight = this.gridBottom - this.gridTop;

    // 网格内边距
    this.gridPadX = 20 * s;
    this.gridPadY = 12 * s;

    // 单元格尺寸（基于内容区域宽度计算）
    const availW = this.contentWidth - this.gridPadX * 2;
    const availH = this.gridHeight - this.gridPadY * 2;
    this.cellGapX = 10 * s;   // 左右间距
    this.cellGapY = 10 * s;   // 上下间距
    this.cellW = (availW - (LEVEL_GRID_COLS - 1) * this.cellGapX) / LEVEL_GRID_COLS;
    this.cellRowH = (availH - (LEVEL_GRID_ROWS - 1) * this.cellGapY) / LEVEL_GRID_ROWS;
    this.cellH = Math.min(this.cellRowH, this.cellW * 1.0); // 格子接近正方形

    // 网格起始位置（基于内容区域）
    this.gridStartX = this.contentLeft + this.gridPadX;
    this.gridStartY = this.gridTop + this.gridPadY + (availH - LEVEL_GRID_ROWS * (this.cellH + this.cellGapY) + this.cellGapY) / 2;
  }

  /**
   * 触摸开始处理（供 main.js 统一分发器调用）
   * 注意：dev 组件的触摸拦截已经在 main.js 的 _dispatchTouch 中统一处理
   */
  handleTouchStart(x, y) {
    this.touchStartX = x;
    this.touchStartY = y;
    this._lastTouchX = x;
    this._lastTouchY = y;
    this.touchStartTime = Date.now();
    this.isDragging = true;
    this.isSwiping = false;
    this.isSlideAnimating = false; // 按下时中断正在进行的动画
    this.slideVelocity = 0;

    // 游戏介绍弹窗：按下时停止惯性滚动
    if (this.showGameIntro) {
      this._introScrolling = true;
      this._introScrollVelocity = 0;
    }
  }

  /**
   * 触摸移动处理（供 main.js 统一分发器调用）
   */
  handleTouchMove(x, y) {
    if (!this.isDragging) return;

    // 游戏介绍弹窗上下拖动（惯性滚动 - Move 阶段：跟手 + 记录速度）
    if (this.showGameIntro && this._introScrolling) {
      const dy = y - this._lastTouchY;
      this._introScrollY += dy;
      // 指数移动平均计算速度（更平滑的惯性）
      this._introScrollVelocity = dy * 0.6 + (this._introScrollVelocity || 0) * 0.4;
      this._lastTouchY = y;
      return;
    }

    const dx = x - this.touchStartX;
    const dy = y - this.touchStartY;

    // 判断滑动方向（首次超过10px时决定）
    if (!this.isSwiping && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
      this.isSwiping = Math.abs(dx) > Math.abs(dy);
    }

    if (this.isSwiping) {
      // 实时跟随手指：用增量更新偏移
      const moveDelta = x - this._lastTouchX;
      this.slideOffset += moveDelta;

      // 边界阻尼：首页往右拖或末页往左拖时加阻力
      if ((this.currentPage === 0 && this.slideOffset > 0) ||
        (this.currentPage >= this.totalPages - 1 && this.slideOffset < 0)) {
        this.slideOffset *= 0.4; // 强阻尼
      }
    }
    this._lastTouchX = x;
    this._lastTouchY = y;
  }

  /**
   * 触摸结束处理（供 main.js 统一分发器调用）
   */
  handleTouchEnd(x, y) {
    if (!this.isDragging) return;
    this.isDragging = false;

    const elapsed = Date.now() - this.touchStartTime;
    const totalDx = x - this.touchStartX;

    // 游戏介绍弹窗：松手处理
    if (this.showGameIntro) {
      this._introScrolling = false;
      // 判断是否为"点击"（滑动距离很小）→ 检测是否在弹窗外部关闭
      const totalDy = y - this.touchStartY;
      if (Math.abs(totalDy) < 10 && Math.abs(totalDx) < 10) {
        const s = SCALE;
        const bw = (SCREEN_WIDTH - 80 * s) * 0.8;
        const bh = (SCREEN_HEIGHT - 40 * s) * 0.8;
        const bx = (SCREEN_WIDTH - bw) / 2;
        const by = (SCREEN_HEIGHT - bh) / 2;
        if (x < bx || x > bx + bw || y < by || y > by + bh) {
          this.showGameIntro = false;
        }
      }
      // velocity 已在 Move 中累计，update 中会持续应用惯性并衰减
      return;
    }

    // 道具介绍弹窗左右滑动翻页
    if (this.showPropsGuide && Math.abs(totalDx) > 30 && elapsed < 500) {
      const props = this._getPropsData();
      if (totalDx < -30 && this._propsGuidePage < props.length - 1) {
        this._propsGuidePage++;
      } else if (totalDx > 30 && this._propsGuidePage > 0) {
        this._propsGuidePage--;
      }
      this.slideOffset = 0;
      this.isSwiping = false;
      return;
    }

    if (this.isSwiping) {
      // 计算松手速度
      const velocity = this.slideOffset / Math.max(elapsed, 1);
      const threshold = this.contentWidth * 0.15;

      // 判断翻页方向
      if (this.slideOffset < -threshold || velocity < -0.3) {
        // 向左滑 → 下一页
        if (this.currentPage < this.totalPages - 1) {
          this.currentPage++;
          this.slideOffset += this.contentWidth; // 偏移加一页宽度（动画起点）
        }
      } else if (this.slideOffset > threshold || velocity > 0.3) {
        // 向右滑 → 上一页
        if (this.currentPage > 0) {
          this.currentPage--;
          this.slideOffset -= this.contentWidth;
        }
      }

      // 启动回弹动画（目标偏移=0）
      this.isSlideAnimating = true;
      this.isSwiping = false;
    } else if (elapsed < 300 && Math.abs(this.slideOffset) < 5) {
      // 点击事件
      this._handleTap(x, y);
      this.slideOffset = 0;
    }
  }

  _handleTap(x, y) {
    // 隐私协议弹窗最高优先级
    if (this._showPrivacyPrompt) {
      this._handlePrivacyPromptTap(x, y);
      return;
    }

    // 授权弹窗优先处理
    if (this._showAuthPrompt) {
      this._handleAuthPromptTap(x, y);
      return;
    }

    // 游戏介绍弹窗：点击弹窗外部关闭
    if (this.showGameIntro) {
      const s = SCALE;
      const bw = (SCREEN_WIDTH - 80 * s) * 0.8;
      const bh = (SCREEN_HEIGHT - 40 * s) * 0.8;
      const bx = (SCREEN_WIDTH - bw) / 2;
      const by = (SCREEN_HEIGHT - bh) / 2;
      if (x < bx || x > bx + bw || y < by || y > by + bh) {
        this.showGameIntro = false;
      }
      return;
    }

    // 道具介绍弹窗（点击左右切换，点击上下区域关闭）
    if (this.showPropsGuide) {
      this._handlePropsGuideTap(x, y);
      return;
    }

    // 检测副标题行左右箭头点击
    if (this._arrowY) {
      const s = SCALE;
      const hitSize = 20 * s; // 点击热区半径
      if (Math.abs(y - this._arrowY) < hitSize) {
        // 左箭头 "<"：跳转到第一页
        if (Math.abs(x - this._arrowLeftX) < hitSize && this.currentPage > 0) {
          this.currentPage = 0;
          this.slideOffset = 0;
          return;
        }
        // 右箭头 ">"：跳转到已解锁的最后一页
        if (Math.abs(x - this._arrowRightX) < hitSize && this.currentPage < this.totalPages - 1) {
          const maxUnlocked = this.progress.getMaxUnlocked();
          const lastUnlockedPage = Math.min(
            Math.floor((maxUnlocked - 1) / LEVELS_PER_PAGE),
            this.totalPages - 1
          );
          this.currentPage = lastUnlockedPage;
          this.slideOffset = 0;
          return;
        }
      }
    }

    // 检测底部导航栏点击（胶囊样式）
    if (y >= this.navY && y <= this.navY + this.navHeight) {
      const s = SCALE;
      const padX = 30 * s;
      const barX = this.contentLeft + padX;
      const barW = this.contentWidth - padX * 2;
      if (x >= barX && x <= barX + barW) {
        const itemW = barW / this.navItems.length;
        const idx = Math.floor((x - barX) / itemW);
        if (idx >= 0 && idx < this.navItems.length) {
          this.navItems.forEach((item, i) => { item.active = i === idx; });
          this._onNavChange(idx);
        }
      }
      return;
    }

    // 设置面板按钮点击
    if (this.showSettings) {
      this._handleSettingsTap(x, y);
      return;
    }

    // 检测关卡格子点击
    const startIdx = this.currentPage * LEVELS_PER_PAGE;
    for (let row = 0; row < LEVEL_GRID_ROWS; row++) {
      for (let col = 0; col < LEVEL_GRID_COLS; col++) {
        const levelIdx = startIdx + (LEVEL_GRID_ROWS - 1 - row) * LEVEL_GRID_COLS + col;
        if (levelIdx >= TOTAL_LEVELS) continue;

        const cx = this.gridStartX + col * (this.cellW + this.cellGapX);
        const cy = this.gridStartY + row * (this.cellRowH + this.cellGapY) + (this.cellRowH - this.cellH) / 2;

        if (x >= cx && x <= cx + this.cellW && y >= cy && y <= cy + this.cellH) {
          const data = this.levelData[levelIdx];
          if (data.unlocked) {
            this.selectedLevel = levelIdx;
            if (this.onLevelSelected) {
              this.onLevelSelected(levelIdx + 1); // 关卡号从1开始
            }
          }
          return;
        }
      }
    }
  }

  /**
   * 通关更新
   */
  completeLevel(levelNum, stars, score) {
    this.progress.completeLevel(levelNum, stars);
    if (score) this.progress.saveScore(levelNum, score);
    this.levelData = this.progress.getAllData();
    // 通关后同步到云端
    this._uploadProgressToCloud();
    // 写入开放数据（好友排行用）
    this._updateOpenData();
  }

  /**
   * 解锁关卡
   */
  unlockLevel(levelNum) {
    this.progress.unlock(levelNum);
    this.levelData = this.progress.getAllData();
  }

  /**
   * 进入菜单时同步进度（双向）
   * - 云端 maxLevel > 本地：用云端数据覆盖本地，确保解锁到 maxLevel
   * - 本地 maxLevel > 云端：上传本地数据到云端
   * - 云端无数据：上传本地数据
   */
  _syncProgressToCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'get' },
      success: (res) => {
        const result = res.result;
        if (!result || result.code !== 0) {
          this._uploadProgressToCloud();
          return;
        }

        const localMax = this.progress.getMaxUnlocked();
        const cloudMax = result.maxLevel || 0;
        const cloudProgress = result.levelProgress;

        if (result.msg === 'not_found' || !cloudProgress) {
          // 云端无数据，上传本地
          if (localMax > 1) {
            this._uploadProgressToCloud();
          }
        } else if (cloudMax > localMax) {
          // 云端更新：用云端数据覆盖本地
          this._applyCloudProgress(cloudProgress, cloudMax);
        } else if (localMax > cloudMax) {
          // 本地更新：上传到云端
          this._uploadProgressToCloud();
        }
      },
      fail: (err) => {
        console.error('云函数调用失败:', err);
      },
    });
  }

  /**
   * 上传本地关卡进度到云端（含用户信息）
   */
  _uploadProgressToCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    const maxLevel = this.progress.getMaxUnlocked();
    const levelProgress = this.progress.getAllData();

    // 尝试获取已授权的用户信息
    let userInfo = null;
    try {
      const setting = wx.getStorageSync('ppq_user_info');
      if (setting) userInfo = setting;
    } catch (e) { /* ignore */ }
    console.log('levelProgress:', levelProgress);
    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: {
        action: 'save',
        maxLevel,
        levelProgress,
        userInfo,
      },
      success: (res) => { console.log('上传进度成功:', res); },
      fail: (err) => { console.error('上传进度失败:', err); },
    });
  }

  /**
   * 应用云端进度到本地
   * 用云端的 levelProgress 覆盖本地，并确保解锁到 cloudMax
   */
  _applyCloudProgress(cloudProgress, cloudMax) {
    if (cloudProgress && Array.isArray(cloudProgress)) {
      // 用云端数据覆盖本地
      for (let i = 0; i < cloudProgress.length && i < this.progress.data.length; i++) {
        const cloud = cloudProgress[i];
        const local = this.progress.data[i];
        // 取两者较高值（合并）
        if (cloud.unlocked) local.unlocked = true;
        if ((cloud.stars || 0) > (local.stars || 0)) {
          local.stars = cloud.stars;
        }
      }
    }

    // 确保解锁到 cloudMax
    for (let i = 0; i < cloudMax && i < this.progress.data.length; i++) {
      this.progress.data[i].unlocked = true;
    }

    // 保存到本地缓存并刷新显示
    this.progress.save();
    this.levelData = this.progress.getAllData();
    console.log('已从云端同步进度，maxLevel:', cloudMax);
  }

  /**
   * 获取最高解锁关卡
   */
  getMaxUnlockedLevel() {
    return this.progress.getMaxUnlocked();
  }

  /**
   * 导航 tab 切换回调
   */
  _onNavChange(idx) {
    const label = this.navItems[idx].label;
    if (label === '排行') {
      this.showRank = true;
      this.showSettings = false;
      this._showRankBoard();
    } else if (label === '设置') {
      this.showSettings = true;
      this.showRank = false;
      this._hideRankBoard();
    } else if (label === '150球') {
      // 启动150球特殊模式
      this.showSettings = false;
      this.showRank = false;
      if (this.onLevelSelected) {
        this.onLevelSelected(-150); // 用负数标记150球模式
      }
    } else {
      this.showSettings = false;
      if (this.showRank) {
        this.showRank = false;
        this._hideRankBoard();
      }
    }
  }

  /**
   * 显示排行榜 — 通知开放数据域获取数据
   */
  _showRankBoard() {
    if (typeof wx === 'undefined') return;
    const openDataContext = wx.getOpenDataContext();
    openDataContext.postMessage({ action: 'showRank' });
    // 缓存开放数据域的 canvas 引用
    this._openDataCanvas = openDataContext.canvas;
  }

  /**
   * 隐藏排行榜
   */
  _hideRankBoard() {
    if (typeof wx === 'undefined') return;
    const openDataContext = wx.getOpenDataContext();
    openDataContext.postMessage({ action: 'hideRank' });
    this._openDataCanvas = null;
  }

  /**
   * 写入开放数据（好友排行榜数据源）
   * 通关后调用，写入当前最高关卡和总星数
   */
  _updateOpenData() {
    if (typeof wx === 'undefined' || !wx.setUserCloudStorage) return;

    const maxLevel = this.progress.getMaxUnlocked();
    let totalStars = 0;
    this.levelData.forEach(d => { totalStars += d.stars || 0; });

    wx.setUserCloudStorage({
      KVDataList: [
        { key: 'maxLevel', value: String(maxLevel) },
        { key: 'totalStars', value: String(totalStars) },
      ],
      success: () => { console.log('开放数据写入成功'); },
      fail: (err) => { console.error('开放数据写入失败:', err); },
    });
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    // 滑动回弹动画
    if (this.isSlideAnimating) {
      this.slideOffset *= 0.82; // 衰减系数（越小越快吸附）
      if (Math.abs(this.slideOffset) < 0.5) {
        this.slideOffset = 0;
        this.isSlideAnimating = false;
      }
    }

    // 游戏介绍弹窗 - 惯性滚动（松手后持续滚动 + 逐渐减速 + 边界弹性回弹）
    if (this.showGameIntro && !this._introScrolling) {
      const maxScroll = this._introMaxScroll || 0;

      // 惯性应用
      if (Math.abs(this._introScrollVelocity) > 0.3) {
        this._introScrollY += this._introScrollVelocity;
        this._introScrollVelocity *= 0.92;  // 摩擦力衰减
        if (Math.abs(this._introScrollVelocity) < 0.3) {
          this._introScrollVelocity = 0;
        }
      }

      // 弹性回弹：超出顶部
      if (this._introScrollY > 0) {
        this._introScrollY *= 0.82;
        this._introScrollVelocity = 0;
        if (this._introScrollY < 0.5) this._introScrollY = 0;
      }
      // 弹性回弹：超出底部
      if (this._introScrollY < maxScroll) {
        this._introScrollY += (maxScroll - this._introScrollY) * 0.18;
        this._introScrollVelocity = 0;
        if (Math.abs(this._introScrollY - maxScroll) < 0.5) this._introScrollY = maxScroll;
      }
    }
  }

  render(ctx) {
    this._drawBackground(ctx);
    this._drawTitle(ctx);

    if (this.showRank) {
      this._drawRankBoard(ctx);
    } else if (this.showSettings) {
      this._drawSettings(ctx);
    } else {
      this._drawPageIndicator(ctx);
      this._drawLevelGrid(ctx);
    }

    // 游戏介绍弹窗（覆盖在最上层）
    if (this.showGameIntro) {
      this._drawGameIntro(ctx);
    }

    // 道具介绍弹窗
    if (this.showPropsGuide) {
      this._drawPropsGuide(ctx);
    }

    // 授权昵称弹窗
    if (this._showAuthPrompt) {
      this._drawAuthPrompt(ctx);
    }

    // 隐私协议弹窗（最高优先级，覆盖在最上层）
    if (this._showPrivacyPrompt) {
      this._drawPrivacyPrompt(ctx);
    }

    this._drawNavBar(ctx);

    // Toast 提示
    if (this._toastTimer > 0) {
      this._drawToast(ctx);
    }
  }

  /**
   * 渲染 Toast 提示（统一样式）
   */
  _drawToast(ctx) {
    this._toastTimer--;
    const s = SCALE;
    const centerX = this.contentCenterX;
    const centerY = SCREEN_HEIGHT * 0.35;

    // 淡入淡出
    let alpha = 1;
    if (this._toastTimer > 70) alpha = (90 - this._toastTimer) / 20;
    else if (this._toastTimer < 20) alpha = this._toastTimer / 20;

    ctx.globalAlpha = alpha * 0.9;

    // 支持多行文本
    const lines = (this._toastText || '').split('\\n');
    const lineHeight = 20 * s;
    const totalHeight = lines.length * lineHeight;
    const padding = 15 * s;
    const tw = 250 * s; // 加宽以容纳更多内容
    const th = totalHeight + padding * 2;
    const r = 10 * s;

    const boxY = centerY - th / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.beginPath();
    ctx.moveTo(centerX - tw / 2 + r, boxY);
    ctx.lineTo(centerX + tw / 2 - r, boxY);
    ctx.arcTo(centerX + tw / 2, boxY, centerX + tw / 2, boxY + r, r);
    ctx.arcTo(centerX + tw / 2, boxY + th, centerX + tw / 2 - r, boxY + th, r);
    ctx.lineTo(centerX - tw / 2 + r, boxY + th);
    ctx.arcTo(centerX - tw / 2, boxY + th, centerX - tw / 2, boxY + th - r, r);
    ctx.arcTo(centerX - tw / 2, boxY, centerX - tw / 2 + r, boxY, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${13 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    lines.forEach((line, idx) => {
      const y = boxY + padding + idx * lineHeight + lineHeight / 2;
      ctx.fillText(line, centerX, y);
    });

    ctx.globalAlpha = 1;
  }

  /**
   * 将开放数据域的 sharedCanvas 绘制到主域
   */
  _drawRankBoard(ctx) {
    if (!this._openDataCanvas) return;
    const top = this.gridTop;
    const height = this.gridBottom - this.gridTop;

    // 将开放数据域 canvas 绘制到游戏区域
    ctx.drawImage(
      this._openDataCanvas,
      0, 0, this._openDataCanvas.width, this._openDataCanvas.height,
      0, top, SCREEN_WIDTH, height
    );
  }

  /**
   * 绘制设置面板
   */
  _drawSettings(ctx) {
    // 重置渲染状态，防止被其他模块污染
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const s = SCALE;
    const top = this.gridTop + 20 * s;
    const centerX = this.contentCenterX;

    // 两列布局参数
    const cols = 2;
    const btnW = 140 * s;
    const btnH = 44 * s;
    const gapX = 16 * s;   // 列间距
    const gapY = 16 * s;   // 行间距
    const totalW = cols * btnW + (cols - 1) * gapX;
    const startX = centerX - totalW / 2;

    const buttons = [
      { label: '分享游戏', color: '#ffffff' },
      { label: this.soundOn ? '声音（开）' : '声音（关）', color: this.soundOn ? '#ffffff' : '#888899' },
      { label: '同步数据', color: '#ffffff' },
      { label: '道具介绍', color: '#ffffff' },
      { label: '游戏介绍', color: '#ffffff' },
    ];

    // 存储按钮位置（供点击检测用）
    this._settingBtns = [];

    buttons.forEach((btn, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (btnW + gapX);
      const y = top + row * (btnH + gapY);
      const r = 8 * s;

      // 透明背景 + 白色边框
      ctx.strokeStyle = btn.color;
      ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + btnW - r, y);
      ctx.arcTo(x + btnW, y, x + btnW, y + r, r);
      ctx.arcTo(x + btnW, y + btnH, x + btnW - r, y + btnH, r);
      ctx.lineTo(x + r, y + btnH);
      ctx.arcTo(x, y + btnH, x, y + btnH - r, r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
      ctx.stroke();

      // 文字
      ctx.fillStyle = btn.color;
      ctx.font = `bold ${14 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, x + btnW / 2, y + btnH / 2);

      this._settingBtns.push({ x, y, w: btnW, h: btnH });
    });

    // 渲染结束后清除状态
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  /**
   * 处理设置面板按钮点击
   */
  _handleSettingsTap(x, y) {
    if (!this._settingBtns) return;

    for (let i = 0; i < this._settingBtns.length; i++) {
      const btn = this._settingBtns[i];
      if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
        switch (i) {
          case 0: this._doShare(); break;
          case 1: this._toggleSound(); break;
          case 2: this._doSyncData(); break;
          case 3: this.showPropsGuide = true; this._propsGuidePage = 0; break;
          case 4: this.showGameIntro = true; this._introScrollY = 0; break;
        }
        return;
      }
    }
  }

  /**
   * 分享游戏
   */
  _doShare() {
    if (typeof wx === 'undefined') return;
    wx.shareAppMessage({
      title: '碰碰球 — 超爽弹球粉碎游戏！快来挑战！',
      imageUrl: 'images/welcome.jpg',
    });
  }

  /**
   * 切换声音开关
   */
  _toggleSound() {
    this.soundOn = !this.soundOn;
    try {
      wx.setStorageSync('ppq_sound', this.soundOn);
    } catch (e) { /* ignore */ }
  }

  /**
   * 同步数据（双向对比，以 maxLevel 大的为准）
   * 同时检查是否需要获取用户信息
   */
  _doSyncData() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    this._toastText = '同步中...';
    this._toastTimer = 60;

    // 检查是否需要获取用户信息
    this._checkAndRequestUserProfile();

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'get' },
      success: (res) => {
        const result = res.result;
        if (!result || result.code !== 0) {
          // 云端无数据，直接上传本地
          this._uploadProgressToCloud();
          this._toastText = '数据已上传到云端';
          this._toastTimer = 90;
          return;
        }

        const localMax = this.progress.getMaxUnlocked();
        const cloudMax = result.maxLevel || 0;
        const cloudProgress = result.levelProgress;

        if (cloudMax > localMax && cloudProgress) {
          // 云端更新：拉取云端数据覆盖本地
          this._applyCloudProgress(cloudProgress, cloudMax);
          this._toastText = `已从云端同步（第${cloudMax}关）`;
          this._toastTimer = 90;
        } else if (localMax > cloudMax) {
          // 本地更新：上传本地数据到云端
          this._uploadProgressToCloud();
          this._toastText = `数据已同步到云端（第${localMax}关）`;
          this._toastTimer = 90;
        } else {
          // 数据一致
          this._toastText = '数据已是最新';
          this._toastTimer = 90;
        }
      },
      fail: () => {
        this._toastText = '同步失败，请检查网络';
        this._toastTimer = 90;
      },
    });
  }

  /**
   * 检查并请求用户信息
   * 如果没有 nickName，直接触发 _requestUserProfile()
   */
  _checkAndRequestUserProfile() {
    try {
      const cached = wx.getStorageSync('ppq_user_info') || {};
      if (!cached.nickName || cached.nickName === '') {
        // 没有 nickName，直接请求用户信息
        this._requestUserProfile();
      }
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * 绘制游戏介绍弹窗
   */
  _drawGameIntro(ctx) {
    const s = SCALE;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 宽高各减 20%（居中）
    const boxW = (SCREEN_WIDTH - 80 * s) * 0.8;
    const boxH = (SCREEN_HEIGHT - 40 * s) * 0.8;
    const boxX = (SCREEN_WIDTH - boxW) / 2;
    const boxY = (SCREEN_HEIGHT - boxH) / 2;

    // 弹窗背景
    ctx.fillStyle = '#0c1435';
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 1.5 * s;
    const r = 10 * s;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r);
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 8 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 标题
    ctx.fillStyle = '#00d4ff';
    ctx.font = `bold ${16 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('游戏介绍', SCREEN_WIDTH / 2, boxY + 12 * s);

    // 内容
    const lines = [
      '【基础操作】',
      '滑动屏幕调整弹球发射角度，松手发射。',
      '弹球碰到砖块反弹，数字归零即粉碎！',
      '',
      '【核心目标】',
      '消灭所有数字砖块即可通关！',
      '用更少弹球通关，获得更高评价～',
      '',
      '【道具与机关】',
      '⚡ 闪电：清掉一整片砖块',
      '●● 多球：额外增加弹球数量',
      '⚔ 攻击：提升白球消耗砖块数',
      '△ 三角/障碍：利用反射打出巧妙路线',
      '',
      '【小技巧】',
      '利用墙壁和砖块反弹，让弹球在缝隙',
      '来回穿梭，打出更高消除效率！',
      '',
      '【评分系统】',
      'Combo连击：短时间内连续命中砖块获得倍率加成',
      '球升级：白球累计击打5/10/20/30次砖块后变色',
      '变色后的球攻击力和加分倍率更高！',
      '',
      '【过关条件】',
      '达到目标积分即可过关。',
      '越少轮数达成目标，星级越高！',
    ];

    const lineH = 16 * s;
    const contentTop = boxY + 38 * s;
    const contentBottom = boxY + boxH - 28 * s;
    const contentH = contentBottom - contentTop;
    const totalContentH = lines.length * lineH;

    // 限制滚动范围（允许少量弹性超出，由 update 中的回弹处理）
    const maxScroll = Math.min(0, contentH - totalContentH);
    // 手动拖动时允许超出 30px（弹性感），惯性滚动中由 update 限制
    const elasticLimit = 30;
    if (this._introScrollY < maxScroll - elasticLimit) this._introScrollY = maxScroll - elasticLimit;
    if (this._introScrollY > elasticLimit) this._introScrollY = elasticLimit;
    // 保存 maxScroll 供 update 回弹使用
    this._introMaxScroll = maxScroll;

    // 裁剪内容区域
    ctx.save();
    ctx.beginPath();
    ctx.rect(boxX, contentTop, boxW, contentH);
    ctx.clip();

    // 绘制内容（带滚动偏移）
    ctx.textAlign = 'left';
    lines.forEach((line, i) => {
      const ly = contentTop + i * lineH + this._introScrollY;
      // 跳过不可见行
      if (ly + lineH < contentTop || ly > contentBottom) return;
      if (line.startsWith('【')) {
        ctx.fillStyle = '#ffdd00';
        ctx.font = `bold ${11.5 * s}px Arial`;
      } else {
        ctx.fillStyle = '#ccddff';
        ctx.font = `${11 * s}px Arial`;
      }
      ctx.fillText(line, boxX + 16 * s, ly);
    });

    ctx.restore();

    // 滚动指示器（内容超出时显示）
    if (totalContentH > contentH) {
      const barH = Math.max(10 * s, contentH * (contentH / totalContentH));
      const barY = contentTop + (-this._introScrollY / (totalContentH - contentH)) * (contentH - barH);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(boxX + boxW - 6 * s, barY, 3 * s, barH);
    }

    // 底部提示
    ctx.fillStyle = '#888899';
    ctx.font = `${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('点击外部关闭 / 上下拖动查看更多', SCREEN_WIDTH / 2, boxY + boxH - 12 * s);
  }

  /**
   * 道具介绍数据
   */
  _getPropsData() {
    return [
      {
        name: '单列消除',
        icon: '|',
        iconColor: '#ff3333',
        desc: [
          '红色外圈 + 红色竖条',
          '',
          '白球经过道具时触发，',
          '对同列所有砖块造成伤害。',
          '伤害 = 当前攻击力等级。',
          '',
          '整列砖块全部消除后道具消失。',
          '可被多次触发直到列清空。',
        ],
      },
      {
        name: '单行消除',
        icon: '—',
        iconColor: '#ff3333',
        desc: [
          '红色外圈 + 红色横条',
          '',
          '白球经过道具时触发，',
          '对同行所有砖块造成伤害。',
          '伤害 = 当前攻击力等级。',
          '',
          '整行砖块全部消除后道具消失。',
          '可被多次触发直到行清空。',
        ],
      },
      {
        name: '空心白洞',
        icon: '◎',
        iconColor: '#ffffff',
        desc: [
          '白色空心圆环，脉动发光',
          '',
          '白球碰到后传送到随机位置。',
          '每颗球每次飞行只触发一次，',
          '防止来回传送死循环。',
          '',
          '第18关起出现。',
          '传送目标会短暂显示标记。',
        ],
      },
      {
        name: '闪电',
        icon: '⚡',
        iconColor: '#ffcc00',
        desc: [
          '瞄准阶段点击左上角闪电按钮',
          '',
          '立即清除最底一行所有砖块。',
          '适合在砖块快要触底时使用，',
          '紧急情况的救命技能！',
          '',
          '每局初始4次机会。',
        ],
      },
      {
        name: '多球',
        icon: '●●',
        iconColor: '#ff6688',
        desc: [
          '瞄准阶段点击左上角多球按钮',
          '',
          '本轮发射的球数量翻倍！',
          '多球 = 多消除 = 更高分。',
          '',
          '每局初始5次机会。',
          '可叠加使用（2→4→8...）',
        ],
      },
      {
        name: '攻击增幅',
        icon: '⚔',
        iconColor: '#ff9900',
        desc: [
          '瞄准阶段点击左上角攻击按钮',
          '',
          '白球攻击力永久+1。',
          '默认攻击力1（每碰扣1HP），',
          '升级后每碰扣2、3、4...HP。',
          '',
          '每局初始5次机会。',
          '对消行/消列伤害也生效。',
        ],
      },
    ];
  }

  /**
   * 绘制道具介绍 banner 弹窗
   */
  _drawPropsGuide(ctx) {
    const s = SCALE;
    const props = this._getPropsData();
    const page = this._propsGuidePage;
    const prop = props[page];

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 宽高各减 20%（居中）
    const boxW = (SCREEN_WIDTH - 120 * s) * 0.8;
    const boxH = (SCREEN_HEIGHT - 60 * s) * 0.8;
    const boxX = (SCREEN_WIDTH - boxW) / 2;
    const boxY = (SCREEN_HEIGHT - boxH) / 2;
    const r = 10 * s;

    // 弹窗背景
    ctx.fillStyle = '#0c1435';
    ctx.strokeStyle = '#4499cc';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r);
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 图标
    ctx.fillStyle = prop.iconColor;
    ctx.font = `bold ${36 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prop.icon, SCREEN_WIDTH / 2, boxY + 40 * s);

    // 名称
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${16 * s}px Arial`;
    ctx.fillText(prop.name, SCREEN_WIDTH / 2, boxY + 72 * s);

    // 描述
    ctx.fillStyle = '#ccddff';
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'left';
    const descTop = boxY + 95 * s;
    const lineH = 16 * s;
    prop.desc.forEach((line, i) => {
      ctx.fillText(line, boxX + 16 * s, descTop + i * lineH);
    });

    // 页码指示器
    ctx.textAlign = 'center';
    ctx.fillStyle = '#888899';
    ctx.font = `${10 * s}px Arial`;
    ctx.fillText(`${page + 1} / ${props.length}`, SCREEN_WIDTH / 2, boxY + boxH - 30 * s);

    // 左右箭头提示
    if (page > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${20 * s}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText('‹', boxX + 6 * s, SCREEN_HEIGHT / 2);
    }
    if (page < props.length - 1) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${20 * s}px Arial`;
      ctx.textAlign = 'right';
      ctx.fillText('›', boxX + boxW - 6 * s, SCREEN_HEIGHT / 2);
    }

    // 底部提示
    ctx.fillStyle = '#666677';
    ctx.font = `${9 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('← 左右点击翻页 | 点击上下区域关闭 →', SCREEN_WIDTH / 2, boxY + boxH - 12 * s);
  }

  /**
   * 道具介绍弹窗点击处理
   */
  _handlePropsGuideTap(x, y) {
    const s = SCALE;
    const props = this._getPropsData();

    // 计算弹窗区域（与 _drawPropsGuide 一致）
    const boxW = (SCREEN_WIDTH - 120 * s) * 0.8;
    const boxH = (SCREEN_HEIGHT - 60 * s) * 0.8;
    const boxX = (SCREEN_WIDTH - boxW) / 2;
    const boxY = (SCREEN_HEIGHT - boxH) / 2;

    // 点击弹窗外部 → 关闭
    if (x < boxX || x > boxX + boxW || y < boxY || y > boxY + boxH) {
      this.showPropsGuide = false;
      return;
    }

    // 左半边点击 → 上一页
    if (x < boxX + boxW / 2) {
      if (this._propsGuidePage > 0) this._propsGuidePage--;
    } else {
      // 右半边点击 → 下一页
      if (this._propsGuidePage < props.length - 1) this._propsGuidePage++;
      else this.showPropsGuide = false; // 最后一页再点右边关闭
    }
  }

  /**
   * 绘制隐私协议弹窗
   * 微信规范要求：处理用户个人信息前必须以弹窗方式提示用户阅读同意隐私协议
   */
  _drawPrivacyPrompt(ctx) {
    const s = SCALE;
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const boxW = 280 * s;
    const boxH = 160 * s;
    const boxX = centerX - boxW / 2;
    const boxY = centerY - boxH / 2;
    const r = 12 * s;

    // 弹窗背景（圆角矩形）
    ctx.fillStyle = '#0c1435';
    ctx.strokeStyle = '#4499cc';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r);
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('用户隐私保护提示', centerX, boxY + 25 * s);

    // 正文内容
    ctx.fillStyle = '#ccccdd';
    ctx.font = `${11 * s}px Arial`;
    ctx.fillText('在您使用本游戏前，请仔细阅读', centerX, boxY + 52 * s);

    // 隐私协议链接（突出显示）
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${11 * s}px Arial`;
    ctx.fillText('《隐私协议》', centerX, boxY + 70 * s);

    ctx.fillStyle = '#ccccdd';
    ctx.font = `${11 * s}px Arial`;
    ctx.fillText('我们将收集您的昵称、头像用于排行榜展示', centerX, boxY + 88 * s);

    // 按钮
    const btnW = 100 * s;
    const btnH = 34 * s;
    const btnY = boxY + boxH - 50 * s;

    // "同意并继续" 按钮
    ctx.fillStyle = '#4499cc';
    ctx.beginPath();
    const btnR = 6 * s;
    const agreeX = centerX - btnW - 8 * s;
    ctx.moveTo(agreeX + btnR, btnY);
    ctx.lineTo(agreeX + btnW - btnR, btnY);
    ctx.arcTo(agreeX + btnW, btnY, agreeX + btnW, btnY + btnR, btnR);
    ctx.arcTo(agreeX + btnW, btnY + btnH, agreeX + btnW - btnR, btnY + btnH, btnR);
    ctx.lineTo(agreeX + btnR, btnY + btnH);
    ctx.arcTo(agreeX, btnY + btnH, agreeX, btnY + btnH - btnR, btnR);
    ctx.arcTo(agreeX, btnY, agreeX + btnR, btnY, btnR);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0c1435';
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.fillText('同意并继续', agreeX + btnW / 2, btnY + btnH / 2);

    // "不同意" 按钮
    const rejectX = centerX + 8 * s;
    ctx.strokeStyle = '#888899';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    ctx.moveTo(rejectX + btnR, btnY);
    ctx.lineTo(rejectX + btnW - btnR, btnY);
    ctx.arcTo(rejectX + btnW, btnY, rejectX + btnW, btnY + btnR, btnR);
    ctx.arcTo(rejectX + btnW, btnY + btnH, rejectX + btnW - btnR, btnY + btnH, btnR);
    ctx.lineTo(rejectX + btnR, btnY + btnH);
    ctx.arcTo(rejectX, btnY + btnH, rejectX, btnY + btnH - btnR, btnR);
    ctx.arcTo(rejectX, btnY, rejectX + btnR, btnY, btnR);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = '#888899';
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.fillText('不同意', rejectX + btnW / 2, btnY + btnH / 2);
  }

  /**
   * 隐私协议弹窗点击处理
   */
  _handlePrivacyPromptTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const boxH = 160 * s;
    const boxY = centerY - boxH / 2;
    const btnW = 100 * s;
    const btnH = 34 * s;
    const btnY = boxY + boxH - 50 * s;

    // "同意并继续" 按钮区域
    const agreeX = centerX - btnW - 8 * s;
    if (x >= agreeX && x <= agreeX + btnW &&
      y >= btnY && y <= btnY + btnH) {
      this._onPrivacyAgree();
      return;
    }

    // "不同意" 按钮区域
    const rejectX = centerX + 8 * s;
    if (x >= rejectX && x <= rejectX + btnW &&
      y >= btnY && y <= btnY + btnH) {
      this._onPrivacyReject();
      return;
    }

    // 点击"隐私协议"链接 - 打开隐私协议页面
    const linkY = boxY + 70 * s;
    if (y >= linkY - 12 * s && y <= linkY + 12 * s &&
      x >= centerX - 60 * s && x <= centerX + 60 * s) {
      if (typeof wx !== 'undefined' && wx.openPrivacyContract) {
        wx.openPrivacyContract({
          fail: () => {
            this._toastText = '无法打开隐私协议';
            this._toastTimer = 60;
          },
        });
      }
      return;
    }
  }

  /**
   * 绘制授权昵称弹窗
   */
  _drawAuthPrompt(ctx) {
    const s = SCALE;
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const boxW = 240 * s;
    const boxH = 120 * s;
    const boxX = centerX - boxW / 2;
    const boxY = centerY - boxH / 2;
    const r = 10 * s;

    // 弹窗背景
    ctx.fillStyle = '#0c1435';
    ctx.strokeStyle = '#4499cc';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.moveTo(boxX + r, boxY);
    ctx.lineTo(boxX + boxW - r, boxY);
    ctx.arcTo(boxX + boxW, boxY, boxX + boxW, boxY + r, r);
    ctx.arcTo(boxX + boxW, boxY + boxH, boxX + boxW - r, boxY + boxH, r);
    ctx.lineTo(boxX + r, boxY + boxH);
    ctx.arcTo(boxX, boxY + boxH, boxX, boxY + boxH - r, r);
    ctx.arcTo(boxX, boxY, boxX + r, boxY, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('是否授权获取昵称信息？', centerX, boxY + 30 * s);
    ctx.fillStyle = '#888899';
    ctx.font = `${10 * s}px Arial`;
    ctx.fillText('用于排行榜展示', centerX, boxY + 50 * s);

    // 按钮
    const btnW = 80 * s;
    const btnH = 32 * s;
    const btnY = boxY + boxH - 45 * s;

    // "是" 按钮
    ctx.strokeStyle = '#39ff14';
    ctx.lineWidth = 1 * s;
    ctx.strokeRect(centerX - btnW - 10 * s, btnY, btnW, btnH);
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${13 * s}px Arial`;
    ctx.fillText('是', centerX - btnW / 2 - 10 * s, btnY + btnH / 2);

    // "否" 按钮
    ctx.strokeStyle = '#888899';
    ctx.strokeRect(centerX + 10 * s, btnY, btnW, btnH);
    ctx.fillStyle = '#888899';
    ctx.fillText('否', centerX + btnW / 2 + 10 * s, btnY + btnH / 2);
  }

  /**
   * 授权弹窗点击处理
   */
  _handleAuthPromptTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const boxH = 120 * s;
    const btnW = 80 * s;
    const btnH = 32 * s;
    const btnY = centerY - boxH / 2 + boxH - 45 * s;

    // "是" 按钮区域
    if (x >= centerX - btnW - 10 * s && x <= centerX - 10 * s &&
      y >= btnY && y <= btnY + btnH) {
      this._showAuthPrompt = false;
      this._requestUserProfile();
      return;
    }

    // "否" 按钮区域
    if (x >= centerX + 10 * s && x <= centerX + btnW + 10 * s &&
      y >= btnY && y <= btnY + btnH) {
      this._showAuthPrompt = false;
      // 标记拒绝，下次不再弹窗
      try {
        wx.setStorageSync('ppq_auth_refused', true);
        const info = wx.getStorageSync('ppq_user_info') || {};
        info.refused = true;
        wx.setStorageSync('ppq_user_info', info);
      } catch (e) { /* ignore */ }
      return;
    }
  }

  /**
   * 请求用户昵称授权（wx.getUserProfile）
   * 先检查隐私协议，再请求用户信息
   */
  _requestUserProfile() {
    if (typeof wx === 'undefined' || !wx.getUserProfile) return;

    // 先处理隐私协议授权（微信隐私保护指引要求）
    const doGetUserProfile = () => {
      wx.getUserProfile({
        desc: '用于游戏内展示玩家昵称。',
        success: (res) => {
          const info = res.userInfo;
          try {
            const cached = wx.getStorageSync('ppq_user_info') || {};
            cached.nickName = info.nickName || '';
            cached.avatarUrl = info.avatarUrl || '';
            cached.refused = false;
            wx.setStorageSync('ppq_user_info', cached);
            wx.setStorageSync('ppq_auth_refused', false);
          } catch (e) { /* ignore */ }

          // 同步到云函数
          if (wx.cloud) {
            wx.cloud.callFunction({
              name: 'saveUserProgress',
              data: {
                action: 'save',
                userInfo: {
                  nickName: info.nickName || '',
                  avatarUrl: info.avatarUrl || '',
                },
              },
              success: (res) => {
                console.log('[云函数调用成功]', res);
              },
              fail: (err) => {
                console.error('[云函数调用失败]', err);
              },
            });
          }

          // 记录成功信息和返回数据到 console.log
          console.log('[授权成功]', res);
          console.log('用户名称：', info.nickName || '');
          this._toastText = '授权成功（查看Dev日志）';
          this._toastTimer = 60;
        },
        fail: (err) => {
          // 用户取消了授权弹窗
          try {
            wx.setStorageSync('ppq_auth_refused', true);
          } catch (e) { /* ignore */ }

          // 记录失败错误信息到 console.log
          console.error('[授权失败]', err);
          this._toastText = '授权失败（查看Dev日志）';
          this._toastTimer = 60;
        },
      });
    };

    // 检查隐私协议状态并要求授权
    if (wx.getPrivacySetting) {
      wx.getPrivacySetting({
        success: (res) => {
          if (res.needAuthorization) {
            // 需要展示隐私协议弹窗
            if (wx.requirePrivacyAuthorize) {
              wx.requirePrivacyAuthorize({
                success: () => {
                  // 用户同意隐私协议后，再请求用户信息
                  doGetUserProfile();
                },
                fail: () => {
                  // 用户拒绝隐私协议
                  try {
                    wx.setStorageSync('ppq_auth_refused', true);
                  } catch (e) { /* ignore */ }
                  this._toastText = '需要同意隐私协议';
                  this._toastTimer = 60;
                },
              });
            } else {
              // 不支持 requirePrivacyAuthorize，直接请求
              doGetUserProfile();
            }
          } else {
            // 已授权隐私协议，直接请求用户信息
            doGetUserProfile();
          }
        },
        fail: () => {
          // 获取隐私设置失败，直接请求用户信息
          doGetUserProfile();
        },
      });
    } else {
      // 不支持 getPrivacySetting，直接请求用户信息
      doGetUserProfile();
    }
  }

  _drawBackground(ctx) {
    // 深色渐变背景
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, COLORS.bgTop);
    gradient.addColorStop(0.5, '#0f0a2a');
    gradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 随机星光粒子（静态绘制几个）
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    const stars = [
      [0.1, 0.05], [0.3, 0.12], [0.7, 0.08], [0.9, 0.15],
      [0.15, 0.25], [0.5, 0.3], [0.85, 0.22], [0.6, 0.45],
      [0.2, 0.55], [0.75, 0.6], [0.4, 0.7], [0.9, 0.75],
    ];
    stars.forEach(([rx, ry]) => {
      const size = 1 + Math.sin(this.glowPhase + rx * 10) * 0.5;
      ctx.beginPath();
      ctx.arc(rx * SCREEN_WIDTH, ry * SCREEN_HEIGHT, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  _drawTitle(ctx) {
    const s = SCALE;
    const centerX = this.contentCenterX;
    const y = this.titleY;

    // 主标题 "弹球粉碎大师" — 霓虹蓝发光大字
    const title = '弹球粉碎大师';
    const fontSize = 24 * s;

    // 外发光层
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 18 * s;
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(title, centerX, y + 18 * s);

    // 主体文字（白色）
    ctx.shadowBlur = 6 * s;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, centerX, y + 18 * s);
    ctx.shadowBlur = 0;

    // 副标题："选择关卡  当前:X  |  开启挑战"（与主标题间距增加8px）
    const maxUnlocked = this.progress.getMaxUnlocked();
    const subTitleY = y + 48 * s;
    ctx.fillStyle = 'rgba(180,210,255,0.7)';
    ctx.font = `${11 * s}px Arial`;
    const subText = `选择关卡   当前:${maxUnlocked}  |  开启挑战`;
    ctx.fillText(subText, centerX, subTitleY);

    // 测量副标题文字宽度，将箭头紧贴文字两侧
    const subTextWidth = ctx.measureText(subText).width;
    const arrowGap = 12 * s; // 箭头与文字之间的间距
    const arrowLeftX = centerX - subTextWidth / 2 - arrowGap;
    const arrowRightX = centerX + subTextWidth / 2 + arrowGap;

    // 左侧 "<" 按钮（跳转到第一页）
    const arrowFont = `bold ${14 * s}px Arial`;
    ctx.font = arrowFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = this.currentPage > 0 ? 'rgba(180,210,255,0.9)' : 'rgba(100,120,150,0.4)';
    ctx.fillText('<', arrowLeftX, subTitleY);

    // 右侧 ">" 按钮（跳转到已解锁最后一页）
    ctx.fillStyle = this.currentPage < this.totalPages - 1 ? 'rgba(180,210,255,0.9)' : 'rgba(100,120,150,0.4)';
    ctx.fillText('>', arrowRightX, subTitleY);

    // 记录箭头位置供点击检测使用
    this._arrowLeftX = arrowLeftX;
    this._arrowRightX = arrowRightX;
    this._arrowY = subTitleY;
  }

  _drawPageIndicator(ctx) {
    // 页码指示器已融入副标题，不再单独绘制
  }

  _drawLevelGrid(ctx) {
    const s = SCALE;
    const borderPad = 12 * s;
    const bx = this.contentLeft + this.gridPadX - borderPad;
    const by = this.gridTop;
    const bw = this.contentWidth - this.gridPadX * 2 + 2 * borderPad;
    const bh = this.gridHeight;
    const cornerR = 10 * s;

    // 外框圆角发光边框
    const glowIntensity = 0.5 + 0.3 * Math.sin(this.glowPhase);
    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 10 * s * glowIntensity;
    this._roundRect(ctx, bx, by, bw, bh, cornerR);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 裁剪区域（只在边框内绘制，防止格子画到外面）
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, bw, bh);
    ctx.clip();

    // 渲染当前页 + 相邻页（带滑动偏移）
    const offset = this.slideOffset;
    this._drawPageCells(ctx, this.currentPage, offset);

    // 如果向右拖（offset>0），左边露出前一页
    if (offset > 0 && this.currentPage > 0) {
      this._drawPageCells(ctx, this.currentPage - 1, offset - this.contentWidth);
    }
    // 如果向左拖（offset<0），右边露出后一页
    if (offset < 0 && this.currentPage < this.totalPages - 1) {
      this._drawPageCells(ctx, this.currentPage + 1, offset + this.contentWidth);
    }

    ctx.restore();
  }

  /**
   * 绘制一页的关卡格子（带水平偏移）
   */
  _drawPageCells(ctx, pageIdx, offsetX) {
    const startIdx = pageIdx * LEVELS_PER_PAGE;

    for (let row = 0; row < LEVEL_GRID_ROWS; row++) {
      for (let col = 0; col < LEVEL_GRID_COLS; col++) {
        const levelIdx = startIdx + (LEVEL_GRID_ROWS - 1 - row) * LEVEL_GRID_COLS + col;
        if (levelIdx >= TOTAL_LEVELS || levelIdx < 0) continue;

        const cx = this.gridStartX + col * (this.cellW + this.cellGapX) + offsetX;
        const cy = this.gridStartY + row * (this.cellRowH + this.cellGapY) + (this.cellRowH - this.cellH) / 2;

        this._drawLevelCell(ctx, cx, cy, levelIdx);
      }
    }
  }

  _drawLevelCell(ctx, x, y, levelIdx) {
    const s = SCALE;
    const data = this.levelData[levelIdx];
    const levelNum = levelIdx + 1;
    const w = this.cellW;
    const h = this.cellH;
    const isSelected = this.selectedLevel === levelIdx;
    const cornerR = 6 * s;

    if (data.unlocked) {
      // 已解锁关卡 — 深色填充背景 + 蓝色发光边框
      const cellGlow = isSelected ? 1.0 : (0.3 + 0.15 * Math.sin(this.glowPhase + levelIdx * 0.3));

      // 填充深色背景
      ctx.fillStyle = isSelected ? 'rgba(0,80,140,0.4)' : 'rgba(10,20,50,0.8)';
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.fill();

      // 边框
      ctx.strokeStyle = isSelected ? '#00d4ff' : '#2a5580';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.shadowColor = isSelected ? '#00d4ff' : '#2a5580';
      ctx.shadowBlur = (isSelected ? 10 : 3) * s * cellGlow;
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // 关卡号（大字）
      ctx.fillStyle = COLORS.textWhite;
      ctx.font = `bold ${15 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2 - 7 * s);

      // 星星
      this._drawStars(ctx, x + w / 2, y + h - 10 * s, data.stars, 3, 5 * s);

    } else {
      // 未解锁关卡 — 暗色背景 + 暗边框
      ctx.fillStyle = 'rgba(15,20,40,0.6)';
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.fill();

      ctx.strokeStyle = '#1a2a44';
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.stroke();

      // 关卡号（灰色）
      ctx.fillStyle = '#444466';
      ctx.font = `${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2 - 5 * s);

      // 灰色星星
      this._drawStars(ctx, x + w / 2, y + h - 10 * s, 0, 3, 5 * s);
    }
  }

  _drawStars(ctx, centerX, centerY, count, total, size) {
    const gap = size * 2.2;
    const startX = centerX - ((total - 1) * gap) / 2;

    for (let i = 0; i < total; i++) {
      const sx = startX + i * gap;
      const filled = i < count;
      ctx.fillStyle = filled ? COLORS.starActive : COLORS.starInactive;
      if (filled) {
        ctx.shadowColor = COLORS.starActive;
        ctx.shadowBlur = 4 * SCALE;
      }
      this._drawStar(ctx, sx, centerY, size, size * 0.4);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
    // 彻底清除阴影残留
    ctx.shadowColor = 'transparent';
  }

  _drawStar(ctx, cx, cy, outerR, innerR) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const angle = (Math.PI / 2) * -1 + (Math.PI / 5) * i;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }

  _drawNavBar(ctx) {
    // 重置渲染状态，防止前面模块残留影响
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    const s = SCALE;
    const y = this.navY;
    const h = this.navHeight;
    const padX = 30 * s;
    const barX = this.contentLeft + padX;
    const barW = this.contentWidth - padX * 2;
    const cornerR = h / 2; // 完全圆角胶囊

    // 导航栏背景（深色圆角胶囊）
    ctx.fillStyle = 'rgba(10,15,40,0.85)';
    ctx.strokeStyle = 'rgba(80,100,150,0.4)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, barX, y, barW, h, cornerR);
    ctx.fill();
    ctx.stroke();

    // 导航项
    const itemW = barW / this.navItems.length;
    const symbols = ['»', '·', '~']; // 普通符号修饰

    this.navItems.forEach((item, i) => {
      const ix = barX + itemW * i + itemW / 2;
      const isActive = item.active;

      // 符号修饰
      ctx.fillStyle = isActive ? '#00d4ff' : '#666688';
      ctx.font = `${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(symbols[i], ix - 20 * s, y + h / 2);

      // 文字
      ctx.fillStyle = isActive ? '#ffffff' : '#888899';
      ctx.font = `${isActive ? 'bold ' : ''}${12 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, ix + 2 * s, y + h / 2);

      // 激活下划线（蓝色）
      if (isActive) {
        ctx.fillStyle = '#00d4ff';
        const lineW = 36 * s;
        ctx.fillRect(ix - lineW / 2, y + h - 6 * s, lineW, 2.5 * s);
      }
    });
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}
