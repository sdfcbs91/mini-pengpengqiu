import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
  LAUNCH_Y, LIGHTNING_INITIAL, MULTIBALL_INITIAL, MAX_ENERGY, ENERGY_PER_BRICK,
} from '../config';
import Grid from '../core/grid';
import Launcher from '../core/launcher';
import HUD from '../runtime/hud';
import { moveBallWithCollision } from '../core/collision';
import Warp from '../core/warp';
import { getLevelConfig } from '../data/levelData';

/**
 * 游戏主场景
 * 管理碰碰球核心玩法的所有逻辑和渲染
 */
export default class GameScene {
  constructor() {
    this.grid = new Grid();
    this.launcher = new Launcher();
    this.hud = new HUD();

    // 墙壁碰撞标记（用于死循环检测，统一为一个对象）
    this._wall = { isWall: true };

    // 游戏数据
    this.stage = 1;
    this.score = 0;
    this.line = 0;
    this.gameState = 'aiming';  // 'aiming' | 'launching' | 'running' | 'settling' | 'over' | 'win' | 'paused'
    this.prevState = '';         // 暂停前的状态
    this.glowPhase = 0;
    this.initialLevel = 1;       // 进入的关卡号（用于保存进度）
    this.maxRounds = 20;         // 通关所需回合数

    // 技能
    this.lightningCount = LIGHTNING_INITIAL;
    this.multiBallCount = MULTIBALL_INITIAL;
    this.energy = 0;
    this.showAimLine = true;

    // 球相关
    this.ballCount = 1;
    this.nextBallCount = 0;     // 本轮收集的加球道具数

    // 球速加速系统（基于帧计数，更精确）
    this.launchStartTime = 0;    // 发射开始时间戳
    this.runningFrames = 0;      // 球运行帧数（launching+running 阶段累计）
    this.speedMultiplier = 1;    // 当前速度倍率
    this.speedTipText = '';      // 加速提示文字
    this.speedTipTimer = 0;      // 提示显示计时器（帧数）

    // 统计（用于星级评价）
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    // 回调
    this.onGameOver = null;
    this.onBackToMenu = null;
    this.onLevelComplete = null;  // (levelNum, stars) => void
    this.winStars = 0;

    // 触摸绑定
    this._bindTouch();
  }

  /**
   * 初始化指定关卡
   */
  initLevel(levelNum) {
    this.initialLevel = levelNum;
    this.stage = levelNum;
    this.score = 0;
    this.line = 0;
    this.gameState = 'aiming';
    this.energy = 0;
    this.nextBallCount = 0;
    this.launchStartTime = 0;
    this.runningFrames = 0;
    this.speedMultiplier = 1;
    this.speedTipText = '';
    this.speedTipTimer = 0;
    this.totalBricksThisRound = 0;
    this.destroyedThisRound = 0;
    this.starProgress = 0;

    const cfg = getLevelConfig(levelNum);
    this.maxRounds = cfg.maxRounds || 20;
    this.ballCount = cfg.defaultBalls || (1 + levelNum);

    this.grid.initLevel(this.stage);
    this.launcher.init(SCREEN_WIDTH / 2, this.ballCount);
  }

  _bindTouch() {
    // 追踪触摸状态：是否有手指在屏幕上
    this._touching = false;

    this._touchStartHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = true;
      const { clientX, clientY } = e.touches[0];

      if (this.gameState === 'over') {
        this._handleOverTap(clientX, clientY);
        return;
      }

      if (this.gameState === 'win') {
        this._handleWinTap(clientX, clientY);
        return;
      }

      if (this.gameState === 'paused') {
        this._handlePauseTap(clientX, clientY);
        return;
      }

      // 检查HUD按钮
      if (this.hud.hitAimButton(clientX, clientY)) {
        this.showAimLine = !this.showAimLine;
        this.launcher.showAimLine = this.showAimLine;
        return;
      }
      if (this.hud.hitPauseButton(clientX, clientY)) {
        this.prevState = this.gameState;
        this.gameState = 'paused';
        return;
      }

      // 检查技能按钮（仅在瞄准阶段）
      if (this.gameState === 'aiming') {
        if (this.hud.hitLightningButton(clientX, clientY)) {
          this._useLightning();
          return;
        }
        if (this.hud.hitMultiBallButton(clientX, clientY)) {
          this._useMultiBall();
          return;
        }
      }

      // 瞄准 - 任意位置触摸都可以开始瞄准
      if (this.gameState === 'aiming') {
        this.launcher.isAiming = true;
        this.launcher.setAimAngle(clientX, clientY);
      }
    };

    this._touchMoveHandler = (e) => {
      if (GameGlobal.databus.scene !== 'playing') return;
      if (this.gameState !== 'aiming' || !this.launcher.isAiming) return;

      if (!e.touches || e.touches.length === 0) {
        this._touching = false;
        return;
      }

      const { clientX, clientY } = e.touches[0];
      this.launcher.setAimAngle(clientX, clientY);
    };

    this._touchEndHandler = () => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = false;
      this._tryLaunch();
    };

    this._touchCancelHandler = () => {
      if (GameGlobal.databus.scene !== 'playing') return;
      this._touching = false;
      this._tryLaunch();
    };

    wx.onTouchStart(this._touchStartHandler);
    wx.onTouchMove(this._touchMoveHandler);
    wx.onTouchEnd(this._touchEndHandler);
    wx.onTouchCancel(this._touchCancelHandler);
  }

  /**
   * 尝试发射球
   */
  _tryLaunch() {
    if (this.gameState === 'aiming' && this.launcher.isAiming) {
      this.launcher.isAiming = false;
      this.gameState = 'launching';
      this.launcher.startLaunch();
      this.totalBricksThisRound = this.grid.bricks.filter(b => b.isAlive).length;
      this.destroyedThisRound = 0;
      this.launchStartTime = Date.now();
      // runningFrames 跨轮累计，不在每次发射时重置
      this.speedTipText = '';
      this.speedTipTimer = 0;
    }
  }

  unbindTouch() {
    wx.offTouchStart(this._touchStartHandler);
    wx.offTouchMove(this._touchMoveHandler);
    wx.offTouchEnd(this._touchEndHandler);
    wx.offTouchCancel(this._touchCancelHandler);
  }

  _useLightning() {
    if (this.lightningCount <= 0) return;
    this.lightningCount--;

    // 清除最底行砖块
    let maxRow = -1;
    this.grid.bricks.forEach(b => {
      if (b.isAlive && b.row > maxRow) maxRow = b.row;
    });
    if (maxRow >= 0) {
      this.grid.bricks.forEach(b => {
        if (b.isAlive && b.row === maxRow) {
          b.isAlive = false;
          this.score += b.hp;
        }
      });
      this.grid.cleanup();
    }
  }

  _useMultiBall() {
    if (this.multiBallCount <= 0) return;
    this.multiBallCount--;
    this.ballCount *= 2;
    this.launcher.ballCount = this.ballCount;
  }

  /**
   * 每帧更新
   */
  update() {
    if (this.gameState === 'paused' || this.gameState === 'over' || this.gameState === 'win') return;

    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    this.hud.update();
    this.grid.update();

    // 球速加速：从进入关卡开始持续计帧（所有非暂停/结束状态都累计）
    this._checkSpeedBoost();

    switch (this.gameState) {
      case 'aiming':
        // 帧级防卡死：如果正在瞄准但手指已不在屏幕上，自动发射
        if (this.launcher.isAiming && !this._touching) {
          this._tryLaunch();
        }
        break;

      case 'launching':
        this.launcher.updateLaunch();
        this._updateBalls();
        if (!this.launcher.isLaunching && this.launcher.allBallsStopped()) {
          this.gameState = 'settling';
        } else if (!this.launcher.isLaunching) {
          this.gameState = 'running';
        }
        break;

      case 'running':
        this._updateBalls();
        if (this.launcher.allBallsStopped()) {
          this.gameState = 'settling';
        }
        break;

      case 'settling':
        this._settle();
        break;
    }
  }

  /**
   * 检测球速加速（阈值从关卡配置读取）
   */
  _checkSpeedBoost() {
    this.runningFrames++;

    const cfg = getLevelConfig(this.stage);
    let newMultiplier = 1;
    if (this.runningFrames >= cfg.speedBoostFrame1) {
      newMultiplier = 2;
    }

    if (newMultiplier !== this.speedMultiplier) {
      this.speedMultiplier = newMultiplier;
      if (newMultiplier === 2) {
        this.speedTipText = '加速 x2';
      }
      this.speedTipTimer = 120; // 显示2秒

      // 立即对所有飞行中的球强制设速
      this.launcher.balls.forEach(ball => {
        if (ball.active) {
          ball.applySpeedMultiplier(newMultiplier);
        }
      });
    }

    if (this.speedTipTimer > 0) {
      this.speedTipTimer--;
    }
  }

  _updateBalls() {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const bricks = this.grid.bricks;
    // 横板也参与碰撞（球碰到反弹但不消除）
    const allObstacles = [...bricks, ...this.grid.planks];

    this.launcher.balls.forEach(ball => {
      if (ball.isFullyStopped()) return;

      if (ball.active && this.speedMultiplier > 1) {
        ball.applySpeedMultiplier(this.speedMultiplier);
      }

      if (ball.sliding) {
        ball.update(left, right, top, bottom);
        return;
      }

      if (ball.landed && !ball.sliding && !ball.slideDone) {
        this.launcher.checkLanded(ball);
        ball.update(left, right, top, bottom);
        return;
      }

      if (!ball.active) return;

      const vx = ball.vx;
      const vy = ball.vy;

      // 快速回落检测：球向下飞且路径上没有砖块时，加速3倍回落
      let speedBoost = 1;
      if (vy > 0 && this.speedMultiplier >= 2) {
        const hasBlockAhead = this._hasBrickInPath(ball, allObstacles);
        if (!hasBlockAhead) {
          speedBoost = 3;
        }
      }

      const moveVx = vx * speedBoost;
      const moveVy = vy * speedBoost;

      // 1. 扫描碰撞：沿速度方向移动，遇到砖块就停+反弹
      const hitBricks = moveBallWithCollision(ball, moveVx, moveVy, allObstacles);

      // 2. 处理被击中的砖块
      for (const brick of hitBricks) {
        const destroyed = brick.hit();
        if (destroyed) {
          this.score += brick.maxHp;
          this.destroyedThisRound++;
          this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        }
      }

      // 3. 墙壁反弹（扫描碰撞后球可能到了墙壁外）
      const r = ball.radius;
      if (ball.x - r <= left) { ball.x = left + r; ball.vx = Math.abs(ball.vx); ball.recordBounce(this._wall); }
      if (ball.x + r >= right) { ball.x = right - r; ball.vx = -Math.abs(ball.vx); ball.recordBounce(this._wall); }
      if (ball.y - r <= top) { ball.y = top + r; ball.vy = Math.abs(ball.vy); ball.recordBounce(this._wall); }

      // 4. 底部落地
      if (ball.vy > 0 && ball.y + r >= bottom) {
        ball.y = bottom - r;
        ball.active = false;
        ball.landed = true;
        ball.landX = ball.x;
        if (!ball.slideDone && !ball.sliding) {
          this.launcher.checkLanded(ball);
        }
      }

      // 5. 道具碰撞（一步内可收集多个，碰撞半径加容差让擦边也能触发）
      if (ball.active) {
        for (const pickup of this.grid.pickups) {
          if (pickup.collected) continue;
          const pdx = ball.x - pickup.x;
          const pdy = ball.y - pickup.y;
          const pickupHitR = ball.radius + pickup.radius + 4 * SCALE;
          if (pdx * pdx + pdy * pdy < pickupHitR * pickupHitR) {
            pickup.collect();
            this.nextBallCount++;
          }
        }
      }

      // 5.5 白洞碰撞（碰到后传送到缓存位置，白洞不消失，碰撞半径加容差）
      if (ball.active) {
        for (const warp of this.grid.warps) {
          if (!warp.active) continue;
          const dx = ball.x - warp.x;
          const dy = ball.y - warp.y;
          const warpHitR = ball.radius + warp.radius + 4 * SCALE;
          if (dx * dx + dy * dy < warpHitR * warpHitR) {
            // 记录白洞碰撞用于循环检测
            ball.recordBounce(warp);
            // 第一次碰到时计算并缓存目标位置
            if (!warp.hasCachedDest()) {
              this._calcWarpDest(warp);
            }
            // 传送到缓存位置
            const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.x = warp.cachedDestX;
            ball.y = warp.cachedDestY;
            ball.vx = Math.cos(warp.cachedAngle) * spd;
            ball.vy = Math.sin(warp.cachedAngle) * spd;
            this._warpEffect = { x: warp.x, y: warp.y, dx: warp.cachedDestX, dy: warp.cachedDestY, timer: 30 };
            break;
          }
        }
      }

      // 6. 防水平弹跳
      if (ball.active) {
        const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (spd > 0) {
          const minC = spd * 0.05;
          if (Math.abs(ball.vy) < minC) {
            ball.vy += ball.vy >= 0 ? minC : -minC;
            if (Math.abs(ball.vy) < 0.01) ball.vy = minC;
            const ns = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            ball.vx *= spd / ns;
            ball.vy *= spd / ns;
          }
        }
      }
      // 7. 循环弹跳穿越：检测到重复路径时打破循环
      if (ball.active && ball.needWarp) {
        ball.needWarp = false;
        const loopObj = ball.loopObject;
        ball.loopObject = null;
        ball.bounceHistory = [];

        if (loopObj instanceof Warp) {
          // 循环路径包含白洞：重新随机目标位置，传送到新位置
          loopObj.resetCache();
          this._calcWarpDest(loopObj);
          const spd2 = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
          ball.x = loopObj.cachedDestX;
          ball.y = loopObj.cachedDestY;
          ball.vx = Math.cos(loopObj.cachedAngle) * spd2;
          ball.vy = Math.sin(loopObj.cachedAngle) * spd2;
          this._warpEffect = { x: loopObj.x, y: loopObj.y, dx: loopObj.cachedDestX, dy: loopObj.cachedDestY, timer: 30 };
        } else {
          // 循环路径不含白洞：生成临时白洞效果，传送到随机空位
          const fromX = ball.x, fromY = ball.y;
          this._warpBall(ball);
          this._warpEffect = { x: fromX, y: fromY, dx: ball.x, dy: ball.y, timer: 30 };
        }
      }
    });
  }

  /**
   * 将球传送到随机空位（空心白洞穿越效果）
   */
  _warpBall(ball) {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const r = ball.radius;

    // 随机找一个不在砖块内的位置
    const allObstacles = [...this.grid.bricks.filter(b => b.isAlive), ...this.grid.planks];
    for (let attempt = 0; attempt < 20; attempt++) {
      const nx = left + r + Math.random() * (right - left - r * 2);
      const ny = top + r + Math.random() * (bottom - top - r * 2) * 0.6; // 偏上半区

      // 检查是否与任何障碍物重叠
      let blocked = false;
      for (const ob of allObstacles) {
        if (nx + r > ob.x && nx - r < ob.x + ob.width &&
            ny + r > ob.y && ny - r < ob.y + ob.height) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        ball.x = nx;
        ball.y = ny;
        // 给一个随机向下的角度
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        const spd = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        ball.vx = Math.cos(angle) * spd;
        ball.vy = Math.sin(angle) * spd;
        return;
      }
    }

    // 找不到空位就强制往下弹
    ball.vy = Math.abs(ball.vy);
  }

  /**
   * 为白洞计算并缓存传送目标位置（每轮只算一次）
   */
  _calcWarpDest(warp) {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const r = 8; // 球半径近似

    const allObstacles = [...this.grid.bricks.filter(b => b.isAlive), ...this.grid.planks];

    for (let attempt = 0; attempt < 20; attempt++) {
      const nx = left + r + Math.random() * (right - left - r * 2);
      const ny = top + r + Math.random() * (bottom - top - r * 2) * 0.6;

      let blocked = false;
      for (const ob of allObstacles) {
        if (nx + r > ob.x && nx - r < ob.x + ob.width &&
            ny + r > ob.y && ny - r < ob.y + ob.height) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        warp.cachedDestX = nx;
        warp.cachedDestY = ny;
        warp.cachedAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
        return;
      }
    }

    // 兜底：传送到游戏区域中间偏上
    warp.cachedDestX = (left + right) / 2;
    warp.cachedDestY = top + (bottom - top) * 0.3;
    warp.cachedAngle = -Math.PI / 2;
  }

  /**
   * 检测球的前进路径上是否有砖块
   */
  _hasBrickInPath(ball, bricks) {
    const r = ball.radius;
    const vx = ball.vx;
    const vy = ball.vy;

    for (const brick of bricks) {
      if (!brick.isAlive) continue;

      // Minkowski扩展AABB
      const ex = brick.x - r;
      const ey = brick.y - r;
      const ew = brick.width + r * 2;
      const eh = brick.height + r * 2;

      // 简单射线-AABB检测
      let tMin = -Infinity, tMax = Infinity;

      if (Math.abs(vx) > 0.001) {
        let t1 = (ex - ball.x) / vx;
        let t2 = (ex + ew - ball.x) / vx;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
      } else {
        if (ball.x < ex || ball.x > ex + ew) continue;
      }

      if (Math.abs(vy) > 0.001) {
        let t1 = (ey - ball.y) / vy;
        let t2 = (ey + eh - ball.y) / vy;
        if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
        tMin = Math.max(tMin, t1);
        tMax = Math.min(tMax, t2);
      } else {
        if (ball.y < ey || ball.y > ey + eh) continue;
      }

      // t > 0 且相交 → 前方有砖块
      if (tMax > 0 && tMin < tMax && tMin < 50) {
        return true;
      }
    }

    return false;
  }

  _settle() {
    // 结算：清理已消除砖块和已收集道具
    this.grid.cleanup();

    // 白洞缓存重置（下一轮重新计算传送位置）
    this.grid.warps.forEach(w => { if (w.active) w.resetCache(); });

    // 清理超出底线的未收集道具
    this.grid.pickups = this.grid.pickups.filter(p => {
      if (p.collected) return false;
      if (p.targetY > LAUNCH_Y) return false;
      return true;
    });

    // 计算星级进度
    if (this.totalBricksThisRound > 0) {
      this.starProgress = Math.min(1, this.destroyedThisRound / this.totalBricksThisRound);
    }

    // 增加行数
    this.line++;

    const reachedTarget = this.line >= this.maxRounds;
    const noBricksLeft = this.grid.bricks.filter(b => b.isAlive).length === 0;

    // 通关条件：达到目标回合数 且 所有砖块已清除
    if (reachedTarget && noBricksLeft) {
      const stars = this.score > this.maxRounds * 10 ? 3 : this.score > this.maxRounds * 5 ? 2 : 1;
      this.winStars = stars;
      this.gameState = 'win';
      if (this.onLevelComplete) {
        this.onLevelComplete(this.initialLevel, stars);
      }
      return;
    }

    this.stage++;

    // 砖块下移
    const isOver = this.grid.shiftDown(LAUNCH_Y);

    // 删除靠近发射线的横板（防止与白球起点重叠）
    const safeZone = LAUNCH_Y - this.grid.rowHeight;
    this.grid.planks = this.grid.planks.filter(p => p.targetY < safeZone);

    // 达到目标回合后不再生成新砖块，只继续推砖块下移
    if (!reachedTarget) {
      this.grid.generateRow(this.stage, 0);
    }

    // 更新球数
    this.ballCount += this.nextBallCount;
    this.nextBallCount = 0;

    // 更新发射点
    const nextX = this.launcher.getNextLaunchX();
    this.launcher.init(nextX, this.ballCount);
    this.launcher.showAimLine = this.showAimLine;

    // 检查游戏结束（砖块触底）
    if (isOver || this.grid.checkGameOver(LAUNCH_Y)) {
      this.gameState = 'over';
      return;
    }

    // 下移后砖块可能全被推出/打完了，再检一次
    if (reachedTarget && this.grid.bricks.filter(b => b.isAlive).length === 0) {
      const stars = this.score > this.maxRounds * 10 ? 3 : this.score > this.maxRounds * 5 ? 2 : 1;
      this.winStars = stars;
      this.gameState = 'win';
      if (this.onLevelComplete) {
        this.onLevelComplete(this.initialLevel, stars);
      }
      return;
    }

    this.gameState = 'aiming';
  }

  /**
   * 渲染
   */
  render(ctx) {
    // 背景
    this._renderBackground(ctx);

    // 游戏区域边框
    this._renderGameAreaBorder(ctx);

    // 砖块和道具
    this.grid.render(ctx, this.glowPhase);

    // 球
    this.launcher.renderBalls(ctx);

    // 穿越白洞特效
    if (this._warpEffect && this._warpEffect.timer > 0) {
      this._renderWarpEffect(ctx);
    }

    // 发射点（瞄准线等）
    this.launcher.render(ctx, this.gameState, this.grid.bricks);

    // HUD（单行：闪电 | 关卡信息 | 暂停 | 多球）
    this.hud.render(ctx, {
      stage: this.stage,
      line: this.line,
      maxRounds: this.maxRounds,
      score: this.score,
      lightningCount: this.lightningCount,
      multiBallCount: this.multiBallCount,
    });

    // 加速提示
    if (this.speedTipTimer > 0) {
      this._renderSpeedTip(ctx);
    }

    // 暂停覆盖层
    if (this.gameState === 'paused') {
      this._renderPauseOverlay(ctx);
    }

    // 游戏结束覆盖层
    if (this.gameState === 'over') {
      this._renderGameOverOverlay(ctx);
    }

    // 通关覆盖层
    if (this.gameState === 'win') {
      this._renderWinOverlay(ctx);
    }
  }

  /**
   * 渲染穿越白洞特效 — 出发点缩小消失 + 目标点扩散出现
   */
  _renderWarpEffect(ctx) {
    const e = this._warpEffect;
    e.timer--;
    const progress = e.timer / 30; // 1→0
    const s = SCALE;

    // === 出发点：圆环缩小消失 ===
    const rOut = 15 * s * progress;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;
    ctx.globalAlpha = progress * 0.8;
    ctx.beginPath();
    ctx.arc(e.x, e.y, rOut, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(e.x, e.y, rOut * 0.5, 0, Math.PI * 2);
    ctx.stroke();

    // === 目标点：圆环从小扩散 + 闪烁出现 ===
    if (e.dx != null && e.dy != null) {
      const appear = 1 - progress; // 0→1
      const rDest = 18 * s * appear;
      const flash = 0.6 + 0.4 * Math.sin(appear * Math.PI * 4);

      // 扩散外圈（蓝白发光）
      ctx.shadowColor = 'rgba(150,200,255,0.9)';
      ctx.shadowBlur = 14 * s * appear;
      ctx.strokeStyle = `rgba(200,220,255,${0.9 * flash * (appear > 0.1 ? 1 : appear * 10)})`;
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(e.dx, e.dy, rDest, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 扩散内圈
      ctx.strokeStyle = `rgba(180,210,255,${0.7 * flash * appear})`;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.arc(e.dx, e.dy, rDest * 0.5, 0, Math.PI * 2);
      ctx.stroke();

      // 十字标记
      const crossLen = 6 * s * appear;
      ctx.strokeStyle = `rgba(255,255,255,${0.8 * flash * appear})`;
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(e.dx - crossLen, e.dy);
      ctx.lineTo(e.dx + crossLen, e.dy);
      ctx.moveTo(e.dx, e.dy - crossLen);
      ctx.lineTo(e.dx, e.dy + crossLen);
      ctx.stroke();

      // 中心亮点
      ctx.fillStyle = `rgba(255,255,255,${0.9 * appear})`;
      ctx.beginPath();
      ctx.arc(e.dx, e.dy, 3 * s * appear, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  _renderSpeedTip(ctx) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT * 0.35;

    // 淡入淡出
    let alpha = 1;
    if (this.speedTipTimer > 105) alpha = (120 - this.speedTipTimer) / 15;
    else if (this.speedTipTimer < 25) alpha = this.speedTipTimer / 25;

    ctx.globalAlpha = alpha * 0.95;

    // 背景圆角矩形
    const tw = 160 * s;
    const th = 40 * s;
    const r = th / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.moveTo(centerX - tw / 2 + r, centerY - th / 2);
    ctx.lineTo(centerX + tw / 2 - r, centerY - th / 2);
    ctx.arcTo(centerX + tw / 2, centerY - th / 2, centerX + tw / 2, centerY, r);
    ctx.arcTo(centerX + tw / 2, centerY + th / 2, centerX + tw / 2 - r, centerY + th / 2, r);
    ctx.lineTo(centerX - tw / 2 + r, centerY + th / 2);
    ctx.arcTo(centerX - tw / 2, centerY + th / 2, centerX - tw / 2, centerY, r);
    ctx.arcTo(centerX - tw / 2, centerY - th / 2, centerX - tw / 2 + r, centerY - th / 2, r);
    ctx.closePath();
    ctx.fill();

    // 边框发光
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 文字
    ctx.fillStyle = '#ffcc00';
    ctx.font = `bold ${18 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.speedTipText, centerX, centerY);

    ctx.globalAlpha = 1;
  }

  _renderBackground(ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, SCREEN_HEIGHT);
    gradient.addColorStop(0, COLORS.bgTop);
    gradient.addColorStop(0.4, COLORS.bgMid);
    gradient.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
  }

  _renderGameAreaBorder(ctx) {
    const s = SCALE;
    const glow = 0.5 + 0.3 * Math.sin(this.glowPhase);

    ctx.strokeStyle = COLORS.neonBlue;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.neonBlue;
    ctx.shadowBlur = 10 * s * glow;
    ctx.strokeRect(
      GAME_AREA_LEFT - 2, GAME_AREA_TOP - 2,
      GAME_AREA_RIGHT - GAME_AREA_LEFT + 4,
      LAUNCH_Y - GAME_AREA_TOP + 4
    );
    ctx.shadowBlur = 0;
  }

  _renderPauseOverlay(ctx) {
    const s = SCALE;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `bold ${24 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PAUSED', centerX, centerY - 60 * s);

    // 继续按钮
    this._drawButton(ctx, centerX, centerY, 120 * s, 40 * s, 'CONTINUE', COLORS.neonCyan);

    // 返回菜单按钮
    this._drawButton(ctx, centerX, centerY + 60 * s, 120 * s, 40 * s, 'MENU', COLORS.neonRed);
  }

  _renderGameOverOverlay(ctx) {
    const s = SCALE;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = COLORS.neonRed;
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.neonRed;
    ctx.shadowBlur = 10 * s;
    ctx.fillText('GAME OVER', centerX, centerY - 80 * s);
    ctx.shadowBlur = 0;

    // 分数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${16 * s}px Arial`;
    ctx.fillText(`Score: ${this.score}`, centerX, centerY - 30 * s);
    ctx.fillText(`Stage: ${this.stage}`, centerX, centerY);
    ctx.fillText(`Rounds: ${this.line} / ${this.maxRounds}`, centerX, centerY + 30 * s);

    // 重试按钮
    this._drawButton(ctx, centerX, centerY + 80 * s, 120 * s, 40 * s, 'RETRY', COLORS.neonCyan);

    // 返回菜单
    this._drawButton(ctx, centerX, centerY + 130 * s, 120 * s, 40 * s, 'MENU', COLORS.neonRed);
  }

  _renderWinOverlay(ctx) {
    const s = SCALE;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 12 * s;
    ctx.fillText('STAGE CLEAR!', centerX, centerY - 100 * s);
    ctx.shadowBlur = 0;

    // 星星
    const starY = centerY - 55 * s;
    const starSize = 14 * s;
    const starGap = starSize * 2.5;
    for (let i = 0; i < 3; i++) {
      const sx = centerX + (i - 1) * starGap;
      const filled = i < this.winStars;
      ctx.fillStyle = filled ? '#ffdd00' : '#333355';
      if (filled) { ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 6 * s; }
      ctx.beginPath();
      for (let j = 0; j < 10; j++) {
        const r = j % 2 === 0 ? starSize : starSize * 0.4;
        const angle = -Math.PI / 2 + (Math.PI / 5) * j;
        const px = sx + Math.cos(angle) * r;
        const py = starY + Math.sin(angle) * r;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 分数信息
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${15 * s}px Arial`;
    ctx.fillText(`Score: ${this.score}`, centerX, centerY - 15 * s);
    ctx.fillText(`Rounds: ${this.line} / ${this.maxRounds}`, centerX, centerY + 15 * s);

    // 下一关按钮
    this._drawButton(ctx, centerX, centerY + 65 * s, 140 * s, 40 * s, 'NEXT LEVEL', '#39ff14');

    // 返回菜单
    this._drawButton(ctx, centerX, centerY + 120 * s, 140 * s, 40 * s, 'MENU', COLORS.neonCyan);
  }

  _handleWinTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 140 * s;
    const bh = 40 * s;

    // 下一关按钮
    const nextY = centerY + 65 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= nextY - bh / 2 && y <= nextY + bh / 2) {
      this.initLevel(this.initialLevel + 1);
      return;
    }

    // 返回菜单
    const menuY = centerY + 120 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }

  _drawButton(ctx, cx, cy, w, h, text, color) {
    const s = SCALE;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6 * s;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = color;
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, cy);

    // 存储按钮区域用于点击检测
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }

  _handlePauseTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 120 * s;
    const bh = 40 * s;

    // 继续按钮
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= centerY - bh / 2 && y <= centerY + bh / 2) {
      this.gameState = this.prevState || 'aiming';
      return;
    }

    // 返回菜单按钮
    const menuY = centerY + 60 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }

  _handleOverTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 120 * s;
    const bh = 40 * s;

    // 重试按钮
    const retryY = centerY + 80 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= retryY - bh / 2 && y <= retryY + bh / 2) {
      this.initLevel(this.stage);
      return;
    }

    // 返回菜单
    const menuY = centerY + 130 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }
  }
}
