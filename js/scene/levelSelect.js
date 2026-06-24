import { SCREEN_WIDTH, SCREEN_HEIGHT, DPR } from '../render';
import { COLORS, SCALE, TOTAL_LEVELS, LEVEL_GRID_COLS, LEVEL_GRID_ROWS, LEVELS_PER_PAGE, SAFE_LEFT, SAFE_RIGHT } from '../config';
import { LevelProgress } from '../data/levelData';
import ScrollView from '../runtime/scrollView';

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

    // 主页背景地图（图片）
    this._bgImage = wx.createImage();
    this._bgImageLoaded = false;
    this._bgImage.onload = () => { this._bgImageLoaded = true; };
    this._bgImage.src = 'images/home_bg.jpg';

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
    this._introScroller = new ScrollView(); // 游戏介绍弹窗滚动条模块

    // 数据记录弹窗
    this.showDataRecord = false;
    this._dataRecordTab = 'level';    // 'level' | 'mode150'
    this._dataRecordLoading = false;
    this._levelRecords = null;        // 关卡记录数据
    this._mode150Records = null;      // 150球记录数据
    this._dataRecordScroller = new ScrollView();

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
      // 必须先确认隐私协议已同意，才能请求用户信息
      try {
        const agreed = wx.getStorageSync('ppq_privacy_agreed');
        if (agreed) {
          this._requestUserProfile();
        }
      } catch (e) { /* ignore */ }
    }
  }

  /**
   * 检查隐私协议状态，决定是否弹窗
   * 微信规范要求：处理用户个人信息前必须以弹窗方式提示用户阅读同意隐私协议
   */
  _checkPrivacyAndInit() {
    if (typeof wx === 'undefined') {
      // 非微信环境，直接初始化
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

    // 本地未记录同意 → 必须弹窗让用户确认隐私协议
    // 不依赖 wx.getPrivacySetting 的返回值，因为即使系统层面不需要授权，
    // 微信审核仍要求在处理用户个人信息前以弹窗方式提示用户
    this._showPrivacyPrompt = true;
  }

  /**
   * 用户同意隐私协议后执行的初始化操作
   */
  _doAfterPrivacyAgreed() {
    // 同步本地进度到云端
    this._syncProgressToCloud();
    // 写入开放数据（排行榜数据源）
    this._updateOpenData();

    // 检查是否已有昵称，没有则直接请求用户授权（微信系统弹窗）
    try {
      const cached = wx.getStorageSync('ppq_user_info') || {};
      const refused = wx.getStorageSync('ppq_auth_refused');
      if (!cached.nickName && !refused) {
        this._requestUserProfile();
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
    this.contentWidth = SCREEN_WIDTH - this.safeLeft - this.safeRight;
    // 整块布局靠右：富余的安全边距留在左侧，内容块整体贴向右侧
    // （右边缘 = SCREEN_WIDTH - safeLeft，左侧留白 = safeRight）
    this.contentLeft = this.safeRight;
    this.contentCenterX = this.contentLeft + this.contentWidth / 2;

    // 顶部标题区域（横屏模式下紧凑布局）
    this.titleY = 8 * s;
    this.titleHeight = 50 * s;

    // 底部导航栏（圆角胶囊样式）；整体再上移 8px → 底边距 16px
    this.navHeight = 44 * s;
    this.navY = SCREEN_HEIGHT - this.navHeight - 16 * s;

    // 关卡网格区域（列表模块整体再下移 8px）
    this.gridTop = this.titleY + this.titleHeight + 16 * s;
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
    // 格子接近正方形，高度再降低 5%（cy 会按 (cellRowH - cellH)/2 居中，行间对齐自动保持）
    this.cellH = Math.min(this.cellRowH, this.cellW * 1.0) * 0.95;

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
      this._introScroller.onTouchStart(y);
    }

    // 数据记录弹窗：列表滚动
    if (this.showDataRecord) {
      this._dataRecordScroller.onTouchStart(y);
    }
  }

  /**
   * 触摸移动处理（供 main.js 统一分发器调用）
   */
  handleTouchMove(x, y) {
    if (!this.isDragging) return;

    // 游戏介绍弹窗上下拖动（使用ScrollView模块）
    if (this.showGameIntro && this._introScrolling) {
      this._introScroller.onTouchMove(y);
      this._introScrollY = this._introScroller.getScrollY();
      this._lastTouchY = y;
      return;
    }

    // 数据记录弹窗列表滚动
    if (this.showDataRecord) {
      this._dataRecordScroller.onTouchMove(y);
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
      this._introScroller.onTouchEnd();
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
      return;
    }

    // 数据记录弹窗：松手释放滚动惯性 + 点击判定
    if (this.showDataRecord) {
      this._dataRecordScroller.onTouchEnd();
      const totalDy = y - this.touchStartY;
      // 视为点击（移动距离小）→ 交给 _handleTap 处理 tab/返回
      if (Math.abs(totalDy) < 10 && Math.abs(totalDx) < 10) {
        this._handleTap(x, y);
      }
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

    // 数据记录弹窗
    if (this.showDataRecord) {
      // 返回按钮
      if (this._dataRecordBackBtn) {
        const b = this._dataRecordBackBtn;
        if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
          this.showDataRecord = false;
          return;
        }
      }
      // tab 切换
      if (this._dataRecordTabBtns) {
        for (const btn of this._dataRecordTabBtns) {
          if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
            this._switchDataRecordTab(btn.key);
            return;
          }
        }
      }
      return; // 拦截弹窗内其他点击
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

    // 排行榜全屏模式：按子域布局约定的位置检测点击
    // 子域使用 screenWidth/screenHeight 逻辑像素坐标布局
    if (this.showRank) {
      const sw = SCREEN_WIDTH;
      const sh = SCREEN_HEIGHT;

      // 返回按钮（子域布局：按钮中心位于 y = sh - 70，矩形上边 = 中心 - 半高）
      const rbW = 120;
      const rbH = 40;
      const rbX = sw / 2 - rbW / 2;
      const rbY = sh - 70 - rbH / 2;
      if (x >= rbX && x <= rbX + rbW && y >= rbY && y <= rbY + rbH) {
        this.showRank = false;
        this._hideRankBoard();
        this.navItems.forEach((item) => { item.active = item.label === '闯关'; });
        return;
      }

      // Tab 按钮（子域布局：顶部三个 tab）
      const tabs = ['level', 'mode150', 'stars'];
      const tabW = 72;
      const tabH = 28;
      const tabGap = 8;
      const totalTabW = tabs.length * tabW + (tabs.length - 1) * tabGap;
      const tabStartX = sw / 2 - totalTabW / 2;
      const tabY = 60;

      for (let i = 0; i < tabs.length; i++) {
        const tx = tabStartX + i * (tabW + tabGap);
        if (x >= tx && x <= tx + tabW && y >= tabY && y <= tabY + tabH) {
          if (this._rankCategory !== tabs[i]) {
            this._rankCategory = tabs[i];
            this._requestRankData(tabs[i]);
          }
          return;
        }
      }

      return; // 拦截所有点击
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
  completeLevel(levelNum, stars, score, mapName) {
    this.progress.completeLevel(levelNum, stars);
    if (score) this.progress.saveScore(levelNum, score);
    if (mapName) this.progress.saveMapName(levelNum, mapName);
    this.levelData = this.progress.getAllData();
    // 通关后同步到云端（延迟2秒，确保 levelCleared 先完成写入通关数据）
    setTimeout(() => {
      this._uploadProgressToCloud();
    }, 2000);
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
    // levelProgress 每个已通关关卡均含 mapName 字段（地图/布局名称，
    // 参考150球历史记录的 formationName），随进度一起上传到云端
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
      // 用云端数据合并到本地（逐字段取更优值，确保所有字段都同步）
      for (let i = 0; i < cloudProgress.length && i < this.progress.data.length; i++) {
        const cloud = cloudProgress[i];
        const local = this.progress.data[i];
        if (!cloud) continue;
        // 解锁状态：任一已解锁则解锁
        if (cloud.unlocked) local.unlocked = true;
        // 星级：取较高
        if ((cloud.stars || 0) > (local.stars || 0)) {
          local.stars = cloud.stars;
        }
        // 关卡最高分：取较高（含 scoreTime）
        if ((cloud.score || 0) > (local.score || 0)) {
          local.score = cloud.score;
          if (cloud.scoreTime) local.scoreTime = cloud.scoreTime;
        }
        // 通关最高积分：取较高
        if ((cloud.clearScore || 0) > (local.clearScore || 0)) {
          local.clearScore = cloud.clearScore;
        }
        // 最少通关回合：取较小（越少越好）
        if (cloud.clearRounds !== undefined &&
          (local.clearRounds === undefined || cloud.clearRounds < local.clearRounds)) {
          local.clearRounds = cloud.clearRounds;
        }
        // 最快通关耗时：取较小（越少越好）
        if (cloud.clearTime !== undefined &&
          (local.clearTime === undefined || cloud.clearTime < local.clearTime)) {
          local.clearTime = cloud.clearTime;
        }
        // 地图名称：本地缺失时用云端值
        if (cloud.mapName && !local.mapName) {
          local.mapName = cloud.mapName;
        }
        // 最近通关时间戳：取较新
        if (cloud.lastClearAt && (!local.lastClearAt || cloud.lastClearAt > local.lastClearAt)) {
          local.lastClearAt = cloud.lastClearAt;
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
    this._rankCategory = this._rankCategory || 'level';
    this._requestRankData(this._rankCategory);
  }

  /**
   * 切换到群排行榜（从群卡片打开时自动调用）
   */
  _showGroupRankBoard() {
    if (typeof wx === 'undefined') return;
    this._rankCategory = this._rankCategory || 'level';
    this._requestRankData(this._rankCategory);
  }

  /**
   * 请求排行数据（通知开放数据域按分类获取 + 渲染）
   * @param {string} category 'level' | 'mode150' | 'stars'
   */
  _requestRankData(category) {
    if (typeof wx === 'undefined') return;
    const openDataContext = wx.getOpenDataContext();
    const shareTicket = GameGlobal.shareTicket || '';

    this._openDataCanvas = openDataContext.canvas;

    // 关键：sharedCanvas 尺寸只能在主域设置，设为屏幕物理像素（与主域 canvas 一致）
    this._openDataCanvas.width = Math.round(SCREEN_WIDTH * DPR);
    this._openDataCanvas.height = Math.round(SCREEN_HEIGHT * DPR);

    openDataContext.postMessage({
      action: 'showRankByCategory',
      category: category,
      shareTicket: shareTicket,
    });
  }

  /**
   * 隐藏排行榜
   */
  _hideRankBoard() {
    if (typeof wx === 'undefined') return;
    const openDataContext = wx.getOpenDataContext();
    openDataContext.postMessage({ action: 'hideRank' });
    this._openDataCanvas = null;
    this._rankCategory = 'level';
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

    // 150 球最高分（从本地缓存或云端获取）
    let mode150Best = 0;
    try {
      mode150Best = parseInt(wx.getStorageSync('ppq_mode150_best')) || 0;
    } catch (e) { /* ignore */ }

    wx.setUserCloudStorage({
      KVDataList: [
        { key: 'maxLevel', value: String(maxLevel) },
        { key: 'totalStars', value: String(totalStars) },
        { key: 'mode150Best', value: String(mode150Best) },
      ],
      success: () => { console.log('开放数据写入成功'); },
      fail: (err) => { console.error('开放数据写入失败:', err); },
    });
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    // 从群聊卡片打开时：好友/群关系功能尚未开通，暂不展示排行榜场景，直接进入首页
    if (GameGlobal.showGroupRankOnLaunch) {
      GameGlobal.showGroupRankOnLaunch = false;
      this.showRank = false;
      this.showSettings = false;
      this.navItems.forEach((item) => { item.active = item.label === '闯关'; });
      this._hideRankBoard();
    }

    // 滑动回弹动画
    if (this.isSlideAnimating) {
      this.slideOffset *= 0.82; // 衰减系数（越小越快吸附）
      if (Math.abs(this.slideOffset) < 0.5) {
        this.slideOffset = 0;
        this.isSlideAnimating = false;
      }
    }

    // 游戏介绍弹窗 - 惯性滚动（由ScrollView模块处理）
    if (this.showGameIntro && !this._introScrolling) {
      this._introScroller.update();
      this._introScrollY = this._introScroller.getScrollY();
    }

    // 数据记录弹窗 - 列表惯性滚动
    if (this.showDataRecord) {
      this._dataRecordScroller.update();
    }
  }

  render(ctx) {
    // 排行榜全屏模式：隐藏主域所有内容（含底部导航栏），纯展示子域排行榜
    if (this.showRank) {
      this._drawRankBoard(ctx);
      return;
    }

    this._drawBackground(ctx);
    this._drawTitle(ctx);

    if (this.showSettings) {
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

    // 历史记录弹窗（层级置于最上方，高于底部菜单）
    if (this.showDataRecord) {
      this._drawDataRecord(ctx);
    }

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
  /**
   * 排行榜全屏模式：主域只绘制黑底，子域全屏渲染（含标题、tab、列表、返回按钮）
   * 子域样式参照 150 球历史记录列表
   */
  _drawRankBoard(ctx) {
    if (!this._openDataCanvas) return;

    // 重置渲染状态
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 黑色背景
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    // 子域 canvas 全屏绘制（还原 scale 以 1:1 物理像素绘制）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(
      this._openDataCanvas,
      0, 0, this._openDataCanvas.width, this._openDataCanvas.height,
      0, 0, this._openDataCanvas.width, this._openDataCanvas.height
    );
    ctx.restore();

    // 不再在主域绘制标题/tab/返回按钮——全部交给子域
    // 主域只负责点击检测（坐标由子域 postMessage 通知 or 主域按布局计算）
    this._rankCategoryBtns = [];
    this._rankBackBtn = null;
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
      { label: '历史记录', color: '#ffffff' },
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
          case 3: this._showDataRecord(); break;
          case 4: this.showPropsGuide = true; this._propsGuidePage = 0; break;
          case 5: this.showGameIntro = true; this._introScrollY = 0; this._introScroller.reset(); break;
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
   * 打开数据记录弹窗（默认显示关卡 tab）
   */
  _showDataRecord() {
    this.showDataRecord = true;
    this._dataRecordTab = 'level';
    this._dataRecordScroller.reset();
    // 每次打开都清空缓存，实时从云函数重新拉取最新记录
    this._levelRecords = null;
    this._mode150Records = null;
    this._fetchLevelRecords();
  }

  /**
   * 拉取关卡记录（前10场，按耗时少、回合少排序）
   * 实时从云函数获取（每次打开/切换 tab 都会重新请求）
   */
  _fetchLevelRecords() {
    if (this._levelRecords) return; // 本次已加载完成，避免重复请求
    this._dataRecordLoading = true;
    if (typeof wx === 'undefined' || !wx.cloud) {
      this._levelRecords = [];
      this._dataRecordLoading = false;
      return;
    }
    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'getLevelRecords' },
      success: (res) => {
        const result = res.result;
        console.log('[历史记录-关卡] 云函数返回:', result);
        const records = (result && result.code === 0) ? (result.records || []) : [];
        // 排序：耗时升序（优先）→ 回合数升序（其次）
        records.sort((a, b) => {
          if (a.timeUsed !== b.timeUsed) return a.timeUsed - b.timeUsed;
          return a.rounds - b.rounds;
        });
        this._levelRecords = records;
        this._dataRecordLoading = false;
      },
      fail: (err) => {
        console.error('[历史记录-关卡] 云函数调用失败:', err);
        this._levelRecords = [];
        this._dataRecordLoading = false;
      },
    });
  }

  /**
   * 拉取 150 球历史记录
   */
  _fetchMode150Records() {
    if (this._mode150Records) return; // 已缓存
    this._dataRecordLoading = true;
    if (typeof wx === 'undefined' || !wx.cloud) {
      this._mode150Records = [];
      this._dataRecordLoading = false;
      return;
    }
    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'getMode150History' },
      success: (res) => {
        const result = res.result;
        this._mode150Records = (result && result.code === 0) ? (result.history || []) : [];
        this._dataRecordLoading = false;
      },
      fail: () => {
        this._mode150Records = [];
        this._dataRecordLoading = false;
      },
    });
  }

  /**
   * 切换数据记录 tab
   */
  _switchDataRecordTab(tab) {
    if (this._dataRecordTab === tab) return;
    this._dataRecordTab = tab;
    this._dataRecordScroller.reset();
    if (tab === 'level') this._fetchLevelRecords();
    else this._fetchMode150Records();
  }

  /**
   * 绘制数据记录弹窗（样式参照 150 球历史记录）
   */
  _drawDataRecord(ctx) {
    const s = SCALE;

    // 重置渲染状态
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // 遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const topY = 30 * s;

    // 标题
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${20 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#4499cc';
    ctx.shadowBlur = 2 * s;
    ctx.fillText('历史记录', centerX, topY);
    ctx.shadowBlur = 0;

    // Tab（关卡 / 150球）
    const tabs = [
      { key: 'level', label: '关卡' },
      { key: 'mode150', label: '150球' },
    ];
    const tabW = 80 * s;
    const tabH = 28 * s;
    const tabGap = 10 * s;
    const totalTabW = tabs.length * tabW + (tabs.length - 1) * tabGap;
    const tabStartX = centerX - totalTabW / 2;
    const tabY = topY + 28 * s;

    this._dataRecordTabBtns = [];
    tabs.forEach((tab, i) => {
      const tx = tabStartX + i * (tabW + tabGap);
      const active = this._dataRecordTab === tab.key;
      ctx.fillStyle = active ? '#4499cc' : 'rgba(30,40,70,0.8)';
      ctx.fillRect(tx, tabY, tabW, tabH);
      ctx.strokeStyle = '#4499cc';
      ctx.lineWidth = 1;
      ctx.strokeRect(tx, tabY, tabW, tabH);
      ctx.fillStyle = active ? '#ffffff' : '#888899';
      ctx.font = `bold ${12 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tab.label, tx + tabW / 2, tabY + tabH / 2);
      this._dataRecordTabBtns.push({ key: tab.key, x: tx, y: tabY, w: tabW, h: tabH });
    });

    const btnY = SCREEN_HEIGHT - 50 * s;

    // 加载中
    if (this._dataRecordLoading) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${14 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('加载中...', centerX, SCREEN_HEIGHT / 2);
    } else if (this._dataRecordTab === 'level') {
      this._drawLevelRecordTable(ctx, s, tabY + tabH + 10 * s, btnY);
    } else {
      this._drawMode150RecordTable(ctx, s, tabY + tabH + 10 * s, btnY);
    }

    // 返回按钮
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#4499cc';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#4499cc';
    ctx.shadowBlur = 2 * s;
    const rbW = 120 * s;
    const rbH = 40 * s;
    ctx.strokeRect(centerX - rbW / 2, btnY - rbH / 2, rbW, rbH);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText('返回', centerX, btnY);
    this._dataRecordBackBtn = { x: centerX - rbW / 2, y: btnY - rbH / 2, w: rbW, h: rbH };
  }

  /**
   * 关卡记录表格（列：关卡、地图、回合、耗时、时间）
   */
  _drawLevelRecordTable(ctx, s, contentTop, btnY) {
    const data = this._levelRecords || [];
    const centerX = SCREEN_WIDTH / 2;

    const tableW = 320 * s;
    const tableLeft = (SCREEN_WIDTH - tableW) / 2;
    const colX = [
      tableLeft,                 // 关卡
      tableLeft + 55 * s,        // 地图
      tableLeft + 150 * s,       // 回合
      tableLeft + 210 * s,       // 耗时
      tableLeft + 270 * s,       // 时间
    ];
    const headers = ['关卡', '地图', '回合', '耗时', '时间'];

    // 表头
    const headerY = contentTop;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textBaseline = 'middle';
    headers.forEach((h, i) => ctx.fillText(h, colX[i], headerY));

    // 分隔线
    ctx.strokeStyle = 'rgba(68,153,204,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableLeft, headerY + 12 * s);
    ctx.lineTo(tableLeft + tableW, headerY + 12 * s);
    ctx.stroke();

    if (data.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.font = `${14 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('暂无通关记录', centerX, (contentTop + btnY) / 2);
      return;
    }

    const listTop = headerY + 18 * s;
    const listBottom = btnY - 30 * s;
    const rowH = 30 * s;
    const totalH = data.length * rowH;
    this._dataRecordScroller.setContentArea(listTop, listBottom - listTop, totalH);
    const scrollY = this._dataRecordScroller.getScrollY();

    ctx.save();
    ctx.beginPath();
    ctx.rect(tableLeft - 5 * s, listTop, tableW + 10 * s, listBottom - listTop);
    ctx.clip();

    data.forEach((item, i) => {
      const rowY = listTop + i * rowH + 10 * s + scrollY;
      if (rowY + rowH < listTop || rowY - rowH > listBottom) return;

      const rankColors = ['#ffdd00', '#c0c0c0', '#cd7f32'];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = i < 3 ? rankColors[i] : '#ffffff';
      ctx.font = `bold ${11 * s}px Arial`;
      ctx.fillText(`${item.level}`, colX[0], rowY);

      ctx.fillStyle = '#aaddff';
      ctx.font = `${10 * s}px Arial`;
      const mapName = (item.mapName || '随机').slice(0, 5);
      ctx.fillText(mapName, colX[1], rowY);

      ctx.fillStyle = '#ffffff';
      ctx.font = `${11 * s}px Arial`;
      ctx.fillText(`${item.rounds}`, colX[2], rowY);
      ctx.fillText(`${item.timeUsed}s`, colX[3], rowY);

      ctx.fillStyle = '#888888';
      ctx.font = `${9 * s}px Arial`;
      ctx.fillText(this._formatRecordDate(item.lastClearAt), colX[4], rowY);
    });

    ctx.restore();

    if (this._dataRecordScroller.needsScroll()) {
      this._dataRecordScroller.renderScrollBar(ctx, tableLeft + tableW + 2 * s, s, {
        color: 'rgba(68,153,204,0.4)',
      });
    }
  }

  /**
   * 150 球记录表格（复用 150 球历史记录展示：得分、阵型、耗时、时间）
   */
  _drawMode150RecordTable(ctx, s, contentTop, btnY) {
    const data = this._mode150Records || [];
    const centerX = SCREEN_WIDTH / 2;

    const tableW = 300 * s;
    const tableLeft = (SCREEN_WIDTH - tableW) / 2;
    const colX = [
      tableLeft,                 // 排名
      tableLeft + 35 * s,        // 得分
      tableLeft + 110 * s,       // 阵型
      tableLeft + 210 * s,       // 时间
    ];
    const headers = ['#', '得分', '阵型', '游玩时间'];

    const headerY = contentTop;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textBaseline = 'middle';
    headers.forEach((h, i) => ctx.fillText(h, colX[i], headerY));

    ctx.strokeStyle = 'rgba(68,153,204,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableLeft, headerY + 12 * s);
    ctx.lineTo(tableLeft + tableW, headerY + 12 * s);
    ctx.stroke();

    if (data.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.font = `${14 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText('暂无记录', centerX, (contentTop + btnY) / 2);
      return;
    }

    const listTop = headerY + 18 * s;
    const listBottom = btnY - 30 * s;
    const rowH = 30 * s;
    const totalH = data.length * rowH;
    this._dataRecordScroller.setContentArea(listTop, listBottom - listTop, totalH);
    const scrollY = this._dataRecordScroller.getScrollY();

    ctx.save();
    ctx.beginPath();
    ctx.rect(tableLeft - 5 * s, listTop, tableW + 10 * s, listBottom - listTop);
    ctx.clip();

    data.forEach((item, i) => {
      const rowY = listTop + i * rowH + 10 * s + scrollY;
      if (rowY + rowH < listTop || rowY - rowH > listBottom) return;

      const rankColors = ['#ffdd00', '#c0c0c0', '#cd7f32'];
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      ctx.fillStyle = i < 3 ? rankColors[i] : '#ffffff';
      ctx.font = `bold ${11 * s}px Arial`;
      ctx.fillText(`${i + 1}`, colX[0], rowY);

      ctx.fillStyle = '#ffffff';
      ctx.font = `${11 * s}px Arial`;
      ctx.fillText(`${item.score}`, colX[1], rowY);

      ctx.fillStyle = '#aaddff';
      ctx.font = `${10 * s}px Arial`;
      ctx.fillText((item.formationName || '未知').slice(0, 6), colX[2], rowY);

      ctx.fillStyle = '#888888';
      ctx.font = `${9 * s}px Arial`;
      ctx.fillText(this._formatRecordDate(item.date), colX[3], rowY);
    });

    ctx.restore();

    if (this._dataRecordScroller.needsScroll()) {
      this._dataRecordScroller.renderScrollBar(ctx, tableLeft + tableW + 2 * s, s, {
        color: 'rgba(68,153,204,0.4)',
      });
    }
  }

  /**
   * 格式化记录日期（MM-DD HH:mm）
   */
  _formatRecordDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const hh = String(d.getHours()).padStart(2, '0');
      const mi = String(d.getMinutes()).padStart(2, '0');
      return `${mm}-${dd} ${hh}:${mi}`;
    } catch (e) {
      return '-';
    }
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
        if (!result || result.code !== 0 || result.msg === 'not_found' || !result.levelProgress) {
          // 云端无数据，直接上传本地
          this._uploadProgressToCloud();
          this._toastText = '数据已上传到云端';
          this._toastTimer = 90;
          return;
        }

        const localMax = this.progress.getMaxUnlocked();
        const cloudMax = result.maxLevel || 0;
        const cloudProgress = result.levelProgress;
        const effectiveMax = Math.max(cloudMax, localMax);

        // 双向合并：先把云端数据合并到本地（逐字段取更优值，含 mapName 等所有新字段）
        this._applyCloudProgress(cloudProgress, effectiveMax);
        // 再把合并后的本地数据上传到云端，保证云端也获得本地更优/新增字段
        this._uploadProgressToCloud();

        this._toastText = `数据已同步（第${effectiveMax}关）`;
        this._toastTimer = 90;
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
    ctx.shadowBlur = 2 * s;
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

    // 设置ScrollView的内容区域参数
    this._introScroller.setContentArea(contentTop, contentH, totalContentH);
    this._introScrollY = this._introScroller.getScrollY();

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

    // 滚动指示器（内容超出时显示，使用ScrollView模块渲染）
    if (this._introScroller.needsScroll()) {
      this._introScroller.renderScrollBar(ctx, boxX + boxW - 6 * s, s);
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
        name: '加球',
        icon: '●',
        iconColor: '#fff',
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
      // {
      //   name: '攻击增幅',
      //   icon: '⚔',
      //   iconColor: '#ff9900',
      //   desc: [
      //     '瞄准阶段点击左上角攻击按钮',
      //     '',
      //     '白球攻击力永久+1。',
      //     '默认攻击力1（每碰扣1HP），',
      //     '升级后每碰扣2、3、4...HP。',
      //     '',
      //     '每局初始5次机会。',
      //     '对消行/消列伤害也生效。',
      //   ],
      // },
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
   * 注意：调用此方法前必须确保隐私协议已同意（ppq_privacy_agreed = true）
   */
  _requestUserProfile() {
    if (typeof wx === 'undefined' || !wx.getUserProfile) return;

    // 再次确认隐私协议已同意，防止任何绕过
    try {
      const agreed = wx.getStorageSync('ppq_privacy_agreed');
      if (!agreed) return;
    } catch (e) { return; }

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

        console.log('[授权成功]', res);
        console.log('用户名称：', info.nickName || '');
        this._toastText = '授权成功';
        this._toastTimer = 60;
      },
      fail: (err) => {
        // 用户取消了授权弹窗
        try {
          wx.setStorageSync('ppq_auth_refused', true);
        } catch (e) { /* ignore */ }

        console.error('[授权失败]', err);
      },
    });
  }

  _drawBackground(ctx) {
    // 使用背景地图图片填满整个屏幕
    if (this._bgImageLoaded) {
      ctx.drawImage(this._bgImage, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else {
      // 图片加载完成前的兜底底色（深色，避免白屏闪烁）
      ctx.fillStyle = COLORS.bgTop;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
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
    ctx.shadowBlur = 2 * s;
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(title, centerX, y + 18 * s);

    // 主体文字（白色）
    ctx.shadowBlur = 2 * s;
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

    // 外框圆角发光边框（与关卡按钮边框统一色）
    const glowIntensity = 0.5 + 0.3 * Math.sin(this.glowPhase);
    ctx.strokeStyle = COLORS.frameBorder;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.frameBorder;
    ctx.shadowBlur = 2 * s * glowIntensity;
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
      ctx.strokeStyle = isSelected ? '#00d4ff' : COLORS.frameBorder;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.shadowColor = isSelected ? '#00d4ff' : COLORS.frameBorder;
      ctx.shadowBlur = (isSelected ? 2 : 1) * s * cellGlow;
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

      // 星星（上移 4px）
      this._drawStars(ctx, x + w / 2, y + h - 14 * s, data.stars, 3, 5 * s);

    } else {
      // 未解锁关卡 — 暗色背景 + 暗边框
      ctx.fillStyle = 'rgba(15,20,40,0.6)';
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.fill();

      ctx.strokeStyle = '#1a2a44';
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, w, h, cornerR);
      ctx.stroke();

      // 关卡号（待解锁：调亮为 #fdfdfd）
      ctx.fillStyle = '#fdfdfd';
      ctx.font = `${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2 - 5 * s);

      // 星星（待解锁：未点亮色调亮为 #fdfdfd；上移 4px）
      this._drawStars(ctx, x + w / 2, y + h - 14 * s, 0, 3, 5 * s, '#fdfdfd');
    }
  }

  _drawStars(ctx, centerX, centerY, count, total, size, inactiveColor = COLORS.starInactive) {
    const gap = size * 2.2;
    const startX = centerX - ((total - 1) * gap) / 2;

    for (let i = 0; i < total; i++) {
      const sx = startX + i * gap;
      const filled = i < count;
      ctx.fillStyle = filled ? COLORS.starActive : inactiveColor;
      if (filled) {
        ctx.shadowColor = COLORS.starActive;
        ctx.shadowBlur = 2 * SCALE;
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
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    // 底部菜单模块整体 0.6 透明度
    ctx.globalAlpha = 0.6;

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

    // 恢复透明度，避免影响后续渲染
    ctx.globalAlpha = 1;
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
