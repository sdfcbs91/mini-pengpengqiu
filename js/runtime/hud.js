import { SCREEN_WIDTH } from '../render';
import { COLORS, SCALE } from '../config';

/**
 * 顶部 HUD
 * 显示关卡号、星级进度条、行数、分数、辅助线/暂停按钮、技能按钮
 */
export default class HUD {
  constructor() {
    this.glowPhase = 0;

    const s = SCALE;
    // 技能按钮布局
    this.skillBtnR = 18 * s;
    this.lightningX = 30 * s;
    this.lightningY = 62 * s;
    this.multiBallX = SCREEN_WIDTH - 30 * s;
    this.multiBallY = 62 * s;
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx, data) {
    const s = SCALE;
    const { stage, line, score, starProgress, showAimLine, lightningCount, multiBallCount } = data;

    // ---- 左上角：辅助线开关按钮 ----
    const btnR = 14 * s;
    const btnX = 22 * s;
    const btnY = 22 * s;
    const aimGlow = showAimLine ? 1.0 : 0.3;

    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonCyan;
    ctx.shadowBlur = 6 * s * aimGlow;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 靶心图标
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.globalAlpha = aimGlow;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLORS.neonCyan;
    ctx.beginPath();
    ctx.arc(btnX, btnY, 2 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // ---- 中间：STAGE 标题 ----
    const centerX = SCREEN_WIDTH / 2;
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`STAGE-${stage}`, centerX, 10 * s);

    // ---- 星级进度条 ----
    const barW = 120 * s;
    const barH = 5 * s;
    const barX = centerX - barW / 2;
    const barY = 27 * s;

    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(barX, barY, barW, barH);

    const progress = Math.min(1, starProgress || 0);
    if (progress > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      gradient.addColorStop(0, '#ff6600');
      gradient.addColorStop(1, '#ffaa00');
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    this._drawMiniStar(ctx, barX - 8 * s, barY + barH / 2, 5 * s, progress >= 0.5);
    this._drawMiniStar(ctx, barX + barW + 8 * s, barY + barH / 2, 5 * s, progress >= 1.0);

    // ---- 右上角：暂停按钮 ----
    const pauseX = SCREEN_WIDTH - 22 * s;
    const pauseY = 22 * s;
    const pauseR = 14 * s;

    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonCyan;
    ctx.shadowBlur = 4 * s;
    ctx.beginPath();
    ctx.arc(pauseX, pauseY, pauseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = COLORS.neonCyan;
    const lineW = 2.5 * s;
    const lineH = 11 * s;
    const gap = 4 * s;
    ctx.fillRect(pauseX - gap / 2 - lineW, pauseY - lineH / 2, lineW, lineH);
    ctx.fillRect(pauseX + gap / 2, pauseY - lineH / 2, lineW, lineH);

    // ---- Line 和 Score（第二行） ----
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${12 * s}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Line  ${line}`, 50 * s, 40 * s);

    ctx.textAlign = 'right';
    ctx.fillText(String(score), SCREEN_WIDTH - 50 * s, 40 * s);

    // ---- 左下：闪电技能按钮 ----
    this._drawSkillButton(ctx, this.lightningX, this.lightningY, this.skillBtnR, s, lightningCount);
    this._drawLightning(ctx, this.lightningX, this.lightningY - 3 * s, 10 * s);

    // ---- 右下：多球技能按钮 ----
    this._drawSkillButton(ctx, this.multiBallX, this.multiBallY, this.skillBtnR, s, multiBallCount);
    this._drawMultiBall(ctx, this.multiBallX, this.multiBallY - 3 * s, 8 * s);
  }

  _drawSkillButton(ctx, cx, cy, r, s, count) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase);

    // 外圈
    ctx.strokeStyle = COLORS.skillRed;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.skillRedGlow;
    ctx.shadowBlur = 8 * s * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 半透明填充
    ctx.fillStyle = 'rgba(150,10,10,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 数量文字
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${8 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.45);
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

  _drawMiniStar(ctx, cx, cy, size, filled) {
    ctx.fillStyle = filled ? COLORS.starActive : COLORS.starInactive;
    if (filled) {
      ctx.shadowColor = COLORS.starActive;
      ctx.shadowBlur = 4 * SCALE;
    }
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? size : size * 0.4;
      const angle = -Math.PI / 2 + (Math.PI / 5) * i;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  /**
   * 检测是否点击了辅助线按钮
   */
  hitAimButton(x, y) {
    const s = SCALE;
    const dx = x - 22 * s;
    const dy = y - 22 * s;
    return dx * dx + dy * dy <= (14 * s) * (14 * s);
  }

  /**
   * 检测是否点击了暂停按钮
   */
  hitPauseButton(x, y) {
    const s = SCALE;
    const dx = x - (SCREEN_WIDTH - 22 * s);
    const dy = y - 22 * s;
    return dx * dx + dy * dy <= (14 * s) * (14 * s);
  }

  /**
   * 检测是否点击了闪电技能按钮
   */
  hitLightningButton(x, y) {
    const dx = x - this.lightningX;
    const dy = y - this.lightningY;
    return dx * dx + dy * dy <= this.skillBtnR * this.skillBtnR;
  }

  /**
   * 检测是否点击了多球技能按钮
   */
  hitMultiBallButton(x, y) {
    const dx = x - this.multiBallX;
    const dy = y - this.multiBallY;
    return dx * dx + dy * dy <= this.skillBtnR * this.skillBtnR;
  }
}
