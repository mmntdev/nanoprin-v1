/**
 * 物理シミュレーションエンジン
 * 各領域が独立して揺れる（異なる物理パラメータ）
 */
class PhysicsEngine {
    // デフォルト値
    static DEFAULTS = {
        baseStiffness: 0.08,
        baseDamping: 0.92,
        sensitivity: 4.0,
        posThreshold: 0.3,
        velThreshold: 0.05
    };

    constructor() {
        // 基本物理パラメータ
        this.baseStiffness = PhysicsEngine.DEFAULTS.baseStiffness;
        this.baseDamping = PhysicsEngine.DEFAULTS.baseDamping;
        this.mass = 1.0;
        this.sensitivity = PhysicsEngine.DEFAULTS.sensitivity;
        this.maxDisplacement = 25;

        // 微小振動抑制の閾値
        this.posThreshold = PhysicsEngine.DEFAULTS.posThreshold;
        this.velThreshold = PhysicsEngine.DEFAULTS.velThreshold;

        // グリッド密度（短辺のセル数）
        this.gridDensity = 10;

        // 実際のグリッドサイズ（縦横別）
        this.gridSizeX = 10;
        this.gridSizeY = 10;

        // 画像のアスペクト比
        this.aspectRatio = 1;

        // 各頂点の状態
        this.vertices = [];

        // 揺れ領域（複数対応）
        this.regions = [];

        // 力の履歴（遅延適用用）
        this.forceHistory = [];
        this.historyLength = 8; // 遅延フレーム数

        // 押し込み状態（複数箇所対応）
        this.pressPoints = new Map(); // id -> { x, y, depth, targetDepth }
        this.pressSpeed = 0.15; // 押し込み速度
        this.releaseSpeed = 0.08; // 離す速度

        this.initVertices();
    }

    /**
     * 画像のアスペクト比を設定
     * @param {number} width - 画像の幅
     * @param {number} height - 画像の高さ
     */
    setImageAspectRatio(width, height) {
        this.aspectRatio = width / height;
        this.calculateGridSize();
        this.initVertices();
    }

    /**
     * アスペクト比に基づいてグリッドサイズを計算
     */
    calculateGridSize() {
        if (this.aspectRatio >= 1) {
            // 横長または正方形
            this.gridSizeY = this.gridDensity;
            this.gridSizeX = Math.round(this.gridDensity * this.aspectRatio);
        } else {
            // 縦長
            this.gridSizeX = this.gridDensity;
            this.gridSizeY = Math.round(this.gridDensity / this.aspectRatio);
        }
    }

    initVertices() {
        this.vertices = [];
        for (let y = 0; y <= this.gridSizeY; y++) {
            for (let x = 0; x <= this.gridSizeX; x++) {
                this.vertices.push({
                    baseX: x / this.gridSizeX,
                    baseY: y / this.gridSizeY,
                    dx: 0,
                    dy: 0
                });
            }
        }
    }

    /**
     * 領域を追加（独立した物理パラメータを持つ）
     */
    addRegion(region) {
        const index = this.regions.length;

        // 各領域で異なるパラメータを設定
        const stiffnessVariation = 0.7 + Math.random() * 0.6; // 0.7〜1.3
        const dampingVariation = 0.95 + Math.random() * 0.1;   // 0.95〜1.05
        const delayFrames = index * 3 + Math.floor(Math.random() * 2); // 領域ごとに遅延

        this.regions.push({
            ...region,
            position: { x: 0, y: 0 },
            velocity: { x: 0, y: 0 },
            // 領域固有のパラメータ
            stiffness: this.baseStiffness * stiffnessVariation,
            damping: this.baseDamping * dampingVariation,
            delayFrames: delayFrames,
            // 振動の位相オフセット
            phaseOffset: index * Math.PI * 0.3
        });
    }

    setRegions(regions) {
        this.regions = [];
        this.forceHistory = [];
        for (const r of regions) {
            this.addRegion(r);
        }
    }

    clearRegions() {
        this.regions = [];
        this.forceHistory = [];
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

    calculateRegionInfluence(px, py, region) {
        const { x, y, width, height } = region;

        const cx = x + width / 2;
        const cy = y + height / 2;

        const rx = (px - cx) / (width / 2);
        const ry = (py - cy) / (height / 2);

        const ellipseDist = Math.sqrt(rx * rx + ry * ry);

        const fadeStart = 0.6;
        const fadeEnd = 1.5;

        let influence;
        if (ellipseDist < fadeStart) {
            influence = Math.exp(-ellipseDist * ellipseDist * 0.5);
        } else {
            const t = (ellipseDist - fadeStart) / (fadeEnd - fadeStart);
            const smoothT = Math.max(0, 1 - t * t * t);
            const centerValue = Math.exp(-fadeStart * fadeStart * 0.5);
            influence = centerValue * smoothT;
        }

        const verticalBias = 1.0 + (cy - py) * 0.5;
        influence *= Math.max(0.5, Math.min(1.5, verticalBias));

        return influence;
    }

    setParams(params) {
        if (params.stiffness !== undefined) this.baseStiffness = params.stiffness;
        if (params.damping !== undefined) this.baseDamping = params.damping;
        if (params.mass !== undefined) this.mass = params.mass;
        if (params.sensitivity !== undefined) this.sensitivity = params.sensitivity;
        if (params.maxDisplacement !== undefined) this.maxDisplacement = params.maxDisplacement;
        if (params.gridSize !== undefined) {
            this.gridDensity = params.gridSize;
            this.calculateGridSize();
            this.initVertices();
        }
    }

    /**
     * 外力を適用して全領域を更新
     * @param {Object} force - 力 {x, y}
     * @param {string} patternId - パターンID（オプション）
     */
    update(force, patternId) {
        // 押し込み状態を更新
        this.updatePressState();

        const forceX = (force.x || 0) * this.sensitivity;
        const forceY = (force.y || 0) * this.sensitivity;

        // 力の履歴を更新（パターンIDも含める）
        this.forceHistory.unshift({ x: forceX, y: forceY, patternId: patternId });
        if (this.forceHistory.length > this.historyLength) {
            this.forceHistory.pop();
        }

        // 各領域を独立して更新
        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];

            // 遅延した力を取得
            const delayIndex = Math.min(region.delayFrames, this.forceHistory.length - 1);
            const delayedForce = this.forceHistory[delayIndex] || { x: 0, y: 0, patternId: null };

            // もみもみパターンの場合、奇数番目の領域（右胸）は逆回転
            let appliedForceX = delayedForce.x;
            let appliedForceY = delayedForce.y;
            if (delayedForce.patternId === 'kneadLeft' || delayedForce.patternId === 'kneadRight') {
                if (i % 2 === 1) {
                    // 奇数番目の領域（右胸）は逆回転（X軸を反転）
                    appliedForceX = -appliedForceX;
                }
            }

            // バネ力（領域固有のstiffness）
            const springForceX = -region.stiffness * region.position.x;
            const springForceY = -region.stiffness * region.position.y;

            // 減衰力（領域固有のdamping）
            const dampingForceX = -region.damping * region.velocity.x;
            const dampingForceY = -region.damping * region.velocity.y;

            // 加速度（適用する力を使用）
            const ax = (springForceX + dampingForceX + appliedForceX) / this.mass;
            const ay = (springForceY + dampingForceY + appliedForceY) / this.mass;

            // 速度更新
            region.velocity.x += ax;
            region.velocity.y += ay;

            // 位置更新
            region.position.x += region.velocity.x;
            region.position.y += region.velocity.y;

            // 制限
            region.position.x = this.clamp(region.position.x, -this.maxDisplacement, this.maxDisplacement);
            region.position.y = this.clamp(region.position.y, -this.maxDisplacement, this.maxDisplacement);

            // 微小振動の抑制: 位置と速度が十分小さければゼロにする
            if (Math.abs(region.position.x) < this.posThreshold && Math.abs(region.velocity.x) < this.velThreshold) {
                region.position.x = 0;
                region.velocity.x = 0;
            }
            if (Math.abs(region.position.y) < this.posThreshold && Math.abs(region.velocity.y) < this.velThreshold) {
                region.position.y = 0;
                region.velocity.y = 0;
            }
        }

        return this.calculateVertexDisplacements();
    }

    calculateVertexDisplacements() {
        const result = [];

        // 微小振動を抑制するための閾値
        const threshold = 0.3;

        for (const v of this.vertices) {
            let totalDx = 0;
            let totalDy = 0;
            let totalWeight = 0;

            for (const region of this.regions) {
                const influence = this.calculateRegionInfluence(v.baseX, v.baseY, region);

                if (influence > 0.001) {
                    totalDx += region.position.x * influence;
                    totalDy += region.position.y * influence;
                    totalWeight += influence;
                }
            }

            // 各押し込みポイントからの変形を追加（領域内のみ）
            for (const [id, point] of this.pressPoints) {
                if (point.depth > 0.001) {
                    // この頂点が領域内にあるかチェック
                    let regionInfluence = 0;
                    for (const region of this.regions) {
                        regionInfluence = Math.max(regionInfluence, this.calculateRegionInfluence(v.baseX, v.baseY, region));
                    }

                    // 領域内でない場合はスキップ
                    if (regionInfluence < 0.01) continue;

                    // 押し込み位置からの距離
                    const dx = v.baseX - point.x;
                    const dy = v.baseY - point.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // 影響範囲（距離に応じてガウス的に減衰）
                    const radius = 0.15; // 影響半径
                    const pressInfluence = Math.exp(-(dist * dist) / (2 * radius * radius));

                    if (pressInfluence > 0.01) {
                        // 押し込みによる変形量（最大15ピクセル）
                        const pressDisplacement = point.depth * 15;

                        // 領域の影響度も加味
                        const combinedInfluence = pressInfluence * regionInfluence;

                        // 押し込み位置から外側に広がる効果
                        if (dist > 0.001) {
                            const normalX = dx / dist;
                            const normalY = dy / dist;
                            // 外側に押し出す
                            totalDx += normalX * pressDisplacement * combinedInfluence * 0.5;
                            totalDy += normalY * pressDisplacement * combinedInfluence * 0.3;
                        }

                        // 中心は凹む
                        const centerInfluence = Math.exp(-(dist * dist) / (2 * (radius * 0.5) * (radius * 0.5)));
                        totalDy += pressDisplacement * centerInfluence * regionInfluence * 0.3;
                    }
                }
            }

            // 微小な変位を0に丸める（振動抑制）
            if (Math.abs(totalDx) < threshold) totalDx = 0;
            if (Math.abs(totalDy) < threshold) totalDy = 0;

            result.push({
                x: v.baseX,
                y: v.baseY,
                dx: totalDx,
                dy: totalDy,
                influence: totalWeight
            });
        }

        return result;
    }

    /**
     * 押し込みを開始（位置指定）
     * @param {number} id - 押し込みポイントのID（マウス=0、タッチ=タッチID）
     * @param {number} x - 正規化されたX座標（0〜1）
     * @param {number} y - 正規化されたY座標（0〜1）
     */
    startPress(id, x, y) {
        this.pressPoints.set(id, {
            x: x,
            y: y,
            depth: 0,
            targetDepth: 1.0
        });
    }

    /**
     * 押し込み位置を更新
     * @param {number} id - 押し込みポイントのID
     * @param {number} x - 正規化されたX座標（0〜1）
     * @param {number} y - 正規化されたY座標（0〜1）
     */
    updatePressPosition(id, x, y) {
        const point = this.pressPoints.get(id);
        if (point) {
            point.x = x;
            point.y = y;
        }
    }

    /**
     * 押し込みを終了（離す）
     * @param {number} id - 押し込みポイントのID
     */
    endPress(id) {
        const point = this.pressPoints.get(id);
        if (point) {
            // 離したときに揺れを発生させる（押し込みの深さに応じた衝撃）
            const releaseMagnitude = point.depth * 8;

            // 押し込み位置に近い領域に影響を与える
            for (const region of this.regions) {
                const cx = region.x + region.width / 2;
                const cy = region.y + region.height / 2;

                // 押し込み位置と領域中心の距離
                const dx = point.x - cx;
                const dy = point.y - cy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // 距離に応じた影響（近いほど強い）
                const influence = Math.max(0, 1 - dist * 2);
                if (influence > 0) {
                    // 押し込み位置から外側に向かう反発力
                    const angle = Math.atan2(cy - point.y, cx - point.x);
                    const randomOffset = (Math.random() - 0.5) * 0.3;
                    region.velocity.x += Math.cos(angle + randomOffset) * releaseMagnitude * influence * 0.5;
                    region.velocity.y += Math.sin(angle + randomOffset) * releaseMagnitude * influence * 0.5;
                    // 上方向への反発も追加
                    region.velocity.y -= releaseMagnitude * influence * 0.8;
                }
            }

            // ポイントを削除予定としてマーク
            point.targetDepth = 0;
        }
    }

    /**
     * 押し込み状態を更新
     */
    updatePressState() {
        const toDelete = [];

        for (const [id, point] of this.pressPoints) {
            if (point.targetDepth > 0) {
                // 押し込み中：目標に向かって素早く移動
                point.depth += (point.targetDepth - point.depth) * this.pressSpeed;
            } else {
                // 離し中：ゆっくり戻る
                point.depth += (point.targetDepth - point.depth) * this.releaseSpeed;
                // 非常に小さくなったら削除
                if (Math.abs(point.depth) < 0.001) {
                    toDelete.push(id);
                }
            }
        }

        // 完了したポイントを削除
        for (const id of toDelete) {
            this.pressPoints.delete(id);
        }
    }

    /**
     * 特定位置に力を適用（ポインタ位置基準の揺れ）
     * @param {Object} force - 力 {x, y}
     * @param {number} posX - 正規化されたX座標（0〜1）
     * @param {number} posY - 正規化されたY座標（0〜1）
     */
    applyForceAtPosition(force, posX, posY) {
        // 押し込み状態を更新
        this.updatePressState();

        const forceX = (force.x || 0) * this.sensitivity;
        const forceY = (force.y || 0) * this.sensitivity;

        // 各領域に対して、ポインタ位置からの距離に応じた力を適用
        for (const region of this.regions) {
            const cx = region.x + region.width / 2;
            const cy = region.y + region.height / 2;

            // ポインタ位置と領域中心の距離
            const dx = posX - cx;
            const dy = posY - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // 領域内かつ近いほど強い影響
            const influence = this.calculateRegionInfluence(posX, posY, region);
            if (influence > 0.01) {
                // バネ力
                const springForceX = -region.stiffness * region.position.x;
                const springForceY = -region.stiffness * region.position.y;

                // 減衰力
                const dampingForceX = -region.damping * region.velocity.x;
                const dampingForceY = -region.damping * region.velocity.y;

                // 加速度（影響度に応じて力を調整）
                const ax = (springForceX + dampingForceX + forceX * influence) / this.mass;
                const ay = (springForceY + dampingForceY + forceY * influence) / this.mass;

                // 速度更新
                region.velocity.x += ax;
                region.velocity.y += ay;

                // 位置更新
                region.position.x += region.velocity.x;
                region.position.y += region.velocity.y;

                // 制限
                region.position.x = this.clamp(region.position.x, -this.maxDisplacement, this.maxDisplacement);
                region.position.y = this.clamp(region.position.y, -this.maxDisplacement, this.maxDisplacement);

                // 微小振動の抑制
                if (Math.abs(region.position.x) < this.posThreshold && Math.abs(region.velocity.x) < this.velThreshold) {
                    region.position.x = 0;
                    region.velocity.x = 0;
                }
                if (Math.abs(region.position.y) < this.posThreshold && Math.abs(region.velocity.y) < this.velThreshold) {
                    region.position.y = 0;
                    region.velocity.y = 0;
                }
            }
        }

        return this.calculateVertexDisplacements();
    }

    /**
     * 衝撃を与える（各領域に異なるタイミングで）
     */
    applyImpulse(impulse) {
        const ix = (impulse.x || 0) * this.sensitivity * 5;
        const iy = (impulse.y || 0) * this.sensitivity * 5;

        for (let i = 0; i < this.regions.length; i++) {
            const region = this.regions[i];

            // 領域ごとに異なる方向と強さ
            const angle = region.phaseOffset + Math.random() * 0.5;
            const magnitude = 0.7 + Math.random() * 0.6;

            // 回転を加えた衝撃
            const rotatedX = ix * Math.cos(angle) - iy * Math.sin(angle) * 0.3;
            const rotatedY = iy * Math.cos(angle) + ix * Math.sin(angle) * 0.3;

            region.velocity.x += rotatedX * magnitude;
            region.velocity.y += rotatedY * magnitude;
        }
    }

    reset() {
        for (const region of this.regions) {
            region.position = { x: 0, y: 0 };
            region.velocity = { x: 0, y: 0 };
        }
        for (const v of this.vertices) {
            v.dx = 0;
            v.dy = 0;
        }
        this.forceHistory = [];
    }

    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    getDisplacements() {
        return this.calculateVertexDisplacements();
    }

    getGridSize() {
        return this.gridDensity;
    }

    getGridDensity() {
        return this.gridDensity;
    }

    setGridDensity(density) {
        this.gridDensity = Math.max(5, Math.min(40, density));
        this.calculateGridSize();
        this.initVertices();
    }

    getGridSizeX() {
        return this.gridSizeX;
    }

    getGridSizeY() {
        return this.gridSizeY;
    }

    getRegionCount() {
        return this.regions.length;
    }

    /**
     * 物理パラメータを取得
     */
    getPhysicsParams() {
        return {
            baseStiffness: this.baseStiffness,
            baseDamping: this.baseDamping,
            sensitivity: this.sensitivity,
            posThreshold: this.posThreshold,
            velThreshold: this.velThreshold
        };
    }

    /**
     * 物理パラメータを設定
     */
    setPhysicsParams(params) {
        if (params.baseStiffness !== undefined) this.baseStiffness = params.baseStiffness;
        if (params.baseDamping !== undefined) this.baseDamping = params.baseDamping;
        if (params.sensitivity !== undefined) this.sensitivity = params.sensitivity;
        if (params.posThreshold !== undefined) this.posThreshold = params.posThreshold;
        if (params.velThreshold !== undefined) this.velThreshold = params.velThreshold;

        // 既存の領域にも反映（dampingとstiffnessのバリエーション付き）
        for (const region of this.regions) {
            const stiffnessVariation = 0.7 + Math.random() * 0.6;
            const dampingVariation = 0.95 + Math.random() * 0.1;
            region.stiffness = this.baseStiffness * stiffnessVariation;
            region.damping = this.baseDamping * dampingVariation;
        }
    }

    /**
     * デフォルト値にリセット
     */
    resetToDefaults() {
        this.baseStiffness = PhysicsEngine.DEFAULTS.baseStiffness;
        this.baseDamping = PhysicsEngine.DEFAULTS.baseDamping;
        this.sensitivity = PhysicsEngine.DEFAULTS.sensitivity;
        this.posThreshold = PhysicsEngine.DEFAULTS.posThreshold;
        this.velThreshold = PhysicsEngine.DEFAULTS.velThreshold;

        // 既存の領域にも反映
        for (const region of this.regions) {
            const stiffnessVariation = 0.7 + Math.random() * 0.6;
            const dampingVariation = 0.95 + Math.random() * 0.1;
            region.stiffness = this.baseStiffness * stiffnessVariation;
            region.damping = this.baseDamping * dampingVariation;
        }
    }
}
