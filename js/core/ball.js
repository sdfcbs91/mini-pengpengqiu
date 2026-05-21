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

    // 循环弹跳检测
    this.bounceHistory = [];     // 最近碰撞对象记录
    this.loopCount = 0;          // 检测到的循环次数
    this.needWarp = false;       // 是否需要穿越
    this.loopObject = null;      // 导致循环的对象引用
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
    this.bounceHistory = [];
    this.loopCount = 0;
    this.needWarp = false;
    this.loopObject = null;
  }

  /**
   * 记录碰撞对象，检测死循环弹跳
   * 只记录非砖块对象（横板、白洞等），砖块碰撞会清空历史（局面已改变）
   * 最近6次非砖块碰撞中同一对象出现>=3次，判定为死循环
   */
  recordBounce(obstacle) {
    // 砖块碰撞：清空历史记录（碰到砖块说明局面改变，之前的路径不再有效）
    if (obstacle.isAlive !== undefined && !obstacle.isPlank) {
      this.bounceHistory = [];
      return;
    }

    // 同一对象连续记录则跳过（防止单帧内重复计数）
    if (this.bounceHistory.length > 0 &&
        this.bounceHistory[this.bounceHistory.length - 1] === obstacle) {
      return;
    }

    this.bounceHistory.push(obstacle);
    if (this.bounceHistory.length > 6) {
      this.bounceHistory.shift();
    }

    // 检测：最近6次中是否有非砖块对象出现3次以上
    if (this.bounceHistory.length >= 3) {
      const countMap = new Map();
      for (const obj of this.bounceHistory) {
        countMap.set(obj, (countMap.get(obj) || 0) + 1);
      }
      for (const [obj, count] of countMap.entries()) {
        if (count >= 3) {
          this.needWarp = true;
          this.loopObject = obj;
          return;
        }
      }
    }
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
