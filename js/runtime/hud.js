import { SCREEN_WIDTH } from '../render';
import { COLORS, SCALE } from '../config';

/**
 * 顶部 HUD
 * 显示关卡号、星级进度条、行数、分数、按钮
 */
export default class HUD {
  constructor() {
    this.glowPhase = 0;
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx, data) {
    const s = SCALE;
    const { stage, line, score, starProgress, showAimLine } = data;

    // ---- 左上角：辅助线开关按钮 ----
    const btnR = 18 * s;
    const btnX = 30 * s;
    const btnY = 30 * s;
    const aimGlow = showAimLine ? 1.0 : 0.3;

    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonCyan;
    ctx.shadowBlur = 8 * s * aimGlow;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 辅助线图标（靶心）
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.globalAlpha = aimGlow;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnR * 0.45, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(btnX, btnY, 2 * s, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.neonCyan;
    ctx.fill();
    ctx.globalAlpha = 1;

    // ---- 中间：STAGE 标题 ----
    const centerX = SCREEN_WIDTH / 2;
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${12 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`STAGE-${stage}`, centerX, 14 * s);

    // ---- 星级进度条 ----
    const barW = 140 * s;
    const barH = 6 * s;
    const barX = centerX - barW / 2;
    const barY = 32 * s;

    // 进度条背景
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(barX, barY, barW, barH);

    // 进度条填充
    const progress = Math.min(1, starProgress || 0);
    if (progress > 0) {
      const gradient = ctx.createLinearGradient(barX, 0, barX + barW * progress, 0);
      gradient.addColorStop(0, '#ff6600');
      gradient.addColorStop(1, '#ffaa00');
      ctx.fillStyle = gradient;
      ctx.fillRect(barX, barY, barW * progress, barH);
    }

    // 星星标记（两个端点）
    this._drawMiniStar(ctx, barX - 8 * s, barY + barH / 2, 6 * s, progress >= 0.5);
    this._drawMiniStar(ctx, barX + barW + 8 * s, barY + barH / 2, 6 * s, progress >= 1.0);

    // ---- Line 和 Score ----
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${14 * s}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`Line  ${line}`, 30 * s, 55 * s);

    ctx.textAlign = 'right';
    ctx.fillText(String(score), SCREEN_WIDTH - 30 * s, 55 * s);

    // ---- 右上角：暂停按钮 ----
    const pauseX = SCREEN_WIDTH - 30 * s;
    const pauseY = 30 * s;
    const pauseR = 18 * s;

    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonCyan;
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(pauseX, pauseY, pauseR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 暂停图标（双竖线）
    ctx.fillStyle = COLORS.neonCyan;
    const lineW = 3 * s;
    const lineH = 14 * s;
    const gap = 5 * s;
    ctx.fillRect(pauseX - gap / 2 - lineW, pauseY - lineH / 2, lineW, lineH);
    ctx.fillRect(pauseX + gap / 2, pauseY - lineH / 2, lineW, lineH);
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
    const dx = x - 30 * s;
    const dy = y - 30 * s;
    return dx * dx + dy * dy <= (18 * s) * (18 * s);
  }

  /**
   * 检测是否点击了暂停按钮
   */
  hitPauseButton(x, y) {
    const s = SCALE;
    const dx = x - (SCREEN_WIDTH - 30 * s);
    const dy = y - 30 * s;
    return dx * dx + dy * dy <= (18 * s) * (18 * s);
  }
}
