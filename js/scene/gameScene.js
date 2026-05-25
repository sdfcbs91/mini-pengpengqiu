import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
  LAUNCH_Y, LIGHTNING_INITIAL, MULTIBALL_INITIAL, MAX_ENERGY, ENERGY_PER_BRICK,
  GRID_COLS, BALL_RADIUS,
} from '../config';
import Grid from '../core/grid';
import Brick from '../core/brick';
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

    // 墙壁碰撞标记（用于死循环检测，区分三面墙）
    this._wallLeft = { isWall: true, wallId: 1 };
    this._wallRight = { isWall: true, wallId: 2 };
    this._wallTop = { isWall: true, wallId: 3 };

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
    this.atkBoostCount = 2;      // 攻击力提升次数（每关2次）
    this.atkLevel = 1;           // 当前白球攻击力

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

    // 粒子效果数组
    this._particles = [];

    // 回调
    this.onGameOver = null;
    this.onBackToMenu = null;
    this.onLevelComplete = null;  // (levelNum, stars) => void
    this.winStars = 0;

    // 碰撞音效（预加载 + 对象池，避免首次播放卡顿）
    this._lastCollisionSoundTime = 0;
    this._collisionSoundInterval = 80; // 毫秒
    this._collisionAudioPool = [];
    this._collisionAudioIdx = 0;
    this._launcherShakeTimer = 0;
    this._initCollisionAudio();
  }

  /**
   * 预加载碰撞音效对象池（3个实例轮流使用）
   */
  _initCollisionAudio() {
    const POOL_SIZE = 3;
    for (let i = 0; i < POOL_SIZE; i++) {
      const audio = wx.createInnerAudioContext();
      audio.src = 'audio/glass_beads_collision.wav';
      audio.volume = 0.3;
      this._collisionAudioPool.push(audio);
    }
  }

  /**
   * 初始化指定关卡
   */
  initLevel(levelNum) {
    this.initialLevel = levelNum;
    this.stage = Math.abs(levelNum);
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

    // 开局拖拽提示（首次触摸后隐藏）
    this._showDragHint = true;

    // 触摸灵敏度（用于拖动白球）
    this._touchSensitivity = 1.0;

    // 重置技能次数（每关/重试时重置）
    this.lightningCount = LIGHTNING_INITIAL;
    this.multiBallCount = MULTIBALL_INITIAL;
    this.atkBoostCount = 2;

    if (levelNum === -150) {
      // 150球特殊模式：使用预设地形，baseHp从200起
      this.maxRounds = 1;
      this.ballCount = 150;
      this.grid.initLevel(1);
      // 临时设置 levelConfig 使模板用高HP
      this.grid.levelConfig = { baseHp: 265, triangleRate: 0, pickupMin: 1, pickupMax: 1, plankRate: 0, warpRate: 0.1 };
      // 强制使用预设模板
      this.grid.bricks = [];
      this.grid.pickups = [];
      this.grid.planks = [];
      this.grid.warps = [];
      this.grid.rowClears = [];
      this.grid.colClears = [];
      this.grid._applyTemplate(150); // stage=150 触发道具生成
    } else {
      const cfg = getLevelConfig(levelNum);
      this.maxRounds = cfg.maxRounds || 20;
      const rawBalls = cfg.defaultBalls || (1 + levelNum);

      // 白球数封顶60，超出部分转为攻击力
      if (rawBalls > 60) {
        this.ballCount = 60;
        this.atkLevel = Math.floor(rawBalls / 60) + 1;
      } else {
        this.ballCount = rawBalls;
        this.atkLevel = 1;
      }

      this.grid.initLevel(this.stage);
    }

    this.launcher.init(SCREEN_WIDTH / 2, this.ballCount);
  }

  /**
   * 150球模式专用布局：密集砖块 + 随机方向斜向通道 + 顶部空行
   */
  _generate150Layout() {
    const grid = this.grid;
    const COLS = GRID_COLS;
    const ROWS = 8;

    grid.bricks = [];
    grid.pickups = [];
    grid.planks = [];
    grid.warps = [];
    grid.rowClears = [];
    grid.colClears = [];

    // HP梯度（从上到下递增）
    const hpByRow = [45, 54, 58, 63, 67, 72, 80, 90];

    // 随机选择斜坡方向：左侧（左下→右上）或 右侧（右下→左上）
    const goRight = Math.random() > 0.5;

    // 斜向通道判定
    const isInChannel = (row, col) => {
      if (goRight) {
        // 左下→右上：row=7时col≈0，row=1时col≈6
        const target = (ROWS - 1 - row) * (COLS - 1) / (ROWS - 1);
        return Math.abs(col - target) < 1.2;
      } else {
        // 右下→左上：row=7时col≈6，row=1时col≈0
        const target = (COLS - 1) - (ROWS - 1 - row) * (COLS - 1) / (ROWS - 1);
        return Math.abs(col - target) < 1.2;
      }
    };

    for (let row = 0; row < ROWS; row++) {
      // 第0行（顶部）留空，给球自由弹跳
      if (row === 0) continue;

      const baseHp = hpByRow[row] || 50;

      for (let col = 0; col < COLS; col++) {
        if (isInChannel(row, col)) continue;

        // 通道相邻的砖块HP降低（弱点）
        let hp = baseHp;
        if (isInChannel(row, col - 1) || isInChannel(row, col + 1)) {
          hp = 2;
        }

        const brick = new Brick();
        brick.init(
          row, col,
          grid.getColX(col),
          grid.getRowY(row),
          BRICK_W, BRICK_H,
          hp, 'normal', ''
        );
        grid.bricks.push(brick);
      }
    }
  }

  /**
   * 触摸开始处理（供 main.js 统一分发器调用）
   * 注意：dev 组件的触摸拦截已经在 main.js 的 _dispatchTouch 中统一处理
   */
  handleTouchStart(x, y) {
    if (GameGlobal.databus.scene !== 'playing') return;

    this._touching = true;
    this._lastTouchX = x;
    this._lastTouchY = y;

    if (this.gameState === 'over') {
      this._handleOverTap(x, y);
      return;
    }

    if (this.gameState === 'win') {
      this._handleWinTap(x, y);
      return;
    }

    if (this.gameState === 'paused') {
      this._handlePauseTap(x, y);
      return;
    }

    // 检查HUD按钮
    if (this.hud.hitAimButton(x, y)) {
      this.showAimLine = !this.showAimLine;
      this.launcher.showAimLine = this.showAimLine;
      return;
    }
    if (this.hud.hitPauseButton(x, y)) {
      this.prevState = this.gameState;
      this.gameState = 'paused';
      return;
    }

    // 检查技能按钮（仅在瞄准阶段）
    if (this.gameState === 'aiming') {
      if (this.hud.hitLightningButton(x, y)) {
        this._useLightning();
        return;
      }
      if (this.hud.hitMultiBallButton(x, y)) {
        this._useMultiBall();
        return;
      }
      if (this.hud.hitAtkBoostButton(x, y)) {
        this._useAtkBoost();
        return;
      }
    }

    // 瞄准阶段：判断是拖拽白球位置 还是 调整角度
    if (this.gameState === 'aiming') {
      const ballDist = Math.abs(x - this.launcher.x) + Math.abs(y - this.launcher.y);
      if (ballDist < 40 * SCALE) {
        // 触摸在白球附近 → 拖拽白球位置
        this._isDraggingBall = true;
        this.launcher.isAiming = false;
        this._showDragHint = false; // 开始拖动白球时隐藏提示
      } else {
        // 其他位置 → 瞄准角度
        this._isDraggingBall = false;
        this.launcher.isAiming = true;
        this.launcher.setAimAngle(x, y);
        this._showDragHint = false; // 开始瞄准时隐藏提示
      }
    }
  }

  /**
   * 触摸移动处理（供 main.js 统一分发器调用）
   */
  handleTouchMove(x, y) {
    if (GameGlobal.databus.scene !== 'playing') return;
    if (this.gameState !== 'aiming') return;

    const dx = x - this._lastTouchX;
    const dy = y - this._lastTouchY;
    this._lastTouchX = x;
    this._lastTouchY = y;

    if (this._isDraggingBall) {
      // 拖拽白球X位置（限制在游戏区域内，使用灵敏度系数）
      const moveX = dx * this._touchSensitivity;
      this.launcher.x = Math.max(GAME_AREA_LEFT + 12 * SCALE, Math.min(GAME_AREA_RIGHT - 12 * SCALE, this.launcher.x + moveX));
    } else if (this.launcher.isAiming) {
      // 瞄准角度：使用增量调整，更精细
      // 传递增量dx和dy，launcher内部会乘以不同灵敏度系数
      this.launcher.setAimAngle(x, y, true, dx, dy);
    }
  }

  /**
   * 触摸结束处理（供 main.js 统一分发器调用）
   */
  handleTouchEnd() {
    if (GameGlobal.databus.scene !== 'playing') return;
    this._touching = false;
    if (this._isDraggingBall) {
      this._isDraggingBall = false;
      return; // 拖拽白球松手不发射
    }
    this._tryLaunch();
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
    // 增加弹球数量 = 当前球数 × 1.1（向上取整）
    const addBalls = Math.ceil(this.ballCount * 0.1);
    this.ballCount += addBalls;
    this.launcher.ballCount = this.ballCount;
  }

  _useAtkBoost() {
    if (this.atkBoostCount <= 0) return;
    this.atkBoostCount--;
    // 攻击力 = 当前攻击力 × 1.1 + 1
    this.atkLevel = Math.floor(this.atkLevel * 1.1) + 1;
  }

  /**
   * 播放碰撞音效（节流 + 对象池轮换，避免卡顿）
   */
  _playCollisionSound() {
    // 检查声音开关
    try {
      const soundOn = wx.getStorageSync('ppq_sound');
      if (soundOn === false) return;
    } catch (e) { /* 默认开 */ }

    const now = Date.now();
    if (now - this._lastCollisionSoundTime < this._collisionSoundInterval) return;
    this._lastCollisionSoundTime = now;

    // 从对象池中取下一个音频实例（轮换使用，避免stop/seek卡顿）
    if (this._collisionAudioPool.length === 0) return;
    const audio = this._collisionAudioPool[this._collisionAudioIdx];
    this._collisionAudioIdx = (this._collisionAudioIdx + 1) % this._collisionAudioPool.length;

    audio.stop();
    audio.seek(0);
    audio.play();
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
      newMultiplier = 1.5;
    }

    if (newMultiplier !== this.speedMultiplier) {
      this.speedMultiplier = newMultiplier;
      if (newMultiplier === 1.5) {
        this.speedTipText = '加速 x1.5';
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

      // 记录移动前位置（用于道具扫描碰撞）
      const prevBX = ball.x;
      const prevBY = ball.y;

      const vx = ball.vx;
      const vy = ball.vy;

      // 快速回落检测：球向下飞且路径上没有砖块时，加速3倍回落
      let speedBoost = 1;
      if (vy > 0 && this.speedMultiplier >= 1.5) {
        const hasBlockAhead = this._hasBrickInPath(ball, allObstacles);
        if (!hasBlockAhead) {
          speedBoost = 3;
        }
      }

      const moveVx = vx * speedBoost;
      const moveVy = vy * speedBoost;

      // 1. 扫描碰撞：沿速度方向移动，遇到砖块就停+反弹
      const hitBricks = moveBallWithCollision(ball, moveVx, moveVy, allObstacles);

      // 2. 处理被击中的砖块（攻击力影响伤害 + 球升级加成）
      for (const brick of hitBricks) {
        // 球每次击打砖块，累计hitCount并检查升级
        ball.hitCount++;
        if (ball.hitCount >= 30 && ball.powerLevel < 4) {
          ball.powerLevel = 4; // 红光
        } else if (ball.hitCount >= 20 && ball.powerLevel < 3) {
          ball.powerLevel = 3; // 黄光
        } else if (ball.hitCount >= 10 && ball.powerLevel < 2) {
          ball.powerLevel = 2; // 蓝光
        } else if (ball.hitCount >= 5 && ball.powerLevel < 1) {
          ball.powerLevel = 1; // 绿光
        }

        // 计算实际伤害：基础攻击力 * 球升级倍率
        let damage = this.atkLevel;
        if (ball.powerLevel >= 4) {
          damage = Math.floor(this.atkLevel * 10) + 1;
        } else if (ball.powerLevel >= 3) {
          damage = Math.floor(this.atkLevel * 6) + 1;
        } else if (ball.powerLevel >= 2) {
          damage = Math.floor(this.atkLevel * 3) + 1;
        } else if (ball.powerLevel >= 1) {
          damage = Math.floor(this.atkLevel * 1.5) + 1;
        }

        const destroyed = brick.hit(damage);
        if (!brick.isPlank) this._playCollisionSound(); // 只有砖块发声，横板不发声
        if (destroyed) {
          this.score += brick.maxHp;
          this.destroyedThisRound++;
          this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        }
      }

      // 碰到砖块则重置无砖反弹计数
      if (hitBricks.length > 0) {
        const hitReal = hitBricks.some(b => !b.isPlank);
        if (hitReal) ball.noBrickBounces = 0;
      }

      // 3. 墙壁反弹（扫描碰撞后球可能到了墙壁外）
      const r = ball.radius;
      if (ball.x - r <= left) { ball.x = left + r; ball.vx = Math.abs(ball.vx); ball.recordBounce(this._wallLeft); ball.noBrickBounces++; }
      if (ball.x + r >= right) { ball.x = right - r; ball.vx = -Math.abs(ball.vx); ball.recordBounce(this._wallRight); ball.noBrickBounces++; }
      if (ball.y - r <= top) { ball.y = top + r; ball.vy = Math.abs(ball.vy); ball.recordBounce(this._wallTop); ball.noBrickBounces++; }

      // 将墙壁修正后的最终位置追加到路径（确保道具碰撞检测覆盖完整路径）
      if (ball._pathPoints) {
        const lastPt = ball._pathPoints[ball._pathPoints.length - 1];
        if (lastPt.x !== ball.x || lastPt.y !== ball.y) {
          ball._pathPoints.push({ x: ball.x, y: ball.y });
        }
      }

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

      // 5. 道具碰撞（使用帧内完整路径做线段-圆碰撞，防止反弹中间穿越漏检）
      if (ball.active) {
        const path = ball._pathPoints || [{ x: prevBX, y: prevBY }, { x: ball.x, y: ball.y }];
        for (const pickup of this.grid.pickups) {
          if (pickup.collected) continue;
          const hitR = ball.radius + pickup.radius + 4 * SCALE;
          if (this._pathCircleHit(path, pickup.x, pickup.y, hitR)) {
            pickup.collect();
            this.nextBallCount++;
          }
        }
      }

      // 5.2 消单行道具碰撞（可重复触发，但同一帧内不重复）
      if (ball.active) {
        const path = ball._pathPoints || [{ x: prevBX, y: prevBY }, { x: ball.x, y: ball.y }];
        for (const rc of this.grid.rowClears) {
          if (rc.collected) continue;
          if (rc._lastHitFrame === this.runningFrames) continue; // 同一帧不重复
          const hitR = ball.radius + rc.radius + 8 * SCALE;
          if (this._pathCircleHit(path, rc.x, rc.y, hitR)) {
            rc._lastHitFrame = this.runningFrames;
            this._executeRowClear(rc);
            break;
          }
        }
      }

      // 5.3 消单列道具碰撞（可重复触发，但同一帧内不重复）
      if (ball.active) {
        const path = ball._pathPoints || [{ x: prevBX, y: prevBY }, { x: ball.x, y: ball.y }];
        for (const cc of this.grid.colClears) {
          if (cc.collected) continue;
          if (cc._lastHitFrame === this.runningFrames) continue; // 同一帧不重复
          const hitR = ball.radius + cc.radius + 8 * SCALE;
          if (this._pathCircleHit(path, cc.x, cc.y, hitR)) {
            cc._lastHitFrame = this.runningFrames;
            this._executeColClear(cc);
            break;
          }
        }
      }

      // 5.5 白洞碰撞（帧内完整路径检测）
      if (ball.active) {
        const path = ball._pathPoints || [{ x: prevBX, y: prevBY }, { x: ball.x, y: ball.y }];
        for (const warp of this.grid.warps) {
          if (!warp.active) continue;
          if (ball.usedWarps.has(warp)) continue;
          const warpHitR = ball.radius + warp.radius + 4 * SCALE;
          if (this._pathCircleHit(path, warp.x, warp.y, warpHitR)) {
            // 标记已使用
            ball.usedWarps.add(warp);
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

      // 8. 死循环回收：连续反弹30次未碰砖块，回收白球
      if (ball.active && ball.noBrickBounces >= 30) {
        this._recycleBall(ball);
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
   * 砖块分裂粒子效果
   */
  _spawnBrickParticles(brick) {
    const cx = brick.x + brick.width / 2;
    const cy = brick.y + brick.height / 2;
    const count = 20 + Math.floor(Math.random() * 10);

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      const size = 2 + Math.random() * 4;
      this._particles.push({
        x: cx + (Math.random() - 0.5) * brick.width,
        y: cy + (Math.random() - 0.5) * brick.height,
        vx: Math.cos(angle) * speed * SCALE,
        vy: Math.sin(angle) * speed * SCALE,
        size: size * SCALE,
        life: 40 + Math.floor(Math.random() * 20),
        maxLife: 60,
        color: brick.getColorScheme().border,
      });
    }
  }

  /**
   * 回收死循环白球：消散特效 + 发射器抖动
   */
  _recycleBall(ball) {
    // 生成消散粒子（与球当前升级颜色一致）
    let color = '#ffffff';
    if (ball.powerLevel >= 4) color = '#ff3333';
    else if (ball.powerLevel >= 3) color = '#ffcc00';
    else if (ball.powerLevel >= 2) color = '#3399ff';
    else if (ball.powerLevel >= 1) color = '#33ff66';

    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3;
      this._particles.push({
        x: ball.x,
        y: ball.y,
        vx: Math.cos(angle) * speed * SCALE,
        vy: Math.sin(angle) * speed * SCALE,
        size: (2 + Math.random() * 3) * SCALE,
        life: 25 + Math.floor(Math.random() * 15),
        maxLife: 40,
        color,
      });
    }

    // 回收球
    ball.active = false;
    ball.landed = true;
    ball.landX = this.launcher.x;
    ball.slideDone = true;

    // 发射器抖动效果
    this._launcherShakeTimer = 15;
  }

  /**
   * 上传关卡最高分到云端（仅当超过历史最高分时才更新）
   */
  _uploadLevelScore() {
    if (typeof wx === 'undefined' || !wx.cloud) return;
    if (this.initialLevel <= 0) return; // 特殊模式不走这里
    if (this.score <= 0) return;

    const level = this.initialLevel;
    const score = this.score;

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: {
        action: 'saveScore',
        level,
        score,
      },
      success: (res) => { console.log('关卡分数上传:', res.result); },
      fail: (err) => { console.error('关卡分数上传失败:', err); },
    });
  }

  /**
   * 执行消单行：对同行砖块造成伤害
   * 伤害 = 攻击力（atkLevel），每个砖块扣一次
   * 整行清除后道具消失
   */
  _executeRowClear(rc) {
    const targetRow = rc.row;
    const damage = this.atkLevel;

    // 找到同行所有存活砖块
    const rowBricks = this.grid.bricks.filter(b => b.isAlive && b.row === targetRow);

    for (const brick of rowBricks) {
      const destroyed = brick.hit(damage);
      if (destroyed) {
        this.score += brick.maxHp;
        this.destroyedThisRound++;
        this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        this._spawnBrickParticles(brick);
      }
    }

    // 红色横向激光特效
    this._rowClearEffect = {
      y: rc.y,
      timer: 20,
    };

    // 检查整行是否已全部清除，是则消除道具
    const remaining = this.grid.bricks.filter(b => b.isAlive && b.row === targetRow);
    if (remaining.length === 0) {
      rc.collect();
    }
  }

  /**
   * 执行消单列：对同列砖块造成伤害
   * 整列清除后道具消失
   */
  _executeColClear(cc) {
    const targetCol = cc.col;
    const damage = this.atkLevel;

    const colBricks = this.grid.bricks.filter(b => b.isAlive && b.col === targetCol);

    for (const brick of colBricks) {
      const destroyed = brick.hit(damage);
      if (destroyed) {
        this.score += brick.maxHp;
        this.destroyedThisRound++;
        this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        this._spawnBrickParticles(brick);
      }
    }

    // 红色纵向激光特效
    this._colClearEffect = {
      x: cc.x,
      timer: 20,
    };

    // 检查整列是否已全部清除
    const remaining = this.grid.bricks.filter(b => b.isAlive && b.col === targetCol);
    if (remaining.length === 0) {
      cc.collect();
    }
  }

  /**
   * 为白洞计算并缓存传送目标位置
   * 优先选择靠近砖块的空位（让球传送后能有效命中砖块）
   */
  _calcWarpDest(warp) {
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const r = 8;

    const aliveBricks = this.grid.bricks.filter(b => b.isAlive);
    const allObstacles = [...aliveBricks, ...this.grid.planks];

    // 策略：在砖块附近（砖块边缘外扩一定距离）随机找空位
    let bestX = -1, bestY = -1;

    for (let attempt = 0; attempt < 30; attempt++) {
      let nx, ny;

      if (attempt < 20 && aliveBricks.length > 0) {
        // 前20次尝试：在随机砖块附近生成目标点
        const targetBrick = aliveBricks[Math.floor(Math.random() * aliveBricks.length)];
        const offsetX = (Math.random() - 0.5) * (targetBrick.width * 3);
        const offsetY = (Math.random() - 0.5) * (targetBrick.height * 3);
        nx = targetBrick.x + targetBrick.width / 2 + offsetX;
        ny = targetBrick.y + targetBrick.height / 2 + offsetY;
      } else {
        // 后10次：纯随机（兜底）
        nx = left + r + Math.random() * (right - left - r * 2);
        ny = top + r + Math.random() * (bottom - top - r * 2) * 0.6;
      }

      // 边界限制
      nx = Math.max(left + r, Math.min(right - r, nx));
      ny = Math.max(top + r, Math.min(bottom - r * 4, ny));

      // 检查是否与障碍物重叠
      let blocked = false;
      for (const ob of allObstacles) {
        if (nx + r > ob.x && nx - r < ob.x + ob.width &&
          ny + r > ob.y && ny - r < ob.y + ob.height) {
          blocked = true;
          break;
        }
      }
      if (!blocked) {
        bestX = nx;
        bestY = ny;
        break;
      }
    }

    if (bestX < 0) {
      bestX = (left + right) / 2;
      bestY = top + (bottom - top) * 0.3;
    }

    warp.cachedDestX = bestX;
    warp.cachedDestY = bestY;
    warp.cachedAngle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
    warp.startDestTimer();
  }

  /**
   * 统计当前存活砖块占据的行数
   */
  _countBrickRows() {
    const rows = new Set();
    for (const b of this.grid.bricks) {
      if (b.isAlive) rows.add(b.row);
    }
    return rows.size;
  }

  /**
   * 线段-圆碰撞检测：球从(ax,ay)移动到(bx,by)，是否与圆心(cx,cy)半径r相交
   */
  _segCircleHit(ax, ay, bx, by, cx, cy, r) {
    const dx = bx - ax;
    const dy = by - ay;
    const fx = ax - cx;
    const fy = ay - cy;

    const lenSq = dx * dx + dy * dy;
    if (lenSq < 0.001) {
      return fx * fx + fy * fy < r * r;
    }

    let t = -(fx * dx + fy * dy) / lenSq;
    if (t < 0) t = 0;
    if (t > 1) t = 1;

    const nearX = ax + t * dx - cx;
    const nearY = ay + t * dy - cy;
    return nearX * nearX + nearY * nearY < r * r;
  }

  /**
   * 多段路径-圆碰撞检测：检查完整路径（多个线段）是否与圆相交
   * path = [{x,y}, {x,y}, ...] 路径点序列
   */
  _pathCircleHit(path, cx, cy, r) {
    for (let i = 0; i < path.length - 1; i++) {
      if (this._segCircleHit(path[i].x, path[i].y, path[i + 1].x, path[i + 1].y, cx, cy, r)) {
        return true;
      }
    }
    return false;
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

    // 150球模式：只发射一次，球全部回来后直接结算
    if (this.initialLevel === -150) {
      this._settle150Mode();
      return;
    }

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
      this._uploadLevelScore();
      if (this.onLevelComplete) {
        this.onLevelComplete(this.initialLevel, stars, this.score);
      }
      return;
    }

    this.stage++;

    // 根据当前砖块行数决定生成几行
    const existingRows = this._countBrickRows();
    let rowsToGenerate = 1;
    if (!reachedTarget) {
      if (existingRows <= 2) {
        rowsToGenerate = 3;
      } else if (existingRows <= 4) {
        rowsToGenerate = 2;
      }
    }

    // 砖块下移（移动相应行数）
    for (let i = 0; i < rowsToGenerate; i++) {
      const isOver = this.grid.shiftDown(LAUNCH_Y);
      if (isOver) {
        this.gameState = 'over';
        this._uploadLevelScore();
        return;
      }
    }

    // 删除超出底部的横板（只删除完全超出发射线的）
    this.grid.planks = this.grid.planks.filter(p => p.targetY < LAUNCH_Y);
    // 删除超出底部的白洞、消单行、消单列
    this.grid.warps = this.grid.warps.filter(w => w.active && w.targetY < LAUNCH_Y);
    this.grid.rowClears = this.grid.rowClears.filter(rc => !rc.collected && rc.targetY < LAUNCH_Y);
    this.grid.colClears = this.grid.colClears.filter(cc => !cc.collected && cc.targetY < LAUNCH_Y);

    // 达到目标回合后不再生成新砖块
    if (!reachedTarget) {
      for (let i = 0; i < rowsToGenerate; i++) {
        this.grid.generateRow(this.stage, i);
      }
    }

    // 更新球数
    this.ballCount += this.nextBallCount;
    this.nextBallCount = 0;

    // 更新发射点
    const nextX = this.launcher.getNextLaunchX();
    this.launcher.init(nextX, this.ballCount);
    this.launcher.showAimLine = this.showAimLine;

    // 检查游戏结束（砖块触底）
    if (this.grid.checkGameOver(LAUNCH_Y)) {
      this.gameState = 'over';
      this._uploadLevelScore();
      return;
    }

    // 下移后砖块可能全被推出/打完了，再检一次
    if (reachedTarget && this.grid.bricks.filter(b => b.isAlive).length === 0) {
      const stars = this.score > this.maxRounds * 10 ? 3 : this.score > this.maxRounds * 5 ? 2 : 1;
      this.winStars = stars;
      this.gameState = 'win';
      this._uploadLevelScore();
      if (this.onLevelComplete) {
        this.onLevelComplete(this.initialLevel, stars, this.score);
      }
      return;
    }

    this.gameState = 'aiming';
  }

  /**
   * 150球模式结算：记录得分和用时，上传云函数
   */
  _settle150Mode() {
    const elapsed = Math.round((Date.now() - this.launchStartTime) / 1000); // 秒
    const bricksDestroyed = this.grid.bricks.filter(b => !b.isAlive).length;
    const bricksTotal = this.grid.bricks.length + bricksDestroyed;

    this.winStars = this.score > 500 ? 3 : this.score > 200 ? 2 : 1;
    this.gameState = 'win';

    // 上传150球模式成绩到云函数
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.callFunction({
        name: 'saveUserProgress',
        data: {
          action: 'save',
          mode150: {
            score: this.score,
            time: elapsed,
            destroyed: bricksDestroyed,
            total: bricksTotal,
            date: new Date().toISOString(),
          },
        },
        success: () => { console.log('150球成绩已上传'); },
        fail: () => { /* 静默 */ },
      });
    }

    if (this.onLevelComplete) {
      this.onLevelComplete(this.initialLevel, this.winStars);
    }
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

    // 球（重置状态确保白球不被前面渲染的shadow/alpha污染）
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    this.launcher.renderBalls(ctx);

    // 穿越白洞特效
    if (this._warpEffect && this._warpEffect.timer > 0) {
      this._renderWarpEffect(ctx);
    }

    // 发射器抖动效果（保存上下文状态）
    if (this._launcherShakeTimer > 0) {
      this._launcherShakeTimer--;
      const shakeX = (Math.random() - 0.5) * 4 * SCALE;
      ctx.save();
      ctx.translate(shakeX, 0);
    }

    // 发射点（瞄准线等）— 传入所有障碍物（砖块+横板）供射线检测
    this.launcher.render(ctx, this.gameState, [...this.grid.bricks, ...this.grid.planks]);

    // 恢复抖动效果的上下文状态
    if (this._launcherShakeTimer >= 0 && this._launcherShakeTimer < 15) {
      ctx.restore();
    }

    // 确保白球显示在正确层级（在抖动效果之后，HUD之前）
    // 如果正在瞄准阶段，额外渲染一次白球确保可见（无论是否拖动）
    if (this.gameState === 'aiming') {
      ctx.save();
      ctx.globalAlpha = 1;
      ctx.shadowColor = COLORS.ballGlow;
      ctx.shadowBlur = 10 * SCALE;
      ctx.fillStyle = COLORS.ballColor;
      ctx.beginPath();
      ctx.arc(this.launcher.x, this.launcher.y, BALL_RADIUS * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // 开局拖拽提示（左右箭头）
    if (this._showDragHint && this.gameState === 'aiming') {
      this._renderDragHint(ctx);
    }

    // HUD（单行：闪电 | 关卡信息 | 暂停 | 多球 | 攻击力）
    this.hud.render(ctx, {
      stage: this.stage,
      line: this.line,
      maxRounds: this.maxRounds,
      score: this.score,
      lightningCount: this.lightningCount,
      multiBallCount: this.multiBallCount,
      atkBoostCount: this.atkBoostCount,
      atkLevel: this.atkLevel,
    });

    // 加速提示
    if (this.speedTipTimer > 0) {
      this._renderSpeedTip(ctx);
    }

    // 粒子效果
    if (this._particles.length > 0) {
      this._updateAndRenderParticles(ctx);
    }

    // 消单行激光特效
    if (this._rowClearEffect && this._rowClearEffect.timer > 0) {
      this._renderRowClearEffect(ctx);
    }

    // 消单列激光特效
    if (this._colClearEffect && this._colClearEffect.timer > 0) {
      this._renderColClearEffect(ctx);
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

  /**
   * 渲染开局拖拽提示：白球两侧的左右箭头
   */
  _renderDragHint(ctx) {
    const s = SCALE;
    const x = this.launcher.x;
    const y = this.launcher.y;
    const pulse = 0.5 + 0.5 * Math.sin(this.glowPhase * 3);

    ctx.globalAlpha = 0.6 * pulse;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 * s;

    const arrowLen = 18 * s;
    const arrowHead = 6 * s;
    const gap = 20 * s;

    // 左箭头
    const lx = x - gap;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx - arrowLen, y);
    ctx.moveTo(lx - arrowLen, y);
    ctx.lineTo(lx - arrowLen + arrowHead, y - arrowHead);
    ctx.moveTo(lx - arrowLen, y);
    ctx.lineTo(lx - arrowLen + arrowHead, y + arrowHead);
    ctx.stroke();

    // 右箭头
    const rx = x + gap;
    ctx.beginPath();
    ctx.moveTo(rx, y);
    ctx.lineTo(rx + arrowLen, y);
    ctx.moveTo(rx + arrowLen, y);
    ctx.lineTo(rx + arrowLen - arrowHead, y - arrowHead);
    ctx.moveTo(rx + arrowLen, y);
    ctx.lineTo(rx + arrowLen - arrowHead, y + arrowHead);
    ctx.stroke();

    // 提示文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `${9 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('← 拖拽移动白球 →', x, y + 16 * s);

    ctx.globalAlpha = 1;
  }

  _renderSpeedTip(ctx) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT * 0.35;

    // 淡入淡出
    let alpha = 1;
    if (this.speedTipTimer > 105) alpha = (120 - this.speedTipTimer) / 15;
    else if (this.speedTipTimer < 20) alpha = this.speedTipTimer / 20;

    ctx.globalAlpha = alpha * 0.9;

    // 背景圆角矩形
    const tw = 140 * s;
    const th = 36 * s;
    const r = th / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
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

    // 白色文字
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${14 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.speedTipText, centerX, centerY);

    ctx.globalAlpha = 1;
  }

  /**
   * 更新和渲染粒子效果
   */
  _updateAndRenderParticles(ctx) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15 * SCALE; // 重力
      p.life--;

      if (p.life <= 0) {
        this._particles.splice(i, 1);
        continue;
      }

      const alpha = p.life / p.maxLife;
      const size = p.size * (0.5 + 0.5 * alpha);

      ctx.globalAlpha = alpha * 0.9;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 4 * SCALE * alpha;

      // 随机形状：方块或圆
      if (i % 3 === 0) {
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  /**
   * 渲染消单行红色激光特效
   */
  _renderRowClearEffect(ctx) {
    const e = this._rowClearEffect;
    e.timer--;
    const progress = e.timer / 20; // 1→0
    const s = SCALE;

    // 红色横向激光线
    const left = GAME_AREA_LEFT;
    const right = GAME_AREA_RIGHT;
    const lineH = 3.2 * s * progress;

    ctx.globalAlpha = progress * 0.9;

    // 主光线
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 12 * s * progress;
    ctx.fillRect(left, e.y - lineH / 2, right - left, lineH);

    // 外扩光晕
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.fillRect(left, e.y - lineH * 2, right - left, lineH * 4);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  /**
   * 渲染消单列红色激光特效（纵向）
   */
  _renderColClearEffect(ctx) {
    const e = this._colClearEffect;
    e.timer--;
    const progress = e.timer / 20;
    const s = SCALE;

    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const lineW = 3.2 * s * progress;

    ctx.globalAlpha = progress * 0.9;

    // 主光线
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 12 * s * progress;
    ctx.fillRect(e.x - lineW / 2, top, lineW, bottom - top);

    // 外扩光晕
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.fillRect(e.x - lineW * 2, top, lineW * 4, bottom - top);

    ctx.shadowBlur = 0;
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
    ctx.fillText('暂停', centerX, centerY - 60 * s);

    // 继续按钮
    this._drawButton(ctx, centerX, centerY, 120 * s, 40 * s, '继续', COLORS.neonCyan);

    // 重试按钮
    this._drawButton(ctx, centerX, centerY + 60 * s, 120 * s, 40 * s, '重试', COLORS.neonYellow);

    // 返回菜单按钮
    this._drawButton(ctx, centerX, centerY + 120 * s, 120 * s, 40 * s, '菜单', COLORS.neonRed);
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
    ctx.fillText('游戏结束', centerX, centerY - 80 * s);
    ctx.shadowBlur = 0;

    // 分数
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${16 * s}px Arial`;
    ctx.fillText(`得分: ${this.score}`, centerX, centerY - 30 * s);
    ctx.fillText(`关卡: ${this.stage}`, centerX, centerY);
    ctx.fillText(`回合: ${this.line} / ${this.maxRounds}`, centerX, centerY + 30 * s);

    // 重试按钮
    this._drawButton(ctx, centerX, centerY + 80 * s, 120 * s, 40 * s, '重试', COLORS.neonCyan);

    // 返回菜单
    this._drawButton(ctx, centerX, centerY + 130 * s, 120 * s, 40 * s, '菜单', COLORS.neonRed);
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
    ctx.fillText('通关！', centerX, centerY - 100 * s);
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
    ctx.fillText(`得分: ${this.score}`, centerX, centerY - 15 * s);
    if (this.initialLevel !== -150) {
      ctx.fillText(`回合: ${this.line} / ${this.maxRounds}`, centerX, centerY + 15 * s);
    }

    if (this.initialLevel === -150) {
      // 150球模式：只显示菜单按钮
      this._drawButton(ctx, centerX, centerY + 65 * s, 140 * s, 40 * s, '菜单', COLORS.neonCyan);
    } else {
      // 普通模式：下一关 + 菜单
      this._drawButton(ctx, centerX, centerY + 65 * s, 140 * s, 40 * s, '下一关', '#39ff14');
      this._drawButton(ctx, centerX, centerY + 120 * s, 140 * s, 40 * s, '菜单', COLORS.neonCyan);
    }
  }

  _handleWinTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const bw = 140 * s;
    const bh = 40 * s;

    if (this.initialLevel === -150) {
      // 150球模式：菜单按钮在 65*s 位置
      const menuY = centerY + 65 * s;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
        if (this.onBackToMenu) this.onBackToMenu();
      }
      return;
    }

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

    // 重试按钮
    const retryY = centerY + 60 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
      y >= retryY - bh / 2 && y <= retryY + bh / 2) {
      this.initLevel(this.initialLevel);
      return;
    }

    // 返回菜单按钮
    const menuY = centerY + 120 * s;
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
      y >= menuY - bh / 2 && y <= menuY + bh / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }

    // 点击其他任意区域 = 继续游戏
    this.gameState = this.prevState || 'aiming';
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
