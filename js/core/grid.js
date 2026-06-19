import Brick from './brick';
import Pickup from './pickup';
import Plank from './plank';
import Warp from './warp';
import RowClear from './rowClear';
import ColClear from './colClear';
import {
  GRID_COLS, GRID_ROWS, BRICK_GAP, BRICK_W, BRICK_H,
  GAME_AREA_LEFT, GAME_AREA_TOP,
} from '../config';
import { getLevelConfig } from '../data/levelData';
import { ROW_PATTERNS, MULTI_ROW_TEMPLATES, MULTI_ROW_TEMPLATE_NAMES, LEVEL_TEMPLATES } from '../data/patternData';

// =====================================================================
// 砖块行生成 - 可用列范围（最左/最右列强制留空，方便球边墙反弹）
// GRID_COLS = 12，可用列为 1~10（共 10 列）
// =====================================================================
const USABLE_COL_MIN = 1;
const USABLE_COL_MAX = GRID_COLS - 2;  // = 10

/**
 * 从预设图形中随机选一个并做轻微扰动
 * - 70% 概率保留该图形所有列
 * - 30% 概率每列独立 85% 保留率（产生轻微变化）
 * 总是返回 col 数组（保证全部在 USABLE_COL_MIN ~ USABLE_COL_MAX 之间）
 */
function pickRandomRowPattern() {
  const base = ROW_PATTERNS[Math.floor(Math.random() * ROW_PATTERNS.length)];
  if (Math.random() < 0.7) return [...base];
  return base.filter(() => Math.random() < 0.85);
}

/**
 * 网格管理器
 * 砖块生成策略：从预设图形配置（patternData.js）中随机选取
 * 最左/最右列保持空（边墙反弹通道）
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

    // 初始保留空列（在可用列范围内，让球有通道可钻）
    this.reservedEmptyCol = USABLE_COL_MIN + Math.floor(Math.random() * (USABLE_COL_MAX - USABLE_COL_MIN + 1));

    // 第 3、5、10、15... 关使用预设关卡模板（精心设计的关卡）
    if (stage >= 3 && stage % 5 === 0 && this._applyTemplate(stage)) {
      return;
    }

    // 默认：从 10 种多行图形（正方形、回字、十字、漏斗等）中随机选一个铺设初始砖块
    const tplIdx = Math.floor(Math.random() * MULTI_ROW_TEMPLATES.length);
    this._applyMultiRowTemplate(stage, tplIdx);
  }

  /**
   * 应用多行预设图形模板生成初始砖块布局
   * 模板偏移到可用列（USABLE_COL_MIN ~ USABLE_COL_MAX）
   * @param {number} stage 关卡号（决定 HP）
   * @param {number} templateIdx 模板索引（0~9）
   */
  _applyMultiRowTemplate(stage, templateIdx) {
    const tpl = MULTI_ROW_TEMPLATES[templateIdx];
    if (!tpl) return false;

    // 记录当前关卡所用的地图（布局）名称，供历史记录展示
    this.templateName = MULTI_ROW_TEMPLATE_NAMES[templateIdx] || '随机地图';

    const cfg = this.levelConfig || getLevelConfig(Math.max(1, stage));
    const baseHp = cfg.baseHp || Math.max(1, Math.round(stage * 1.5));
    const triangleRate = cfg.triangleRate || 0;

    // 顶部留出 1 行空间（让球可以从顶部反弹）
    const startRow = 1;

    for (let r = 0; r < tpl.length; r++) {
      const targetRow = startRow + r;
      if (targetRow >= GRID_ROWS) break;

      const rowMap = tpl[r];
      for (let c = 0; c < rowMap.length; c++) {
        if (rowMap[c] !== 1) continue;

        // 模板列偏移到可用列起点
        const targetCol = USABLE_COL_MIN + c;
        if (targetCol > USABLE_COL_MAX) break;

        const brick = new Brick();
        const isTriangle = Math.random() < triangleRate;
        const type = isTriangle ? 'triangle' : 'normal';
        const dirs = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
        const dir = isTriangle ? dirs[Math.floor(Math.random() * dirs.length)] : '';

        brick.init(
          targetRow, targetCol,
          this.getColX(targetCol),
          this.getRowY(targetRow),
          BRICK_W, BRICK_H,
          Math.max(1, baseHp + Math.floor(Math.random() * 3) - 1),
          type, dir
        );
        this.bricks.push(brick);
      }
    }

    // 在空位中放一些加球器（每行随机 1 个，最多 2 个）
    this._sprinklePickupsAfterTemplate(tpl, startRow, cfg);

    this.rowCounter = tpl.length;
    return true;
  }

  /**
   * 在多行模板的空位中均匀撒一些加球器（避免砖块阵中找不到球路）
   */
  _sprinklePickupsAfterTemplate(tpl, startRow, cfg) {
    const pickupMin = (cfg && cfg.pickupMin) || 1;
    const pickupMax = (cfg && cfg.pickupMax) || 2;
    const totalPickups = pickupMin + Math.floor(Math.random() * (pickupMax - pickupMin + 1)) + 1;

    const emptyCells = [];
    for (let r = 0; r < tpl.length; r++) {
      const targetRow = startRow + r;
      if (targetRow >= GRID_ROWS) break;
      const rowMap = tpl[r];
      for (let c = 0; c < rowMap.length; c++) {
        if (rowMap[c] === 0) {
          emptyCells.push({ row: targetRow, col: USABLE_COL_MIN + c });
        }
      }
    }
    if (emptyCells.length === 0) return;

    // 洗牌随机取
    emptyCells.sort(() => Math.random() - 0.5);
    const placed = Math.min(totalPickups, emptyCells.length);
    for (let i = 0; i < placed; i++) {
      const { row, col } = emptyCells[i];
      const pickup = new Pickup();
      pickup.init(
        this.getColX(col) + BRICK_W / 2,
        this.getRowY(row) + BRICK_H / 2
      );
      this.pickups.push(pickup);
    }
  }


  /**
   * 预设地图模板（保证至少一条通道到顶部）
   * 数据来源：patternData.js 中的 LEVEL_TEMPLATES
   * 0=空, 1=普通砖块, 2=高HP砖块
   * 第0行始终留空
   */
  _applyTemplate(stage) {
    const template = LEVEL_TEMPLATES[Math.floor(Math.random() * LEVEL_TEMPLATES.length)];
    this.templateName = template.name || '未知阵型';  // 保存选中的模板名称
    const cfg = this.levelConfig || getLevelConfig(stage);
    const baseHp = Math.round((cfg.baseHp || stage * 1.5) * 0.76);

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
   * 在模板空位上随机放置道具
   * 规则：
   * - 横板不能放在通道路径上（贯通列或连通顶部的斜路）
   * - 消单列所在列必须有砖块，否则改为消单行
   * - 空心白洞放置在靠近砖块的位置
   */
  _spawnTemplateProps(map, stage) {
    // 找出通道列（整列全空 = 通往顶部的路）
    const throughCols = new Set();
    for (let col = 0; col < GRID_COLS; col++) {
      let allEmpty = true;
      for (let row = 1; row < map.length; row++) {
        if (map[row] && map[row][col] !== 0) { allEmpty = false; break; }
      }
      if (allEmpty) throughCols.add(col);
    }

    // 找出有砖块的列
    const colsWithBricks = new Set();
    for (let row = 1; row < map.length; row++) {
      for (let col = 0; col < GRID_COLS && col < map[row].length; col++) {
        if (map[row][col] !== 0) colsWithBricks.add(col);
      }
    }

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

    // 放1-2个消单行（放在同行有砖块的空位）
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

    // 放1-2个消单列（该列必须有砖块，否则改为消单行）
    const colClearCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < colClearCount && idx < emptyCells.length; i++, idx++) {
      const { row, col } = emptyCells[idx];
      if (colsWithBricks.has(col)) {
        // 该列有砖块，正常放消单列
        const cc = new ColClear();
        cc.init(
          this.getColX(col) + BRICK_W / 2,
          this.getRowY(row) + BRICK_H / 2,
          col
        );
        this.colClears.push(cc);
      } else {
        // 该列无砖块，改为消单行
        const rc = new RowClear();
        rc.init(
          this.getColX(col) + BRICK_W / 2,
          this.getRowY(row) + BRICK_H / 2,
          row
        );
        this.rowClears.push(rc);
      }
    }

    // 放0-1个空心白洞（第18关起，优先靠近砖块的位置）
    if (stage >= 18) {
      // 找靠近砖块的空位（相邻有砖块的空格）
      let warpCell = null;
      for (let k = idx; k < emptyCells.length; k++) {
        const { row, col } = emptyCells[k];
        // 检查上下左右是否有砖块
        const hasAdjacentBrick =
          (map[row - 1] && map[row - 1][col] !== 0) ||
          (map[row + 1] && map[row + 1][col] !== 0) ||
          (col > 0 && map[row][col - 1] !== 0) ||
          (col < GRID_COLS - 1 && map[row][col + 1] !== 0);
        if (hasAdjacentBrick) {
          warpCell = emptyCells[k];
          // 移除该元素
          emptyCells.splice(k, 1);
          break;
        }
      }
      if (!warpCell && idx < emptyCells.length) {
        warpCell = emptyCells[idx]; idx++;
      }
      if (warpCell) {
        const warp = new Warp();
        warp.init(
          this.getColX(warpCell.col) + BRICK_W / 2,
          this.getRowY(warpCell.row) + BRICK_H / 2
        );
        this.warps.push(warp);
      }
    }

    // 放1-2个横板（第5关起，不能放在通道列上，也不能放在斜向通道路径上）
    if (stage >= 5) {
      // 横板候选：非通道列 且 该行左右有砖块（说明不在斜路上）
      const plankCandidates = [];
      for (; idx < emptyCells.length; idx++) {
        const { row, col } = emptyCells[idx];
        if (throughCols.has(col)) continue; // 跳过贯通列
        // 检查该空位是否在斜路上：如果上下行同列也为空则可能是斜路
        const aboveEmpty = row > 1 && map[row - 1] && map[row - 1][col] === 0;
        const belowEmpty = row < map.length - 1 && map[row + 1] && map[row + 1][col] === 0;
        if (aboveEmpty && belowEmpty) continue; // 上下都空=垂直通道的一部分，跳过
        plankCandidates.push({ row, col });
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
   * 生成一行砖块
   * 从 10 种预设图形（ROW_PATTERNS）中随机选一个并做轻微扰动
   * 最左 / 最右列（col=0、col=GRID_COLS-1）保持空，作为球的边墙反弹通道
   */
  generateRow(stage, rowIndex = 0) {
    const cfg = this.levelConfig || getLevelConfig(Math.max(1, stage));
    const baseHp = cfg.baseHp || Math.max(1, Math.round(stage * 1.5));
    // 每新一轮砖块 HP 提高 10%，整体降低 24% 平衡难度
    const hp = Math.round(baseHp * Math.pow(1.1, this.rowCounter) * 0.76);
    const triangleRate = cfg.triangleRate;
    const pickupMin = cfg.pickupMin;
    const pickupMax = cfg.pickupMax;

    this.rowCounter++;

    // 从预设图形中随机抽取，并过滤掉边缘列（兜底，保证不会出现在 col=0/GRID_COLS-1）
    let cols = pickRandomRowPattern().filter(
      c => c >= USABLE_COL_MIN && c <= USABLE_COL_MAX && c !== this.reservedEmptyCol
    );

    // 确保至少 3 个砖块（避免空行；从可用列范围内随机补充）
    while (cols.length < 3) {
      const c = USABLE_COL_MIN + Math.floor(Math.random() * (USABLE_COL_MAX - USABLE_COL_MIN + 1));
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

    // 道具放在空列中（仅限可用列范围内，最左/最右列保持空）
    const emptyCols = [];
    for (let c = USABLE_COL_MIN; c <= USABLE_COL_MAX; c++) {
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

    // 横板生成（第5关起，随机在空列中放置，不能放在保留通道列上）
    const plankRate = cfg.plankRate || 0;
    const plankCols = []; // 记录放了横板的列
    if (plankRate > 0 && emptyCols.length > pickupCount) {
      const remainCols = shuffled.slice(pickupCount).filter(c => c !== this.reservedEmptyCol && c !== this.gapCol);
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
      for (let c = USABLE_COL_MIN; c <= USABLE_COL_MAX; c++) {
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
    if (stage >= 1 && cols.length > 0 && Math.random() < rowClearChance) {
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
      for (let c = USABLE_COL_MIN; c <= USABLE_COL_MAX; c++) {
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
      for (let c = USABLE_COL_MIN; c <= USABLE_COL_MAX; c++) {
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
   * 在指定行的空位置随机生成新砖块（用于运行中动态补充上半部分砖块）
   * 不会与已有砖块重叠：先收集该行已存在的列，仅在剩余列中随机选 2~4 个生成
   * @param {number} stage 当前关卡
   * @param {number} targetRow 目标行（0~GRID_ROWS-1）
   */
  generateBricksAtRow(stage, targetRow) {
    if (targetRow < 0 || targetRow >= GRID_ROWS) return;

    // 收集该行已被占用的列（避免砖块与已有元素重叠）
    // 包含：砖块、横板、加球器、白洞、消单行、消单列
    const usedCols = new Set();
    const targetRowY = this.getRowY(targetRow);

    // 判断给定 (x, y) 中心坐标是否落在指定 row 的格子内
    const isInTargetRow = (cy) => {
      return cy >= targetRowY && cy <= targetRowY + BRICK_H;
    };
    // 根据中心 x 坐标反推 col（加 0.5 容错四舍五入）
    const colFromCenterX = (cx) => {
      return Math.round((cx - GAME_AREA_LEFT - BRICK_GAP - BRICK_W / 2) / (BRICK_W + BRICK_GAP));
    };

    // 1) 砖块
    this.bricks.forEach(b => {
      if (b.isAlive && b.row === targetRow) usedCols.add(b.col);
    });
    // 2) 横板
    this.planks.forEach(p => {
      if (p.row === targetRow) usedCols.add(p.col);
    });
    // 3) 加球器（pickup）
    this.pickups.forEach(p => {
      if (p.collected) return;
      if (isInTargetRow(p.y)) {
        const c = colFromCenterX(p.x);
        if (c >= 0 && c < GRID_COLS) usedCols.add(c);
      }
    });
    // 4) 白洞（warp）
    this.warps.forEach(w => {
      if (!w.active) return;
      if (isInTargetRow(w.y)) {
        const c = colFromCenterX(w.x);
        if (c >= 0 && c < GRID_COLS) usedCols.add(c);
      }
    });
    // 5) 消单行（rowClear）
    this.rowClears.forEach(rc => {
      if (rc.collected) return;
      if (rc.row === targetRow || isInTargetRow(rc.y)) {
        const c = colFromCenterX(rc.x);
        if (c >= 0 && c < GRID_COLS) usedCols.add(c);
      }
    });
    // 6) 消单列（colClear）
    this.colClears.forEach(cc => {
      if (cc.collected) return;
      if (isInTargetRow(cc.y)) {
        const c = colFromCenterX(cc.x);
        if (c >= 0 && c < GRID_COLS) usedCols.add(c);
      }
    });

    // 仅在可用列范围内寻找空位（最左/最右列保持空）
    const availableCols = [];
    for (let c = USABLE_COL_MIN; c <= USABLE_COL_MAX; c++) {
      if (!usedCols.has(c)) availableCols.push(c);
    }
    if (availableCols.length === 0) return;

    const cfg = this.levelConfig || getLevelConfig(Math.max(1, stage));
    const baseHp = cfg.baseHp || Math.max(1, Math.round(stage * 1.5));
    // 随关卡逐步加 HP（轻微增长）
    const hp = Math.round(baseHp * Math.pow(1.05, this.rowCounter) * 0.76);
    const triangleRate = cfg.triangleRate || 0;
    this.rowCounter++;

    // 优先使用预设图形：取交集，使补充的砖块呈现完整图案
    const pattern = pickRandomRowPattern();
    const availableSet = new Set(availableCols);
    let selected = pattern.filter(c => availableSet.has(c));

    // 若交集太少，则从所有可用列中随机补足 2~4 个
    if (selected.length < 2) {
      const count = Math.min(availableCols.length, 2 + Math.floor(Math.random() * 3));
      selected = availableCols.sort(() => Math.random() - 0.5).slice(0, count);
    }

    selected.forEach(col => {
      const brick = new Brick();
      const isTriangle = Math.random() < triangleRate;
      const type = isTriangle ? 'triangle' : 'normal';
      const dirs = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
      const dir = isTriangle ? dirs[Math.floor(Math.random() * dirs.length)] : '';

      brick.init(
        targetRow, col,
        this.getColX(col),
        this.getRowY(targetRow),
        BRICK_W, BRICK_H,
        Math.max(1, hp + Math.floor(Math.random() * 3) - 1),
        type, dir
      );
      this.bricks.push(brick);
    });
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
    this.bricks.forEach(b => {
      // 存活砖块正常更新，已死亡但带闪电余晖的砖块仅递减计时器
      if (b.isAlive) b.update();
      else if (b.lightningTimer > 0) b.lightningTimer--;
    });
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
