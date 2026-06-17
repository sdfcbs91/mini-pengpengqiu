import { PICKUP_RADIUS, SCALE } from '../config';

/**
 * 消单行道具
 * 白球每次碰到后对同行砖块造成伤害
 * 整行砖块全部清除后道具才消失
 */
export default class RowClear {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetY = 0;
    this.row = 0;           // 所在行号
    this.radius = PICKUP_RADIUS;
    this.collected = false;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  init(x, y, row) {
    this.x = x;
    this.y = y;
    this.targetY = y;
    this.row = row;
    this.collected = false;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  collect() {
    this.collected = true;
    this.radius = 0;
    this.x = -9999;
    this.y = -9999;
    this.targetY = -9999;
  }

  moveDown(amount) {
    this.targetY += amount;
    this.row++;
  }

  update() {
    this.glowPhase += 0.06;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    if (Math.abs(this.y - this.targetY) > 0.5) {
      this.y += (this.targetY - this.y) * 0.2;
    } else {
      this.y = this.targetY;
    }
  }

  render(ctx) {
    if (this.collected) return;

    const s = SCALE;
    const glow = 0.5 + 0.5 * Math.sin(this.glowPhase);
    const r = this.radius;

    // 红色外圈
    ctx.strokeStyle = '#ff3333';
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = 'rgba(255,50,50,0.8)';
    ctx.shadowBlur = 2 * s * glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内部红色横条
    const barW = r * 1.2;
    const barH = 3 * s;
    ctx.fillStyle = `rgba(255,60,60,${0.7 + 0.3 * glow})`;
    ctx.fillRect(this.x - barW / 2, this.y - barH / 2, barW, barH);
  }
}
