import './render';
import DataBus from './databus';
import LevelSelect from './scene/levelSelect';
import GameScene from './scene/gameScene';
import { SCREEN_WIDTH, SCREEN_HEIGHT, DPR } from './render';

// ============ 开发调试开�?============
// 设置�?false 则不生成 dev 调试工具（提升性能、避免误触）
const DEV_ENABLED = true; // �?改这里：true=开�?/ false=关闭
// ================================================

// 条件导入 devLog
let DevLog = null;
if (DEV_ENABLED) {
  DevLog = require('./runtime/devLog').default;
}

const ctx = canvas.getContext('2d');

// 高清适配：缩�?context，后续所有绘图坐标使用逻辑像素
