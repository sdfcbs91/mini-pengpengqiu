/**
 * DevLog - 游戏内可滚动日志面板
 */
class DevLog {
  constructor() {
    this.logs = [];
    this.visible = true; // dev按钮是否可见
    this.showPanel = false; // 日志面板是否显示
    this.panelScrollY = 0; // 面板滚动偏移
    this.panelMaxScroll = 0; // 最大滚动距离

    // 面板布局（逻辑像素）
    this.panelWidth = 0;
    this.panelHeight = 0;
    this.panelX = 0;
    this.panelY = 0;
    this.contentTop = 0; // 内容区域顶部
    this.contentHeight = 0; // 内容区域高度
    this.lineHeight = 0; // 行高
    this.fontSize = 0; // 字号

    // 触摸状态（用于滚动）
    this._touching = false;
    this._touchStartY = 0;
    this._touchScrollStart = 0;

    // 保存原始 console
    const self = this;
    const _origLog = console.log;
    const _origError = console.error;

    // 重写 console
    console.log = function(...args) {
      self._addLog('log', ...args);
      _origLog.apply(console, args);
    };

    console.error = function(...args) {
      self._addLog('error', ...args);
      _origError.apply(console, args);
    };

    // 确认初始化
    if (typeof wx !== 'undefined') {
      wx.showToast({
        title: 'DevLog初始化成功!',
        icon: 'none',
        duration: 2000
      });
    }
  }

  _addLog(type, ...args) {
    const msg = args.map(a => {
      if (typeof a === 'object') {
        try { return JSON.stringify(a); } catch(e) { return String(a); }
      }
      return String(a);
    }).join(' ');

    this.logs.push({
      type,
      message: msg,
      time: new Date().toLocaleTimeString()
    });

    if (this.logs.length > 100) this.logs.shift();
  }

  /**
   * 显示/隐藏日志面板
   */
  togglePanel() {
    this.showPanel = !this.showPanel;
    this.panelScrollY = 0;
  }

  /**
   * 处理触摸 - 检测是否点击了 dev 组件
   * @param {number} x - 触摸X坐标（逻辑像素）
   * @param {number} y - 触摸Y坐标（逻辑像素）
   * @returns {boolean} true表示点击了dev组件，应该拦截触摸
   */
  handleTouch(x, y) {
    if (!this.visible && !this.showPanel) return false;

    const info = wx.getSystemInfoSync();

    // 如果面板正在显示，拦截所有触摸（具体处理由 handleTouchStart/Move/End 完成）
    if (this.showPanel) {
      return true; // 面板显示时，拦截所有触摸
    }

    // 检测是否点击了 dev 按钮（右下角 60x60 区域）
    const btnSize = 60;
    const bx = info.screenWidth - btnSize - 10;
    const by = info.screenHeight - btnSize - 10;

    if (x >= bx && x <= bx + btnSize && y >= by && y <= by + btnSize) {
      this.togglePanel();
      return true; // 拦截触摸
    }

    return false;
  }

  /**
   * 处理触摸开始（用于滚动 + 按钮点击）
   */
  handleTouchStart(x, y) {
    if (!this.showPanel) return;

    const s = this._getScale();

    // 检测是否点击了关闭按钮
    const closeBtnX = this.panelX + this.panelWidth - 40 * s;
    const closeBtnY = this.panelY + 10 * s;
    const closeBtnSize = 30 * s;

    if (x >= closeBtnX && x <= closeBtnX + closeBtnSize &&
        y >= closeBtnY && y <= closeBtnY + closeBtnSize) {
      this.showPanel = false;
      return;
    }

    // 检测是否点击了清除按钮
    const clearBtnX = this.panelX + this.panelWidth - 80 * s;
    const clearBtnY = this.panelY + 10 * s;
    const clearBtnW = 30 * s;
    const clearBtnH = 30 * s;

    if (x >= clearBtnX && x <= clearBtnX + clearBtnW &&
        y >= clearBtnY && y <= clearBtnY + clearBtnH) {
      this.logs = [];
      this.panelScrollY = 0;
      return;
    }

    // 如果在内容区域，开始滚动
    if (y >= this.contentTop && y <= this.contentTop + this.contentHeight) {
      this._touching = true;
      this._touchStartY = y;
      this._touchScrollStart = this.panelScrollY;
    }
  }

  /**
   * 处理触摸移动（用于滚动）
   */
  handleTouchMove(_x, y) {
    if (!this.showPanel || !this._touching) return;

    const dy = y - this._touchStartY;
    this.panelScrollY = this._touchScrollStart + dy;

    // 限制滚动范围
    if (this.panelScrollY < 0) this.panelScrollY = 0;
    if (this.panelScrollY > this.panelMaxScroll) this.panelScrollY = this.panelMaxScroll;
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd() {
    this._touching = false;
  }

  _getScale() {
    if (typeof wx === 'undefined') return 1;
    const info = wx.getSystemInfoSync();
    return Math.min(info.screenWidth / 375, info.screenHeight / 667);
  }

  /**
   * 渲染 - dev按钮 + 日志面板
   */
  render(ctx) {
    if (typeof wx === 'undefined' || !wx.getSystemInfoSync) return;

    const info = wx.getSystemInfoSync();
    const s = this._getScale();

    // 总是绘制dev按钮在右下角
    this._renderButton(ctx, info, s);

    // 如果面板显示，绘制面板
    if (this.showPanel) {
      this._renderPanel(ctx, info, s);
    }
  }

  _renderButton(ctx, info, s) {
    const btnSize = 50 * s; // 缩小按钮，避免覆盖游戏区域
    const bx = info.screenWidth - btnSize - 10 * s;
    const by = info.screenHeight - btnSize - 10 * s;

    // 保存上下文状态
    ctx.save();

    // 按钮背景（半透明）
    ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
    ctx.fillRect(bx, by, btnSize, btnSize);

    // 按钮文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEV', bx + btnSize / 2, by + btnSize / 2);

    // 如果有新日志，显示红点
    if (this.logs.length > 0) {
      ctx.fillStyle = '#ff3333';
      ctx.beginPath();
      ctx.arc(bx + btnSize - 5 * s, by + 5 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  _renderPanel(ctx, info, s) {
    // 保存上下文状态，避免影响游戏渲染
    ctx.save();

    const padX = 20 * s;
    const padY = 60 * s;
    this.panelWidth = info.screenWidth - padX * 2;
    this.panelHeight = info.screenHeight - padY * 2;
    this.panelX = padX;
    this.panelY = padY;

    this.fontSize = 12 * s;
    this.lineHeight = this.fontSize + 4 * s;
    this.contentTop = this.panelY + 40 * s; // 标题栏高度
    this.contentHeight = this.panelHeight - 40 * s - 10 * s; // 减去标题栏和底部边距

    // 半透明遮罩（更透明，让游戏可见）
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, info.screenWidth, info.screenHeight);

    // 面板背景（半透明）
    ctx.fillStyle = 'rgba(26,26,46,0.95)';
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(this.panelX + 10 * s, this.panelY);
    ctx.lineTo(this.panelX + this.panelWidth - 10 * s, this.panelY);
    ctx.arcTo(this.panelX + this.panelWidth, this.panelY, this.panelX + this.panelWidth, this.panelY + 10 * s, 10 * s);
    ctx.arcTo(this.panelX + this.panelWidth, this.panelY + this.panelHeight, this.panelX + this.panelWidth - 10 * s, this.panelY + this.panelHeight, 10 * s);
    ctx.lineTo(this.panelX + 10 * s, this.panelY + this.panelHeight);
    ctx.arcTo(this.panelX, this.panelY + this.panelHeight, this.panelX, this.panelY + this.panelHeight - 10 * s, 10 * s);
    ctx.arcTo(this.panelX, this.panelY, this.panelX + 10 * s, this.panelY, 10 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 标题
    ctx.fillStyle = '#00d4ff';
    ctx.font = `bold ${16 * s}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Dev Logs', this.panelX + 15 * s, this.panelY + 20 * s);

    // 日志条数
    ctx.fillStyle = '#888899';
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'right';
    ctx.fillText(`共 ${this.logs.length} 条`, this.panelX + this.panelWidth - 90 * s, this.panelY + 20 * s);

    // 关闭按钮
    ctx.fillStyle = '#ff3333';
    ctx.font = `bold ${20 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✕', this.panelX + this.panelWidth - 25 * s, this.panelY + 20 * s);

    // 清除按钮
    ctx.fillStyle = '#ff9900';
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('清', this.panelX + this.panelWidth - 65 * s, this.panelY + 20 * s);

    // 内容区域裁剪
    ctx.save();
    ctx.beginPath();
    ctx.rect(this.panelX, this.contentTop, this.panelWidth, this.contentHeight);
    ctx.clip();

    // 绘制日志
    this._renderLogs(ctx, s);

    ctx.restore(); // 恢复裁剪

    // 滚动指示器
    if (this.panelMaxScroll > 0) {
      this._renderScrollBar(ctx, s);
    }

    ctx.restore(); // 恢复上下文状态
  }

  _renderLogs(ctx, s) {
    if (this.logs.length === 0) {
      ctx.fillStyle = '#666677';
      ctx.font = `${13 * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无日志', this.panelX + this.panelWidth / 2, this.contentTop + this.contentHeight / 2);
      return;
    }

    // 计算每条日志的实际行数（基于文本实际宽度）
    const maxWidth = this.panelWidth - 80 * s; // 消息区域最大宽度
    const lineHeight = this.lineHeight;
    
    // 计算每条日志的行数
    const logLineCounts = this.logs.map(log => {
      if (!log.message) return 1;
      return this._calculateLines(ctx, log.message, maxWidth, s);
    });

    // 计算总高度
    let totalHeight = 0;
    for (let i = 0; i < logLineCounts.length; i++) {
      totalHeight += logLineCounts[i] * lineHeight;
    }
    this.panelMaxScroll = Math.max(0, totalHeight - this.contentHeight);

    // 绘制日志（从最新开始，从下往上）
    let currentY = this.contentTop + this.contentHeight + this.panelScrollY;
    
    for (let i = this.logs.length - 1; i >= 0; i--) {
      const log = this.logs[i];
      const lineCount = logLineCounts[i];
      const logHeight = lineCount * lineHeight;
      
      currentY -= logHeight;

      // 只绘制可见区域的日志
      if (currentY + logHeight < this.contentTop) break;
      if (currentY > this.contentTop + this.contentHeight) {
        continue;
      }

      // 日志类型图标
      const icon = log.type === 'error' ? '❌' : 'ℹ️';
      ctx.fillStyle = log.type === 'error' ? '#ff3333' : '#00d4ff';
      ctx.font = `${11 * s}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(icon, this.panelX + 5 * s, currentY);

      // 时间
      ctx.fillStyle = '#888899';
      ctx.font = `${10 * s}px Arial`;
      ctx.fillText(log.time, this.panelX + 20 * s, currentY);

      // 消息（自动换行，完整展示）
      const msg = log.message || '';
      ctx.fillStyle = log.type === 'error' ? '#ff8888' : '#ccddff';
      ctx.font = `${11 * s}px Arial`;

      // 使用文本实际宽度进行换行
      const lines = this._wrapText(ctx, msg, maxWidth, s);
      
      // 绘制每一行
      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const lineText = lines[lineIdx];
        const lineY = currentY + lineIdx * lineHeight;
        
        // 只绘制可见行
        if (lineY + lineHeight > this.contentTop && lineY < this.contentTop + this.contentHeight) {
          ctx.fillText(lineText, this.panelX + 75 * s, lineY);
        }
        
        if (lineIdx >= lineCount) break;
      }
    }
  }

  /**
   * 计算文本需要多少行（基于实际文本宽度）
   */
  _calculateLines(ctx, text, maxWidth, s) {
    if (!text) return 1;
    
    ctx.font = `${11 * s}px Arial`;
    let lineCount = 1;
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth) {
        lineCount++;
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    return lineCount;
  }

  /**
   * 将文本按照实际宽度换行
   */
  _wrapText(ctx, text, maxWidth, s) {
    if (!text) return [''];
    
    ctx.font = `${11 * s}px Arial`;
    const lines = [];
    let currentLine = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = char;
      } else {
        currentLine = testLine;
      }
    }
    
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    return lines;
  }

  _renderScrollBar(ctx, s) {
    const barW = 4 * s;
    const barH = this.contentHeight * (this.contentHeight / (this.contentHeight + this.panelMaxScroll));
    const barX = this.panelX + this.panelWidth - 10 * s;
    const barY = this.contentTop + (this.panelScrollY / this.panelMaxScroll) * (this.contentHeight - barH);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(barX, barY, barW, barH);
  }
}

// 导出单例
const devLog = new DevLog();
export default devLog;
