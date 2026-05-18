import { SCREEN_WIDTH } from '../render';
import { COLORS, SCALE, STATUS_BAR_HEIGHT } from '../config';

/**
 * 顶部 HUD（单行布局）
 * 布局：[闪电] [STAGE / Rounds / Score] [暂停] [多球]
 */
export default class HUD {
  constructor() {
    this.glowPhase = 0;

    const s = SCALE;
    // 单行Y坐标（状态栏下方）
    this.rowY = STATUS_BAR_HEIGHT + 18 * s;
    this.btnR = 15 * s;

    // 按钮X坐标
    this.lightningX = 28 * s;
    this.multiBallX = SCREEN_WIDTH - 28 * s;
    this.pauseX = SCREEN_WIDTH - 70 * s;
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx, data) {
    const s = SCALE;
    const { stage, line, score, lightningCount, multiBallCount } = data;
    const y = this.rowY;
    const centerX = SCREEN_WIDTH / 2;

    // ---- 左侧：闪电技能 ----
    this._drawSkillButton(ctx, this.lightningX, y, this.btnR, s, lightningCount);
    this._drawLightning(ctx, this.lightningX, y - 2 * s, 9 * s);

    // ---- 中间信息 ----
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${11 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`STAGE ${stage}`, centerX, y - 7 * s);

    ctx.font = `${9 * s}px Arial`;
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(`${data.line || 0}/${data.maxRounds || '?'}   Score: ${score}`, centerX, y + 8 * s);

    // ---- 暂停按钮 ----
    const pauseR = 12 * s;
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.pauseX, y, pauseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.neonCyan;
    const lw = 2 * s, lh = 10 * s, lg = 3.5 * s;
    ctx.fillRect(this.pauseX - lg / 2 - lw, y - lh / 2, lw, lh);
    ctx.fillRect(this.pauseX + lg / 2, y - lh / 2, lw, lh);

    // ---- 右侧：多球技能 ----
    this._drawSkillButton(ctx, this.multiBallX, y, this.btnR, s, multiBallCount);
    this._drawMultiBall(ctx, this.multiBallX, y - 2 * s, 7 * s);
  }

  _drawSkillButton(ctx, cx, cy, r, s, count) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase);

    ctx.strokeStyle = COLORS.skillRed;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.skillRedGlow;
    ctx.shadowBlur = 6 * s * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(150,10,10,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${7 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.4);
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

  // 辅助线开关按钮已删除，hitAimButton 始终返回 false
  hitAimButton() { return false; }

  hitPauseButton(x, y) {
    const dx = x - this.pauseX;
    const dy = y - this.rowY;
    return dx * dx + dy * dy <= (12 * SCALE) * (12 * SCALE);
  }

  hitLightningButton(x, y) {
    const dx = x - this.lightningX;
    const dy = y - this.rowY;
    return dx * dx + dy * dy <= this.btnR * this.btnR;
  }

  hitMultiBallButton(x, y) {
    const dx = x - this.multiBallX;
    const dy = y - this.rowY;
    return dx * dx + dy * dy <= this.btnR * this.btnR;
  }
}
