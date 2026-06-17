import { BRICK_W, BRICK_H, COLORS, SCALE } from '../config';

/**
 * 横板类
 * 不可破坏的障碍物，高度为砖块的1/4，增加关卡难度
 * 球碰到横板会反弹但横板不消失
 * 横板到达底部不算游戏失败
 */
export default class Plank {
  constructor() {
    this.row = 0;
    this.col = 0;
    this.x = 0;
    this.y = 0;
    this.targetY = 0;
    this.width = BRICK_W;
    this.height = BRICK_H * 0.25;  // 砖块高度的1/4
    this.isAlive = true;            // 始终为true（不可破坏）
    this.isPlank = true;            // 标记为横板
  }

  init(row, col, x, y) {
    this.row = row;
    this.col = col;
    this.x = x;
    this.y = y + BRICK_H * 0.375;  // 居中放置在砖块格子内
    this.targetY = this.y;
    this.width = BRICK_W;
    this.height = BRICK_H * 0.25;
  }

  update() {
    // 平滑下移
    if (Math.abs(this.y - this.targetY) > 0.5) {
      this.y += (this.targetY - this.y) * 0.2;
    } else {
      this.y = this.targetY;
    }
  }

  /**
   * 被击中不做任何事（不可破坏）
   */
  hit() {
    return false;
  }

  render(ctx, glowPhase) {
    const s = SCALE;
    const x = this.x;
    const y = this.y;
    const w = this.width;
    const h = this.height;

    // 金属质感背景
    const gradient = ctx.createLinearGradient(x, y, x, y + h);
    gradient.addColorStop(0, '#667788');
    gradient.addColorStop(0.3, '#aabbcc');
    gradient.addColorStop(0.5, '#ddeeff');
    gradient.addColorStop(0.7, '#aabbcc');
    gradient.addColorStop(1, '#667788');
    ctx.fillStyle = gradient;

    // 圆角矩形
    const r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + r, r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
    ctx.fill();

    // 边框发光
    const glow = 0.4 + 0.2 * Math.sin(glowPhase + this.col);
    ctx.strokeStyle = '#88ccff';
    ctx.lineWidth = 1;
    ctx.shadowColor = '#88ccff';
    ctx.shadowBlur = 2 * s * glow;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}
