import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../render';
import {
  COLORS, SCALE, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_RIGHT, GAME_AREA_TOP,
  LAUNCH_Y, LIGHTNING_INITIAL, MULTIBALL_INITIAL, MAX_ENERGY, ENERGY_PER_BRICK,
  GRID_COLS, GRID_ROWS, BALL_RADIUS,
  TARGET_SCORE, LEVEL_TIME_LIMIT, BRICK_AREA_BOTTOM,
  LAUNCH_BAR_HEIGHT, LAUNCH_BAR_WIDTH, LAUNCH_BAR_X_LEFT, LAUNCH_BAR_X_RIGHT,
} from '../config';
import Grid from '../core/grid';
import Brick from '../core/brick';
import Launcher from '../core/launcher';
import HUD from '../runtime/hud';
import { moveBallWithCollision } from '../core/collision';
import Warp from '../core/warp';
import { getLevelConfig, getLevelTargetScore, getLevelStarThresholds } from '../data/levelData';
import ScrollView from '../runtime/scrollView';

/**
 * 游戏主场景
 * 管理碰碰球核心玩法的所有逻辑和渲染
 */
export default class GameScene {
  constructor() {
    this.grid = new Grid();
    this.launcher = new Launcher();
    this.hud = new HUD();
    this._historyScroller = new ScrollView(); // 150球历史记录滚动条

    // 打砖块场景背景地图（图片）
    this._bgImage = wx.createImage();
    this._bgImageLoaded = false;
    this._bgImage.onload = () => { this._bgImageLoaded = true; };
    this._bgImage.src = 'images/play_bg.jpg';

    // 打砖块区域左边界（动态：若与左上角"关卡:N"文案重叠则右移；默认 = GAME_AREA_LEFT）
    this.gameAreaLeft = GAME_AREA_LEFT;

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

    // 绘制模式
    this._drawMode = false;          // 绘制按钮开关状态
    this._drawLines = [];            // 已绘制的直线数组 [{x1,y1,x2,y2}]
    this._drawingLine = null;        // 当前正在绘制的直线 {x1,y1,x2,y2}
    this._isDrawing = false;         // 是否正在绘制中（手指按下）
    this._isDraggingLine = false;    // 是否正在拖拽已有线条
    this._dragLineStartX = 0;       // 拖拽起始X
    this._dragLineStartY = 0;       // 拖拽起始Y
    this._drawLocked = false;       // 发球后锁定绘制功能，本轮不可再编辑
    this._showDrawTips = false;      // 绘制 tips 选择面板是否显示
    this._drawLineType = 'normal';   // 当前绘制线条类型：'normal'(白板横条) | 'oneway'(上实下虚横条)
  }

  /**
   * 倒计时归零 → 游戏结束（弹窗显示当前得分）
   */
  _onTimeout() {
    this.gameState = 'over';
    this._timeoutGameOver = true; // 标记由超时引发
    if (typeof this._uploadLevelScore === 'function') {
      this._uploadLevelScore();
    }
    if (this.onGameOver) this.onGameOver();
  }

  /**
   * 砖块销毁加分（业界经典打砖块加分公式）
   *  - 基础分（baseScore）按砖块"类型"固定，不再用 maxHp（避免后期分数膨胀）
   *  - Combo 系数：短时间窗口（60帧）内连续命中累计倍率，断了就清零
   *  - 球升级系数：球的 powerLevel 越高加成越大（绿光 1.1x → 红光 2.0x）
   *
   *  最终分数 = baseScore × comboMul × powerMul
   *
   * @param {Brick} brick 被销毁的砖块
   * @param {Ball}  ball  击中的球（可为 null 表示技能消除）
   */
  _addBrickScore(brick, ball) {
    // 防御：plank（横板）等不可消除元素不加分
    if (!brick || brick.isPlank) return;

    // 1. 基础分：按砖块类型固定（不再使用 maxHp）
    let baseScore = 10;
    if (brick.type === 'triangle') {
      baseScore = 15;        // 三角块（更难命中）
    } else if (brick.maxHp >= 5) {
      baseScore = 20;        // 高 HP 砖块（耐打型）
    }

    // 2. Combo 系数：基于"短时间窗口连击数"
    //    每命中一次 +1 → 1 秒内未再命中则清零
    //    每 3 连击 +30%，封顶 +200%（即 3.0x）
    this._comboCount = (this._comboCount || 0) + 1;
    this._comboTimer = 60; // 1 秒窗口（60FPS）
    const comboMul = 1 + Math.min(2, Math.floor(this._comboCount / 3) * 0.3);

    // 3. 球升级系数：powerLevel 越高加成越大
    let powerMul = 1;
    if (ball) {
      if (ball.powerLevel >= 4) powerMul = 2.0;  // 红光
      else if (ball.powerLevel >= 3) powerMul = 1.5;  // 黄光
      else if (ball.powerLevel >= 2) powerMul = 1.3;  // 蓝光
      else if (ball.powerLevel >= 1) powerMul = 1.1;  // 绿光
    }

    // 4. 综合
    const finalScore = Math.round(baseScore * comboMul * powerMul);
    this.score += finalScore;

    // 显示飞起的得分文字（高 Combo 或球升级时高亮）
    this._spawnScoreFloat(brick, finalScore, comboMul * powerMul);
  }

  /**
   * 弹出"+N"分数提示动画
   */
  _spawnScoreFloat(brick, score, multiplier) {
    if (!this._scoreFloats) this._scoreFloats = [];
    this._scoreFloats.push({
      x: brick.x + brick.width / 2,
      y: brick.y + brick.height / 2,
      score,
      multiplier,
      timer: 50, // 帧数
    });
    // 限制最多10个，避免过多
    if (this._scoreFloats.length > 12) this._scoreFloats.shift();
  }

  /**
   * 更新并渲染分数飞起特效
   */
  _updateAndRenderScoreFloats(ctx) {
    const s = SCALE;
    const floats = this._scoreFloats;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      f.timer--;
      f.y -= 0.6 * s;
      if (f.timer <= 0) {
        floats.splice(i, 1);
        continue;
      }
      const alpha = Math.min(1, f.timer / 30);
      // 倍率高 → 颜色更鲜艳
      const isCombo = f.multiplier >= 1.5;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isCombo ? '#ffdd00' : '#ffffff';
      ctx.font = `bold ${(isCombo ? 14 : 12) * s}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = isCombo ? '#ff9900' : 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 2 * s;
      const text = isCombo ? `+${f.score} x${f.multiplier.toFixed(1)}` : `+${f.score}`;
      ctx.fillText(text, f.x, f.y);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }
  }

  /**
   * 更新并渲染闪电链特效
   *  - 闪电链的可见状态完全由 affected 砖块的 lightningTimer 驱动
   *  - 只要 affected 中还有任意砖块 lightningTimer > 0 → 持续渲染
   *  - 全部砖块 lightningTimer = 0 → 删除该链
   *  - 球持续击打砖块时，触发链会刷新 affected 的 lightningTimer，确保特效不间断
   */
  _updateAndRenderLightningChains(ctx) {
    if (!this._lightningChains || this._lightningChains.length === 0) return;
    const s = SCALE;

    for (let i = this._lightningChains.length - 1; i >= 0; i--) {
      const chain = this._lightningChains[i];

      // 取 affected 中最大 lightningTimer 作为该链的可见生命周期
      let maxTimer = 0;
      for (const b of chain.affected) {
        // 已死亡且被 cleanup 过的砖块视为 0
        if (b.lightningTimer > maxTimer) maxTimer = b.lightningTimer;
      }

      if (maxTimer <= 0) {
        this._lightningChains.splice(i, 1);
        continue;
      }

      // 随机闪烁：15% 概率本帧不绘制（间断电流感，但不至于太频繁消失）
      if (Math.random() < 0.15) continue;

      // 渐隐：基于 maxTimer / 15 计算 alpha，球停击后快速淡出
      const alpha = Math.min(1, maxTimer / 10);

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(120, 200, 255, 0.95)';
      ctx.shadowBlur = 2 * s;

      // 1) 外层粗光晕线
      ctx.strokeStyle = `rgba(150, 220, 255, ${alpha * 0.45})`;
      ctx.lineWidth = 4 * s;
      for (const e of chain.edges) {
        this._drawJaggedLightningSegment(ctx, e.x1, e.y1, e.x2, e.y2, s);
      }

      // 2) 内层亮蓝白细线（更清晰的核心电弧）
      ctx.shadowBlur = 2 * s;
      ctx.strokeStyle = `rgba(220, 240, 255, ${alpha})`;
      ctx.lineWidth = 1.5 * s;
      for (const e of chain.edges) {
        this._drawJaggedLightningSegment(ctx, e.x1, e.y1, e.x2, e.y2, s);
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }

  /**
   * 在两点间绘制锯齿闪电折线（每段做 ±jitter 的垂直偏移）
   */
  _drawJaggedLightningSegment(ctx, x1, y1, x2, y2, s) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 0.5) return;

    const ux = dx / len;
    const uy = dy / len;
    // 垂直法向量（锯齿在垂直方向偏移）
    const px = -uy;
    const py = ux;

    // 段数：长度越大段数越多
    const segments = Math.max(3, Math.min(6, Math.floor(len / (8 * s))));
    const jitterMax = 5 * s;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const baseX = x1 + dx * t;
      const baseY = y1 + dy * t;
      const offset = (Math.random() - 0.5) * jitterMax * 2;
      ctx.lineTo(baseX + px * offset, baseY + py * offset);
    }
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  /**
   * 渲染拖动白球时的"取消发射"按钮
   * 手指悬停时按钮发出强红光
   */
  _renderCancelButton(ctx) {
    const s = SCALE;
    const { cx, cy, r } = this._getCancelButtonPos();
    const hover = this._cancelHovered;
    const glowAlpha = hover ? 0.95 : 0.55;
    const pulse = 0.6 + 0.3 * Math.sin(this.glowPhase * 2);

    ctx.save();

    // 外发光圆环
    ctx.shadowColor = `rgba(255,68,68,${glowAlpha})`;
    ctx.shadowBlur = (hover ? 2 : 1) * s * pulse;
    ctx.strokeStyle = hover ? '#ff5566' : '#cc3344';
    ctx.lineWidth = (hover ? 3 : 2) * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 半透明红色背景
    ctx.fillStyle = hover ? 'rgba(180,30,40,0.65)' : 'rgba(80,15,20,0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 中心 "X" 图标
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.shadowColor = hover ? 'rgba(255,68,68,0.9)' : 'transparent';
    ctx.shadowBlur = (hover ? 2 : 0) * s;
    const xLen = r * 0.4;
    ctx.beginPath();
    ctx.moveTo(cx - xLen, cy - xLen);
    ctx.lineTo(cx + xLen, cy + xLen);
    ctx.moveTo(cx + xLen, cy - xLen);
    ctx.lineTo(cx - xLen, cy + xLen);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.shadowBlur = 0;

    // 提示文字
    ctx.fillStyle = hover ? '#ff8888' : '#aaaaaa';
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('取消', cx, cy + r + 4 * s);

    ctx.restore();
  }

  /**
   * 渲染"收回"按钮（球在运行中时显示，点击强制收回所有飞行中的球）
   */
  _renderRecallButton(ctx) {
    const s = SCALE;
    const { cx, cy, r } = this._getCancelButtonPos(); // 与取消按钮同一位置

    ctx.save();

    // 蓝色边框光晕（与左侧面板风格统一）
    ctx.shadowColor = 'rgba(50,100,230,0.75)';
    ctx.shadowBlur = 2 * s;
    ctx.strokeStyle = '#2960dd';
    ctx.lineWidth = 1.5 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 深底色背景
    ctx.fillStyle = 'rgba(6,10,28,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 中心：向下箭头 "↓" 图标
    ctx.strokeStyle = '#5b8dff';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const arrowH = r * 0.5;
    const arrowW = r * 0.35;
    ctx.beginPath();
    ctx.moveTo(cx, cy - arrowH);
    ctx.lineTo(cx, cy + arrowH * 0.3);
    ctx.moveTo(cx - arrowW, cy - arrowH * 0.1);
    ctx.lineTo(cx, cy + arrowH * 0.3);
    ctx.lineTo(cx + arrowW, cy - arrowH * 0.1);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 底部横线（表示发射台）
    ctx.strokeStyle = '#5b8dff';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - arrowW, cy + arrowH * 0.6);
    ctx.lineTo(cx + arrowW, cy + arrowH * 0.6);
    ctx.stroke();

    // 文字
    ctx.fillStyle = '#5b8dff';
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('收回', cx, cy + r + 4 * s);

    ctx.restore();
  }

  /**
   * 判断坐标是否在收回按钮上
   */
  _hitRecallButton(x, y) {
    const { cx, cy, r } = this._getCancelButtonPos();
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= r * r;
  }

  /**
   * 执行收回：所有未完全停止的球沿轨迹飞回发射位置
   */
  _doRecallBalls() {
    const targetX = this.launcher.x;
    const targetY = this.launcher.y;
    // 停止继续发射新球
    this.launcher.isLaunching = false;
    this.launcher.launchedCount = this.launcher.ballCount;

    this.launcher.balls.forEach(ball => {
      if (ball.isFullyStopped()) return;
      if (ball.recalling) return;
      ball.startRecall(targetX, targetY);
    });
  }

  /**
   * 判断是否应该显示收回按钮：球已发射 & 还有球未完全停止
   */
  _shouldShowRecallButton() {
    if (this.gameState !== 'launching' && this.gameState !== 'running') return false;
    // 有任何球还在飞行中（active 且未落地）或正在飞回中（recalling）
    return this.launcher.balls.some(b => (b.active && !b.landed) || b.recalling);
  }

  /**
   * 游戏结束后获取用户信息
   * 如果没有 nickName，设置标志让 levelSelect 显示授权提示
   */
  _fetchUserInfoAfterGame() {
    if (typeof wx === 'undefined') return;

    try {
      const cached = wx.getStorageSync('ppq_user_info') || {};
      if (!cached.nickName || cached.nickName === '') {
        // 没有 nickName，设置标志让 levelSelect 显示授权提示
        GameGlobal._needAuthPrompt = true;
        console.log('[游戏结束] 需要获取用户信息');
      }
    } catch (e) {
      // 忽略错误
    }
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
    // 计算打砖块区域左边界：若左上角"关卡:N"文案与砖块区重叠，则把左边界右移避让
    this._computeGameAreaLeft();
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

    // 倒计时（秒，2分钟），按帧累计精确计算
    this.timeLeft = LEVEL_TIME_LIMIT;
    this._timeAccumFrames = 0;
    this._timeoutGameOver = false;
    this._roundsExhausted = false;  // 轮数耗尽标记

    // 绘制模式重置
    this._drawMode = false;
    this._drawLines = [];
    this._drawingLine = null;
    this._isDrawing = false;
    this._isDraggingLine = false;
    this._drawLocked = false;
    this._showDrawTips = false;
    this._drawLineType = 'normal';
    this._drawBtnBlinkTimer = 90;  // 绘制按钮开局闪动提示（约1.5秒）

    // 飞起的得分文字（特效）
    this._scoreFloats = [];

    // 闪电链特效（每条链含一组边的折线）
    this._lightningChains = [];

    // Combo 系统（短时间窗口连击）：60帧 = 1秒未击中砖块则清零
    this._comboCount = 0;
    this._comboTimer = 0;

    // 拖动白球时的"取消发射"按钮状态
    this._showCancelHint = false;
    this._cancelHovered = false;
    this._cancelLaunch = false;

    // 保持技能状态（整关持续：一旦激活，后续回合全部自动保存/恢复球状态）
    this._keepBallActive = false;  // 保持是否已激活（整关不再重置）

    // 动态目标分数（按关卡难度计算）+ 星级阈值（按通关轮数评定）
    this.targetScore = getLevelTargetScore(Math.abs(levelNum));
    this.starThresholds = getLevelStarThresholds(Math.abs(levelNum));

    // 开局拖拽提示（首次触摸后隐藏）
    this._showDragHint = true;

    // 触摸灵敏度（用于拖动白球）
    this._touchSensitivity = 1.0;

    // 技能次数从云端加载（默认先用本地初始值，云端返回后覆盖）
    this.lightningCount = LIGHTNING_INITIAL;
    this.multiBallCount = MULTIBALL_INITIAL;
    this.atkBoostCount = 2;
    this._skillRewardTip = false;
    this._skillRewardTimer = 0;
    this._loadSkillsFromCloud();

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

    // 白球初始位置：发射轨道中心
    const launchCenterX = (LAUNCH_BAR_X_LEFT + LAUNCH_BAR_X_RIGHT) / 2;
    this.launcher.init(launchCenterX, this.ballCount);
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

    if (this.gameState === 'mode150History') {
      // 先尝试启动滚动
      this._historyScroller.onTouchStart(y);
      this._handleMode150HistoryTap(x, y);
      return;
    }

    // 球飞行中：检查收回按钮
    if (this._shouldShowRecallButton() && this._hitRecallButton(x, y)) {
      this._doRecallBalls();
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

    // 检查绘制按钮（发球后锁定，不可再切换）
    if (this.hud.hitDrawButton(x, y)) {
      if (this._drawLocked) return; // 发球后绘制功能锁定
      if (this._drawMode) {
        // 已处于绘制模式 → 关闭绘制模式和 tips
        this._drawMode = false;
        this._showDrawTips = false;
      } else {
        // 未进入绘制模式 → 切换 tips 选择面板
        this._showDrawTips = !this._showDrawTips;
      }
      return;
    }

    // tips 选择面板显示中：优先处理面板内点击
    if (this._showDrawTips && !this._drawLocked) {
      this._handleDrawTipsTap(x, y);
      return;
    }

    // 绘制模式高亮时：检查上一步按钮（发球后锁定则不可操作）
    if (this._drawMode && this._drawLines.length > 0 && !this._drawLocked) {
      if (this._hitUndoButton(x, y)) {
        this._drawLines.pop();
        return;
      }
    }

    // 绘制模式高亮时：已有线条则开始拖拽（发球后锁定则不可操作）
    if (this._drawMode && this.gameState === 'aiming' && this._drawLines.length > 0 && !this._drawLocked) {
      if (this._isNearDrawLine(x, y)) {
        this._isDraggingLine = true;
        this._dragLineStartX = x;
        this._dragLineStartY = y;
        return;
      }
    }

    // 绘制模式高亮时：在蓝色边框内开始绘制直线（最多只能绘制一条）
    if (this._drawMode && this.gameState === 'aiming' && this._drawLines.length === 0) {
      const clipped = this._clipToGameArea(x, y);
      if (this._isInsideGameArea(x, y)) {
        this._isDrawing = true;
        this._drawingLine = { x1: clipped.x, y1: clipped.y, x2: clipped.x, y2: clipped.y, type: this._drawLineType };
        return;
      }
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
        // 触摸在白球附近 → 拖拽白球位置（不显示取消按钮）
        this._isDraggingBall = true;
        this.launcher.isAiming = false;
        this._showDragHint = false;
        this._showCancelHint = false;
      } else {
        // 其他位置 → 瞄准角度（显示取消按钮）
        this._isDraggingBall = false;
        this.launcher.isAiming = true;
        this.launcher.setAimAngle(x, y);
        this._showDragHint = false;
        this._showCancelHint = true;
      }
      this._cancelHovered = false;
      this._cancelLaunch = false;
    }
  }

  /**
   * 触摸移动处理（供 main.js 统一分发器调用）
   */
  handleTouchMove(x, y) {
    if (GameGlobal.databus.scene !== 'playing') return;

    // 150球历史记录弹窗：滚动处理
    if (this.gameState === 'mode150History') {
      this._historyScroller.onTouchMove(y);
      return;
    }

    if (this.gameState !== 'aiming') return;

    // 绘制模式下：更新当前绘制直线的终点（限制最大长度为两个砖块宽度）
    if (this._isDrawing && this._drawingLine) {
      const clipped = this._clipToGameArea(x, y);
      // 白板横条：3 个砖块宽再降低 30% → 2.1 个砖块宽
      // 上实下虚横条：1.8 个砖块宽再降低 30% → 1.26 个砖块宽
      const maxLen = (this._drawLineType === 'oneway') ? BRICK_W * 1.26 : BRICK_W * 2.1;
      const dx = clipped.x - this._drawingLine.x1;
      const dy = clipped.y - this._drawingLine.y1;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= maxLen) {
        this._drawingLine.x2 = clipped.x;
        this._drawingLine.y2 = clipped.y;
      } else {
        // 超出最大长度，截断到最大长度
        this._drawingLine.x2 = this._drawingLine.x1 + (dx / dist) * maxLen;
        this._drawingLine.y2 = this._drawingLine.y1 + (dy / dist) * maxLen;
      }
      this._lastTouchX = x;
      this._lastTouchY = y;
      return;
    }

    // 绘制模式下：拖拽已有线条
    if (this._isDraggingLine && this._drawLines.length > 0) {
      const moveX = x - this._dragLineStartX;
      const moveY = y - this._dragLineStartY;
      const line = this._drawLines[0];
      const newLine = {
        x1: line.x1 + moveX,
        y1: line.y1 + moveY,
        x2: line.x2 + moveX,
        y2: line.y2 + moveY,
        type: line.type,  // 保留线条类型（上实下虚/白板），拖拽后不退化
      };
      // 检查新位置是否在游戏区域内且不遮盖砖块（保留4px间距）
      if (this._isLineInsideGameArea(newLine) && !this._isLineOverlappingBricks(newLine)) {
        this._drawLines[0] = newLine;
        this._dragLineStartX = x;
        this._dragLineStartY = y;
      }
      this._lastTouchX = x;
      this._lastTouchY = y;
      return;
    }

    const dx = x - this._lastTouchX;
    const dy = y - this._lastTouchY;
    this._lastTouchX = x;
    this._lastTouchY = y;

    // 检测手指是否悬停在取消按钮上
    if (this._showCancelHint) {
      this._cancelHovered = this._isOnCancelButton(x, y);
    }

    if (this._isDraggingBall) {
      // 拖拽白球X位置：限制在白色发射轨道线范围内
      const moveX = dx * this._touchSensitivity;
      const minX = LAUNCH_BAR_X_LEFT + BALL_RADIUS;
      const maxX = LAUNCH_BAR_X_RIGHT - BALL_RADIUS;
      this.launcher.x = Math.max(minX, Math.min(maxX, this.launcher.x + moveX));
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

    // 150球历史记录弹窗：滚动结束
    if (this.gameState === 'mode150History') {
      this._historyScroller.onTouchEnd();
      return;
    }

    // 绘制模式下：手指松开时保存当前绘制的直线
    if (this._isDrawing && this._drawingLine) {
      // 只有起点和终点不同才保存
      const dl = this._drawingLine;
      if (Math.abs(dl.x2 - dl.x1) > 2 || Math.abs(dl.y2 - dl.y1) > 2) {
        // 检查是否遮盖砖块，如果遮盖则不保存
        if (!this._isLineOverlappingBricks(dl)) {
          this._drawLines.push({ ...dl, type: dl.type || this._drawLineType });
        }
      }
      this._drawingLine = null;
      this._isDrawing = false;
      return;
    }

    // 绘制模式下：结束拖拽
    if (this._isDraggingLine) {
      this._isDraggingLine = false;
      return;
    }

    // 优先判断：手指松开时是否在取消按钮上 → 取消发射
    const wasHover = this._cancelHovered;
    this._showCancelHint = false;
    this._cancelHovered = false;

    if (wasHover) {
      // 取消本次发射动作
      this._isDraggingBall = false;
      this.launcher.isAiming = false;
      return;
    }

    if (this._isDraggingBall) {
      this._isDraggingBall = false;
      return; // 拖拽白球松手不发射
    }
    this._tryLaunch();
  }

  /**
   * 检测坐标 (x, y) 是否在取消按钮上
   */
  _isOnCancelButton(x, y) {
    const pos = this._getCancelButtonPos();
    const dx = x - pos.cx;
    const dy = y - pos.cy;
    return dx * dx + dy * dy <= pos.r * pos.r;
  }

  /**
   * 获取取消按钮的位置和半径（右下角，避开右侧技能列表）
   */
  _getCancelButtonPos() {
    const s = SCALE;
    const r = 24 * s;
    // 右下角：贴右侧面板内侧，BRICK_AREA_BOTTOM 下方留空区
    const cx = GAME_AREA_RIGHT + r + 20 * s;
    const cy = SCREEN_HEIGHT - r - 40 * s;
    return { cx, cy, r };
  }

  /**
   * 计算打砖块区域左边界：
   * 若左上角"关卡:N"文案区域与砖块区（顶部）水平重叠，则把左边界右移到文案右侧，避免遮挡。
   */
  _computeGameAreaLeft() {
    const s = SCALE;
    const rect = this.hud.getLevelLabelRect(this.stage);
    const labelRight = rect.x + rect.w;
    const gap = 8 * s;
    // 文案位于顶部，砖块区顶部 = GAME_AREA_TOP，二者垂直重叠，故只需判断水平是否越过左边界
    if (labelRight + gap > GAME_AREA_LEFT) {
      this.gameAreaLeft = labelRight + gap;
    } else {
      this.gameAreaLeft = GAME_AREA_LEFT;
    }
  }

  // ============================================================
  // 绘制模式辅助方法
  // ============================================================

  /**
   * 计算绘制 tips 选择面板的布局
   * 面板锚定在"绘制"按钮右侧，自上而下排列：白板横条、上实下虚横条、取消
   */
  _getDrawTipsLayout() {
    const s = SCALE;
    const btnX = this.hud.drawBtnX;
    const btnY = this.hud.drawBtnY;
    const btnW = this.hud.drawBtnW;

    const panelW = 132 * s;
    const rowH = 36 * s;
    const padX = 10 * s;
    const padY = 8 * s;
    const rows = 3;
    const panelH = rows * rowH + padY * 2;
    // 面板放在绘制按钮右侧，顶部相对绘制按钮上移 40px
    const panelX = btnX + btnW + 8 * s;
    let panelY = btnY - 40 * s;
    // 防止超出底部
    if (panelY + panelH > SCREEN_HEIGHT - 8 * s) {
      panelY = SCREEN_HEIGHT - 8 * s - panelH;
    }

    const items = [
      { key: 'normal', label: '白板横条' },
      { key: 'oneway', label: '上实下虚' },
      { key: 'cancel', label: '取消' },
    ];
    const rects = items.map((it, i) => ({
      key: it.key,
      label: it.label,
      x: panelX + padX,
      y: panelY + padY + i * rowH,
      w: panelW - padX * 2,
      h: rowH,
    }));

    return { panelX, panelY, panelW, panelH, rows: rects };
  }

  /**
   * 处理 tips 面板内的点击
   */
  _handleDrawTipsTap(x, y) {
    const layout = this._getDrawTipsLayout();
    for (const r of layout.rows) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        if (r.key === 'cancel') {
          // 取消：关闭 tips，什么都不做
          this._showDrawTips = false;
        } else {
          // 选择白板横条 / 上实下虚横条 → 进入绘制模式
          this._drawLineType = r.key;
          this._drawMode = true;
          this._showDrawTips = false;
        }
        return;
      }
    }
    // 点击面板外：关闭 tips
    this._showDrawTips = false;
  }

  /**
   * 渲染绘制 tips 选择面板
   */
  _renderDrawTips(ctx) {
    const s = SCALE;
    const layout = this._getDrawTipsLayout();

    ctx.save();
    // 面板背景
    this._roundRectPath(ctx, layout.panelX, layout.panelY, layout.panelW, layout.panelH, 8 * s);
    ctx.fillStyle = 'rgba(6,10,28,0.96)';
    ctx.fill();
    ctx.strokeStyle = '#2960dd';
    ctx.lineWidth = 1.5 * s;
    ctx.shadowColor = 'rgba(50,100,230,0.6)';
    ctx.shadowBlur = 3 * s;
    ctx.stroke();
    ctx.shadowBlur = 0;

    for (const r of layout.rows) {
      const cx = r.x + r.w / 2;
      const midY = r.y + r.h / 2;

      if (r.key === 'cancel') {
        // 取消文案
        ctx.fillStyle = '#aaaaaa';
        ctx.font = `bold ${13 * s}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('取消', cx, midY);
        continue;
      }

      // 预览图形：横条
      const barW = r.w * 0.5;
      const barX = r.x + 6 * s;
      const barCx0 = barX;
      const barCx1 = barX + barW;
      const barY = midY;

      if (r.key === 'normal') {
        // 白板横条：实线
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 3 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(barCx0, barY);
        ctx.lineTo(barCx1, barY);
        ctx.stroke();
        ctx.lineCap = 'butt';
      } else {
        // 上实下虚横条：上实线 + 下虚线
        ctx.strokeStyle = 'rgba(255,255,255,0.9)';
        ctx.lineWidth = 2.5 * s;
        ctx.lineCap = 'round';
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(barCx0, barY - 2 * s);
        ctx.lineTo(barCx1, barY - 2 * s);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1.5 * s;
        ctx.setLineDash([3 * s, 2.5 * s]);
        ctx.beginPath();
        ctx.moveTo(barCx0, barY + 3 * s);
        ctx.lineTo(barCx1, barY + 3 * s);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.lineCap = 'butt';
      }

      // 文字标签（无默认选中态，统一蓝色）
      ctx.fillStyle = '#5b8dff';
      ctx.font = `bold ${11 * s}px Arial`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(r.label, barX + barW + 8 * s, barY);
    }

    ctx.restore();
  }

  /**
   * 圆角矩形路径辅助（不填充/描边，仅建立路径）
   */
  _roundRectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  /**
   * 获取"上一步"按钮的位置（与取消按钮位置和大小一致）
   */
  _getUndoButtonPos() {
    return this._getCancelButtonPos();
  }

  /**
   * 检测坐标是否命中"上一步"按钮
   */
  _hitUndoButton(x, y) {
    const pos = this._getUndoButtonPos();
    const dx = x - pos.cx;
    const dy = y - pos.cy;
    return dx * dx + dy * dy <= pos.r * pos.r;
  }

  /**
   * 判断坐标是否在蓝色边框游戏区域内
   */
  _isInsideGameArea(x, y) {
    const borderX = this.gameAreaLeft - 2;
    const borderY = GAME_AREA_TOP - 2;
    const borderW = GAME_AREA_RIGHT - this.gameAreaLeft + 4;
    const borderH = BRICK_AREA_BOTTOM - GAME_AREA_TOP + 4;
    return x >= borderX && x <= borderX + borderW &&
      y >= borderY && y <= borderY + borderH;
  }

  /**
   * 将坐标裁剪到蓝色边框游戏区域内
   * 如果坐标超出边框，则截断到边框上
   */
  _clipToGameArea(x, y) {
    const borderX = this.gameAreaLeft - 2;
    const borderY = GAME_AREA_TOP - 2;
    const borderW = GAME_AREA_RIGHT - this.gameAreaLeft + 4;
    const borderH = BRICK_AREA_BOTTOM - GAME_AREA_TOP + 4;
    const clippedX = Math.max(borderX, Math.min(borderX + borderW, x));
    const clippedY = Math.max(borderY, Math.min(borderY + borderH, y));
    return { x: clippedX, y: clippedY };
  }

  /**
   * 渲染"上一步"按钮（样式与取消按钮一致，但文案不同）
   */
  _renderUndoButton(ctx) {
    const s = SCALE;
    const { cx, cy, r } = this._getUndoButtonPos();

    ctx.save();

    // 蓝色边框光晕（与取消按钮风格一致但用蓝色）
    ctx.shadowColor = 'rgba(50,100,230,0.75)';
    ctx.shadowBlur = 2 * s;
    ctx.strokeStyle = '#2960dd';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 深底色背景
    ctx.fillStyle = 'rgba(6,10,28,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.fill();

    // 中心：左箭头 "←" 图标
    ctx.strokeStyle = '#5b8dff';
    ctx.lineWidth = 2.5 * s;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const arrowH = r * 0.4;
    const arrowW = r * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx + arrowW * 0.4, cy);
    ctx.lineTo(cx - arrowW * 0.4, cy);
    ctx.moveTo(cx - arrowW * 0.4, cy);
    ctx.lineTo(cx - arrowW * 0.4 + arrowH * 0.5, cy - arrowH * 0.6);
    ctx.moveTo(cx - arrowW * 0.4, cy);
    ctx.lineTo(cx - arrowW * 0.4 + arrowH * 0.5, cy + arrowH * 0.6);
    ctx.stroke();
    ctx.lineCap = 'butt';

    // 提示文字
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `bold ${10 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('上一步', cx, cy + r + 4 * s);

    ctx.restore();
  }

  /**
   * 渲染已绘制的直线和当前正在绘制的直线
   */
  _renderDrawLines(ctx) {
    const s = SCALE;
    const endpointR = 4 * s; // 端点小圆点半径

    // 已保存的直线 + 两端小圆点
    ctx.lineCap = 'round';
    for (const line of this._drawLines) {
      if (line.type === 'oneway') {
        this._renderOneWayLine(ctx, line, 'rgba(255,255,255,0.85)', endpointR);
      } else {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 2.5 * s;
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
        // 两端小圆点（增强端点碰撞的视觉提示）
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(line.x1, line.y1, endpointR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(line.x2, line.y2, endpointR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 当前正在绘制的直线（金色高亮）+ 两端小圆点
    if (this._drawingLine) {
      if (this._drawingLine.type === 'oneway') {
        this._renderOneWayLine(ctx, this._drawingLine, 'rgba(255,210,80,0.95)', endpointR);
      } else {
        ctx.strokeStyle = 'rgba(255,210,80,0.9)';
        ctx.lineWidth = 2.5 * s;
        ctx.shadowColor = 'rgba(255,210,80,0.6)';
        ctx.shadowBlur = 2 * s;
        ctx.beginPath();
        ctx.moveTo(this._drawingLine.x1, this._drawingLine.y1);
        ctx.lineTo(this._drawingLine.x2, this._drawingLine.y2);
        ctx.stroke();
        ctx.shadowBlur = 0;
        // 两端小圆点
        ctx.fillStyle = 'rgba(255,210,80,0.9)';
        ctx.beginPath();
        ctx.arc(this._drawingLine.x1, this._drawingLine.y1, endpointR, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this._drawingLine.x2, this._drawingLine.y2, endpointR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.lineCap = 'butt';
  }

  /**
   * 渲染"上实下虚横条"：上边实线（反弹面）+ 下方平行虚线（可穿透提示）
   * @param {Object} line {x1,y1,x2,y2}
   * @param {string} color 实线颜色
   * @param {number} endpointR 端点圆点半径
   */
  _renderOneWayLine(ctx, line, color, endpointR) {
    const s = SCALE;
    // 线段单位方向 + 法线（向下偏移用）
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / len, uy = dy / len;
    // 法线（指向"下方"：y 正方向那一侧）
    let nx = -uy, ny = ux;
    if (ny < 0) { nx = -nx; ny = -ny; } // 保证法线朝下
    const offset = 4 * s; // 下方虚线与实线的间距

    // 上边实线（反弹面）
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5 * s;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();

    // 下方虚线（表示可从下方穿入）
    ctx.strokeStyle = color.replace(/0?\.\d+\)$/, '0.5)');
    ctx.lineWidth = 1.5 * s;
    ctx.setLineDash([4 * s, 3 * s]);
    ctx.beginPath();
    ctx.moveTo(line.x1 + nx * offset, line.y1 + ny * offset);
    ctx.lineTo(line.x2 + nx * offset, line.y2 + ny * offset);
    ctx.stroke();
    ctx.setLineDash([]);

    // 两端小圆点（画在实线端点）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(line.x1, line.y1, endpointR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(line.x2, line.y2, endpointR, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * 判断触摸点是否在已绘制线条附近（用于判断是否开始拖拽）
   * 判定范围：距离线段 30*SCALE 以内
   */
  _isNearDrawLine(x, y) {
    if (this._drawLines.length === 0) return false;
    const line = this._drawLines[0];
    const dist = this._pointToSegmentDist(x, y, line.x1, line.y1, line.x2, line.y2);
    return dist < 30 * SCALE;
  }

  /**
   * 计算点到线段的最短距离
   */
  _pointToSegmentDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1) {
      // 线段退化为点
      const ddx = px - x1;
      const ddy = py - y1;
      return Math.sqrt(ddx * ddx + ddy * ddy);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distX = px - closestX;
    const distY = py - closestY;
    return Math.sqrt(distX * distX + distY * distY);
  }

  /**
   * 判断线条的两个端点是否都在游戏区域内
   */
  _isLineInsideGameArea(line) {
    const borderX = this.gameAreaLeft - 2;
    const borderY = GAME_AREA_TOP - 2;
    const borderW = GAME_AREA_RIGHT - this.gameAreaLeft + 4;
    const borderH = BRICK_AREA_BOTTOM - GAME_AREA_TOP + 4;
    const inBounds = (x, y) =>
      x >= borderX && x <= borderX + borderW &&
      y >= borderY && y <= borderY + borderH;
    return inBounds(line.x1, line.y1) && inBounds(line.x2, line.y2);
  }

  /**
   * 判断线条是否与任何存活砖块重叠（需保留4px间距）
   * 算法：对每个存活砖块，将其外扩4px后检测线段是否与该矩形相交
   */
  _isLineOverlappingBricks(line) {
    const gap = 4 * SCALE;
    const bricks = this.grid.bricks;
    for (const brick of bricks) {
      if (!brick.isAlive) continue;
      // 砖块外扩 gap 后的矩形
      const bx = brick.x - gap;
      const by = brick.y - gap;
      const bw = brick.width + gap * 2;
      const bh = brick.height + gap * 2;
      if (this._segmentIntersectsRect(line.x1, line.y1, line.x2, line.y2, bx, by, bw, bh)) {
        return true;
      }
    }
    // 也检查横板
    if (this.grid.planks) {
      for (const plank of this.grid.planks) {
        if (!plank.isAlive) continue;
        const bx = plank.x - gap;
        const by = plank.y - gap;
        const bw = plank.width + gap * 2;
        const bh = plank.height + gap * 2;
        if (this._segmentIntersectsRect(line.x1, line.y1, line.x2, line.y2, bx, by, bw, bh)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 线段与矩形相交检测（Cohen-Sutherland 算法简化版）
   * 检测线段 (x1,y1)-(x2,y2) 是否与矩形 (rx,ry,rw,rh) 相交
   */
  _segmentIntersectsRect(x1, y1, x2, y2, rx, ry, rw, rh) {
    // 区域编码
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;
    const code = (x, y) => {
      let c = INSIDE;
      if (x < rx) c |= LEFT;
      else if (x > rx + rw) c |= RIGHT;
      if (y < ry) c |= TOP;
      else if (y > ry + rh) c |= BOTTOM;
      return c;
    };

    let c1 = code(x1, y1);
    let c2 = code(x2, y2);

    // 两端点都在矩形内
    if (c1 === 0 && c2 === 0) return true;
    // 两端点在矩形同一侧外
    if (c1 & c2) return false;
    // 一个在内一个在外
    if (c1 === 0 || c2 === 0) return true;

    // 需要进一步检测：线段是否穿过矩形
    // 检测线段与矩形四条边的交点
    const intersects = (ax, ay, bx, by, cx, cy, dx, dy) => {
      const denom = (bx - ax) * (dy - cy) - (by - ay) * (dx - cx);
      if (Math.abs(denom) < 0.0001) return false;
      const t = ((cx - ax) * (dy - cy) - (cy - ay) * (dx - cx)) / denom;
      const u = ((cx - ax) * (by - ay) - (cy - ay) * (bx - ax)) / denom;
      return t >= 0 && t <= 1 && u >= 0 && u <= 1;
    };

    // 矩形四条边
    if (intersects(x1, y1, x2, y2, rx, ry, rx + rw, ry)) return true;           // 上边
    if (intersects(x1, y1, x2, y2, rx, ry + rh, rx + rw, ry + rh)) return true; // 下边
    if (intersects(x1, y1, x2, y2, rx, ry, rx, ry + rh)) return true;           // 左边
    if (intersects(x1, y1, x2, y2, rx + rw, ry, rx + rw, ry + rh)) return true; // 右边

    return false;
  }

  /**
   * 尝试发射球
   */
  _tryLaunch() {
    if (this.gameState === 'aiming' && this.launcher.isAiming) {
      // === 发射时才真正扣除预选技能的次数 ===
      this._consumeArmedSkills();

      this.launcher.isAiming = false;
      this.gameState = 'launching';
      // 发球后锁定绘制功能：关闭绘制模式，不可再编辑/移动白线
      this._drawMode = false;
      this._drawLocked = true;
      this.launcher.startLaunch();
      this.totalBricksThisRound = this.grid.bricks.filter(b => b.isAlive).length;
      this.destroyedThisRound = 0;
      this.launchStartTime = Date.now();
      // runningFrames 跨轮累计，不在每次发射时重置
      this.speedTipText = '';
      this.speedTipTimer = 0;
    }
  }

  /**
   * 发射时真正扣除预选技能的次数并生效
   * 避免"点击选中但取消发射"或"跨关卡"时次数被错误扣除
   */
  _consumeArmedSkills() {
    // 闪电技能
    if (this._lightningArmed && this.lightningCount > 0) {
      this.lightningCount--;
      this._syncSkillUseToCloud('lightning');
    } else {
      // 次数不足或未预选 → 取消闪电标记
      this._lightningArmed = false;
      this.launcher.lightningArmed = false;
    }

    // 多球技能已改为点击立即生效，无需在发射时消费
    this._multiBallArmed = false;

    // 保持技能：一旦激活，整关持续（每回合自动保存球状态，下轮继承）
    if (this._atkBoostArmed && this.atkBoostCount > 0) {
      this.atkBoostCount--;
      this._syncSkillUseToCloud('atkBoost');
      this._keepBallActive = true;  // 整关持续生效，按钮永久置灰
    }
    this._atkBoostArmed = false;
  }

  /**
   * 闪电技能（预选）：仅标记，不立即扣除次数
   * 真正扣除在 _tryLaunch → _consumeArmedSkills 中执行
   */
  _useLightning() {
    if (this.lightningCount <= 0) return;
    if (this.gameState !== 'aiming') return;
    // 切换预选状态（再次点击可取消）
    this._lightningArmed = !this._lightningArmed;
    this.launcher.lightningArmed = this._lightningArmed;
  }

  /**
   * 闪电连锁伤害（逐层 BFS：先打伤当前层，存活者才继续传导下一层）
   *
   * 核心逻辑：
   *   - 从中心砖块出发逐层扩散
   *   - 每扩散一层先对该层砖块施加伤害
   *   - 被打死的砖块 = 断路，不会继续传导到它们的下一层邻居
   *   - 存活的砖块才作为下一层的导体继续 BFS
   *
   * 防重：本帧 Set 去重（同帧 hitBricks 多砖不重复）
   * 视觉：闪电链由 affected 砖块的 lightningTimer 驱动
   *
   * @param {Brick} centerBrick 中心被击中的砖块
   * @param {number} damage 伤害值
   * @param {Ball} ball 触发的球（用于加分）
   */
  _chainLightningDamage(centerBrick, damage, ball) {
    const triggered = this._lightningTriggeredThisFrame || (this._lightningTriggeredThisFrame = new Set());
    if (triggered.has(centerBrick)) return;

    const skipVisual = centerBrick.lightningTimer > 0;

    const dirs = [
      { dr: -1, dc: 0 },
      { dr: 1, dc: 0 },
      { dr: 0, dc: -1 },
      { dr: 0, dc: 1 },
    ];

    const visited = new Set([centerBrick]);
    triggered.add(centerBrick);

    const affected = [centerBrick];
    const edges = [];

    // 逐层 BFS：当前层 = conductors（导体砖块）
    let conductors = [centerBrick]; // 中心砖块作为第一层导体（已经在主流程中被 hit 过）

    while (conductors.length > 0) {
      const nextLayer = []; // 下一层发现的邻居

      for (const cur of conductors) {
        for (const { dr, dc } of dirs) {
          const tr = cur.row + dr;
          const tc = cur.col + dc;
          const neighbor = this.grid.bricks.find(b =>
            b.isAlive && b.row === tr && b.col === tc && !b.isPlank
          );
          if (!neighbor || visited.has(neighbor)) continue;
          if (triggered.has(neighbor)) continue;

          visited.add(neighbor);
          triggered.add(neighbor);
          affected.push(neighbor);
          edges.push({ from: cur, to: neighbor });
          nextLayer.push(neighbor);
        }
      }

      // 对本层发现的邻居砖块施加伤害
      const aliveConductors = [];
      for (const b of nextLayer) {
        const wasDestroyed = b.hit(damage);
        if (wasDestroyed) {
          // 被打死 = 断路，不作为下层导体
          this._addBrickScore(b, ball);
          this.destroyedThisRound++;
          this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        } else {
          // 存活 = 继续传导
          aliveConductors.push(b);
        }
      }

      // 下一层只有存活的砖块能继续导电
      conductors = aliveConductors;
    }

    // 视觉特效：所有受影响砖块标记 lightningTimer
    for (const b of affected) {
      b.lightningTimer = 15;
    }

    // 闪电链视觉去重
    if (!skipVisual && edges.length > 0) {
      if (!this._lightningChains) this._lightningChains = [];
      this._lightningChains.push({
        edges: edges.map(e => ({
          x1: e.from.x + e.from.width / 2,
          y1: e.from.y + e.from.height / 2,
          x2: e.to.x + e.to.width / 2,
          y2: e.to.y + e.to.height / 2,
        })),
        affected: affected.slice(),
      });
    }
  }

  _useMultiBall() {
    if (this.multiBallCount <= 0) return;
    if (this.gameState !== 'aiming') return;
    // 立即生效：扣除次数 + 增加球数
    this.multiBallCount--;
    this._syncSkillUseToCloud('multiBall');
    const addBalls = Math.ceil(this.ballCount * 0.1);
    this.ballCount += addBalls;
    this.launcher.ballCount = this.ballCount;
  }

  _useAtkBoost() {
    if (this.atkBoostCount <= 0) return;
    if (this.gameState !== 'aiming') return;
    // 上轮保持仍在生效中 → 本轮不可点击
    if (this._keepBallActive) return;
    // 切换预选状态（真正生效在 _consumeArmedSkills 中）
    this._atkBoostArmed = !this._atkBoostArmed;
  }

  /**
   * 播放碰撞音效（节流 + 对象池轮换，避免卡顿）
   */
  /**
   * 分享到群（触发群排行榜）
   * 分数获取优先级：① 当前场景分数 → ② 本地缓存 → ③ 云函数兜底
   */
  _doShareToGroup() {
    if (typeof wx === 'undefined') return;

    let shareScore = this.score;
    let shareLevel = this.stage;

    // ① 当前场景有分数 → 直接分享
    if (shareScore > 0) {
      this._execShare(shareLevel, shareScore);
      return;
    }

    // ② 从本地缓存获取
    try {
      const progressRaw = wx.getStorageSync('ppq_level_progress');
      if (progressRaw && Array.isArray(progressRaw)) {
        for (let i = progressRaw.length - 1; i >= 0; i--) {
          if (progressRaw[i] && progressRaw[i].score > 0) {
            shareScore = progressRaw[i].score;
            shareLevel = i + 1;
            break;
          }
        }
        if (shareScore <= 0) {
          for (let i = progressRaw.length - 1; i >= 0; i--) {
            if (progressRaw[i] && progressRaw[i].unlocked) {
              shareLevel = i + 1;
              break;
            }
          }
        }
      }
    } catch (e) { /* ignore */ }

    if (shareScore > 0) {
      this._execShare(shareLevel, shareScore);
      return;
    }

    // ③ 兜底：从云函数获取该关卡的 score
    if (wx.cloud) {
      wx.cloud.callFunction({
        name: 'saveUserProgress',
        data: { action: 'get' },
        success: (res) => {
          const result = res.result;
          if (result && result.code === 0 && result.levelProgress) {
            const progress = result.levelProgress;
            // 找该关卡或最高关卡的分数
            const idx = this.stage - 1;
            if (progress[idx] && progress[idx].score > 0) {
              this._execShare(this.stage, progress[idx].score);
            } else {
              // 找最高分的关卡
              let bestScore = 0;
              let bestLevel = this.stage;
              for (let i = progress.length - 1; i >= 0; i--) {
                if (progress[i] && progress[i].score > 0) {
                  bestScore = progress[i].score;
                  bestLevel = i + 1;
                  break;
                }
              }
              this._execShare(bestLevel, bestScore);
            }
          } else {
            this._execShare(this.stage, 0);
          }
        },
        fail: () => {
          this._execShare(this.stage, 0);
        },
      });
    } else {
      this._execShare(shareLevel, shareScore);
    }
  }

  /**
   * 执行分享
   */
  _execShare(level, score) {
    const title = score > 0
      ? `我在碰碰球第${level}关拿到了${score}分，快来挑战！`
      : `我在碰碰球闯到了第${level}关，快来挑战！`;

    wx.shareAppMessage({
      title,
      imageUrl: 'images/welcome.jpg',
      query: `level=${level}&score=${score}`,
    });
  }

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

    // 150球历史记录弹窗：只更新滚动条惯性
    if (this.gameState === 'mode150History') {
      this._historyScroller.update();
      return;
    }

    this.glowPhase += 0.03;
    if (this.glowPhase > Math.PI * 2) this.glowPhase -= Math.PI * 2;

    this.hud.update();
    this.grid.update();

    // 绘制按钮开局闪动计时器递减
    if (this._drawBtnBlinkTimer > 0) {
      this._drawBtnBlinkTimer--;
    }

    // 倒计时（基于帧累计，60FPS = 每秒1秒）
    // 只有在白球正式发射后才开始倒计时（launching/running 状态）
    if (this.gameState === 'launching' || this.gameState === 'running') {
      this._timeAccumFrames++;
      if (this._timeAccumFrames >= 60) {
        this._timeAccumFrames -= 60;
        this.timeLeft--;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          // 时间到 → 进入游戏结束（弹窗显示当前得分）
          this._onTimeout();
          return;
        }
      }
    }

    // 球速加速：从进入关卡开始持续计帧（所有非暂停/结束状态都累计）
    this._checkSpeedBoost();

    // Combo 计时器：每帧递减，归零时清空连击计数
    if (this._comboTimer > 0) {
      this._comboTimer--;
      if (this._comboTimer === 0) this._comboCount = 0;
    }

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
   * 检测球速加速（已禁用：白球始终保持 1 倍速）
   */
  _checkSpeedBoost() {
    this.runningFrames++;

    // 已取消"过一定时间触发 1.5 倍加速"功能：始终保持 1 倍速
    // 仅维持 speedTipTimer 倒计时让残留提示文字渐隐消失
    if (this.speedTipTimer > 0) {
      this.speedTipTimer--;
    }
  }

  _updateBalls() {
    const left = this.gameAreaLeft;
    const right = GAME_AREA_RIGHT;
    const top = GAME_AREA_TOP;
    const bottom = LAUNCH_Y;
    const bricks = this.grid.bricks;
    // 横板也参与碰撞（球碰到反弹但不消除）
    const allObstacles = [...bricks, ...this.grid.planks];

    // 本帧闪电去重集合：同一帧内 hitBricks 多砖触发只电一次连通块
    // 跨帧（球反弹后再击中）则重新触发完整 BFS → 邻居跟着多扣血，与中心保持一致
    this._lightningTriggeredThisFrame = new Set();

    this.launcher.balls.forEach(ball => {
      if (ball.isFullyStopped()) return;

      // 飞回中的球：仅执行 recall 轨迹运动
      if (ball.recalling) {
        ball.update(left, right, top, bottom);
        return;
      }

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
      const hitBricks = moveBallWithCollision(ball, moveVx, moveVy, allObstacles, this._drawLines);

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
          this._addBrickScore(brick, ball);
          this.destroyedThisRound++;
          this.energy = Math.min(MAX_ENERGY, this.energy + ENERGY_PER_BRICK);
        }

        // ===== 闪电连锁打击：球带闪电时，连带攻击 4 邻居（上下左右） =====
        // 中心砖块的 lightningTimer 由 _chainLightningDamage 统一设置（在 skipVisual 判定之后）
        if (ball.hasLightning && !brick.isPlank) {
          this._chainLightningDamage(brick, damage, ball);
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
    const left = this.gameAreaLeft;
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
   * 从云端加载技能次数（覆盖本地初始值）
   */
  _loadSkillsFromCloud() {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'getSkills' },
      success: (res) => {
        const result = res.result;
        if (result && result.code === 0 && result.skills) {
          this.lightningCount = result.skills.lightning || 0;
          this.multiBallCount = result.skills.multiBall || 0;
          this.atkBoostCount = result.skills.atkBoost || 0;
          console.log('云端技能加载:', result.skills);
        }
      },
      fail: (err) => { console.error('加载技能失败:', err); },
    });
  }

  /**
   * 使用技能后同步云端扣减
   * @param {'lightning'|'multiBall'|'atkBoost'} skillType
   */
  _syncSkillUseToCloud(skillType) {
    if (typeof wx === 'undefined' || !wx.cloud) return;

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: { action: 'useSkill', skillType },
      success: (res) => { console.log('技能扣减同步:', res.result); },
      fail: (err) => { console.error('技能扣减同步失败:', err); },
    });
  }

  /**
   * 通关后通知云端（记录通关次数、通关积分、时间、回合数，每3次奖励技能+1）
   */
  _notifyLevelCleared() {
    if (typeof wx === 'undefined' || !wx.cloud) return;
    if (this.initialLevel <= 0) return; // 特殊模式不计入

    // 计算通关耗时（总时间 - 剩余时间 + 帧级精度补偿）
    // timeLeft是整秒递减的，_timeAccumFrames记录了当前秒内已累计的帧数
    const fractionalSecond = (this._timeAccumFrames || 0) / 60;
    const timeUsed = LEVEL_TIME_LIMIT - (this.timeLeft || 0) + fractionalSecond;
    // 保留1位小数
    const timeUsedRounded = Math.round(timeUsed * 10) / 10;

    wx.cloud.callFunction({
      name: 'saveUserProgress',
      data: {
        action: 'levelCleared',
        level: this.initialLevel,       // 关卡编号
        clearScore: this.score,         // 通关积分
        timeUsed: timeUsedRounded,             // 通关耗时（秒，精确到0.1秒）
        rounds: this.line,              // 通关使用的回合数
        mapName: this.grid && this.grid.templateName,  // 本关地图（布局）名称，参考150球 formationName
      },
      success: (res) => {
        const result = res.result;
        if (result && result.code === 0) {
          console.log('通关记录:', result);
          if (result.rewarded) {
            // 奖励技能：更新本地次数
            this.lightningCount = result.skills.lightning;
            this.multiBallCount = result.skills.multiBall;
            this.atkBoostCount = result.skills.atkBoost;
            // 标记奖励提示（供UI显示）
            this._skillRewardTip = true;
            this._skillRewardTimer = 180; // 3秒提示
          }
        }
      },
      fail: (err) => { console.error('通关记录失败:', err); },
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
        this._addBrickScore(brick, null);
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
        this._addBrickScore(brick, null);
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
    const left = this.gameAreaLeft;
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

    // 增加回合数
    this.line++;

    // ===== 通关条件：分数达到该关动态目标分 =====
    if (this.score >= this.targetScore) {
      // 星级标准：按"达成目标分时使用的回合数"评定
      //  - 3 星：line ≤ star3MaxRounds（高效通关）
      //  - 2 星：line ≤ star2MaxRounds（中等效率）
      //  - 1 星：达到目标分即可（保底）
      const t = this.starThresholds || { star3MaxRounds: 2, star2MaxRounds: 3 };
      let stars = 1;
      if (this.line <= t.star3MaxRounds) stars = 3;
      else if (this.line <= t.star2MaxRounds) stars = 2;

      this.winStars = stars;
      this.gameState = 'win';
      this._notifyLevelCleared();

      // 游戏结束后获取用户信息
      this._fetchUserInfoAfterGame();

      if (this.onLevelComplete) {
        // 第4个参数：本关所用地图（布局）名称，参考150球的 formationName
        this.onLevelComplete(this.initialLevel, stars, this.score, this.grid && this.grid.templateName);
      }
      return;
    }

    // ===== 强制结束条件：发射轮数达到总轮数上限，分数未达标则判定失败 =====
    if (this.line >= this.maxRounds) {
      this.gameState = 'over';
      this._roundsExhausted = true;  // 标记为轮数耗尽（区别于超时失败）

      // 游戏结束后获取用户信息
      this._fetchUserInfoAfterGame();

      if (this.onGameOver) {
        this.onGameOver();
      }
      return;
    }

    this.stage++;

    // ===== 不再下移砖块；改为在前5行随机选 1~2 行追加新砖块 =====
    const TOP_HALF_ROWS = Math.min(5, GRID_ROWS);
    const refillCount = 1 + (Math.random() < 0.4 ? 1 : 0); // 40% 概率追加2行
    const usedRows = new Set();
    for (let i = 0; i < refillCount; i++) {
      let targetRow;
      let attempts = 0;
      do {
        targetRow = Math.floor(Math.random() * TOP_HALF_ROWS);
        attempts++;
      } while (usedRows.has(targetRow) && attempts < 10);
      usedRows.add(targetRow);
      this.grid.generateBricksAtRow(this.stage, targetRow);
    }

    // 删除超出底部的横板（只删除完全超出发射线的）
    this.grid.planks = this.grid.planks.filter(p => p.targetY < LAUNCH_Y);
    // 删除超出底部的白洞、消单行、消单列
    this.grid.warps = this.grid.warps.filter(w => w.active && w.targetY < LAUNCH_Y);
    this.grid.rowClears = this.grid.rowClears.filter(rc => !rc.collected && rc.targetY < LAUNCH_Y);
    this.grid.colClears = this.grid.colClears.filter(cc => !cc.collected && cc.targetY < LAUNCH_Y);

    // 更新球数
    this.ballCount += this.nextBallCount;
    this.nextBallCount = 0;

    // "保持"技能：一旦激活，此后每回合都保存每个球各自的状态（整关持续）
    // 存储为数组 [{hitCount, powerLevel}, ...]，下轮按顺序注入
    let savedBallStates = [];
    if (this._keepBallActive) {
      this.launcher.balls.forEach(b => {
        savedBallStates.push({
          hitCount: b.hitCount || 0,
          powerLevel: b.powerLevel || 0,
        });
      });
    }

    // 更新发射点
    const nextX = this.launcher.getNextLaunchX();
    this.launcher.init(nextX, this.ballCount);
    this.launcher.showAimLine = this.showAimLine;

    // 恢复每个球各自的升级状态到 launcher（下轮发射时按序注入）
    this.launcher.savedBallStates = savedBallStates;

    // 清除本轮技能预选状态（避免延续到下一轮）
    this._lightningArmed = false;
    this._multiBallArmed = false;
    this._atkBoostArmed = false;
    this.launcher.lightningArmed = false;

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

    // 更新 150 球本地最高分 + 上报关系链数据（供群/好友排行榜读取）
    if (typeof wx !== 'undefined') {
      try {
        const oldBest = parseInt(wx.getStorageSync('ppq_mode150_best')) || 0;
        if (this.score > oldBest) {
          wx.setStorageSync('ppq_mode150_best', this.score);
          // 立即更新关系链 KVData（仅 mode150Best 字段），让群好友排行榜能读到最新值
          if (wx.setUserCloudStorage) {
            wx.setUserCloudStorage({
              KVDataList: [{ key: 'mode150Best', value: String(this.score) }],
              success: () => { console.log('150球最高分已写入关系链'); },
              fail: () => { /* 静默 */ },
            });
          }
        }
      } catch (e) { /* ignore */ }
    }

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
            formationName: this.grid.templateName || '未知阵型',
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

    // 白色发射轨道线（白球横向移动范围的视觉指示）
    this._renderLaunchBar(ctx);

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
    this.launcher.render(ctx, this.gameState, [...this.grid.bricks, ...this.grid.planks], this._drawLines, this.gameAreaLeft);

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
      ctx.shadowBlur = 2 * SCALE;
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

    // HUD（左上返回按钮 + 左侧分数/倒计时面板 + 右侧技能列表）
    this.hud.render(ctx, {
      stage: this.stage,
      line: this.line,
      maxRounds: this.maxRounds,
      score: this.score,
      lightningCount: this.lightningCount,
      multiBallCount: this.multiBallCount,
      atkBoostCount: this.atkBoostCount,
      atkLevel: this.atkLevel,
      timeLeft: this.timeLeft || 0,
      showAimLine: this.showAimLine,
      targetScore: this.targetScore,
      lightningArmed: !!this._lightningArmed,
      keepArmed: !!this._atkBoostArmed,          // 保持按钮是否已预选
      keepDisabled: !!this._keepBallActive,      // 保持按钮是否不可点击（上轮激活了"保持"仍在生效中）
      drawMode: this._drawMode,                  // 绘制按钮开关状态
      drawLocked: this._drawLocked,                // 绘制功能是否已锁定（发球后）
      drawBtnBlink: this._drawBtnBlinkTimer > 0,   // 绘制按钮是否正在闪动提示
    });

    // 绘制模式：渲染已绘制的直线
    if (this._drawLines.length > 0 || this._drawingLine) {
      this._renderDrawLines(ctx);
    }

    // 绘制模式高亮时：显示上一步按钮（发球后锁定则隐藏）
    if (this._drawMode && this._drawLines.length > 0 && !this._drawLocked) {
      this._renderUndoButton(ctx);
    }

    // 绘制 tips 选择面板（点击"绘制"后弹出）
    if (this._showDrawTips && !this._drawLocked) {
      this._renderDrawTips(ctx);
    }

    // 加速提示
    if (this.speedTipTimer > 0) {
      this._renderSpeedTip(ctx);
    }

    // 粒子效果
    if (this._particles.length > 0) {
      this._updateAndRenderParticles(ctx);
    }

    // 闪电链特效（叠加在砖块之上、分数文字之下）
    if (this._lightningChains && this._lightningChains.length > 0) {
      this._updateAndRenderLightningChains(ctx);
    }

    // 分数飞起特效
    if (this._scoreFloats && this._scoreFloats.length > 0) {
      this._updateAndRenderScoreFloats(ctx);
    }

    // 拖动白球时的"取消发射"按钮（右下角）
    if (this._showCancelHint) {
      this._renderCancelButton(ctx);
    }

    // 球飞行中的"收回"按钮（同一位置，与取消按钮互斥显示）
    if (!this._showCancelHint && this._shouldShowRecallButton()) {
      this._renderRecallButton(ctx);
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

    // 150球模式历史记录弹窗
    if (this.gameState === 'mode150History') {
      this._renderMode150HistoryOverlay(ctx);
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
      ctx.shadowBlur = 2 * s * appear;
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
      ctx.shadowBlur = 2 * SCALE * alpha;

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
    const left = this.gameAreaLeft;
    const right = GAME_AREA_RIGHT;
    const lineH = 3.2 * s * progress;

    ctx.globalAlpha = progress * 0.9;

    // 主光线
    ctx.fillStyle = '#ff3333';
    ctx.shadowColor = '#ff3333';
    ctx.shadowBlur = 2 * s * progress;
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
    ctx.shadowBlur = 2 * s * progress;
    ctx.fillRect(e.x - lineW / 2, top, lineW, bottom - top);

    // 外扩光晕
    ctx.fillStyle = 'rgba(255,50,50,0.3)';
    ctx.fillRect(e.x - lineW * 2, top, lineW * 4, bottom - top);

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  _renderBackground(ctx) {
    // 使用背景地图图片填满整个屏幕
    if (this._bgImageLoaded) {
      ctx.drawImage(this._bgImage, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    } else {
      // 图片加载完成前的兜底底色（深色，避免白屏闪烁）
      ctx.fillStyle = COLORS.bgTop;
      ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    }
  }

  _renderGameAreaBorder(ctx) {
    const s = SCALE;
    const glow = 0.5 + 0.3 * Math.sin(this.glowPhase);

    // 中间大框边框（与主页边框统一色，参考设计图）
    ctx.strokeStyle = COLORS.frameBorder;
    ctx.lineWidth = 2;
    ctx.shadowColor = COLORS.frameBorder;
    ctx.shadowBlur = 2 * s * glow;

    // 圆角矩形描边（边框只包砖块区域，白球/发射器在边框外）
    const x = this.gameAreaLeft - 2;
    const y = GAME_AREA_TOP - 2;
    const w = GAME_AREA_RIGHT - this.gameAreaLeft + 4;
    const h = BRICK_AREA_BOTTOM - GAME_AREA_TOP + 4;
    const r = 8 * s;

    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
  }

  /**
   * 渲染白色发射轨道线（限制白球横向移动范围的视觉指示）
   * 与白球同 Y 轴，居中放置，宽度 = 砖块区宽度的 80%
   */
  _renderLaunchBar(ctx) {
    const s = SCALE;
    const x = LAUNCH_BAR_X_LEFT;
    const y = LAUNCH_Y - LAUNCH_BAR_HEIGHT / 2;
    const w = LAUNCH_BAR_WIDTH;
    const h = LAUNCH_BAR_HEIGHT;
    const r = h / 2;

    ctx.save();
    // 轨道渐变填充：两端透明、中间偏白，营造"光带"质感
    const gradient = ctx.createLinearGradient(x, y, x + w, y);
    gradient.addColorStop(0, 'rgba(255,255,255,0.05)');
    gradient.addColorStop(0.15, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.85, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(1, 'rgba(255,255,255,0.05)');
    ctx.fillStyle = gradient;
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 2 * s;

    // 圆角矩形
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  _renderPauseOverlay(ctx) {
    const s = SCALE;

    // 重置渲染状态
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    if (this.initialLevel === -150) {
      // 150球模式：继续、重试、历史记录、菜单 四个按钮
      const btnGap = 55 * s;
      const totalH = btnGap * 3;
      const startY = centerY - totalH / 2;

      this._drawButton(ctx, centerX, startY, 120 * s, 40 * s, '继续', '#4499cc');
      this._drawButton(ctx, centerX, startY + btnGap, 120 * s, 40 * s, '重试', '#4499cc');
      this._drawButton(ctx, centerX, startY + btnGap * 2, 120 * s, 40 * s, '历史记录', '#4499cc');
      this._drawButton(ctx, centerX, startY + btnGap * 3, 120 * s, 40 * s, '首页', '#4499cc');
    } else {
      // 普通模式：继续/重试/首页 三个按钮（分享暂未开通好友关系，已隐藏）
      const btnGap = 60 * s;
      const totalH = btnGap * 2;
      const startY = centerY - totalH / 2;

      this._drawButton(ctx, centerX, startY, 120 * s, 40 * s, '继续', '#4499cc');
      this._drawButton(ctx, centerX, startY + btnGap, 120 * s, 40 * s, '重试', '#4499cc');
      // this._drawButton(ctx, centerX, startY + btnGap * 2, 120 * s, 40 * s, '分享', '#4499cc');
      this._drawButton(ctx, centerX, startY + btnGap * 2, 120 * s, 40 * s, '首页', '#4499cc');
    }
  }

  _renderGameOverOverlay(ctx) {
    const s = SCALE;

    // 半透明背景
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;

    // 标题：超时 / 轮数耗尽 / 普通失败
    const isTimeout = !!this._timeoutGameOver;
    const isRoundsExhausted = !!this._roundsExhausted;
    const title = isTimeout ? '时间到' : isRoundsExhausted ? '回合用尽' : '游戏结束';
    const titleColor = isTimeout ? COLORS.neonYellow : isRoundsExhausted ? COLORS.neonYellow : COLORS.neonRed;

    ctx.fillStyle = titleColor;
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = titleColor;
    ctx.shadowBlur = 2 * s;
    ctx.fillText(title, centerX, centerY - 80 * s);
    ctx.shadowBlur = 0;

    // 关卡
    ctx.fillStyle = COLORS.textWhite;
    ctx.font = `${16 * s}px Arial`;
    ctx.fillText(`关卡: ${this.stage}`, centerX, centerY - 30 * s);

    // 得分 + 回合（同一行）
    ctx.font = `${14 * s}px Arial`;
    ctx.fillText(`得分: ${this.score}/${this.targetScore}    回合: ${this.line}/${this.maxRounds}`, centerX, centerY + 5 * s);

    // 按钮组（重试、菜单、分享 并排）
    const btnW = 80 * s;
    const btnH = 36 * s;
    const btnGapX = 12 * s;
    const totalBtnW = btnW * 3 + btnGapX * 2;
    const btnStartX = centerX - totalBtnW / 2 + btnW / 2;
    const btnY = centerY + 55 * s;

    this._drawButton(ctx, btnStartX, btnY, btnW, btnH, '重试', '#4499cc');
    this._drawButton(ctx, btnStartX + btnW + btnGapX, btnY, btnW, btnH, '菜单', '#4499cc');
    this._drawButton(ctx, btnStartX + (btnW + btnGapX) * 2, btnY, btnW, btnH, '分享', '#33aa66');
  }

  _renderWinOverlay(ctx) {
    const s = SCALE;

    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2 - 20 * s;

    // 标题
    ctx.fillStyle = '#39ff14';
    ctx.font = `bold ${28 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#39ff14';
    ctx.shadowBlur = 2 * s;
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
      if (filled) { ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 2 * s; }
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

    // 技能奖励提示
    if (this._skillRewardTip) {
      ctx.fillStyle = '#ffdd00';
      ctx.font = `bold ${13 * s}px Arial`;
      ctx.shadowColor = '#ffdd00';
      ctx.shadowBlur = 2 * s;
      ctx.fillText(' 技能+1（每通关3次奖励）', centerX, centerY + 40 * s);
      ctx.shadowBlur = 0;
    }

    if (this.initialLevel === -150) {
      // 150球模式：显示菜单按钮 + 历史记录按钮
      this._drawButton(ctx, centerX, centerY + 65 * s, 140 * s, 40 * s, '历史记录', '#4499cc');
      this._drawButton(ctx, centerX, centerY + 120 * s, 140 * s, 40 * s, '菜单', '#4499cc');
    } else {
      // 普通模式：下一关、菜单、分享 三个按钮并排
      const btnW = 80 * s;
      const btnH = 36 * s;
      const btnGap = 12 * s;
      const totalW = btnW * 3 + btnGap * 2;
      const startX = centerX - totalW / 2 + btnW / 2;
      const btnY = centerY + 75 * s;

      this._drawButton(ctx, startX, btnY, btnW, btnH, '下一关', '#4499cc');
      this._drawButton(ctx, startX + btnW + btnGap, btnY, btnW, btnH, '菜单', '#4499cc');
      this._drawButton(ctx, startX + (btnW + btnGap) * 2, btnY, btnW, btnH, '分享', '#33aa66');
    }
  }

  _handleWinTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2 - 20 * s;
    const bw = 140 * s;
    const bh = 40 * s;

    if (this.initialLevel === -150) {
      // 150球模式：历史记录按钮在 65*s 位置，菜单按钮在 120*s 位置
      const historyY = centerY + 65 * s;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= historyY - bh / 2 && y <= historyY + bh / 2) {
        this._showMode150History();
        return;
      }
      const menuY = centerY + 120 * s;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
        if (this.onBackToMenu) this.onBackToMenu();
      }
      return;
    }

    // 普通模式：三个按钮并排
    const btnW = 80 * s;
    const btnH = 36 * s;
    const btnGap = 12 * s;
    const totalW = btnW * 3 + btnGap * 2;
    const startX = centerX - totalW / 2 + btnW / 2;
    const btnY = centerY + 75 * s;

    // 下一关
    if (x >= startX - btnW / 2 && x <= startX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      this.initLevel(this.initialLevel + 1);
      return;
    }

    // 菜单
    const menuX = startX + btnW + btnGap;
    if (x >= menuX - btnW / 2 && x <= menuX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }

    // 分享
    const shareX = startX + (btnW + btnGap) * 2;
    if (x >= shareX - btnW / 2 && x <= shareX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      this._doShareToGroup();
      return;
    }
  }

  _drawButton(ctx, cx, cy, w, h, text, color) {
    const s = SCALE;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 2 * s;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
    ctx.shadowBlur = 0;

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

    if (this.initialLevel === -150) {
      // 150球模式：继续、重试、历史记录、菜单
      const btnGap = 55 * s;
      const totalH = btnGap * 3;
      const startY = centerY - totalH / 2;

      // 继续按钮
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= startY - bh / 2 && y <= startY + bh / 2) {
        this.gameState = this.prevState || 'aiming';
        return;
      }
      // 重试按钮
      const retryY = startY + btnGap;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= retryY - bh / 2 && y <= retryY + bh / 2) {
        this.initLevel(this.initialLevel);
        return;
      }
      // 历史记录按钮
      const historyY = startY + btnGap * 2;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= historyY - bh / 2 && y <= historyY + bh / 2) {
        this._showMode150History();
        return;
      }
      // 菜单按钮
      const menuY = startY + btnGap * 3;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
        if (this.onBackToMenu) this.onBackToMenu();
        return;
      }
    } else {
      // 普通模式：继续/重试/首页（分享暂未开通好友关系，已隐藏）
      const btnGap = 60 * s;
      const totalH = btnGap * 2;
      const startY = centerY - totalH / 2;

      // 继续按钮
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= startY - bh / 2 && y <= startY + bh / 2) {
        this.gameState = this.prevState || 'aiming';
        return;
      }

      // 重试按钮
      const retryY = startY + btnGap;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= retryY - bh / 2 && y <= retryY + bh / 2) {
        this.initLevel(this.initialLevel);
        return;
      }

      // 分享按钮（暂未开通好友关系，已隐藏）
      // const shareY = startY + btnGap * 2;
      // if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
      //   y >= shareY - bh / 2 && y <= shareY + bh / 2) {
      //   this._doShareToGroup();
      //   return;
      // }

      // 返回菜单按钮
      const menuY = startY + btnGap * 2;
      if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
        y >= menuY - bh / 2 && y <= menuY + bh / 2) {
        if (this.onBackToMenu) this.onBackToMenu();
        return;
      }
    }
  }

  /**
   * 显示150球模式历史记录弹窗
   */
  _showMode150History() {
    this._mode150HistoryData = null;
    this._mode150HistoryLoading = true;
    this._prevStateBeforeHistory = this.gameState;
    this.gameState = 'mode150History';
    this._historyScroller.reset(); // 重置滚动状态

    // 从云端获取历史记录
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.callFunction({
        name: 'saveUserProgress',
        data: { action: 'getMode150History' },
        success: (res) => {
          const result = res.result;
          if (result && result.code === 0) {
            this._mode150HistoryData = result.history || [];
          } else {
            this._mode150HistoryData = [];
          }
          this._mode150HistoryLoading = false;
        },
        fail: () => {
          this._mode150HistoryData = [];
          this._mode150HistoryLoading = false;
        },
      });
    } else {
      this._mode150HistoryData = [];
      this._mode150HistoryLoading = false;
    }
  }

  /**
   * 渲染150球模式历史记录弹窗
   */
  _renderMode150HistoryOverlay(ctx) {
    const s = SCALE;

    // 重置渲染状态（防止被前面渲染污染）
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 半透明背景（与暂停弹窗一致）
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    const centerX = SCREEN_WIDTH / 2;
    const topY = 60 * s;

    // 标题
    ctx.fillStyle = '#4499cc';
    ctx.font = `bold ${20 * s}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#4499cc';
    ctx.shadowBlur = 2 * s;
    ctx.fillText('150球模式 - 历史记录', centerX, topY);
    ctx.shadowBlur = 0;

    // 副标题
    ctx.fillStyle = '#aaaaaa';
    ctx.font = `${11 * s}px Arial`;
    ctx.fillText('TOP 10 排行（按得分降序）', centerX, topY + 25 * s);

    if (this._mode150HistoryLoading) {
      ctx.fillStyle = '#ffffff';
      ctx.font = `${14 * s}px Arial`;
      ctx.fillText('加载中...', centerX, SCREEN_HEIGHT / 2);
      return;
    }

    // 返回按钮位置
    const btnY = SCREEN_HEIGHT - 60 * s;

    const data = this._mode150HistoryData || [];
    if (data.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.font = `${14 * s}px Arial`;
      ctx.fillText('暂无记录', centerX, SCREEN_HEIGHT / 2);
    } else {
      // 表头（固定不滚动）
      const headerY = topY + 55 * s;
      const rowH = 32 * s;

      // 表格总宽度和居中偏移
      const tableW = 280 * s;
      const tableLeft = (SCREEN_WIDTH - tableW) / 2;
      const col1X = tableLeft;                    // 排名
      const col2X = tableLeft + 35 * s;           // 得分
      const col3X = tableLeft + 105 * s;          // 阵型
      const col4X = tableLeft + 190 * s;          // 时间

      ctx.textAlign = 'left';
      ctx.fillStyle = '#4499cc';
      ctx.font = `bold ${11 * s}px Arial`;
      ctx.fillText('#', col1X, headerY);
      ctx.fillText('得分', col2X, headerY);
      ctx.fillText('阵型', col3X, headerY);
      ctx.fillText('游玩时间', col4X, headerY);

      // 分隔线
      ctx.strokeStyle = 'rgba(68,153,204,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableLeft, headerY + 12 * s);
      ctx.lineTo(tableLeft + tableW, headerY + 12 * s);
      ctx.stroke();

      // 可滚动内容区域：从分隔线下方到返回按钮上方
      const contentTop = headerY + 18 * s;
      const contentBottom = btnY - 30 * s;
      const contentHeight = contentBottom - contentTop;
      const totalContentHeight = data.length * rowH;

      // 设置滚动区域参数
      this._historyScroller.setContentArea(contentTop, contentHeight, totalContentHeight);

      // 获取当前滚动偏移
      const scrollY = this._historyScroller.getScrollY();

      // 裁剪内容区域
      ctx.save();
      ctx.beginPath();
      ctx.rect(tableLeft - 5 * s, contentTop, tableW + 10 * s, contentHeight);
      ctx.clip();

      // 数据行（带滚动偏移）
      for (let i = 0; i < data.length && i < 10; i++) {
        const item = data[i];
        const rowY = contentTop + i * rowH + 10 * s + scrollY;

        // 跳过不可见行
        if (rowY + rowH < contentTop || rowY - rowH > contentBottom) continue;

        // 排名颜色
        if (i === 0) ctx.fillStyle = '#ffdd00';
        else if (i === 1) ctx.fillStyle = '#c0c0c0';
        else if (i === 2) ctx.fillStyle = '#cd7f32';
        else ctx.fillStyle = '#ffffff';

        ctx.font = `bold ${12 * s}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(`${i + 1}`, col1X, rowY);

        ctx.fillStyle = '#ffffff';
        ctx.font = `${12 * s}px Arial`;
        ctx.fillText(`${item.score}`, col2X, rowY);

        ctx.fillStyle = '#aaddff';
        ctx.font = `${11 * s}px Arial`;
        ctx.fillText(item.formationName || '未知', col3X, rowY);

        // 格式化日期
        ctx.fillStyle = '#888888';
        ctx.font = `${10 * s}px Arial`;
        const dateStr = this._formatHistoryDate(item.date);
        ctx.fillText(dateStr, col4X, rowY);
      }

      ctx.restore();

      // 渲染滚动条（内容超出时显示）
      if (this._historyScroller.needsScroll()) {
        this._historyScroller.renderScrollBar(ctx, tableLeft + tableW + 2 * s, s, {
          color: 'rgba(68,153,204,0.4)',
        });
      }
    }

    // 返回按钮
    ctx.textAlign = 'center';
    this._drawButton(ctx, centerX, btnY, 120 * s, 40 * s, '返回', '#4499cc');
  }

  /**
   * 格式化历史记录日期
   */
  _formatHistoryDate(dateStr) {
    if (!dateStr) return '--';
    try {
      const d = new Date(dateStr);
      const m = (d.getMonth() + 1).toString().padStart(2, '0');
      const day = d.getDate().toString().padStart(2, '0');
      const h = d.getHours().toString().padStart(2, '0');
      const min = d.getMinutes().toString().padStart(2, '0');
      return `${m}-${day} ${h}:${min}`;
    } catch (e) {
      return '--';
    }
  }

  /**
   * 处理150球模式历史记录弹窗的点击
   */
  _handleMode150HistoryTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const btnY = SCREEN_HEIGHT - 60 * s;
    const bw = 120 * s;
    const bh = 40 * s;

    // 返回按钮
    if (x >= centerX - bw / 2 && x <= centerX + bw / 2 &&
      y >= btnY - bh / 2 && y <= btnY + bh / 2) {
      // 返回到之前的状态
      this.gameState = this._prevStateBeforeHistory || 'paused';
      return;
    }
  }

  _handleOverTap(x, y) {
    const s = SCALE;
    const centerX = SCREEN_WIDTH / 2;
    const centerY = SCREEN_HEIGHT / 2;
    const btnW = 80 * s;
    const btnH = 36 * s;
    const btnGapX = 12 * s;
    const totalBtnW = btnW * 3 + btnGapX * 2;
    const btnStartX = centerX - totalBtnW / 2 + btnW / 2;
    const btnY = centerY + 55 * s;

    // 重试
    if (x >= btnStartX - btnW / 2 && x <= btnStartX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      this.initLevel(this.stage);
      return;
    }

    // 菜单
    const menuX = btnStartX + btnW + btnGapX;
    if (x >= menuX - btnW / 2 && x <= menuX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      if (this.onBackToMenu) this.onBackToMenu();
      return;
    }

    // 分享
    const shareX = btnStartX + (btnW + btnGapX) * 2;
    if (x >= shareX - btnW / 2 && x <= shareX + btnW / 2 &&
      y >= btnY - btnH / 2 && y <= btnY + btnH / 2) {
      this._doShareToGroup();
      return;
    }
  }
}
