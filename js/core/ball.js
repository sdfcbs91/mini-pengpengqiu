import { BALL_RADIUS, BALL_SPEED, SCALE } from '../config';

/**
 * 球类
 * 管理球的运动、落地、滑动回收、渲染
 */
export default class Ball {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.radius = BALL_RADIUS;
    this.speed = BALL_SPEED;
    this.baseVx = 0;           // 初始速度分量（用于倍率计算）
    this.baseVy = 0;
    this.active = false;
    this.landed = false;
    this.landX = 0;

    // 滑动回收状态
    this.sliding = false;
    this.slideDone = false;
    this.slideTargetX = 0;
    this.slideSpeed = 0;
  }

  init(x, y, angle) {
    this.x = x;
    this.y = y;
    this.baseVx = Math.cos(angle) * this.speed;
    this.baseVy = Math.sin(angle) * this.speed;
    this.vx = this.baseVx;
    this.vy = this.baseVy;
    this.active = true;
    this.landed = false;
    this.landX = x;
    this.sliding = false;
    this.slideDone = false;
  }

  /**
   * 应用速度倍率（保持方向不变，调整速度大小）
   */
  applySpeedMultiplier(multiplier) {
    const currentSpeed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    const targetSpeed = this.speed * multiplier;
    if (currentSpeed > 0 && Math.abs(currentSpeed - targetSpeed) > 0.1) {
      const ratio = targetSpeed / currentSpeed;
      this.vx *= ratio;
      this.vy *= ratio;
    }
  }

  startSlide(targetX) {
    this.sliding = true;
    this.slideDone = false;
    this.slideTargetX = targetX;
    const dist = Math.abs(targetX - this.x);
    this.slideSpeed = Math.max(4 * SCALE, dist / 15);
  }

  update(left, right, top, bottom) {
    // 滑动回收中
    if (this.sliding && !this.slideDone) {
      const dx = this.slideTargetX - this.x;
      if (Math.abs(dx) <= this.slideSpeed) {
        this.x = this.slideTargetX;
        this.sliding = false;
        this.slideDone = true;
      } else {
        this.x += dx > 0 ? this.slideSpeed : -this.slideSpeed;
      }
      return;
    }

    if (!this.active) return;

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
    if (this.vy > 0 && this.y + this.radius >= bottom) {
      this.y = bottom - this.radius;
      this.active = false;
      this.landed = true;
      this.landX = this.x;
    }
  }

  isFullyStopped() {
    if (!this.landed) return false;
    if (this.sliding) return false;
    return true;
  }

  render(ctx) {
    // 飞行中
    if (this.active) {
      // 外发光圈
      ctx.fillStyle = 'rgba(200,220,255,0.2)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 纯白实心球
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // 滑动回收中
    if (this.sliding && !this.slideDone) {
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
  }
}
