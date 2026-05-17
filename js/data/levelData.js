import { TOTAL_LEVELS } from '../config';

/**
 * 关卡数据模块
 * 包含每关的固定配置参数和玩家进度数据
 */

/**
 * 生成关卡固定参数
 * @param {number} level - 关卡号（从1开始）
 * @returns 关卡配置对象
 */
function generateLevelConfig(level) {
  // HP基础值：随关卡线性增长
  const baseHp = Math.max(1, Math.round(level * 1.5));

  // 砖块填充率：0.4 → 0.7 逐渐增加
  const fillRate = Math.min(0.7, 0.4 + level * 0.005);

  // 初始行数：前10关2行，之后3行
  const initRows = level <= 10 ? 2 : 3;

  // 三角砖块概率：从第5关开始出现，逐渐增加
  const triangleRate = level < 5 ? 0 : Math.min(0.15, 0.03 + (level - 5) * 0.003);

  // 每行道具数量
  const pickupMin = 1;
  const pickupMax = level < 20 ? 2 : 1;

  // 球速加速阈值（帧数）：越往后越早加速
  const speedBoostFrame1 = Math.max(600, 900 - level * 5);  // 第一次加速
  const speedBoostFrame2 = speedBoostFrame1 + Math.max(600, 900 - level * 5); // 第二次加速

  return {
    level,
    baseHp,
    fillRate,
    initRows,
    triangleRate,
    pickupMin,
    pickupMax,
    speedBoostFrame1,
    speedBoostFrame2,
  };
}

/**
 * 全部关卡配置表（预生成）
 */
export const LEVEL_CONFIGS = [];
for (let i = 1; i <= TOTAL_LEVELS; i++) {
  LEVEL_CONFIGS.push(generateLevelConfig(i));
}

/**
 * 获取指定关卡配置
 */
export function getLevelConfig(levelNum) {
  const idx = Math.max(0, Math.min(LEVEL_CONFIGS.length - 1, levelNum - 1));
  return LEVEL_CONFIGS[idx];
}

// ====== 玩家关卡进度数据 ======

const STORAGE_KEY = 'ppq_level_progress';

/**
 * 关卡进度管理
 * 每关: { unlocked: bool, stars: 0-3 }
 */
export class LevelProgress {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = wx.getStorageSync(STORAGE_KEY);
      if (raw && raw.length === TOTAL_LEVELS) return raw;
    } catch (e) { /* ignore */ }
    return this._createDefault();
  }

  _createDefault() {
    const data = [];
    for (let i = 0; i < TOTAL_LEVELS; i++) {
      data.push({ unlocked: i === 0, stars: 0 });
    }
    return data;
  }

  save() {
    try {
      wx.setStorageSync(STORAGE_KEY, this.data);
    } catch (e) { /* ignore */ }
  }

  get(levelNum) {
    return this.data[Math.max(0, levelNum - 1)] || { unlocked: false, stars: 0 };
  }

  isUnlocked(levelNum) {
    return this.get(levelNum).unlocked;
  }

  getStars(levelNum) {
    return this.get(levelNum).stars;
  }

  /**
   * 通关更新：设置星级 + 解锁下一关
   */
  completeLevel(levelNum, stars) {
    const idx = levelNum - 1;
    if (idx < 0 || idx >= TOTAL_LEVELS) return;

    // 更新星级（取最大值）
    this.data[idx].stars = Math.max(this.data[idx].stars, Math.min(3, stars));

    // 解锁下一关
    if (idx + 1 < TOTAL_LEVELS) {
      this.data[idx + 1].unlocked = true;
    }

    this.save();
  }

  /**
   * 解锁指定关卡
   */
  unlock(levelNum) {
    const idx = levelNum - 1;
    if (idx >= 0 && idx < TOTAL_LEVELS) {
      this.data[idx].unlocked = true;
      this.save();
    }
  }

  /**
   * 获取最高已解锁关卡号
   */
  getMaxUnlocked() {
    for (let i = TOTAL_LEVELS - 1; i >= 0; i--) {
      if (this.data[i].unlocked) return i + 1;
    }
    return 1;
  }

  /**
   * 获取全部数据（供 levelSelect 渲染用）
   */
  getAllData() {
    return this.data;
  }
}
