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
    this.backX = LEFT_PANEL_X + BACK_BUTTON_R + 6 * s;
    this.backY = BACK_BUTTON_R + 14 * s;
    this.backR = BACK_BUTTON_R;

    // ----- 左侧分数面板 -----
    this.scorePanelX = LEFT_PANEL_X;
    this.scorePanelY = this.backY + this.backR + 18 * s;
    this.scorePanelW = LEFT_PANEL_WIDTH;
    this.scorePanelH = 80 * s;

    // ----- 左侧倒计时面板 -----
    this.timerPanelX = LEFT_PANEL_X;
    this.timerPanelY = this.scorePanelY + this.scorePanelH + 14 * s;
    this.timerPanelW = LEFT_PANEL_WIDTH;
    this.timerPanelH = 70 * s;

    // ----- 右侧技能按钮（从上到下，按图2比例调大） -----
    this.btnR = 24 * s;  // 按钮半径增大
    const rightCx = RIGHT_PANEL_X + RIGHT_PANEL_WIDTH / 2;
    // 顶部第一个按钮中心 Y（避开顶部胶囊菜单 ~60*s高度）
    const skillTopY = this.btnR + 60 * s;
    const skillGap = this.btnR * 2 + 14 * s;  // 按钮间距：直径 + 间隔
    this.skillCx = rightCx;
    this.lightningY = skillTopY;
    this.multiBallY = skillTopY + skillGap;
    this.atkBoostY = skillTopY + skillGap * 2;
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
      targetScore = TARGET_SCORE,
    } = data || {};

    // ---- 1) 左上角返回按钮 ----
    this._drawBackButton(ctx, s);

    // ---- 2) 左侧分数面板 ----
    this._drawScorePanel(ctx, s, score, line, maxRounds, targetScore);

    // ---- 3) 左侧倒计时面板 ----
    this._drawTimerPanel(ctx, s, timeLeft);

    // ---- 4) 右侧技能按钮 ----
    this._drawSkillCircle(ctx, this.skillCx, this.lightningY, this.btnR, s, lightningCount, '#ff3344');
    this._drawLightning(ctx, this.skillCx, this.lightningY - 3 * s, 16 * s);

    this._drawSkillCircle(ctx, this.skillCx, this.multiBallY, this.btnR, s, multiBallCount, '#ff3366');
    this._drawMultiBall(ctx, this.skillCx, this.multiBallY - 3 * s, 13 * s);

    this._drawAtkButton(ctx, this.skillCx, this.atkBoostY, this.btnR, s, atkBoostCount, atkLevel);
  }

  // ============================================================
  // 返回按钮（圆角矩形，蓝色细边框 + 青色亮箭头，与图片一致）
  // ============================================================
  _drawBackButton(ctx, s) {
    const cx = this.backX;
    const cy = this.backY;
    const r = this.backR;

    // 计算圆角矩形参数（以原圆心 cx/cy 为中心）
    const w = r * 2;
    const h = r * 2;
    const x = cx - r;
    const y = cy - r;
    const radius = 10 * s;

    // 返回按钮专属配色：极暗灰蓝边框（接近背景，几乎只见光晕）
    this._drawRoundedPanel(ctx, x, y, w, h, radius, {
      stroke: '#2a3550',
      glow: 'rgba(80,140,220,0.45)',
      fill: 'rgba(8,14,32,0.92)',
    });

    // 左箭头 "<"（青色亮色）
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 3.2 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.shadowColor = 'rgba(0,245,255,0.85)';
    ctx.shadowBlur = 8 * s;
    const armLen = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + armLen * 0.4, cy - armLen);
    ctx.lineTo(cx - armLen * 0.45, cy);
    ctx.lineTo(cx + armLen * 0.4, cy + armLen);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.lineCap = 'butt';
  }

  // ============================================================
  // 分数面板
  // ============================================================
  _drawScorePanel(ctx, s, score, line, maxRounds, targetScore) {
    const x = this.scorePanelX;
    const y = this.scorePanelY;
    const w = this.scorePanelW;
    const h = this.scorePanelH;

    // 与图片一致的暗蓝色调
    const PANEL_BLUE = '#2960dd';
    const PANEL_GLOW = 'rgba(50,100,230,0.75)';

    this._drawRoundedPanel(ctx, x, y, w, h, 12 * s, {
      stroke: PANEL_BLUE,
      glow: PANEL_GLOW,
      fill: 'rgba(6,10,28,0.92)',
    });

    // 标题"积分"（与边框同色）
    ctx.fillStyle = PANEL_BLUE;
    ctx.font = `bold ${13 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('积分', x + w / 2, y + 10 * s);

    // 主进度： score / 动态目标分（每关不同）
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${22 * s}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(`${score}/${targetScore || TARGET_SCORE}`, x + w / 2, y + h / 2 + 6 * s);
  }

  // ============================================================
  // 倒计时面板
  // ============================================================
  _drawTimerPanel(ctx, s, timeLeft) {
    const x = this.timerPanelX;
    const y = this.timerPanelY;
    const w = this.timerPanelW;
    const h = this.timerPanelH;

    // 倒计时不足10秒时整个面板变红警示，否则蓝色
    const isWarn = timeLeft <= 10;
    const PANEL_COLOR = isWarn ? '#dd3344' : '#2960dd';
    const PANEL_GLOW = isWarn ? 'rgba(230,60,80,0.75)' : 'rgba(50,100,230,0.75)';

    this._drawRoundedPanel(ctx, x, y, w, h, 12 * s, {
      stroke: PANEL_COLOR,
      glow: PANEL_GLOW,
      fill: 'rgba(6,10,28,0.92)',
    });

    // 标题"倒计时"（与边框同色）
    ctx.fillStyle = PANEL_COLOR;
    ctx.font = `bold ${13 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('倒计时', x + w / 2, y + 10 * s);

    // 时间 mm:ss
    const minutes = Math.max(0, Math.floor(timeLeft / 60));
    const seconds = Math.max(0, Math.floor(timeLeft % 60));
    const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    ctx.fillStyle = isWarn ? '#ff8888' : COLORS.textWhite;
    ctx.font = `bold ${24 * s}px Arial`;
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, x + w / 2, y + h / 2 + 8 * s);
  }

  // ============================================================
  // 圆角面板（细边框 + 强外发光，模拟霓虹灯效果）
  // ============================================================
  _drawRoundedPanel(ctx, x, y, w, h, r, opts) {
    const o = opts || {};
    const stroke = o.stroke || '#2960dd';   // 边框暗蓝
    const glow = o.glow || 'rgba(50,100,230,0.75)';
    const fill = o.fill || 'rgba(6,10,28,0.92)';

    const buildPath = () => {
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
    };

    // 1) 填充背景
    buildPath();
    ctx.fillStyle = fill;
    ctx.fill();

    // 2) 强外发光（仅靠 shadow 营造扩散光晕，不画粗边）
    buildPath();
    ctx.shadowColor = glow;
    ctx.shadowBlur = 22;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 3) 再描一次细边强化清晰度
    buildPath();
    ctx.shadowBlur = 8;
    ctx.shadowColor = glow;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  // ============================================================
  // 通用技能按钮（圆形 + 计数）
  // ============================================================
  _drawSkillCircle(ctx, cx, cy, r, s, count, color) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8 * s * glow;
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
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.32);
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
    ctx.lineWidth = 2.5;
    ctx.shadowColor = 'rgba(255,153,0,0.6)';
    ctx.shadowBlur = 8 * s * glow;
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
    ctx.font = `bold ${15 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚔${level}`, cx, cy - 3 * s);

    // 剩余次数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.32);
  }

  // ============================================================
  // 命中检测
  // ============================================================
  _hitCircle(x, y, cx, cy, r) {
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  // 返回按钮（功能：原暂停 = 弹出暂停菜单）— 圆角矩形外接矩形命中检测
  hitBackButton(x, y) {
    const r = this.backR;
    return x >= this.backX - r && x <= this.backX + r &&
           y >= this.backY - r && y <= this.backY + r;
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

  hitAimButton() {
    // 已删除瞄准开关按钮，恒定返回 false 兼容旧调用
    return false;
  }
}
