/**
 * ScrollView - 通用可复用滚动条模块
 * 支持触摸拖拽滚动、惯性滚动、弹性回弹、滚动条渲染
 *
 * 使用方式：
 *   const scroller = new ScrollView();
 *   scroller.setContentArea(contentTop, contentHeight, totalContentHeight);
 *   scroller.onTouchStart(y);
 *   scroller.onTouchMove(y);
 *   scroller.onTouchEnd();
 *   scroller.update();  // 每帧调用，处理惯性和回弹
 *   scroller.renderScrollBar(ctx, barX, scale);  // 渲染滚动条
 *   scroller.getScrollY();  // 获取当前滚动偏移
 */
export default class ScrollView {
    constructor() {
        // 内容区域参数
        this.contentTop = 0;       // 内容区域顶部Y坐标
        this.contentHeight = 0;    // 可视区域高度
        this.totalContentHeight = 0; // 总内容高度

        // 滚动状态
        this.scrollY = 0;          // 当前滚动偏移（<=0，向上滚动为负值）
        this.maxScroll = 0;        // 最大滚动量（负值）

        // 触摸状态
        this._touching = false;
        this._touchStartY = 0;
        this._lastTouchY = 0;
        this._velocity = 0;        // 滚动速度（用于惯性）

        // 配置
        this.friction = 0.92;      // 惯性摩擦系数
        this.elasticFactor = 0.18; // 弹性回弹系数
        this.elasticLimit = 30;    // 弹性超出限制（px）
        this.minVelocity = 0.3;    // 最小速度阈值
    }

    /**
     * 设置内容区域参数
     * @param {number} contentTop - 内容区域顶部Y坐标
     * @param {number} contentHeight - 可视区域高度
     * @param {number} totalContentHeight - 总内容高度
     */
    setContentArea(contentTop, contentHeight, totalContentHeight) {
        this.contentTop = contentTop;
        this.contentHeight = contentHeight;
        this.totalContentHeight = totalContentHeight;
        this.maxScroll = Math.min(0, contentHeight - totalContentHeight);
    }

    /**
     * 重置滚动状态
     */
    reset() {
        this.scrollY = 0;
        this._velocity = 0;
        this._touching = false;
    }

    /**
     * 获取当前滚动偏移
     */
    getScrollY() {
        return this.scrollY;
    }

    /**
     * 是否需要滚动（内容超出可视区域）
     */
    needsScroll() {
        return this.totalContentHeight > this.contentHeight;
    }

    /**
     * 触摸开始
     * @param {number} y - 触摸Y坐标
     * @returns {boolean} 是否在内容区域内
     */
    onTouchStart(y) {
        if (y >= this.contentTop && y <= this.contentTop + this.contentHeight) {
            this._touching = true;
            this._touchStartY = y;
            this._lastTouchY = y;
            this._velocity = 0;
            return true;
        }
        return false;
    }

    /**
     * 触摸移动
     * @param {number} y - 触摸Y坐标
     */
    onTouchMove(y) {
        if (!this._touching) return;

        const dy = y - this._lastTouchY;
        this.scrollY += dy;

        // 指数移动平均计算速度（更平滑的惯性）
        this._velocity = dy * 0.6 + this._velocity * 0.4;
        this._lastTouchY = y;

        // 弹性限制：允许少量超出
        if (this.scrollY > this.elasticLimit) {
            this.scrollY = this.elasticLimit;
        }
        if (this.scrollY < this.maxScroll - this.elasticLimit) {
            this.scrollY = this.maxScroll - this.elasticLimit;
        }
    }

    /**
     * 触摸结束
     */
    onTouchEnd() {
        this._touching = false;
    }

    /**
     * 每帧更新（处理惯性滚动和弹性回弹）
     * 需要在游戏主循环中每帧调用
     */
    update() {
        if (this._touching) return;

        // 惯性滚动
        if (Math.abs(this._velocity) > this.minVelocity) {
            this.scrollY += this._velocity;
            this._velocity *= this.friction;
            if (Math.abs(this._velocity) < this.minVelocity) {
                this._velocity = 0;
            }
        }

        // 弹性回弹：超出顶部
        if (this.scrollY > 0) {
            this.scrollY *= (1 - this.elasticFactor);
            this._velocity = 0;
            if (this.scrollY < 0.5) this.scrollY = 0;
        }

        // 弹性回弹：超出底部
        if (this.scrollY < this.maxScroll) {
            this.scrollY += (this.maxScroll - this.scrollY) * this.elasticFactor;
            this._velocity = 0;
            if (Math.abs(this.scrollY - this.maxScroll) < 0.5) {
                this.scrollY = this.maxScroll;
            }
        }
    }

    /**
     * 渲染滚动条
     * @param {CanvasRenderingContext2D} ctx - Canvas上下文
     * @param {number} barX - 滚动条X坐标
     * @param {number} scale - 缩放比例
     * @param {object} [options] - 可选配置
     * @param {number} [options.barWidth] - 滚动条宽度（默认 3*scale）
     * @param {string} [options.color] - 滚动条颜色（默认 rgba(255,255,255,0.25)）
     * @param {number} [options.minBarHeight] - 最小滚动条高度（默认 10*scale）
     */
    renderScrollBar(ctx, barX, scale, options = {}) {
        if (!this.needsScroll()) return;

        const s = scale;
        const barW = options.barWidth || 3 * s;
        const color = options.color || 'rgba(255,255,255,0.25)';
        const minBarH = options.minBarHeight || 10 * s;

        // 计算滚动条高度（与可视区域/总内容的比例成正比）
        const barH = Math.max(minBarH, this.contentHeight * (this.contentHeight / this.totalContentHeight));

        // 计算滚动条位置（根据当前滚动偏移）
        const scrollRange = this.totalContentHeight - this.contentHeight;
        const scrollProgress = scrollRange > 0 ? (-this.scrollY / scrollRange) : 0;
        const barY = this.contentTop + scrollProgress * (this.contentHeight - barH);

        ctx.fillStyle = color;
        ctx.fillRect(barX, barY, barW, barH);
    }

    /**
     * 判断触摸点是否在内容区域内
     * @param {number} y - 触摸Y坐标
     */
    isInContentArea(y) {
        return y >= this.contentTop && y <= this.contentTop + this.contentHeight;
    }
}
