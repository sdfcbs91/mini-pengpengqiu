import Brick from './brick';
import Pickup from './pickup';
import Plank from './plank';
import Warp from './warp';
import RowClear from './rowClear';
import ColClear from './colClear';
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
    this.rowClears = [];        // 消单行道具
    this.colClears = [];        // 消单列道具
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
    this.rowClears = [];
    this.colClears = [];
    this.levelConfig = getLevelConfig(stage);
    this.gapCol = -1;
    this.gapColLife = 0;
    this.rowCounter = 0;

    // 初始保留空列（整局保持，让球有通道可钻）
    this.reservedEmptyCol = Math.floor(Math.random() * GRID_COLS);

    // 尝试使用预设模板（每5关使用一次，增加趣味性）
    if (stage >= 3 && stage % 5 === 0 && this._applyTemplate(stage)) {
      return; // 模板已生成初始布局
    }

    // 初始行数 = 配置值 + 1 + 关卡/20（渐进增加）
    const baseRows = this.levelConfig.initRows;
    const rows = Math.min(baseRows + 1 + Math.floor(stage / 20), 8);
    // 从第1行开始生成（第0行留空，给球顶部弹跳空间）
    for (let i = 0; i < rows; i++) {
      this.generateRow(stage - i, i + 1);
    }
  }

  /**
   * 预设地图模板（保证至少一条通道到顶部）
   * 0=空, 1=普通砖块, 2=高HP砖块
   * 第0行始终留空
   */
  _applyTemplate(stage) {
    // 预设模板：每个保证至少1条从底部到顶部的垂直/斜向通道（0列始终贯通）
    // 0=空, 1=普通, 2=高HP
    // 9行（row0空+8行砖块），7列
    const templates = [
      // 中央通道 + 两翼密集
      {
        map: [
          [0,0,0,0,0,0,0],
          [1,1,1,0,1,1,1],
          [2,1,1,0,1,1,2],
          [1,2,1,0,1,2,1],
          [1,1,2,0,2,1,1],
          [2,1,1,0,1,1,2],
          [1,2,1,0,1,2,1],
          [1,1,1,0,1,1,1],
          [2,2,1,0,1,2,2],
        ],
      },
      // 左通道（col0始终空）
      {
        map: [
          [0,0,0,0,0,0,0],
          [0,1,1,1,1,1,1],
          [0,2,1,1,1,2,1],
          [0,1,2,1,1,1,2],
          [0,1,1,2,1,2,1],
          [0,2,1,1,2,1,1],
          [0,1,2,1,1,1,2],
          [0,1,1,1,2,1,1],
          [0,2,1,2,1,2,1],
        ],
      },
      // 右通道（col6始终空）
      {
        map: [
          [0,0,0,0,0,0,0],
          [1,1,1,1,1,1,0],
          [1,2,1,1,2,1,0],
          [2,1,2,1,1,2,0],
          [1,1,1,2,1,1,0],
          [1,2,1,1,2,1,0],
          [2,1,1,1,1,2,0],
          [1,1,2,1,2,1,0],
          [1,2,1,2,1,1,0],
        ],
      },
      // 双通道（col1和col5空）
      {
        map: [
          [0,0,0,0,0,0,0],
          [1,0,1,1,1,0,1],
          [2,0,2,1,2,0,2],
          [1,0,1,2,1,0,1],
          [2,0,1,1,1,0,2],
          [1,0,2,1,2,0,1],
          [2,0,1,2,1,0,2],
          [1,0,1,1,1,0,1],
          [2,0,2,1,2,0,2],
        ],
      },
      // S形通道（col3为空的S弯道）
      {
        map: [
          [0,0,0,0,0,0,0],
          [1,1,1,0,0,1,1],
          [1,2,0,0,1,2,1],
          [2,0,0,1,1,1,2],
          [0,0,1,1,2,1,1],
          [0,1,1,2,1,0,0],
          [1,1,2,1,0,0,1],
          [1,2,1,0,0,1,2],
          [2,1,0,0,1,1,1],
        ],
      },
      // 棋盘格（间隔空=多条微通道）
      {
        map: [
          [0,0,0,0,0,0,0],
          [1,0,1,0,1,0,1],
          [0,2,0,2,0,2,0],
          [1,0,1,0,1,0,1],
          [0,2,0,2,0,2,0],
          [1,0,1,0,1,0,1],
          [0,2,0,2,0,2,0],
          [1,0,1,0,1,0,1],
          [0,1,0,1,0,1,0],
        ],
      },
    ];

    const template = templates[Math.floor(Math.random() * templates.length)];
    const cfg = this.levelConfig || getLevelConfig(stage);
    const baseHp = Math.round((cfg.baseHp || stage * 1.5) * 0.95);

    for (let row = 0; row < template.map.length && row < 10; row++) {
      for (let col = 0; col < GRID_COLS && col < template.map[row].length; col++) {
        const cell = template.map[row][col];
        if (cell === 0) continue;

        const hp = cell === 2 ? Math.round(baseHp * 1.5) : baseHp;
        const brick = new Brick();
        brick.init(
          row, col,
          this.getColX(col),
          this.getRowY(row),
          BRICK_W, BRICK_H,
          hp, 'normal', ''
        );
        this.bricks.push(brick);
      }
    }

    // 在空位上随机放置道具
    this._spawnTemplateProps(template.map, stage);

    return true;
  }

  /**
   * 在模板空位上随机放置道具（消行、消列、白洞、横板）
   */
  _spawnTemplateProps(map, stage) {
    // 收集所有空位（排除第0行）
    const emptyCells = [];
    for (let row = 1; row < map.length && row < 10; row++) {
      for (let col = 0; col < GRID_COLS && col < map[row].length; col++) {
        if (map[row][col] === 0) {
          emptyCells.push({ row, col });
        }
      }
    }

    if (emptyCells.length < 3) return;

    // 随机打乱空位
    for (let i = emptyCells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
    }

    let idx = 0;

    // 放1-2个消单行
    const rowClearCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < rowClearCount && idx < emptyCells.length; i++, idx++) {
      const { row, col } = emptyCells[idx];
      const rc = new RowClear();
      rc.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(row) + BRICK_H / 2,
        row
      );
      this.rowClears.push(rc);
    }

    // 放1-2个消单列
    const colClearCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < colClearCount && idx < emptyCells.length; i++, idx++) {
      const { row, col } = emptyCells[idx];
      const cc = new ColClear();
      cc.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(row) + BRICK_H / 2,
        col
      );
      this.colClears.push(cc);
    }

    // 放0-1个空心白洞（第18关起）
    if (stage >= 18 && idx < emptyCells.length) {
      const { row, col } = emptyCells[idx]; idx++;
      const warp = new Warp();
      warp.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(row) + BRICK_H / 2
      );
      this.warps.push(warp);
    }

    // 放1-2个横板（第5关起，不能放在贯通通道列上）
    if (stage >= 5) {
      // 找出贯通列（整列在模板中全为0的列=通道，不能放横板）
      const throughCols = new Set();
      for (let col = 0; col < GRID_COLS; col++) {
        let allEmpty = true;
        for (let row = 1; row < map.length; row++) {
          if (map[row] && map[row][col] !== 0) { allEmpty = false; break; }
        }
        if (allEmpty) throughCols.add(col);
      }

      // 从剩余空位中找非通道列的位置放横板
      const plankCandidates = [];
      for (; idx < emptyCells.length; idx++) {
        const { row, col } = emptyCells[idx];
        if (!throughCols.has(col)) {
          plankCandidates.push({ row, col });
        }
      }

      const plankCount = Math.min(1 + Math.floor(Math.random() * 2), plankCandidates.length);
      for (let i = 0; i < plankCount; i++) {
        const { row, col } = plankCandidates[i];
        const plank = new Plank();
        plank.init(row, col, this.getColX(col), this.getRowY(row));
        this.planks.push(plank);
      }
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
    // 每新一轮砖块 HP 提高 10%，整体降低5%平衡难度
    const hp = Math.round(baseHp * Math.pow(1.1, this.rowCounter) * 0.95);
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

    // 空心白洞生成（第18关起，概率随关卡递增）
    // 不能与砖块、加球器、横板在同一格
    const warpRate = cfg.warpRate || 0;
    const warpChance = warpRate > 0 ? Math.min(0.25, warpRate + stage * 0.001) : 0;
    let warpCol = -1;
    if (warpChance > 0 && Math.random() < warpChance) {
      const usedCols = new Set(cols); // 砖块列
      for (let i = 0; i < pickupCount; i++) usedCols.add(shuffled[i]); // 加球器列
      for (const pc of plankCols) usedCols.add(pc); // 横板列
      const warpCols = [];
      for (let c = 0; c < GRID_COLS; c++) {
        if (!usedCols.has(c)) warpCols.push(c);
      }
      if (warpCols.length > 0) {
        warpCol = warpCols[Math.floor(Math.random() * warpCols.length)];
        const warp = new Warp();
        warp.init(
          this.getColX(warpCol) + BRICK_W / 2,
          this.getRowY(rowIndex) + BRICK_H / 2
        );
        this.warps.push(warp);
      }
    }

    // 消单行道具生成（第5关起，同行必须有砖块，概率随关卡递增）
    // 不能与砖块、加球器、横板（白板）、白洞、已有消单行在同一格
    const rowClearChance = Math.min(0.30, 0.15 + stage * 0.001);
    if (stage >= 5 && cols.length > 0 && Math.random() < rowClearChance) {
      const usedCols2 = new Set(cols); // 砖块列
      for (let i = 0; i < pickupCount; i++) usedCols2.add(shuffled[i]); // 加球器列
      for (const pc of plankCols) usedCols2.add(pc); // 横板列
      if (warpCol >= 0) usedCols2.add(warpCol); // 白洞列
      // 排除同行已有的消单行
      this.rowClears.forEach(r => {
        if (r.row === rowIndex) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (Math.abs(r.x - (this.getColX(c) + BRICK_W / 2)) < 1) usedCols2.add(c);
          }
        }
      });
      const rcCols = [];
      for (let c = 0; c < GRID_COLS; c++) {
        if (!usedCols2.has(c)) rcCols.push(c);
      }
      if (rcCols.length > 0) {
        const rcCol = rcCols[Math.floor(Math.random() * rcCols.length)];
        const rc = new RowClear();
        rc.init(
          this.getColX(rcCol) + BRICK_W / 2,
          this.getRowY(rowIndex) + BRICK_H / 2,
          rowIndex
        );
        this.rowClears.push(rc);
      }
    }

    // 消单列道具生成（第7关起，该列整体必须有砖块存在）
    // 不能与本行砖块、加球器、横板、白洞、消单行在同一格
    // 每局至少保证有一个（前几行没生成则强制生成）
    const shouldGenColClear = stage >= 7 && cols.length > 0;
    const forceColClear = shouldGenColClear && this.colClears.length === 0 && this.rowCounter >= 3;
    const colClearChance = Math.min(0.25, 0.12 + stage * 0.001);
    if (shouldGenColClear && (forceColClear || Math.random() < colClearChance)) {
      // 收集所有不能放的列
      const usedCols3 = new Set(cols); // 本行砖块列不能放
      for (let i = 0; i < pickupCount; i++) usedCols3.add(shuffled[i]);
      for (const pc of plankCols) usedCols3.add(pc);
      if (warpCol >= 0) usedCols3.add(warpCol);
      this.rowClears.forEach(r => {
        if (r.row === rowIndex) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (Math.abs(r.x - (this.getColX(c) + BRICK_W / 2)) < 1) usedCols3.add(c);
          }
        }
      });
      // 找出该列整体有砖块的列（其他行存在砖块即可）
      const colsWithBricks = new Set();
      for (const b of this.bricks) {
        if (b.isAlive) colsWithBricks.add(b.col);
      }
      // 当前行的砖块列也算有砖块
      for (const c of cols) colsWithBricks.add(c);

      // 消单列放在空格且该列有砖块的位置
      const ccCols = [];
      for (let c = 0; c < GRID_COLS; c++) {
        if (!usedCols3.has(c) && colsWithBricks.has(c)) ccCols.push(c);
      }
      if (ccCols.length > 0) {
        const ccCol = ccCols[Math.floor(Math.random() * ccCols.length)];
        const cc = new ColClear();
        cc.init(
          this.getColX(ccCol) + BRICK_W / 2,
          this.getRowY(rowIndex) + BRICK_H / 2,
          ccCol
        );
        this.colClears.push(cc);
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

    // 消单行道具下移
    this.rowClears.forEach(rc => {
      if (!rc.collected) rc.moveDown(this.rowHeight);
    });

    // 消单列道具下移
    this.colClears.forEach(cc => {
      if (!cc.collected) cc.moveDown(this.rowHeight);
    });

    return gameOver;
  }

  cleanup() {
    this.bricks = this.bricks.filter(b => b.isAlive);
    this.pickups = this.pickups.filter(p => !p.collected);
    this.planks = this.planks.filter(p => p.targetY < GAME_AREA_TOP + this.rowHeight * 12);
    this.warps = this.warps.filter(w => w.active);
    this.rowClears = this.rowClears.filter(rc => !rc.collected);
    this.colClears = this.colClears.filter(cc => !cc.collected);
  }

  checkGameOver(bottomLimit) {
    return this.bricks.some(b => b.isAlive && b.y + b.height > bottomLimit);
  }

  update() {
    this.bricks.forEach(b => { if (b.isAlive) b.update(); });
    this.pickups.forEach(p => { if (!p.collected) p.update(); });
    this.planks.forEach(p => { p.update(); });
    this.warps.forEach(w => { if (w.active) w.update(); });
    this.rowClears.forEach(rc => { if (!rc.collected) rc.update(); });
    this.colClears.forEach(cc => { if (!cc.collected) cc.update(); });
  }

  render(ctx, glowPhase) {
    this.bricks.forEach(b => { b.render(ctx, glowPhase); });
    this.planks.forEach(p => { p.render(ctx, glowPhase); });
    this.warps.forEach(w => { w.render(ctx); });
    this.pickups.forEach(p => { p.render(ctx); });
    this.rowClears.forEach(rc => { rc.render(ctx); });
    this.colClears.forEach(cc => { cc.render(ctx); });
  }
}
