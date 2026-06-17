import { PICKUP_RADIUS, COLORS, SCALE } from '../config';

/**
 * 加球道具
 * 球碰到后下轮球数+1
 */
export default class Pickup {
  constructor() {
    this.x = 0;          // 中心X
    this.y = 0;          // 中心Y
    this.targetY = 0;    // 动画目标Y
    this.radius = PICKUP_RADIUS;
    this.collected = false;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  init(x, y) {
    this.x = x;
    this.y = y;
    this.targetY = y;
    this.collected = false;
    this.glowPhase = Math.random() * Math.PI * 2;
  }

  /**
   * 收集道具 - 彻底清除碰撞，防止重复触发
   */
  collect() {
    this.collected = true;
    this.radius = 0;
    this.x = -9999;
    this.y = -9999;
    this.targetY = -9999;
  }
  moveDown(amount) {
    this.targetY += amount;
  }

  update() {
    this.glowPhase += 0.05;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    // 平滑下移
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

    // 外圈发光
    ctx.strokeStyle = COLORS.pickupColor;
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = COLORS.pickupGlow;
    ctx.shadowBlur = 2 * s * glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内圈小点
    ctx.fillStyle = COLORS.pickupColor;
    ctx.globalAlpha = 0.7 + 0.3 * glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
