GameGlobal.canvas = wx.createCanvas();

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

// 设备像素比（高清屏适配核心）
// 限制最大 DPR 为 3，避免超大 canvas 影响性能
const dpr = Math.min(windowInfo.pixelRatio || 2, 3);

// 逻辑尺寸（所有游戏坐标基于此）
export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;

// canvas 设为物理像素尺寸，确保 1:1 像素映射
canvas.width = Math.round(SCREEN_WIDTH * dpr);
canvas.height = Math.round(SCREEN_HEIGHT * dpr);

// 导出 dpr 供其他模块使用
export const DPR = dpr;
