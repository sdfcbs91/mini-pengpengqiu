import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { COLORS, SCALE, TOTAL_LEVELS, LEVEL_GRID_COLS, LEVEL_GRID_ROWS, LEVELS_PER_PAGE } from '../config';
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

    // 当前页（从0开始）
    this.currentPage = 0;
    this.totalPages = Math.ceil(TOTAL_LEVELS / LEVELS_PER_PAGE);

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
    this.showPropsGuide = false; // 道具介绍弹窗
    this._propsGuidePage = 0; // 当前道具页码
    this._propsSwipeStartX = 0; // 滑动起始X

    // 绑定触摸事件
    this._bindTouch();

    // 进入菜单时同步本地进度到云端
    this._syncProgressToCloud();
    // 写入开放数据（排行榜数据源）
    this._updateOpenData();
  }

  _calculateLayout() {
    const s = SCALE;

    // 顶部标题区域
    this.titleY = 40 * s;
    this.titleHeight = 60 * s;

    // 底部导航栏
    this.navHeight = 70 * s;
    this.navY = SCREEN_HEIGHT - this.navHeight;

    // 关卡网格区域
    this.gridTop = this.titleY + this.titleHeight + 20 * s;
    this.gridBottom = this.navY - 20 * s;
    this.gridHeight = this.gridBottom - this.gridTop;

    // 网格内边距
    this.gridPadX = 15 * s;
    this.gridPadY = 10 * s;

    // 单元格尺寸
    const availW = SCREEN_WIDTH - this.gridPadX * 2;
    const availH = this.gridHeight - this.gridPadY * 2;
    this.cellGapX = 8;        // 左右间距8px
    this.cellGapY = 2;        // 上下间距2px
    this.cellW = (availW - (LEVEL_GRID_COLS - 1) * this.cellGapX) / LEVEL_GRID_COLS;
    this.cellRowH = (availH - (LEVEL_GRID_ROWS - 1) * this.cellGapY) / LEVEL_GRID_ROWS;
    this.cellH = this.cellRowH * 0.85; // 格子占行高的85%

    // 网格起始位置
    this.gridStartX = this.gridPadX;
    this.gridStartY = this.gridTop + this.gridPadY;
  }

  _bindTouch() {
    this._lastTouchX = 0;

    this._touchStartHandler = (e) => {
      const { clientX, clientY } = e.touches[0];
      this.touchStartX = clientX;
      this.touchStartY = clientY;
      this._lastTouchX = clientX;
      this.touchStartTime = Date.now();
      this.isDragging = true;
      this.isSwiping = false;
      this.isSlideAnimating = false; // 按下时中断正在进行的动画
      this.slideVelocity = 0;
    };

    this._touchMoveHandler = (e) => {
      if (!this.isDragging) return;
      const { clientX, clientY } = e.touches[0];
      const dx = clientX - this.touchStartX;
      const dy = clientY - this.touchStartY;

      // 判断滑动方向（首次超过10px时决定）
      if (!this.isSwiping && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        this.isSwiping = Math.abs(dx) > Math.abs(dy);
      }

      if (this.isSwiping) {
        // 实时跟随手指：用增量更新偏移
        const moveDelta = clientX - this._lastTouchX;
        this.slideOffset += moveDelta;

        // 边界阻尼：首页往右拖或末页往左拖时加阻力
        if ((this.currentPage === 0 && this.slideOffset > 0) ||
          (this.currentPage >= this.totalPages - 1 && this.slideOffset < 0)) {
          this.slideOffset *= 0.4; // 强阻尼
        }
      }
      this._lastTouchX = clientX;
    };

    this._touchEndHandler = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const elapsed = Date.now() - this.touchStartTime;
      const touch = e.changedTouches[0];
      const totalDx = touch.clientX - this.touchStartX;

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
        const threshold = SCREEN_WIDTH * 0.15;

        // 判断翻页方向
        if (this.slideOffset < -threshold || velocity < -0.3) {
          // 向左滑 → 下一页
          if (this.currentPage < this.totalPages - 1) {
            this.currentPage++;
            this.slideOffset += SCREEN_WIDTH; // 偏移加一页宽度（动画起点）
          }
        } else if (this.slideOffset > threshold || velocity > 0.3) {
          // 向右滑 → 上一页
          if (this.currentPage > 0) {
            this.currentPage--;
            this.slideOffset -= SCREEN_WIDTH;
          }
        }

        // 启动回弹动画（目标偏移=0）
        this.isSlideAnimating = true;
        this.isSwiping = false;
      } else if (elapsed < 300 && Math.abs(this.slideOffset) < 5) {
        // 点击事件
        const touch = e.changedTouches[0];
        this._handleTap(touch.clientX, touch.clientY);
        this.slideOffset = 0;
      }
    };

    wx.onTouchStart(this._touchStartHandler);
    wx.onTouchMove(this._touchMoveHandler);
    wx.onTouchEnd(this._touchEndHandler);
  }

  unbindTouch() {
    wx.offTouchStart(this._touchStartHandler);
    wx.offTouchMove(this._touchMoveHandler);
    wx.offTouchEnd(this._touchEndHandler);
  }

  _handleTap(x, y) {
    // 游戏介绍弹窗优先处理（点击任意位置关闭）
    if (this.showGameIntro) {
      this.showGameIntro = false;
      return;
    }

    // 道具介绍弹窗（点击左右切换，点击上下区域关闭）
    if (this.showPropsGuide) {
      this._handlePropsGuideTap(x, y);
      return;
    }

    // 检测底部导航栏点击
    if (y >= this.navY) {
      const itemW = SCREEN_WIDTH / this.navItems.length;
      const idx = Math.floor(x / itemW);
      if (idx >= 0 && idx < this.navItems.length) {
        this.navItems.forEach((item, i) => { item.active = i === idx; });
        this._onNavChange(idx);
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
  completeLevel(levelNum, stars) {
    this.progress.completeLevel(levelNum, stars);
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
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT * 0.35;

    // 淡入淡出
    let alpha = 1;
    if (this._toastTimer > 70) alpha = (90 - this._toastTimer) / 20;
    else if (this._toastTimer < 20) alpha = this._toastTimer / 20;

    ctx.globalAlpha = alpha * 0.9;

    const tw = 180 * s;
    const th = 36 * s;
    const r = th / 2;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.beginPath();
    ctx.moveTo(centerX - tw / 2 + r, centerY - th / 2);
    ctx.lineTo(centerX + tw / 2 - r, centerY - th / 2);
    ctx.arcTo(centerX + tw / 2, centerY - th / 2, centerX + tw / 2, centerY, r);
    ctx.arcTo(centerX + tw / 2, centerY + th / 2, centerX + tw / 2 - r, centerY + th / 2, r);
    ctx.lineTo(centerX - tw / 2 + r, centerY + th / 2);
    ctx.arcTo(centerX - tw / 2, centerY + th / 2, centerX - tw / 2, centerY, r);
    ctx.arcTo(centerX - tw / 2, centerY - th / 2, centerX - tw / 2 + r, centerY - th / 2, r);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this._toastText || '', centerX, centerY);
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
    const centerX = SCREEN_WIDTH / 2;
    const btnW = 200 * s;
    const btnH = 44 * s;
    const gap = 16 * s;

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
      const y = top + i * (btnH + gap);
      const x = centerX - btnW / 2;
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
      ctx.fillText(btn.label, centerX, y + btnH / 2);

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
          case 4: this.showGameIntro = true; break;
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
   */
  _doSyncData() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    this._toastText = '同步中...';
    this._toastTimer = 60;

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
   * 绘制游戏介绍弹窗
   */
  _drawGameIntro(ctx) {
    const s = SCALE;

    // 半透明遮罩
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const padX = 20 * s;
    const padY = 90 * s;
    const boxW = SCREEN_WIDTH - padX * 2;
    const boxH = SCREEN_HEIGHT - padY * 2;
    const boxX = padX;
    const boxY = padY;

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
    ];

    ctx.fillStyle = '#ccddff';
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'left';
    const lineH = 16 * s;
    const contentTop = boxY + 38 * s;

    lines.forEach((line, i) => {
      if (line.startsWith('【')) {
        ctx.fillStyle = '#ffdd00';
        ctx.font = `bold ${11.5 * s}px Arial`;
      } else {
        ctx.fillStyle = '#ccddff';
        ctx.font = `${11 * s}px Arial`;
      }
      ctx.fillText(line, boxX + 16 * s, contentTop + i * lineH);
    });

    // 底部提示
    ctx.fillStyle = '#888899';
    ctx.font = `${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('点击任意位置关闭', SCREEN_WIDTH / 2, boxY + boxH - 14 * s);
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

    const padX = 24 * s;
    const padY = 100 * s;
    const boxW = SCREEN_WIDTH - padX * 2;
    const boxH = SCREEN_HEIGHT - padY * 2;
    const boxX = padX;
    const boxY = padY;
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
    const padX = 24 * s;
    const padY = 100 * s;
    const boxW = SCREEN_WIDTH - padX * 2;
    const boxX = padX;
    const props = this._getPropsData();

    // 点击弹窗外（上下区域）关闭
    if (y < padY || y > SCREEN_HEIGHT - padY) {
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
    const centerX = SCREEN_WIDTH / 2;
    const y = this.titleY;

    // 主标题 "弹球粉碎大师" — 霓虹蓝发光大字
    const title = '弹球粉碎大师';
    const fontSize = 26 * s;

    // 外发光层
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 20 * s;
    ctx.fillStyle = '#00d4ff';
    ctx.fillText(title, centerX, y + 18 * s);

    // 主体文字（白色）
    ctx.shadowBlur = 8 * s;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(title, centerX, y + 18 * s);
    ctx.shadowBlur = 0;

    // 副标题
    ctx.fillStyle = 'rgba(180,210,255,0.7)';
    ctx.font = `${11 * s}px Arial`;
    ctx.fillText('选择关卡，即刻开启挑战', centerX, y + 42 * s);

  }

  _drawPageIndicator(ctx) {
    const s = SCALE;
    const y = this.gridTop - 10 * s;
    const centerX = SCREEN_WIDTH / 2;

    // 左箭头 <
    const arrowPad = 60 * s;
    if (this.currentPage > 0) {
      ctx.fillStyle = '#4499cc';
      ctx.font = `bold ${16 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('<', centerX - arrowPad, y);
    }

    // 页码 "3 / 8"
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`当前:${this.currentPage + 1}`, centerX, y);

    // 右箭头 >
    if (this.currentPage < this.totalPages - 1) {
      ctx.fillStyle = '#4499cc';
      ctx.font = `bold ${16 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('>', centerX + arrowPad, y);
    }
  }

  _drawLevelGrid(ctx) {
    const s = SCALE;
    const borderPad = 8 * s;
    const bx = this.gridStartX - borderPad;
    const by = this.gridStartY - borderPad;
    const bw = SCREEN_WIDTH - 2 * this.gridStartX + 2 * borderPad;
    const bh = LEVEL_GRID_ROWS * (this.cellRowH + this.cellGapY) - this.cellGapY + 2 * borderPad;

    // 外框发光（固定不随滑动）
    const glowIntensity = 0.5 + 0.3 * Math.sin(this.glowPhase);
    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 12 * s * glowIntensity;
    ctx.strokeRect(bx, by, bw, bh);
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
      this._drawPageCells(ctx, this.currentPage - 1, offset - SCREEN_WIDTH);
    }
    // 如果向左拖（offset<0），右边露出后一页
    if (offset < 0 && this.currentPage < this.totalPages - 1) {
      this._drawPageCells(ctx, this.currentPage + 1, offset + SCREEN_WIDTH);
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

    if (data.unlocked) {
      // 已解锁关卡 — 透明背景 + 发光边框
      const cellGlow = isSelected ? 1.0 : (0.4 + 0.2 * Math.sin(this.glowPhase + levelIdx * 0.3));
      ctx.strokeStyle = '#4499cc';
      ctx.lineWidth = isSelected ? 2.5 : 1;
      ctx.shadowColor = '#4499cc';
      ctx.shadowBlur = (isSelected ? 12 : 4) * s * cellGlow;
      this._roundRect(ctx, x, y, w, h, 6 * s);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowColor = 'transparent';

      // 关卡号
      ctx.fillStyle = COLORS.textWhite;
      ctx.font = `bold ${16 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2 - 6 * s);

      // 星星
      this._drawStars(ctx, x + w / 2, y + h - 12 * s, data.stars, 3, 6 * s);

    } else {
      // 未解锁关卡 — 纯灰白色文字，无任何装饰
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#555566';
      ctx.font = `${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2);
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

    // 顶部细分割线
    ctx.strokeStyle = 'rgba(100,100,150,0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();

    // 导航项（简洁灰白色文字）
    const itemW = SCREEN_WIDTH / this.navItems.length;

    this.navItems.forEach((item, i) => {
      const ix = itemW * i + itemW / 2;
      const isActive = item.active;

      ctx.fillStyle = isActive ? '#ffffff' : '#888899';
      ctx.font = `${isActive ? 'bold ' : ''}${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, ix, y + this.navHeight * 0.4);

      // 激活下划线
      if (isActive) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(ix - 16 * s, y + this.navHeight * 0.7, 32 * s, 2 * s);
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
