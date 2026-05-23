import { SCREEN_WIDTH } from '../render';
import { COLORS, SCALE, STATUS_BAR_HEIGHT } from '../config';

/**
 * 顶部 HUD（单行布局，按钮全部靠左）
 * 布局：[暂停] [闪电] [多球] ... [STAGE / Rounds / Score]
 */
export default class HUD {
  constructor() {
    this.glowPhase = 0;

    const s = SCALE;
    this.rowY = STATUS_BAR_HEIGHT + 18 * s;
    this.btnR = 15 * s;
    this.pauseR = 12 * s;

    // 按钮全部靠左排列
    this.pauseX = 24 * s;
    this.lightningX = 62 * s;
    this.multiBallX = 100 * s;
    this.atkBoostX = 138 * s;  // 攻击力按钮
  }

  update() {
    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx, data) {
    const s = SCALE;
    const { stage, score, lightningCount, multiBallCount, atkBoostCount, atkLevel } = data;
    const y = this.rowY;

    // ---- 暂停按钮（最左） ----
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.pauseX, y, this.pauseR, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.neonCyan;
    const lw = 2 * s, lh = 10 * s, lg = 3.5 * s;
    ctx.fillRect(this.pauseX - lg / 2 - lw, y - lh / 2, lw, lh);
    ctx.fillRect(this.pauseX + lg / 2, y - lh / 2, lw, lh);

    // ---- 闪电技能 ----
    this._drawSkillButton(ctx, this.lightningX, y, this.btnR, s, lightningCount);
    this._drawLightning(ctx, this.lightningX, y - 2 * s, 9 * s);

    // ---- 多球技能 ----
    this._drawSkillButton(ctx, this.multiBallX, y, this.btnR, s, multiBallCount);
    this._drawMultiBall(ctx, this.multiBallX, y - 2 * s, 7 * s);

    // ---- 攻击力提升按钮 ----
    this._drawAtkButton(ctx, this.atkBoostX, y, this.btnR, s, atkBoostCount || 0, atkLevel || 1);

    // ---- 信息显示（放在按钮右侧） ----
    const infoX = 172 * s;
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${11 * s}px Arial`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`关卡 ${stage}`, infoX, y - 7 * s);

    ctx.font = `${9 * s}px Arial`;
    ctx.fillStyle = '#aaaacc';
    ctx.fillText(`${data.line || 0}/${data.maxRounds || '?'}  得分:${score}`, infoX, y + 8 * s);
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
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`⚔${level}`, cx, cy - 2 * s);

    // 剩余次数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${7 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x${count}`, cx, cy + r * 0.4);
  }

  hitAimButton() { return false; }

  hitPauseButton(x, y) {
    const dx = x - this.pauseX;
    const dy = y - this.rowY;
    return dx * dx + dy * dy <= this.pauseR * this.pauseR;
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

  hitAtkBoostButton(x, y) {
    const dx = x - this.atkBoostX;
    const dy = y - this.rowY;
    return dx * dx + dy * dy <= this.btnR * this.btnR;
  }
}
