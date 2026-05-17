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
    this.offsetX = 0;       // 当前滑动偏移
    this.isDragging = false;
    this.isSwiping = false;  // 是否横向滑动

    // 动画相关
    this.animOffset = 0;     // 翻页动画偏移
    this.animTarget = 0;
    this.isAnimating = false;

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
      { icon: 'SHOP', label: 'SHOP' },
      { icon: 'BALL', label: 'BALL' },
      { icon: 'CLASSIC', label: 'CLASSIC', active: true },
      { icon: 'MULTI', label: 'MULTI' },
      { icon: '100', label: '100BALLS' },
    ];

    // 绑定触摸事件
    this._bindTouch();
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
    this.cellGap = 8 * s;
    this.cellW = (availW - (LEVEL_GRID_COLS - 1) * this.cellGap) / LEVEL_GRID_COLS;
    this.cellH = (availH - (LEVEL_GRID_ROWS - 1) * this.cellGap) / LEVEL_GRID_ROWS;

    // 网格起始位置
    this.gridStartX = this.gridPadX;
    this.gridStartY = this.gridTop + this.gridPadY;
  }

  _bindTouch() {
    this._touchStartHandler = (e) => {
      const { clientX, clientY } = e.touches[0];
      this.touchStartX = clientX;
      this.touchStartY = clientY;
      this.touchStartTime = Date.now();
      this.isDragging = true;
      this.isSwiping = false;
      this.offsetX = 0;
    };

    this._touchMoveHandler = (e) => {
      if (!this.isDragging) return;
      const { clientX, clientY } = e.touches[0];
      const dx = clientX - this.touchStartX;
      const dy = clientY - this.touchStartY;

      // 判断滑动方向
      if (!this.isSwiping && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        this.isSwiping = Math.abs(dx) > Math.abs(dy);
      }

      if (this.isSwiping) {
        this.offsetX = dx;
      }
    };

    this._touchEndHandler = (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;

      const elapsed = Date.now() - this.touchStartTime;

      if (this.isSwiping) {
        // 滑动翻页
        const threshold = SCREEN_WIDTH * 0.2;
        const velocity = this.offsetX / Math.max(elapsed, 1);

        if (this.offsetX < -threshold || velocity < -0.5) {
          this._nextPage();
        } else if (this.offsetX > threshold || velocity > 0.5) {
          this._prevPage();
        }
        this.offsetX = 0;
        this.isSwiping = false;
      } else if (elapsed < 300) {
        // 点击事件
        const touch = e.changedTouches[0];
        this._handleTap(touch.clientX, touch.clientY);
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

  _nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
    }
  }

  _prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
    }
  }

  _handleTap(x, y) {
    // 检测底部导航栏点击
    if (y >= this.navY) {
      const itemW = SCREEN_WIDTH / this.navItems.length;
      const idx = Math.floor(x / itemW);
      if (idx >= 0 && idx < this.navItems.length) {
        this.navItems.forEach((item, i) => { item.active = i === idx; });
      }
      return;
    }

    // 检测关卡格子点击
    const startIdx = this.currentPage * LEVELS_PER_PAGE;
    for (let row = 0; row < LEVEL_GRID_ROWS; row++) {
      for (let col = 0; col < LEVEL_GRID_COLS; col++) {
        const levelIdx = startIdx + (LEVEL_GRID_ROWS - 1 - row) * LEVEL_GRID_COLS + col;
        if (levelIdx >= TOTAL_LEVELS) continue;

        const cx = this.gridStartX + col * (this.cellW + this.cellGap);
        const cy = this.gridStartY + row * (this.cellH + this.cellGap);

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
  }

  /**
   * 解锁关卡
   */
  unlockLevel(levelNum) {
    this.progress.unlock(levelNum);
    this.levelData = this.progress.getAllData();
  }

  /**
   * 获取最高解锁关卡
   */
  getMaxUnlockedLevel() {
    return this.progress.getMaxUnlocked();
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx) {
    this._drawBackground(ctx);
    this._drawTitle(ctx);
    this._drawPageIndicator(ctx);
    this._drawLevelGrid(ctx);
    this._drawNavBar(ctx);
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

    // 标题文字 "BRICKS"（每个字母一个彩色方块）
    const letters = [
      { char: 'B', color: '#39ff14' },
      { char: 'R', color: '#ff6600' },
      { char: 'I', color: '#f0e130' },
      { char: 'C', color: '#00d4ff' },
      { char: 'K', color: '#8b5cf6' },
      { char: 'S', color: '#ff1493' },
    ];
    const blockSize = 30 * s;
    const blockGap = 6 * s;
    const totalW = letters.length * blockSize + (letters.length - 1) * blockGap;
    let bx = centerX - totalW / 2;

    letters.forEach(({ char, color }) => {
      // 方块背景
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.3;
      ctx.fillRect(bx, y, blockSize, blockSize);
      ctx.globalAlpha = 1;

      // 方块边框（发光）
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 * s;
      ctx.strokeRect(bx, y, blockSize, blockSize);
      ctx.shadowBlur = 0;

      // 字母
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${18 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, bx + blockSize / 2, y + blockSize / 2);

      bx += blockSize + blockGap;
    });

    // 副标题 "BREAKER QUEST"
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('BREAKER  QUEST', centerX, y + blockSize + 6 * s);

    // 右上角电源按钮
    const pwrX = SCREEN_WIDTH - 30 * s;
    const pwrY = y + blockSize / 2;
    const pwrR = 14 * s;
    ctx.strokeStyle = '#ff0044';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#ff0044';
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(pwrX, pwrY, pwrR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 电源图标线条
    ctx.strokeStyle = '#ff0044';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(pwrX, pwrY, pwrR * 0.5, Math.PI * 0.3, Math.PI * 1.7);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pwrX, pwrY - pwrR * 0.6);
    ctx.lineTo(pwrX, pwrY - pwrR * 0.1);
    ctx.stroke();
  }

  _drawPageIndicator(ctx) {
    const s = SCALE;
    const y = this.gridTop - 8 * s;
    const centerX = SCREEN_WIDTH / 2;
    const dotR = 3 * s;
    const dotGap = 12 * s;

    // 只显示附近几页的点
    const maxDots = 7;
    const half = Math.floor(maxDots / 2);
    let startPage = Math.max(0, this.currentPage - half);
    let endPage = Math.min(this.totalPages - 1, startPage + maxDots - 1);
    startPage = Math.max(0, endPage - maxDots + 1);

    const dotsCount = endPage - startPage + 1;
    let dx = centerX - (dotsCount - 1) * dotGap / 2;

    for (let i = startPage; i <= endPage; i++) {
      const isCurrent = i === this.currentPage;
      ctx.fillStyle = isCurrent ? COLORS.neonCyan : '#333355';
      if (isCurrent) {
        ctx.shadowColor = COLORS.neonCyan;
        ctx.shadowBlur = 6 * s;
      }
      ctx.beginPath();
      ctx.arc(dx, y, isCurrent ? dotR * 1.3 : dotR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      dx += dotGap;
    }
  }

  _drawLevelGrid(ctx) {
    const startIdx = this.currentPage * LEVELS_PER_PAGE;

    // 游戏区域霓虹边框
    const s = SCALE;
    const borderPad = 8 * s;
    const bx = this.gridStartX - borderPad;
    const by = this.gridStartY - borderPad;
    const bw = SCREEN_WIDTH - 2 * this.gridStartX + 2 * borderPad;
    const bh = LEVEL_GRID_ROWS * (this.cellH + this.cellGap) - this.cellGap + 2 * borderPad;

    // 外框发光
    const glowIntensity = 0.5 + 0.3 * Math.sin(this.glowPhase);
    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 12 * s * glowIntensity;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.shadowBlur = 0;

    // 绘制每个关卡格子（从下往上排列：底行是小编号，顶行是大编号）
    for (let row = 0; row < LEVEL_GRID_ROWS; row++) {
      for (let col = 0; col < LEVEL_GRID_COLS; col++) {
        // 底部是小编号，所以反转行
        const levelIdx = startIdx + (LEVEL_GRID_ROWS - 1 - row) * LEVEL_GRID_COLS + col;
        if (levelIdx >= TOTAL_LEVELS) continue;

        const cx = this.gridStartX + col * (this.cellW + this.cellGap);
        const cy = this.gridStartY + row * (this.cellH + this.cellGap);

        this._drawLevelCell(ctx, cx, cy, levelIdx, row, col);
      }
    }
  }

  _drawLevelCell(ctx, x, y, levelIdx, row, col) {
    const s = SCALE;
    const data = this.levelData[levelIdx];
    const levelNum = levelIdx + 1;
    const w = this.cellW;
    const h = this.cellH;
    const isSelected = this.selectedLevel === levelIdx;

    // 颜色 - 按行对应不同颜色
    const displayRow = LEVEL_GRID_ROWS - 1 - row; // 实际显示行
    const colorIdx = displayRow % COLORS.levelColors.length;
    const colorScheme = COLORS.levelColors[colorIdx];

    if (data.unlocked) {
      // 已解锁关卡

      // 背景填充
      ctx.fillStyle = colorScheme.bg;
      ctx.globalAlpha = 0.7;
      this._roundRect(ctx, x, y, w, h, 6 * s);
      ctx.fill();
      ctx.globalAlpha = 1;

      // 发光边框
      const cellGlow = isSelected ? 1.0 : (0.5 + 0.3 * Math.sin(this.glowPhase + levelIdx * 0.3));
      ctx.strokeStyle = colorScheme.border;
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.shadowColor = colorScheme.border;
      ctx.shadowBlur = (isSelected ? 15 : 8) * s * cellGlow;
      this._roundRect(ctx, x, y, w, h, 6 * s);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 关卡号
      ctx.fillStyle = COLORS.textWhite;
      ctx.font = `bold ${18 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h / 2 - 8 * s);

      // 星星
      this._drawStars(ctx, x + w / 2, y + h - 16 * s, data.stars, 3, 7 * s);

      // 行间的箭头连接符（同一行内，非最后一列）
      if (col < LEVEL_GRID_COLS - 1) {
        const arrowX = x + w + this.cellGap / 2;
        const arrowY = y + h / 2;
        // 判断方向：奇数行从右到左，偶数行从左到右
        const isReverse = displayRow % 2 === 1;
        ctx.fillStyle = colorScheme.border;
        ctx.globalAlpha = 0.6;
        ctx.font = `${10 * s}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isReverse ? '<' : '>', arrowX, arrowY);
        ctx.globalAlpha = 1;
      }
    } else {
      // 锁定关卡
      ctx.fillStyle = COLORS.lockedBg;
      ctx.globalAlpha = 0.6;
      this._roundRect(ctx, x, y, w, h, 6 * s);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = COLORS.lockedBorder;
      ctx.lineWidth = 1;
      this._roundRect(ctx, x, y, w, h, 6 * s);
      ctx.stroke();

      // 锁图标
      this._drawLock(ctx, x + w / 2, y + h / 2 - 4 * s, 12 * s);

      // 关卡号（灰色）
      ctx.fillStyle = COLORS.textGray;
      ctx.font = `${11 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(levelNum), x + w / 2, y + h - 14 * s);
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

  _drawLock(ctx, cx, cy, size) {
    const s = SCALE;
    const lockW = size;
    const lockH = size * 0.7;
    const shackleH = size * 0.5;

    // 锁身（红褐色矩形）
    ctx.fillStyle = '#8b2020';
    ctx.fillRect(cx - lockW / 2, cy, lockW, lockH);
    ctx.strokeStyle = '#aa3333';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx - lockW / 2, cy, lockW, lockH);

    // 锁扣（弧形）
    ctx.strokeStyle = '#ccaa00';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, shackleH * 0.5, Math.PI, 0);
    ctx.stroke();

    // 锁眼
    ctx.fillStyle = '#ccaa00';
    ctx.beginPath();
    ctx.arc(cx, cy + lockH * 0.35, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawNavBar(ctx) {
    const s = SCALE;
    const y = this.navY;

    // 背景
    ctx.fillStyle = COLORS.navBg;
    ctx.globalAlpha = 0.95;
    ctx.fillRect(0, y, SCREEN_WIDTH, this.navHeight);
    ctx.globalAlpha = 1;

    // 顶部分割线（霓虹）
    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 1;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 4 * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 导航项
    const itemW = SCREEN_WIDTH / this.navItems.length;
    const iconSize = 22 * s;
    const iconY = y + 12 * s;
    const labelY = y + this.navHeight - 12 * s;

    this.navItems.forEach((item, i) => {
      const ix = itemW * i + itemW / 2;
      const isActive = item.active;

      // 图标占位（简化为圆形+文字）
      ctx.strokeStyle = isActive ? COLORS.navActive : COLORS.navInactive;
      ctx.fillStyle = isActive ? COLORS.navActive : COLORS.navInactive;
      ctx.lineWidth = 1.5;

      if (isActive) {
        ctx.shadowColor = COLORS.navActive;
        ctx.shadowBlur = 6 * s;
      }

      // 图标（简化圆圈）
      ctx.beginPath();
      ctx.arc(ix, iconY + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 图标中文字
      ctx.font = `bold ${8 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.icon.substring(0, 2), ix, iconY + iconSize / 2);

      // 标签
      ctx.font = `${8 * s}px Arial`;
      ctx.textBaseline = 'bottom';
      ctx.fillText(item.label, ix, labelY);
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
