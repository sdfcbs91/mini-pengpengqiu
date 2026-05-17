import { BALL_RADIUS, BALL_SPEED, BALL_TRAIL_LENGTH, COLORS } from '../config';

/**
 * 球类
 * 管理球的运动、渲染、轨迹
 */
export default class Ball {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL_RADIUS;
    this.speed = BALL_SPEED;
    this.active = false;       // 是否正在运动
    this.landed = false;       // 是否已落地
    this.landX = 0;            // 落地位置X
    this.trail = [];           // 轨迹点
  }

  /**
   * 初始化球，设置发射位置和角度
   */
  init(x, y, angle) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.active = true;
    this.landed = false;
    this.landX = x;
    this.trail = [];
  }

  reset() {
    this.active = false;
    this.landed = false;
    this.trail = [];
  }

  update(left, right, top, bottom) {
    if (!this.active) return;

    // 记录轨迹
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > BALL_TRAIL_LENGTH) {
      this.trail.shift();
    }

    // 移动
    this.x += this.vx;
    this.y += this.vy;

    // 墙壁碰撞
    if (this.x - this.radius <= left) {
      this.x = left + this.radius;
      this.vx = Math.abs(this.vx);
    }
    if (this.x + this.radius >= right) {
      this.x = right - this.radius;
      this.vx = -Math.abs(this.vx);
    }
    if (this.y - this.radius <= top) {
      this.y = top + this.radius;
      this.vy = Math.abs(this.vy);
    }

    // 底部落地
    if (this.y + this.radius >= bottom) {
      this.y = bottom - this.radius;
      this.active = false;
      this.landed = true;
      this.landX = this.x;
    }
  }

  render(ctx) {
    if (!this.active && !this.landed) return;

    // 绘制轨迹
    if (this.active) {
      for (let i = 0; i < this.trail.length; i++) {
        const t = this.trail[i];
        const alpha = (i + 1) / this.trail.length * 0.5;
        const r = this.radius * (0.3 + 0.4 * (i / this.trail.length));
        ctx.fillStyle = COLORS.trailColor;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 绘制球（仅运动中的球）
    if (this.active) {
      // 发光
      ctx.shadowColor = COLORS.ballGlow;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COLORS.ballColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}
