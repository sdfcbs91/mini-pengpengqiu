GameGlobal.canvas = wx.createCanvas();

const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();

// 设备像素比（高清屏适配核心）
// 限制最大 DPR 为 3，避免超大 canvas 影响性能
const dpr = Math.min(windowInfo.pixelRatio || 2, 3);

// 逻辑尺寸（所有游戏坐标基于此）
export const SCREEN_WIDTH = windowInfo.screenWidth;
export const SCREEN_HEIGHT = windowInfo.screenHeight;

// 安全区域信息（用于计算刘海屏/异形屏的边距）
// safeArea: { left, right, top, bottom, width, height }
const safeArea = windowInfo.safeArea || { left: 0, right: SCREEN_WIDTH, top: 0, bottom: SCREEN_HEIGHT };
export const SAFE_AREA = safeArea;

// 获取胶囊按钮位置信息（横屏模式下在右上角）
let menuButtonRect = { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
if (typeof wx !== 'undefined' && wx.getMenuButtonBoundingClientRect) {
    try {
        menuButtonRect = wx.getMenuButtonBoundingClientRect();
    } catch (e) {
        // 部分环境可能不支持，使用默认值
    }
}
export const MENU_BUTTON_RECT = menuButtonRect;

// canvas 设为物理像素尺寸，确保 1:1 像素映射
canvas.width = Math.round(SCREEN_WIDTH * dpr);
canvas.height = Math.round(SCREEN_HEIGHT * dpr);

// 导出 dpr 供其他模块使用
export const DPR = dpr;
