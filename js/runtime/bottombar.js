import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import { COLORS, SCALE, HUD_BOTTOM_HEIGHT } from '../config';

/**
 * 底部操作栏
 * 闪电技能 | 能量条 | 多球技能
 */
export default class BottomBar {
  constructor() {
    this.y = SCREEN_HEIGHT - HUD_BOTTOM_HEIGHT;
    this.glowPhase = 0;
  }

  update() {
    this.glowPhase += 0.04;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;
  }

  render(ctx, data) {
    const s = SCALE;
    const { lightningCount, multiBallCount, energy, maxEnergy } = data;
    const y = this.y;

    // ---- 背景分割线 ----
    ctx.strokeStyle = COLORS.neonRed;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonRed;
    ctx.shadowBlur = 4 * s;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(SCREEN_WIDTH, y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // ---- 左侧：闪电技能 ----
    const lx = 45 * s;
    const ly = y + 40 * s;
    const btnR = 28 * s;

    this._drawSkillButton(ctx, lx, ly, btnR, s, lightningCount);
    // 闪电图标
    this._drawLightning(ctx, lx, ly - 4 * s, 14 * s);

    // ---- 中间：能量条 ----
    const barW = SCREEN_WIDTH - 140 * s;
    const barH = 10 * s;
    const barX = 70 * s;
    const barY = ly - barH / 2;

    // 能量条背景
    ctx.fillStyle = COLORS.energyBarBg;
    _roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.fill();

    // 能量条边框
    ctx.strokeStyle = COLORS.neonCyan;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = COLORS.neonCyan;
    ctx.shadowBlur = 4 * s;
    _roundRect(ctx, barX, barY, barW, barH, barH / 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 能量填充
    const eProg = Math.min(1, (energy || 0) / (maxEnergy || 100));
    if (eProg > 0) {
      ctx.fillStyle = COLORS.energyBar;
      _roundRect(ctx, barX + 1, barY + 1, (barW - 2) * eProg, barH - 2, (barH - 2) / 2);
      ctx.fill();
    }

    // 能量条上的球形指示器
    const indicatorX = barX + barW * eProg;
    ctx.fillStyle = COLORS.ballColor;
    ctx.shadowColor = COLORS.ballGlow;
    ctx.shadowBlur = 6 * s;
    ctx.beginPath();
    ctx.arc(indicatorX, ly, 8 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // ---- 右侧：多球技能 ----
    const rx = SCREEN_WIDTH - 45 * s;
    this._drawSkillButton(ctx, rx, ly, btnR, s, multiBallCount);
    // 多球图标
    this._drawMultiBall(ctx, rx, ly - 4 * s, 10 * s);
  }

  _drawSkillButton(ctx, cx, cy, r, s, count) {
    const glow = 0.6 + 0.3 * Math.sin(this.glowPhase);

    // 外圈
    ctx.strokeStyle = COLORS.skillRed;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = COLORS.skillRedGlow;
    ctx.shadowBlur = 10 * s * glow;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 半透明填充
    ctx.fillStyle = 'rgba(150,10,10,0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fill();

    // 数量文字
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`x ${count}`, cx, cy + r * 0.5);
  }

  _drawLightning(ctx, cx, cy, size) {
    const s = SCALE;
    ctx.fillStyle = '#ffcc00';
    ctx.shadowColor = '#ffcc00';
    ctx.shadowBlur = 4 * s;
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
    ctx.shadowBlur = 4 * s;

    // 画3个小球组成三角排列
    const offsets = [
      { dx: 0, dy: -r * 0.5 },
      { dx: -r * 0.45, dy: r * 0.3 },
      { dx: r * 0.45, dy: r * 0.3 },
    ];
    offsets.forEach(({ dx, dy }) => {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  /**
   * 检测是否点击了闪电按钮
   */
  hitLightningButton(x, y) {
    const s = SCALE;
    const dx = x - 45 * s;
    const dy = y - (this.y + 40 * s);
    return dx * dx + dy * dy <= (28 * s) * (28 * s);
  }

  /**
   * 检测是否点击了多球按钮
   */
  hitMultiBallButton(x, y) {
    const s = SCALE;
    const dx = x - (SCREEN_WIDTH - 45 * s);
    const dy = y - (this.y + 40 * s);
    return dx * dx + dy * dy <= (28 * s) * (28 * s);
  }
}

function _roundRect(ctx, x, y, w, h, r) {
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
