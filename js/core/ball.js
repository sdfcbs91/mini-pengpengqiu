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
    this.usedWarps = new Set();  // 本次飞行已穿过的白洞
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
    this.usedWarps = new Set();
  }

  /**
   * 记录碰撞，检测死循环弹跳
   * 用球的碰撞坐标（降精度取整）作为路径标识
   * 碰到砖块时清空历史（局面已改变）
   * 检测：坐标序列中存在长度1~4的子模式连续重复3次
   */
  recordBounce(obstacle) {
    // 砖块碰撞：清空历史记录（碰到砖块说明局面改变）
    if (obstacle.isAlive !== undefined && !obstacle.isPlank) {
      this.bounceHistory = [];
      return;
    }

    // 生成碰撞点 key：坐标降精度（除以8取整），容忍浮点漂移
    // 8px容差 ≈ 球半径大小，同一区域内的碰撞视为同一位置
    const gx = Math.round(this.x / 8);
    const gy = Math.round(this.y / 8);
    const key = ((gx & 0xFFFF) << 16) | (gy & 0xFFFF);

    // 同一坐标连续记录则跳过（防止单帧内重复计数）
    if (this.bounceHistory.length > 0 &&
        this.bounceHistory[this.bounceHistory.length - 1].key === key) {
      return;
    }

    this.bounceHistory.push({ key, obj: obstacle });
    // 保留最多12条记录（最长模式4 × 重复3次 = 12）
    if (this.bounceHistory.length > 12) {
      this.bounceHistory.shift();
    }

    // 检测重复路径：从历史末尾检查是否存在长度1~4的坐标模式重复了3次
    const h = this.bounceHistory;
    const len = h.length;
    for (let patLen = 1; patLen <= 4 && patLen * 3 <= len; patLen++) {
      const start = len - patLen * 3;
      let isLoop = true;
      for (let rep = 1; rep < 3 && isLoop; rep++) {
        for (let i = 0; i < patLen; i++) {
          if (h[start + i].key !== h[start + rep * patLen + i].key) {
            isLoop = false;
            break;
          }
        }
      }
      if (isLoop) {
        this.needWarp = true;
        // loopObject 取模式中最关键的对象（优先取非墙壁的）
        this.loopObject = null;
        for (let i = 0; i < patLen; i++) {
          const obj = h[start + i].obj;
          if (!obj.isWall) {
            this.loopObject = obj;
            break;
          }
        }
        if (!this.loopObject) this.loopObject = h[start].obj;
        return;
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
      // 彻底重置所有状态，防止任何前置特效残留
      ctx.globalAlpha = 1;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // 外发光圈
      ctx.fillStyle = 'rgba(200,220,255,0.2)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();

      // 纯白实心球（始终白色，不变色）
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    // 滑动回收中
    if (this.sliding && !this.slideDone) {
      ctx.globalAlpha = 0.7;
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }
  }
}
