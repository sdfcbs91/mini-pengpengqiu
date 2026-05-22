import Brick from './brick';
import Pickup from './pickup';
import Plank from './plank';
import Warp from './warp';
import {
  GRID_COLS, BRICK_GAP, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_TOP,
} from '../config';
import { getLevelConfig } from '../data/levelData';

/**
 * 网格管理器
 * 砖块生成策略：通道+口袋式布局，让球在砖块间来回弹跳
 */
export default class Grid {
  constructor() {
    this.bricks = [];
    this.pickups = [];
    this.planks = [];
    this.warps = [];            // 空心白洞（穿越道具）
    this.rowHeight = BRICK_H + BRICK_GAP;
    this.levelConfig = null;
    this.gapCol = -1;          // 持续空列（垂直通道）
    this.gapColLife = 0;       // 通道剩余行数
    this.rowCounter = 0;       // 生成行计数器
  }

  getColX(col) {
    return GAME_AREA_LEFT + BRICK_GAP + col * (BRICK_W + BRICK_GAP);
  }

  getRowY(row) {
    return GAME_AREA_TOP + BRICK_GAP + row * this.rowHeight;
  }

  initLevel(stage) {
    this.bricks = [];
    this.pickups = [];
    this.planks = [];
    this.warps = [];
    this.levelConfig = getLevelConfig(stage);
    this.gapCol = -1;
    this.gapColLife = 0;
    this.rowCounter = 0;

    // 初始保留空列（整局保持，让球有通道可钻）
    this.reservedEmptyCol = Math.floor(Math.random() * GRID_COLS);

    // 初始行数 = 配置值 + 1 + 关卡/20（渐进增加）
    const baseRows = this.levelConfig.initRows;
    const rows = Math.min(baseRows + 1 + Math.floor(stage / 20), 8);
    for (let i = 0; i < rows; i++) {
      this.generateRow(stage - i, i);
    }
  }

  /**
   * 生成一行砖块 — 核心策略：
   * 1. 30% 概率开启/延续垂直通道（某一列持续空3~5行）
   * 2. 20% 概率生成"口袋"行（左右两侧满，中间空1~2列）
   * 3. 15% 概率生成"走廊"行（只有左右墙壁列有砖块，中间全空）
   * 4. 其余正常随机填充
   */
  generateRow(stage, rowIndex = 0) {
    const cfg = this.levelConfig || getLevelConfig(Math.max(1, stage));
    const baseHp = cfg.baseHp || Math.max(1, Math.round(stage * 1.5));
    // 每新一轮砖块 HP 提高 10%（基于已生成的行数）
    const hp = Math.round(baseHp * Math.pow(1.1, this.rowCounter));
    const triangleRate = cfg.triangleRate;
    const pickupMin = cfg.pickupMin;
    const pickupMax = cfg.pickupMax;

    this.rowCounter++;

    // 决定本行布局模式
    const roll = Math.random();
    let cols;

    if (roll < 0.15 && stage >= 5) {
      // 走廊行：左右墙壁有砖块，中间全空
      cols = this._generateCorridorRow();
    } else if (roll < 0.35 && stage >= 3) {
      // 口袋行：两侧满，中间开口
      cols = this._generatePocketRow(cfg.fillRate);
    } else {
      // 正常行（带垂直通道）
      cols = this._generateNormalRow(cfg.fillRate);
    }

    // 确保至少4个砖块（不放在保留空列）
    while (cols.length < 4) {
      const c = Math.floor(Math.random() * GRID_COLS);
      if (c !== this.reservedEmptyCol && !cols.includes(c)) cols.push(c);
    }

    // 创建砖块
    cols.forEach(col => {
      const brick = new Brick();
      const isTriangle = Math.random() < triangleRate;
      const type = isTriangle ? 'triangle' : 'normal';
      const dirs = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
      const dir = isTriangle ? dirs[Math.floor(Math.random() * dirs.length)] : '';

      brick.init(
        rowIndex, col,
        this.getColX(col),
        this.getRowY(rowIndex),
        BRICK_W, BRICK_H,
        Math.max(1, hp + Math.floor(Math.random() * 3) - 1),
        type, dir
      );
      this.bricks.push(brick);
    });

    // 道具放在空列中
    const emptyCols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (!cols.includes(c)) emptyCols.push(c);
    }
    const pickupCount = Math.min(
      emptyCols.length,
      pickupMin + Math.floor(Math.random() * (pickupMax - pickupMin + 1))
    );
    const shuffled = emptyCols.sort(() => Math.random() - 0.5);
    for (let i = 0; i < pickupCount; i++) {
      const col = shuffled[i];
      const pickup = new Pickup();
      pickup.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(rowIndex) + BRICK_H / 2
      );
      this.pickups.push(pickup);
    }

    // 横板生成（第5关起，随机在空列中放置）
    const plankRate = cfg.plankRate || 0;
    const plankCols = []; // 记录放了横板的列
    if (plankRate > 0 && emptyCols.length > pickupCount) {
      const remainCols = shuffled.slice(pickupCount);
      for (const col of remainCols) {
        if (Math.random() < plankRate) {
          const plank = new Plank();
          plank.init(rowIndex, col, this.getColX(col), this.getRowY(rowIndex));
          this.planks.push(plank);
          plankCols.push(col);
          break; // 每行最多1个横板
        }
      }
    }

    // 空心白洞生成（第18关起，概率约每关1~2个）
    // 不能与砖块、加球器、横板在同一格
    const warpRate = cfg.warpRate || 0;
    if (warpRate > 0 && Math.random() < warpRate) {
      const usedCols = new Set(cols); // 砖块列
      for (let i = 0; i < pickupCount; i++) usedCols.add(shuffled[i]); // 加球器列
      for (const pc of plankCols) usedCols.add(pc); // 横板列
      const warpCols = [];
      for (let c = 0; c < GRID_COLS; c++) {
        if (!usedCols.has(c)) warpCols.push(c);
      }
      if (warpCols.length > 0) {
        const wCol = warpCols[Math.floor(Math.random() * warpCols.length)];
        const warp = new Warp();
        warp.init(
          this.getColX(wCol) + BRICK_W / 2,
          this.getRowY(rowIndex) + BRICK_H / 2
        );
        this.warps.push(warp);
      }
    }
  }

  /**
   * 正常行 + 垂直通道
   */
  _generateNormalRow(fillRate) {
    // 管理垂直通道
    if (this.gapColLife > 0) {
      this.gapColLife--;
    } else if (Math.random() < 0.3) {
      // 开启新通道：随机选一列，持续3~5行
      this.gapCol = Math.floor(Math.random() * GRID_COLS);
      this.gapColLife = 3 + Math.floor(Math.random() * 3);
    }

    const cols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      // 保留空列始终为空
      if (c === this.reservedEmptyCol) continue;
      // 通道列强制空
      if (c === this.gapCol && this.gapColLife > 0) continue;
      if (Math.random() < fillRate) {
        cols.push(c);
      }
    }
    return cols;
  }

  /**
   * 口袋行：两侧密集，中间开1~2列口子
   * 球可以从口子钻进去在两侧墙壁间弹跳
   */
  _generatePocketRow(fillRate) {
    const gapStart = 1 + Math.floor(Math.random() * (GRID_COLS - 2));
    const gapWidth = 1 + Math.floor(Math.random() * 2);

    const cols = [];
    for (let c = 0; c < GRID_COLS; c++) {
      if (c === this.reservedEmptyCol) continue;
      if (c >= gapStart && c < gapStart + gapWidth) continue;
      if (Math.random() < Math.min(0.85, fillRate + 0.15)) {
        cols.push(c);
      }
    }
    return cols;
  }

  /**
   * 走廊行：只有边缘列有砖块，中间全空
   * 形成左右夹击的走廊，球在里面来回弹
   */
  _generateCorridorRow() {
    const reserved = this.reservedEmptyCol;
    const cols = [];
    if (0 !== reserved) cols.push(0);
    if (1 !== reserved && Math.random() < 0.6) cols.push(1);
    if (GRID_COLS - 1 !== reserved) cols.push(GRID_COLS - 1);
    if (GRID_COLS - 2 !== reserved && Math.random() < 0.6) cols.push(GRID_COLS - 2);
    return cols;
  }

  shiftDown(bottomLimit) {
    let gameOver = false;

    this.bricks.forEach(brick => {
      if (!brick.isAlive) return;
      brick.row++;
      brick.targetY += this.rowHeight;
      if (brick.targetY + brick.height > bottomLimit) {
        gameOver = true;
      }
    });

    // 横板也下移（但不触发 game over）
    this.planks.forEach(plank => {
      plank.row++;
      plank.targetY += this.rowHeight;
    });

    // 白洞也下移
    this.warps.forEach(warp => {
      if (warp.active) warp.moveDown(this.rowHeight);
    });

    this.pickups.forEach(pickup => {
      if (!pickup.collected) {
        pickup.moveDown(this.rowHeight);
      }
    });

    return gameOver;
  }

  cleanup() {
    this.bricks = this.bricks.filter(b => b.isAlive);
    this.pickups = this.pickups.filter(p => !p.collected);
    this.planks = this.planks.filter(p => p.targetY < GAME_AREA_TOP + this.rowHeight * 15);
    this.warps = this.warps.filter(w => w.active && w.targetY < GAME_AREA_TOP + this.rowHeight * 15);
  }

  checkGameOver(bottomLimit) {
    return this.bricks.some(b => b.isAlive && b.y + b.height > bottomLimit);
  }

  update() {
    this.bricks.forEach(b => { if (b.isAlive) b.update(); });
    this.pickups.forEach(p => { if (!p.collected) p.update(); });
    this.planks.forEach(p => { p.update(); });
    this.warps.forEach(w => { if (w.active) w.update(); });
  }

  render(ctx, glowPhase) {
    this.bricks.forEach(b => { b.render(ctx, glowPhase); });
    this.planks.forEach(p => { p.render(ctx, glowPhase); });
    this.warps.forEach(w => { w.render(ctx); });
    this.pickups.forEach(p => { p.render(ctx); });
  }
}
