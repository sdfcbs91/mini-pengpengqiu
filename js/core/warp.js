import { SCALE } from '../config';

/**
 * 空心白洞 — 随机穿越道具
 * 球碰到白洞后传送到游戏区域的随机位置
 * 白洞不可破坏，随砖块一起下移
 */
export default class Warp {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.targetY = 0;
    this.radius = 12 * SCALE;
    this.active = true;
    this.phase = Math.random() * Math.PI * 2;
  }

  init(x, y) {
    this.x = x;
    this.y = y;
    this.targetY = y;
    this.active = true;
    this.phase = Math.random() * Math.PI * 2;
  }

  moveDown(amount) {
    this.targetY += amount;
  }

  update() {
    this.phase += 0.06;
    if (this.phase > Math.PI * 2) this.phase -= Math.PI * 2;

    // 平滑下移
    if (Math.abs(this.y - this.targetY) > 0.5) {
      this.y += (this.targetY - this.y) * 0.2;
    } else {
      this.y = this.targetY;
    }
  }

  render(ctx) {
    if (!this.active) return;

    const s = SCALE;
    const glow = 0.5 + 0.5 * Math.sin(this.phase);
    const r = this.radius;

    // 外圈（旋转效果）
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.shadowColor = 'rgba(255,255,255,0.8)';
    ctx.shadowBlur = 8 * s * glow;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内圈（脉动）
    const innerR = r * (0.4 + 0.15 * Math.sin(this.phase * 2));
    ctx.strokeStyle = 'rgba(200,220,255,0.7)';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(this.x, this.y, innerR, 0, Math.PI * 2);
    ctx.stroke();

    // 中心点
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, 2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}
