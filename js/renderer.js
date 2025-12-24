/**
 * Canvas描画エンジン
 * 画像全体のメッシュ変形で境界をスムーズに揺らす
 */
class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.image = null;

        // 画像の描画情報
        this.imageRect = { x: 0, y: 0, width: 0, height: 0 };

        // 選択済み領域（複数対応）
        this.regions = [];

        // 選択中の領域
        this.selectionRect = null;
        this.isSelecting = false;
        this.selectionStart = null;

        // コールバック
        this.onRegionSelected = null;

        // 領域表示フラグ
        this.showRegions = true;

        // メッシュ表示フラグ
        this.showMesh = false;

        // バインドされたイベントハンドラ
        this.boundOnSelectionStart = this.onSelectionStart.bind(this);
        this.boundOnSelectionMove = this.onSelectionMove.bind(this);
        this.boundOnSelectionEnd = this.onSelectionEnd.bind(this);
        this.boundOnTouchSelectionStart = this.onTouchSelectionStart.bind(this);
        this.boundOnTouchSelectionMove = this.onTouchSelectionMove.bind(this);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;

        this.ctx.scale(dpr, dpr);

        if (this.image) {
            this.calculateImageRect();
            this.render(null);
        }
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    this.image = img;
                    this.calculateImageRect();
                    this.render(null);
                    resolve();
                };
                img.onerror = reject;
                img.src = e.target.result;
            };

            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Image要素から直接読み込み（プリセット復元用）
     */
    loadImageElement(img) {
        return new Promise((resolve) => {
            this.image = img;
            this.calculateImageRect();
            this.render(null);
            resolve();
        });
    }

    calculateImageRect() {
        if (!this.image) return;

        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

        const scale = Math.min(
            canvasWidth / this.image.width,
            canvasHeight / this.image.height
        );

        const width = this.image.width * scale;
        const height = this.image.height * scale;
        const x = (canvasWidth - width) / 2;
        const y = (canvasHeight - height) / 2;

        this.imageRect = { x, y, width, height };
    }

    /**
     * クライアント座標を正規化座標（0〜1）に変換
     * @param {number} clientX - クライアントX座標
     * @param {number} clientY - クライアントY座標
     * @returns {Object} - 正規化された座標 { x, y }
     */
    clientToNormalized(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();

        // キャンバス上の位置
        const canvasX = clientX - rect.left;
        const canvasY = clientY - rect.top;

        // 画像領域上の正規化座標
        const normalizedX = (canvasX - this.imageRect.x) / this.imageRect.width;
        const normalizedY = (canvasY - this.imageRect.y) / this.imageRect.height;

        return {
            x: Math.max(0, Math.min(1, normalizedX)),
            y: Math.max(0, Math.min(1, normalizedY))
        };
    }

    /**
     * 描画
     * @param {Array|null} displacements - 頂点の変位配列（画像全体）
     */
    render(displacements) {
        if (!this.image) return;

        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);

        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // 背景
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        if (!displacements || this.regions.length === 0) {
            // 領域が設定されていない場合、画像をそのまま描画
            this.ctx.drawImage(
                this.image,
                this.imageRect.x, this.imageRect.y,
                this.imageRect.width, this.imageRect.height
            );
        } else {
            // 画像全体をメッシュ変形で描画
            this.renderWithMeshDeformation(displacements);
        }

        // メッシュグリッドを表示
        if (this.showMesh && displacements) {
            this.drawMeshGrid(displacements);
        }

        // 選択済み領域を表示
        if (this.showRegions) {
            this.drawRegions();
        }

        // 選択中の領域を描画
        if (this.selectionRect) {
            this.drawSelectionRect();
        }
    }

    /**
     * 画像全体をメッシュ変形で描画
     */
    renderWithMeshDeformation(displacements) {
        const { x: imgX, y: imgY, width: imgW, height: imgH } = this.imageRect;

        // グリッドサイズを計算（縦横別）
        // displacementsから推測: 頂点数 = (gridSizeX + 1) * (gridSizeY + 1)
        // 最初の行のy座標が全て同じ頂点の数からgridSizeXを推測
        let gridSizeX = 0;
        if (displacements.length > 1) {
            const firstY = displacements[0].y;
            for (let i = 0; i < displacements.length; i++) {
                if (displacements[i].y !== firstY) {
                    gridSizeX = i - 1;
                    break;
                }
            }
        }
        if (gridSizeX === 0) gridSizeX = Math.round(Math.sqrt(displacements.length)) - 1;
        const gridSizeY = Math.round(displacements.length / (gridSizeX + 1)) - 1;

        // メッシュの各セルを三角形で描画
        for (let gy = 0; gy < gridSizeY; gy++) {
            for (let gx = 0; gx < gridSizeX; gx++) {
                const i00 = gy * (gridSizeX + 1) + gx;
                const i10 = gy * (gridSizeX + 1) + gx + 1;
                const i01 = (gy + 1) * (gridSizeX + 1) + gx;
                const i11 = (gy + 1) * (gridSizeX + 1) + gx + 1;

                const v00 = displacements[i00];
                const v10 = displacements[i10];
                const v01 = displacements[i01];
                const v11 = displacements[i11];

                // ソース座標（元画像内）
                const sx00 = v00.x * this.image.width;
                const sy00 = v00.y * this.image.height;
                const sx10 = v10.x * this.image.width;
                const sy10 = v10.y * this.image.height;
                const sx01 = v01.x * this.image.width;
                const sy01 = v01.y * this.image.height;
                const sx11 = v11.x * this.image.width;
                const sy11 = v11.y * this.image.height;

                // 描画先座標（変位を適用）
                const dx00 = imgX + v00.x * imgW + v00.dx;
                const dy00 = imgY + v00.y * imgH + v00.dy;
                const dx10 = imgX + v10.x * imgW + v10.dx;
                const dy10 = imgY + v10.y * imgH + v10.dy;
                const dx01 = imgX + v01.x * imgW + v01.dx;
                const dy01 = imgY + v01.y * imgH + v01.dy;
                const dx11 = imgX + v11.x * imgW + v11.dx;
                const dy11 = imgY + v11.y * imgH + v11.dy;

                // 上三角形
                this.drawTexturedTriangle(
                    sx00, sy00, sx10, sy10, sx01, sy01,
                    dx00, dy00, dx10, dy10, dx01, dy01
                );

                // 下三角形
                this.drawTexturedTriangle(
                    sx10, sy10, sx11, sy11, sx01, sy01,
                    dx10, dy10, dx11, dy11, dx01, dy01
                );
            }
        }
    }

    drawTexturedTriangle(
        sx0, sy0, sx1, sy1, sx2, sy2,
        dx0, dy0, dx1, dy1, dx2, dy2
    ) {
        this.ctx.save();

        // 三角形のサイズを計算（拡張量を動的に調整するため）
        const edge1 = Math.sqrt((dx1 - dx0) ** 2 + (dy1 - dy0) ** 2);
        const edge2 = Math.sqrt((dx2 - dx1) ** 2 + (dy2 - dy1) ** 2);
        const edge3 = Math.sqrt((dx0 - dx2) ** 2 + (dy0 - dy2) ** 2);
        const avgEdge = (edge1 + edge2 + edge3) / 3;

        // 三角形の重心を計算
        const cx = (dx0 + dx1 + dx2) / 3;
        const cy = (dy0 + dy1 + dy2) / 3;

        // 拡張量を三角形サイズに比例させる（大きい三角形ほど多く、最大0.8、最小0.3）
        const expand = Math.max(0.3, Math.min(0.8, avgEdge * 0.02));

        // 頂点を少し外側に拡張（隙間を埋める）- クリップ用
        const dist0 = Math.sqrt((dx0 - cx) ** 2 + (dy0 - cy) ** 2) + 0.01;
        const dist1 = Math.sqrt((dx1 - cx) ** 2 + (dy1 - cy) ** 2) + 0.01;
        const dist2 = Math.sqrt((dx2 - cx) ** 2 + (dy2 - cy) ** 2) + 0.01;

        const ex0 = dx0 + (dx0 - cx) * expand / dist0;
        const ey0 = dy0 + (dy0 - cy) * expand / dist0;
        const ex1 = dx1 + (dx1 - cx) * expand / dist1;
        const ey1 = dy1 + (dy1 - cy) * expand / dist1;
        const ex2 = dx2 + (dx2 - cx) * expand / dist2;
        const ey2 = dy2 + (dy2 - cy) * expand / dist2;

        this.ctx.beginPath();
        this.ctx.moveTo(ex0, ey0);
        this.ctx.lineTo(ex1, ey1);
        this.ctx.lineTo(ex2, ey2);
        this.ctx.closePath();
        this.ctx.clip();

        // 変換行列は元の座標で計算
        const denom = (sx0 - sx2) * (sy1 - sy2) - (sx1 - sx2) * (sy0 - sy2);

        if (Math.abs(denom) < 0.001) {
            this.ctx.restore();
            return;
        }

        const m11 = ((dx0 - dx2) * (sy1 - sy2) - (dx1 - dx2) * (sy0 - sy2)) / denom;
        const m12 = ((dx1 - dx2) * (sx0 - sx2) - (dx0 - dx2) * (sx1 - sx2)) / denom;
        const m21 = ((dy0 - dy2) * (sy1 - sy2) - (dy1 - dy2) * (sy0 - sy2)) / denom;
        const m22 = ((dy1 - dy2) * (sx0 - sx2) - (dy0 - dy2) * (sx1 - sx2)) / denom;
        const m13 = dx2 - m11 * sx2 - m12 * sy2;
        const m23 = dy2 - m21 * sx2 - m22 * sy2;

        this.ctx.transform(m11, m21, m12, m22, m13, m23);
        this.ctx.drawImage(this.image, 0, 0);

        this.ctx.restore();
    }

    /**
     * 選択済み領域を表示
     */
    drawRegions() {
        const { x: imgX, y: imgY, width: imgW, height: imgH } = this.imageRect;

        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];
            const rx = imgX + region.x * imgW;
            const ry = imgY + region.y * imgH;
            const rw = region.width * imgW;
            const rh = region.height * imgH;

            // 楕円で表示
            this.ctx.strokeStyle = '#4ecdc4';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([]);

            this.ctx.beginPath();
            this.ctx.ellipse(rx + rw/2, ry + rh/2, rw/2, rh/2, 0, 0, Math.PI * 2);
            this.ctx.stroke();

            // 番号表示
            this.ctx.fillStyle = '#4ecdc4';
            this.ctx.font = 'bold 16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`${i + 1}`, rx + rw/2, ry + rh/2 + 6);
        }
    }

    drawSelectionRect() {
        if (!this.selectionRect) return;

        const { x, y, width, height } = this.selectionRect;

        // 揺れ領域選択中は楕円・ピンク
        this.ctx.strokeStyle = '#e94560';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.ellipse(x + width/2, y + height/2, width/2, height/2, 0, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
        this.ctx.fill();

        this.ctx.setLineDash([]);
    }

    enableSelection() {
        this.canvas.addEventListener('mousedown', this.boundOnSelectionStart);
        this.canvas.addEventListener('mousemove', this.boundOnSelectionMove);
        this.canvas.addEventListener('mouseup', this.boundOnSelectionEnd);

        this.canvas.addEventListener('touchstart', this.boundOnTouchSelectionStart);
        this.canvas.addEventListener('touchmove', this.boundOnTouchSelectionMove);
        this.canvas.addEventListener('touchend', this.boundOnSelectionEnd);
    }

    disableSelection() {
        this.canvas.removeEventListener('mousedown', this.boundOnSelectionStart);
        this.canvas.removeEventListener('mousemove', this.boundOnSelectionMove);
        this.canvas.removeEventListener('mouseup', this.boundOnSelectionEnd);

        this.canvas.removeEventListener('touchstart', this.boundOnTouchSelectionStart);
        this.canvas.removeEventListener('touchmove', this.boundOnTouchSelectionMove);
        this.canvas.removeEventListener('touchend', this.boundOnSelectionEnd);
    }

    onSelectionStart(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.isSelecting = true;
        this.selectionStart = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        this.selectionRect = null;
    }

    onTouchSelectionStart(event) {
        if (event.touches.length === 0) return;
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        this.isSelecting = true;
        this.selectionStart = {
            x: event.touches[0].clientX - rect.left,
            y: event.touches[0].clientY - rect.top
        };
        this.selectionRect = null;
    }

    onSelectionMove(event) {
        if (!this.isSelecting || !this.selectionStart) return;

        const rect = this.canvas.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const currentY = event.clientY - rect.top;

        this.updateSelectionRect(currentX, currentY);
    }

    onTouchSelectionMove(event) {
        if (!this.isSelecting || !this.selectionStart) return;
        if (event.touches.length === 0) return;
        event.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const currentX = event.touches[0].clientX - rect.left;
        const currentY = event.touches[0].clientY - rect.top;

        this.updateSelectionRect(currentX, currentY);
    }

    updateSelectionRect(currentX, currentY) {
        const x = Math.min(this.selectionStart.x, currentX);
        const y = Math.min(this.selectionStart.y, currentY);
        const width = Math.abs(currentX - this.selectionStart.x);
        const height = Math.abs(currentY - this.selectionStart.y);

        this.selectionRect = { x, y, width, height };
        this.render(null);
    }

    onSelectionEnd() {
        if (!this.isSelecting) return;
        this.isSelecting = false;

        if (this.selectionRect && this.selectionRect.width > 10 && this.selectionRect.height > 10) {
            const normalizedRegion = this.pixelToNormalized(this.selectionRect);

            if (this.onRegionSelected) {
                this.onRegionSelected(normalizedRegion);
            }
        }

        this.selectionRect = null;
    }

    pixelToNormalized(rect) {
        const { x: imgX, y: imgY, width: imgW, height: imgH } = this.imageRect;

        const x = Math.max(0, Math.min(1, (rect.x - imgX) / imgW));
        const y = Math.max(0, Math.min(1, (rect.y - imgY) / imgH));
        const width = Math.max(0, Math.min(1 - x, rect.width / imgW));
        const height = Math.max(0, Math.min(1 - y, rect.height / imgH));

        return { x, y, width, height };
    }

    /**
     * 領域を追加
     */
    addRegion(region) {
        this.regions.push(region);
    }

    /**
     * 領域をクリア
     */
    clearRegions() {
        this.regions = [];
    }

    /**
     * 指定インデックスの領域を削除
     * @param {number} index - 削除する領域のインデックス
     */
    removeRegion(index) {
        if (index >= 0 && index < this.regions.length) {
            this.regions.splice(index, 1);
        }
    }

    /**
     * クリック位置が領域内かどうかを判定
     * @param {number} canvasX - キャンバス上のX座標
     * @param {number} canvasY - キャンバス上のY座標
     * @returns {number} - ヒットした領域のインデックス、なければ-1
     */
    hitTestRegion(canvasX, canvasY) {
        // 正規化座標に変換
        const normX = (canvasX - this.imageRect.x) / this.imageRect.width;
        const normY = (canvasY - this.imageRect.y) / this.imageRect.height;

        // 各領域について楕円内かチェック（逆順で上のレイヤーを優先）
        for (let i = this.regions.length - 1; i >= 0; i--) {
            const region = this.regions[i];
            const cx = region.x + region.width / 2;
            const cy = region.y + region.height / 2;
            const rx = region.width / 2;
            const ry = region.height / 2;

            // 楕円の式: (x-cx)^2/rx^2 + (y-cy)^2/ry^2 <= 1
            const dist = Math.pow((normX - cx) / rx, 2) + Math.pow((normY - cy) / ry, 2);
            if (dist <= 1) {
                return i;
            }
        }
        return -1;
    }

    /**
     * 領域数を取得
     */
    getRegionCount() {
        return this.regions.length;
    }

    /**
     * 全領域を取得
     */
    getRegions() {
        return this.regions;
    }

    hasImage() {
        return this.image !== null;
    }

    /**
     * 画像をクリア
     */
    clearImage() {
        this.image = null;
        this.imageRect = { x: 0, y: 0, width: 0, height: 0 };

        // キャンバスをクリア
        const canvasWidth = this.canvas.width / (window.devicePixelRatio || 1);
        const canvasHeight = this.canvas.height / (window.devicePixelRatio || 1);
        this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        this.ctx.fillStyle = '#16213e';
        this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    /**
     * 領域表示のon/off切り替え
     */
    toggleRegionDisplay() {
        this.showRegions = !this.showRegions;
        return this.showRegions;
    }

    /**
     * 領域表示状態を取得
     */
    isShowingRegions() {
        return this.showRegions;
    }

    /**
     * メッシュ表示のon/off切り替え
     */
    toggleMeshDisplay() {
        this.showMesh = !this.showMesh;
        return this.showMesh;
    }

    /**
     * メッシュ表示状態を取得
     */
    isShowingMesh() {
        return this.showMesh;
    }

    /**
     * メッシュグリッドを描画
     */
    drawMeshGrid(displacements) {
        if (!displacements || displacements.length === 0) return;

        const { x: imgX, y: imgY, width: imgW, height: imgH } = this.imageRect;

        // グリッドサイズを計算（縦横別）
        let gridSizeX = 0;
        if (displacements.length > 1) {
            const firstY = displacements[0].y;
            for (let i = 0; i < displacements.length; i++) {
                if (displacements[i].y !== firstY) {
                    gridSizeX = i - 1;
                    break;
                }
            }
        }
        if (gridSizeX === 0) gridSizeX = Math.round(Math.sqrt(displacements.length)) - 1;
        const gridSizeY = Math.round(displacements.length / (gridSizeX + 1)) - 1;

        this.ctx.strokeStyle = 'rgba(78, 205, 196, 0.5)';
        this.ctx.lineWidth = 1;

        // 横線
        for (let gy = 0; gy <= gridSizeY; gy++) {
            this.ctx.beginPath();
            for (let gx = 0; gx <= gridSizeX; gx++) {
                const idx = gy * (gridSizeX + 1) + gx;
                const v = displacements[idx];
                const px = imgX + v.x * imgW + v.dx;
                const py = imgY + v.y * imgH + v.dy;

                if (gx === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    this.ctx.lineTo(px, py);
                }
            }
            this.ctx.stroke();
        }

        // 縦線
        for (let gx = 0; gx <= gridSizeX; gx++) {
            this.ctx.beginPath();
            for (let gy = 0; gy <= gridSizeY; gy++) {
                const idx = gy * (gridSizeX + 1) + gx;
                const v = displacements[idx];
                const px = imgX + v.x * imgW + v.dx;
                const py = imgY + v.y * imgH + v.dy;

                if (gy === 0) {
                    this.ctx.moveTo(px, py);
                } else {
                    this.ctx.lineTo(px, py);
                }
            }
            this.ctx.stroke();
        }

        // 頂点
        this.ctx.fillStyle = 'rgba(233, 69, 96, 0.6)';
        for (const v of displacements) {
            const px = imgX + v.x * imgW + v.dx;
            const py = imgY + v.y * imgH + v.dy;
            this.ctx.beginPath();
            this.ctx.arc(px, py, 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }
}
