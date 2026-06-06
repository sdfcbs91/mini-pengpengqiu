import { SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE,
  LEFT_PANEL_X, LEFT_PANEL_WIDTH,
  RIGHT_PANEL_X, RIGHT_PANEL_WIDTH,
  BACK_BUTTON_R,
  TARGET_SCORE,
} from '../config';

/**
 * HUD 布局（横屏游戏场景）
 *  - 左上角：返回按钮（功能 = 原暂停按钮，弹出菜单）
 *  - 左侧：分数面板（顶部）+ 倒计时面板（中部）
 *  - 右侧：技能按钮（闪电、多球、攻击力，从上到下排列）
 */
export default class HUD {
  constructor() {
    this.glowPhase = 0;
    const s = SCALE;

    // ----- 左上角返回按钮 -----
    this.backX = LEFT_PANEL_X + BACK_BUTTON_R + 4 * s;
    this.backY = BACK_BUTTON_R + 12 * s;
    this.backR = BACK_BUTTON_R;

    // ----- 左侧分数面板 -----
    this.scorePanelX = LEFT_PANEL_X;
    this.scorePanelY = this.backY + this.backR + 14 * s;
    this.scorePanelW = LEFT_PANEL_WIDTH;
    this.scorePanelH = 70 * s;

    // ----- 左侧倒计时面板 -----
    this.timerPanelX = LEFT_PANEL_X;
    this.timerPanelY = this.scorePanelY + this.scorePanelH + 14 * s;
    this.timerPanelW = LEFT_PANEL_WIDTH;
    this.timerPanelH = 60 * s;

    // ----- 右侧技能按钮（从上到下） -----
    this.btnR = 18 * s;
    const rightCx = RIGHT_PANEL_X + RIGHT_PANEL_WIDTH / 2;
    const skillTopY = 22 * s + 60 * s;
    const skillGap = 50 * s;
    this.skillCx = rightCx;
    this.lightningY = skillTopY;
    this.multiBallY = skillTopY + skillGap;
    this.atkBoostY = skillTopY + skillGap * 2;
    this.aimToggleY = skillTopY + skillGap * 3;  // 瞄准线开关（漩涡图标）
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  /**
   * 渲染 HUD
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} data { stage, score, line, maxRounds, lightningCount, multiBallCount, atkBoostCount, atkLevel, timeLeft, showAimLine }
   */
  render(ctx, data) {
    const s = SCALE;
    const {
      score = 0,
      line = 0,
      maxRounds = 0,
      lightningCount = 0,
      multiBallCount = 0,
      atkBoostCount = 0,
      atkLevel = 1,
      timeLeft = 0,
      showAimLine = true,
    } = data || {};

    // ---- 1) 左上角返回按钮 ----
    this._drawBackButton(ctx, s);

    // ---- 2) 左侧分数面板 ----
    this._drawScorePanel(ctx, s, score, line, maxRounds);

    // ---- 3) 左侧倒计时面板 ----
    this._drawTimerPanel(ctx, s, timeLeft);

    // ---- 4) 右侧技能按钮 ----
    this._drawSkillCircle(ctx, this.skillCx, this.lightningY, this.btnR, s, lightningCount, '#ff3344');
    this._drawLightning(ctx, this.skillCx, this.lightningY - 2 * s, 11 * s);

    this._drawSkillCircle(ctx, this.skillCx, this.multiBallY, this.btnR, s, multiBallCount, '#ff3366');
    this._drawMultiBall(ctx, this.skillCx, this.multiBallY - 2 * s, 9 * s);

    this._drawAtkButton(ctx, this.skillCx, this.atkBoostY, this.btnR, s, atkBoostCount, atkLevel);

    this._drawAimToggleButton(ctx, this.skillCx, this.aimToggleY, this.btnR, s, showAimLine);
  }

  // ============================================================
  // 返回按钮
  // ============================================================
  _drawBackButton(ctx, s) {
    const cx = this.backX;
    const cy = this.backY;
    const r = this.backR;

    // 圆环背景
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = 'rgba(0,212,255,0.5)';
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 半透明填充
    ctx.fillStyle = 'rgba(0,40,80,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 左箭头 "<"
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const armLen = r * 0.45;
    ctx.beginPath();
    ctx.moveTo(cx + armLen * 0.5, cy - armLen);
    ctx.lineTo(cx - armLen * 0.5, cy);
    ctx.lineTo(cx + armLen * 0.5, cy + armLen);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ============================================================
  // 分数面板
  // ============================================================
  _drawScorePanel(ctx, s, score, line, maxRounds) {
    const x = this.scorePanelX;
    const y = this.scorePanelY;
    const w = this.scorePanelW;
    const h = this.scorePanelH;

    this._drawRoundedPanel(ctx, x, y, w, h, 10 * s);

    // 标题"分数"
    ctx.fillStyle = COLORS.neonCyan;
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('分数', x + w / 2, y + 8 * s);

    // 大字分数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${22 * s}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(String(score), x + w / 2, y + h / 2 + 2 * s);

    // 进度（X/Y 得分:Z）
    ctx.fillStyle = '#aaaacc';
    ctx.font = `${9 * s}px Arial`;
    ctx.textBaseline = 'bottom';
    const progressText = `${line || 0}/${maxRounds || TARGET_SCORE} 得分:${score}`;
    ctx.fillText(progressText, x + w / 2, y + h - 6 * s);
  }

  // ============================================================
  // 倒计时面板
  // ============================================================
  _drawTimerPanel(ctx, s, timeLeft) {
    const x = this.timerPanelX;
    const y = this.timerPanelY;
    const w = this.timerPanelW;
    const h = this.timerPanelH;

    this._drawRoundedPanel(ctx, x, y, w, h, 10 * s);

    // 标题"倒计时"
    ctx.fillStyle = COLORS.neonCyan;
    ctx.font = `${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('倒计时', x + w / 2, y + 8 * s);

    // 时间 mm:ss
    const minutes = Math.max(0, Math.floor(timeLeft / 60));
    const seconds = Math.max(0, Math.floor(timeLeft % 60));
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // 倒计时不足10秒时变红警示
    ctx.fillStyle = timeLeft <= 10 ? '#ff4444' : COLORS.textWhite;
    ctx.font = `bold ${20 * s}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, x + w / 2, y + h / 2 + 6 * s);
  }

  // ============================================================
  // 圆角面板
  // ============================================================
  _drawRoundedPanel(ctx, x, y, w, h, r) {
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(8,16,40,0.55)';
    ctx.shadowColor = 'rgba(0,212,255,0.35)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // ============================================================
  // 通用技能按钮（圆形 + 计数）
  // ============================================================
  _drawSkillCircle(ctx, cx, cy, r, s, count, color) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * s * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(80,8,16,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 计数小标签 "xN"
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${8 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.35);
  }

  _drawLightning(ctx, cx, cy, size) {
    const s = SCALE;
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 3 * s;
    ctx.beginPath();
    ctx.moveTo(cx - size * 0.1, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.3, cy - size * 0.5);
    ctx.lineTo(cx + size * 0.05, cy - size * 0.05);
    ctx.lineTo(cx + size * 0.35, cy - size * 0.05);
    ctx.lineTo(cx - size * 0.15, cy + size * 0.5);
    ctx.lineTo(cx + size * 0.1, cy + size * 0.05);
    ctx.lineTo(cx - size * 0.2, cy + size * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  _drawMultiBall(ctx, cx, cy, r) {
    const s = SCALE;
    ctx.fillStyle = '#ff6688';
    ctx.shadowColor = '#ff6688';
    ctx.shadowBlur = 3 * s;
    const offsets = [
      { dx: 0, dy: -r * 0.5 },
      { dx: -r * 0.45, dy: r * 0.3 },
      { dx: r * 0.45, dy: r * 0.3 },
    ];
    offsets.forEach(({ dx, dy }) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  _drawAtkButton(ctx, cx, cy, r, s, count, level) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase + 1);

    // 按钮圈
    ctx.strokeStyle = '#ff9900';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,153,0,0.6)';
    ctx.shadowBlur = 6 * s * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(100,50,0,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 剑/攻击力图标
    ctx.fillStyle = '#ff9900';
    ctx.font = `bold ${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚔${level}`, cx, cy - 2 * s);

    // 剩余次数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${8 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.35);
  }

  _drawAimToggleButton(ctx, cx, cy, r, s, on) {
    const color = on ? '#00d4ff' : '#666688';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = on ? 'rgba(0,212,255,0.6)' : 'transparent';
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = on ? 'rgba(0,40,80,0.4)' : 'rgba(30,30,50,0.4)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 漩涡图标（简化为两个同心弧）
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.8 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55, 0.2, Math.PI * 1.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.3, Math.PI + 0.2, Math.PI * 2.4);
    ctx.stroke();
  }

  // ============================================================
  // 命中检测
  // ============================================================
  _hitCircle(x, y, cx, cy, r) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  // 返回按钮（功能：原暂停 = 弹出暂停菜单）
  hitBackButton(x, y) {
    return this._hitCircle(x, y, this.backX, this.backY, this.backR);
  }

  // 兼容旧调用：暂停按钮 → 命中返回按钮
  hitPauseButton(x, y) {
    return this.hitBackButton(x, y);
  }

  hitLightningButton(x, y) {
    return this._hitCircle(x, y, this.skillCx, this.lightningY, this.btnR);
  }

  hitMultiBallButton(x, y) {
    return this._hitCircle(x, y, this.skillCx, this.multiBallY, this.btnR);
  }

  hitAtkBoostButton(x, y) {
    return this._hitCircle(x, y, this.skillCx, this.atkBoostY, this.btnR);
  }

  hitAimButton(x, y) {
    return this._hitCircle(x, y, this.skillCx, this.aimToggleY, this.btnR);
  }
}
