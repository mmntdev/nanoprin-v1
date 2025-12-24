/**
 * モーションセンサー管理クラス
 * 加速度センサー、タップ、マウス移動を統一的に扱う
 */
class MotionSensor {
    constructor(callback) {
        this.callback = callback;
        this.isRunning = false;
        this.lastAcceleration = { x: 0, y: 0 };

        // デバイスの向きを考慮
        this.orientation = window.orientation || 0;

        // マウス/タッチの前回位置
        this.lastMousePosition = null;
        this.mouseVelocity = { x: 0, y: 0 };

        // 自動揺れ用タイマー
        this.autoSwayInterval = null;
        this.autoSwayStartTime = 0;

        // 自動/手動/センサーの有効フラグ
        this.autoEnabled = false;
        this.manualEnabled = true;
        this.sensorEnabled = false;

        // 手動モード: 'global'（全体揺れ）, 'pointer'（ポインタ位置基準）, 'press'（押し込み）
        this.manualMode = 'global';

        // 自動揺れパターン
        this.autoPatterns = [
            { id: 'breath', name: '呼吸' },
            { id: 'walk', name: '歩行' },
            { id: 'run', name: '駆け足' },
            { id: 'jump', name: 'ジャンプ' },
            { id: 'shake', name: '震え' },
            { id: 'wave', name: '波打ち' },
            { id: 'kneadLeft', name: '左もみ' },
            { id: 'kneadRight', name: '右もみ' }
        ];
        this.currentPatternIndex = 0;

        // 強さ（0.5〜2.0）
        this.autoStrength = 1.0;

        // イベントハンドラを事前バインド（removeEventListenerで正しく削除するため）
        this.boundHandleDeviceMotion = this.handleDeviceMotion.bind(this);
        this.boundHandleOrientationChange = this.handleOrientationChange.bind(this);
        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleMouseDown = this.handleMouseDown.bind(this);
        this.boundHandleMouseUp = this.handleMouseUp.bind(this);
        this.boundHandleTouchStart = this.handleTouchStart.bind(this);
        this.boundHandleTouchMove = this.handleTouchMove.bind(this);
        this.boundHandleTouchEnd = this.handleTouchEnd.bind(this);
    }

    /**
     * 加速度センサーの許可を取得（iOS 13+用）
     * @returns {Promise<boolean>} - 許可が得られたかどうか
     */
    async requestPermission() {
        console.log('requestPermission called');
        console.log('DeviceMotionEvent exists:', typeof DeviceMotionEvent !== 'undefined');
        console.log('requestPermission exists:', typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function');

        // iOSのDeviceMotionEvent許可チェック
        if (typeof DeviceMotionEvent !== 'undefined' &&
            typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                console.log('Permission result:', permission);
                return permission === 'granted';
            } catch (error) {
                console.warn('加速度センサーの許可取得に失敗:', error);
                return false;
            }
        }
        // Android等では許可不要
        console.log('No permission required (Android/PC)');
        return true;
    }

    /**
     * 加速度センサーが利用可能かチェック
     * @returns {boolean}
     */
    isAccelerometerAvailable() {
        return typeof DeviceMotionEvent !== 'undefined';
    }

    /**
     * センサーの開始
     */
    start() {
        if (this.isRunning) return;
        this.isRunning = true;

        console.log('MotionSensor start()');
        console.log('Accelerometer available:', this.isAccelerometerAvailable());

        // 加速度センサーのイベントリスナー
        if (this.isAccelerometerAvailable()) {
            console.log('Adding devicemotion listener');
            window.addEventListener('devicemotion', this.boundHandleDeviceMotion);
            window.addEventListener('orientationchange', this.boundHandleOrientationChange);
        }

        // マウス操作（PC用）
        window.addEventListener('mousemove', this.boundHandleMouseMove);
        window.addEventListener('mousedown', this.boundHandleMouseDown);
        window.addEventListener('mouseup', this.boundHandleMouseUp);

        // タッチ操作
        window.addEventListener('touchstart', this.boundHandleTouchStart);
        window.addEventListener('touchmove', this.boundHandleTouchMove);
        window.addEventListener('touchend', this.boundHandleTouchEnd);
        window.addEventListener('touchcancel', this.boundHandleTouchEnd);

        // 自動揺れを開始
        this.startAutoSway();
    }

    /**
     * 自動揺れの開始
     */
    startAutoSway() {
        if (this.autoSwayInterval) return;

        this.autoSwayStartTime = Date.now();

        // 60fpsで自動揺れを生成
        this.autoSwayInterval = setInterval(() => {
            if (!this.isRunning || !this.autoEnabled) return;

            const time = (Date.now() - this.autoSwayStartTime) / 1000;
            const pattern = this.autoPatterns[this.currentPatternIndex];
            const { x, y } = this.calculatePatternForce(pattern.id, time);

            this.callback({
                type: 'auto',
                force: { x: x * this.autoStrength, y: y * this.autoStrength },
                patternId: pattern.id
            });
        }, 1000 / 60);
    }

    /**
     * パターンごとの力を計算
     */
    calculatePatternForce(patternId, time) {
        let x = 0, y = 0;

        switch (patternId) {
            case 'breath':
                // 呼吸: ゆっくりとした上下の動き
                y = Math.sin(time * 1.5) * 0.5 + Math.sin(time * 2.3) * 0.2;
                x = Math.sin(time * 1.1) * 0.1;
                break;

            case 'walk':
                // 歩行: リズミカルな上下と左右の交互揺れ
                y = Math.abs(Math.sin(time * 4)) * 0.6;
                x = Math.sin(time * 2) * 0.3;
                break;

            case 'run':
                // 駆け足: 早いリズムの上下動
                y = Math.abs(Math.sin(time * 8)) * 0.8 + Math.sin(time * 16) * 0.2;
                x = Math.sin(time * 4) * 0.4;
                break;

            case 'jump':
                // ジャンプ: 急激な上昇と落下
                const jumpCycle = (time * 1.5) % (Math.PI * 2);
                if (jumpCycle < Math.PI * 0.3) {
                    // 跳ね上がり
                    y = Math.sin(jumpCycle / 0.3 * Math.PI / 2) * 1.5;
                } else if (jumpCycle < Math.PI * 1.0) {
                    // 落下
                    y = Math.cos((jumpCycle - Math.PI * 0.3) / 0.7 * Math.PI / 2) * 1.5;
                } else {
                    // 着地の余韻
                    const t = (jumpCycle - Math.PI) / Math.PI;
                    y = Math.sin(t * Math.PI * 3) * Math.exp(-t * 3) * 0.8;
                }
                x = Math.sin(time * 2) * 0.2;
                break;

            case 'shake':
                // 震え: 細かく不規則な振動
                y = Math.sin(time * 20) * 0.3 + Math.sin(time * 27) * 0.2 + Math.sin(time * 33) * 0.15;
                x = Math.sin(time * 23) * 0.25 + Math.sin(time * 31) * 0.15;
                break;

            case 'wave':
                // 波打ち: 滑らかな波状の動き
                y = Math.sin(time * 3) * 0.6 + Math.sin(time * 5.5) * 0.3;
                x = Math.cos(time * 2.5) * 0.4 + Math.sin(time * 4) * 0.2;
                break;

            case 'kneadLeft':
                // 左もみ: 左胸が左回転（反時計回り）、右胸が右回転（時計回り）
                x = Math.cos(-time * 3) * 0.5;
                y = Math.sin(-time * 3) * 0.5;
                break;

            case 'kneadRight':
                // 右もみ: 左胸が右回転（時計回り）、右胸が左回転（反時計回り）
                x = Math.cos(time * 3) * 0.5;
                y = Math.sin(time * 3) * 0.5;
                break;
        }

        return { x, y };
    }

    /**
     * 自動揺れの停止
     */
    stopAutoSway() {
        if (this.autoSwayInterval) {
            clearInterval(this.autoSwayInterval);
            this.autoSwayInterval = null;
        }
    }

    /**
     * 自動揺れのON/OFF切り替え
     */
    toggleAuto() {
        this.autoEnabled = !this.autoEnabled;
        return this.autoEnabled;
    }

    /**
     * 自動揺れの有効/無効を設定
     * @param {boolean} enabled
     */
    setAutoEnabled(enabled) {
        this.autoEnabled = enabled;
    }

    /**
     * 手動入力のON/OFF切り替え
     */
    toggleManual() {
        this.manualEnabled = !this.manualEnabled;
        return this.manualEnabled;
    }

    /**
     * 手動入力の有効/無効を設定
     * @param {boolean} enabled
     */
    setManualEnabled(enabled) {
        this.manualEnabled = enabled;
    }

    /**
     * 手動モードを設定
     * @param {string} mode - 'global', 'pointer', 'press'
     */
    setManualMode(mode) {
        this.manualMode = mode;
    }

    /**
     * 加速度センサーの有効/無効を設定
     * @param {boolean} enabled
     */
    setSensorEnabled(enabled) {
        this.sensorEnabled = enabled;
    }

    /**
     * 手動モードを取得
     */
    getManualMode() {
        return this.manualMode;
    }

    /**
     * 自動揺れが有効か
     */
    isAutoEnabled() {
        return this.autoEnabled;
    }

    /**
     * 手動入力が有効か
     */
    isManualEnabled() {
        return this.manualEnabled;
    }

    /**
     * パターンをIDで設定
     */
    setPattern(patternId) {
        const index = this.autoPatterns.findIndex(p => p.id === patternId);
        if (index !== -1) {
            this.currentPatternIndex = index;
        }
    }

    /**
     * 現在のパターンを取得
     */
    getCurrentPattern() {
        return this.autoPatterns[this.currentPatternIndex];
    }

    /**
     * 強さを上げる
     */
    increaseStrength() {
        this.autoStrength = Math.min(2.0, this.autoStrength + 0.25);
        return this.autoStrength;
    }

    /**
     * 強さを下げる
     */
    decreaseStrength() {
        this.autoStrength = Math.max(0.25, this.autoStrength - 0.25);
        return this.autoStrength;
    }

    /**
     * 現在の強さを取得
     */
    getStrength() {
        return this.autoStrength;
    }

    /**
     * センサーの停止
     */
    stop() {
        if (!this.isRunning) return;
        this.isRunning = false;

        // 自動揺れを停止
        this.stopAutoSway();

        window.removeEventListener('devicemotion', this.boundHandleDeviceMotion);
        window.removeEventListener('orientationchange', this.boundHandleOrientationChange);
        window.removeEventListener('mousemove', this.boundHandleMouseMove);
        window.removeEventListener('mousedown', this.boundHandleMouseDown);
        window.removeEventListener('mouseup', this.boundHandleMouseUp);
        window.removeEventListener('touchstart', this.boundHandleTouchStart);
        window.removeEventListener('touchmove', this.boundHandleTouchMove);
        window.removeEventListener('touchend', this.boundHandleTouchEnd);
        window.removeEventListener('touchcancel', this.boundHandleTouchEnd);
    }

    /**
     * デバイスモーションイベントの処理
     * @param {DeviceMotionEvent} event
     */
    handleDeviceMotion(event) {
        if (!this.isRunning || !this.sensorEnabled) return;

        const acc = event.accelerationIncludingGravity;
        if (!acc) {
            console.log('No acceleration data');
            return;
        }
        console.log('Acceleration:', acc.x, acc.y, acc.z);

        // デバイスの向きに応じて軸を調整
        let x = acc.x || 0;
        let y = acc.y || 0;

        // 画面の向きに応じて補正
        switch (this.orientation) {
            case 90:
                [x, y] = [-y, x];
                break;
            case -90:
                [x, y] = [y, -x];
                break;
            case 180:
                [x, y] = [-x, -y];
                break;
        }

        // 重力成分を考慮した加速度変化を検出
        const deltaX = x - this.lastAcceleration.x;
        const deltaY = y - this.lastAcceleration.y;

        this.lastAcceleration = { x, y };

        // コールバックで通知（変化量を使用）
        this.callback({
            type: 'accelerometer',
            force: { x: deltaX * 0.5, y: deltaY * 0.5 }
        });
    }

    /**
     * 画面の向き変更時の処理
     */
    handleOrientationChange() {
        this.orientation = window.orientation || 0;
    }

    /**
     * マウス移動の処理（PC用）
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (!this.isRunning || !this.manualEnabled) return;

        const currentPosition = { x: event.clientX, y: event.clientY };

        if (this.lastMousePosition) {
            const deltaX = currentPosition.x - this.lastMousePosition.x;
            const deltaY = currentPosition.y - this.lastMousePosition.y;

            // 移動量をフィルタリング（小さすぎる動きは無視）
            if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                if (this.manualMode === 'pointer') {
                    // ポインタ位置基準モード
                    this.callback({
                        type: 'pointerMove',
                        force: { x: deltaX * 0.1, y: deltaY * 0.1 },
                        clientX: event.clientX,
                        clientY: event.clientY
                    });
                } else if (this.manualMode === 'global') {
                    // 全体揺れモード（従来動作）
                    this.callback({
                        type: 'mouse',
                        force: { x: deltaX * 0.1, y: deltaY * 0.1 }
                    });
                }
            }
        }

        this.lastMousePosition = currentPosition;
    }

    /**
     * マウスダウンの処理（押し込み開始）
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        if (!this.isRunning || !this.manualEnabled) return;

        // UIボタン上でのクリックは無視
        if (event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'LABEL' ||
            event.target.tagName === 'SELECT' ||
            event.target.tagName === 'INPUT') {
            return;
        }

        // 押し込み開始
        this.callback({
            type: 'pressStart',
            id: 0, // マウスは常にID=0
            clientX: event.clientX,
            clientY: event.clientY
        });
    }

    /**
     * マウスアップの処理（押し込み終了）
     * @param {MouseEvent} event
     */
    handleMouseUp(event) {
        if (!this.isRunning || !this.manualEnabled) return;

        // 押し込み終了
        this.callback({
            type: 'pressEnd',
            id: 0
        });
    }

    /**
     * タッチ開始の処理（押し込み開始）
     * @param {TouchEvent} event
     */
    handleTouchStart(event) {
        if (!this.isRunning || !this.manualEnabled) return;

        // UIボタン上でのタッチは無視
        if (event.target.tagName === 'BUTTON' ||
            event.target.tagName === 'LABEL' ||
            event.target.tagName === 'SELECT' ||
            event.target.tagName === 'INPUT') {
            return;
        }

        // 各タッチポイントに対して押し込み開始
        for (const touch of event.changedTouches) {
            this.callback({
                type: 'pressStart',
                id: touch.identifier,
                clientX: touch.clientX,
                clientY: touch.clientY
            });
        }

        // タッチ位置を記録（移動用）
        if (event.touches.length > 0) {
            this.lastMousePosition = {
                x: event.touches[0].clientX,
                y: event.touches[0].clientY
            };
        }
    }

    /**
     * タッチ終了の処理（押し込み終了）
     * @param {TouchEvent} event
     */
    handleTouchEnd(event) {
        if (!this.isRunning || !this.manualEnabled) return;

        // 各終了したタッチポイントに対して押し込み終了
        for (const touch of event.changedTouches) {
            this.callback({
                type: 'pressEnd',
                id: touch.identifier
            });
        }
    }

    /**
     * タッチ移動の処理
     * @param {TouchEvent} event
     */
    handleTouchMove(event) {
        if (!this.isRunning || !this.manualEnabled) return;
        if (event.touches.length === 0) return;

        const currentPosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };

        if (this.lastMousePosition) {
            const deltaX = currentPosition.x - this.lastMousePosition.x;
            const deltaY = currentPosition.y - this.lastMousePosition.y;

            if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
                if (this.manualMode === 'pointer') {
                    // ポインタ位置基準モード
                    this.callback({
                        type: 'pointerMove',
                        force: { x: deltaX * 0.15, y: deltaY * 0.15 },
                        clientX: event.touches[0].clientX,
                        clientY: event.touches[0].clientY
                    });
                } else if (this.manualMode === 'global') {
                    // 全体揺れモード（従来動作）
                    this.callback({
                        type: 'touch',
                        force: { x: deltaX * 0.15, y: deltaY * 0.15 }
                    });
                }
            }
        }

        this.lastMousePosition = currentPosition;
    }

    /**
     * 自動揺れの強さを取得
     * @returns {number}
     */
    getAutoStrength() {
        return this.autoStrength;
    }

    /**
     * 自動揺れの強さを設定
     * @param {number} value
     */
    setAutoStrength(value) {
        this.autoStrength = Math.max(0.5, Math.min(2.0, value));
    }
}
