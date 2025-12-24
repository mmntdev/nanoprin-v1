/**
 * nanoprin メインアプリケーション
 * 複数領域対応、境界スムーズ揺れ
 */
class App {
    constructor() {
        // DOM要素
        this.canvas = document.getElementById('mainCanvas');
        this.imageInputLabel = document.querySelector('.file-label-btn');
        this.imageInput = document.getElementById('imageInput');
        this.instruction = document.getElementById('instruction');
        this.regionCount = document.getElementById('regionCount');
        this.startBtn = document.getElementById('startBtn');
        this.autoSelect = document.getElementById('autoSelect');
        this.manualSelect = document.getElementById('manualSelect');
        this.toggleRegionBtn = document.getElementById('toggleRegionBtn');
        this.toggleMeshBtn = document.getElementById('toggleMeshBtn');
        this.savePresetBtn = document.getElementById('savePresetBtn');
        this.editRegionBtn = document.getElementById('editRegionBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.toggleUIBtn = document.getElementById('toggleUIBtn');
        this.sensorBtn = document.getElementById('sensorBtn');
        this.controls = document.getElementById('controls');

        // 加速度センサー状態
        this.sensorEnabled = false;

        // UI表示状態
        this.isUIVisible = true;

        // プリセット関連DOM
        this.loadPresetBtn = document.getElementById('loadPresetBtn');
        this.presetModal = document.getElementById('presetModal');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.presetList = document.getElementById('presetList');
        this.saveModal = document.getElementById('saveModal');
        this.closeSaveModalBtn = document.getElementById('closeSaveModalBtn');
        this.presetNameInput = document.getElementById('presetName');
        this.confirmSaveBtn = document.getElementById('confirmSaveBtn');

        // 設定モーダル関連DOM
        this.settingsBtn = document.getElementById('settingsBtn');
        this.settingsModal = document.getElementById('settingsModal');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.autoStrengthRange = document.getElementById('autoStrengthRange');
        this.autoStrengthValue = document.getElementById('autoStrengthValue');
        this.gridDensityRange = document.getElementById('gridDensityRange');
        this.gridDensityValue = document.getElementById('gridDensityValue');
        this.stiffnessRange = document.getElementById('stiffnessRange');
        this.dampingRange = document.getElementById('dampingRange');
        this.sensitivityRange = document.getElementById('sensitivityRange');
        this.posThresholdRange = document.getElementById('posThresholdRange');
        this.velThresholdRange = document.getElementById('velThresholdRange');
        this.stiffnessValue = document.getElementById('stiffnessValue');
        this.dampingValue = document.getElementById('dampingValue');
        this.sensitivityValue = document.getElementById('sensitivityValue');
        this.posThresholdValue = document.getElementById('posThresholdValue');
        this.velThresholdValue = document.getElementById('velThresholdValue');
        this.resetSettingsBtn = document.getElementById('resetSettingsBtn');

        // モジュール
        this.renderer = new Renderer(this.canvas);
        this.physics = new PhysicsEngine();
        this.motionSensor = null;
        this.storage = new Storage();

        // 現在の画像データ（Base64）
        this.currentImageData = null;

        // 状態
        this.mode = 'upload';
        this.isAnimating = false;
        this.animationId = null;

        // イベントハンドラをバインド
        this.boundHandleMotion = this.handleMotion.bind(this);
        this.boundAnimate = this.animate.bind(this);
    }

    init() {
        // 画像選択
        this.imageInput.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.loadImage(e.target.files[0]);
            }
        });

        // 開始ボタン
        this.startBtn.addEventListener('click', () => {
            this.startAnimation();
        });

        // 自動揺れセレクトボックス
        this.autoSelect.addEventListener('change', () => {
            this.changeAutoPattern();
        });

        // 手動モードセレクトボックス
        this.manualSelect.addEventListener('change', () => {
            this.changeManualMode();
        });

        // 枠表示切り替えボタン
        this.toggleRegionBtn.addEventListener('click', () => {
            this.toggleRegionDisplay();
        });

        // メッシュ表示切り替えボタン
        this.toggleMeshBtn.addEventListener('click', () => {
            this.toggleMeshDisplay();
        });

        // UI表示切り替えボタン
        this.toggleUIBtn.addEventListener('click', () => {
            this.toggleUI();
        });

        // 加速度センサーボタン
        this.sensorBtn.addEventListener('click', () => {
            this.toggleSensor();
        });

        // 保存ボタン
        this.savePresetBtn.addEventListener('click', () => {
            this.openSaveModal();
        });

        // 領域編集ボタン
        this.editRegionBtn.addEventListener('click', () => {
            this.enterEditMode();
        });

        // リセットボタン
        this.resetBtn.addEventListener('click', () => {
            this.reset();
        });

        // プリセット読み込みボタン
        this.loadPresetBtn.addEventListener('click', () => {
            this.openPresetModal();
        });

        // モーダルを閉じる
        this.closeModalBtn.addEventListener('click', () => {
            this.closePresetModal();
        });

        this.closeSaveModalBtn.addEventListener('click', () => {
            this.closeSaveModal();
        });

        // 保存確定
        this.confirmSaveBtn.addEventListener('click', () => {
            this.saveCurrentPreset();
        });

        // モーダル外クリックで閉じる
        this.presetModal.addEventListener('click', (e) => {
            if (e.target === this.presetModal) {
                this.closePresetModal();
            }
        });

        this.saveModal.addEventListener('click', (e) => {
            if (e.target === this.saveModal) {
                this.closeSaveModal();
            }
        });

        // 設定モーダル
        this.settingsBtn.addEventListener('click', () => {
            this.openSettingsModal();
        });

        this.closeSettingsBtn.addEventListener('click', () => {
            this.closeSettingsModal();
        });

        this.settingsModal.addEventListener('click', (e) => {
            if (e.target === this.settingsModal) {
                this.closeSettingsModal();
            }
        });

        // 設定スライダーのイベント
        this.autoStrengthRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.autoStrengthValue.textContent = value.toFixed(1);
            if (this.motionSensor) {
                this.motionSensor.setAutoStrength(value);
            }
        });

        this.gridDensityRange.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            this.gridDensityValue.textContent = value;
            this.physics.setGridDensity(value);
        });

        this.stiffnessRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.stiffnessValue.textContent = value.toFixed(2);
            this.physics.setPhysicsParams({ baseStiffness: value });
        });

        this.dampingRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.dampingValue.textContent = value.toFixed(2);
            this.physics.setPhysicsParams({ baseDamping: value });
        });

        this.sensitivityRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.sensitivityValue.textContent = value.toFixed(1);
            this.physics.setPhysicsParams({ sensitivity: value });
        });

        this.posThresholdRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.posThresholdValue.textContent = value.toFixed(1);
            this.physics.setPhysicsParams({ posThreshold: value });
        });

        this.velThresholdRange.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.velThresholdValue.textContent = value.toFixed(2);
            this.physics.setPhysicsParams({ velThreshold: value });
        });

        this.resetSettingsBtn.addEventListener('click', () => {
            this.resetPhysicsSettings();
        });

        // ウィンドウリサイズ対応
        window.addEventListener('resize', () => {
            this.renderer.resize();
        });

        // 領域選択完了時のコールバック
        this.renderer.onRegionSelected = (region) => {
            this.onRegionSelected(region);
        };

        // ドラッグアンドドロップで画像を読み込む
        this.setupDragAndDrop();

        // confirmモードでの領域クリック/タップ処理
        this.setupRegionClickHandler();
    }

    /**
     * confirmモードで領域をクリック/タップして削除するハンドラのセットアップ
     */
    setupRegionClickHandler() {
        // ドラッグ判定用の変数
        let mouseDownPos = null;
        let touchStartPos = null;
        const DRAG_THRESHOLD = 10; // この距離以上動いたらドラッグとみなす

        // マウスダウン位置を記録
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.mode !== 'confirm') return;
            mouseDownPos = { x: e.clientX, y: e.clientY };
        });

        // マウスクリック（ドラッグでなければ削除）
        this.canvas.addEventListener('click', (e) => {
            if (this.mode !== 'confirm') return;

            // ドラッグ操作だった場合はスキップ
            if (mouseDownPos) {
                const dx = e.clientX - mouseDownPos.x;
                const dy = e.clientY - mouseDownPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance >= DRAG_THRESHOLD) {
                    mouseDownPos = null;
                    return; // ドラッグだったので削除しない
                }
            }
            mouseDownPos = null;

            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;

            const hitIndex = this.renderer.hitTestRegion(canvasX, canvasY);
            if (hitIndex >= 0) {
                this.deleteRegionAt(hitIndex);
            }
        });

        // タッチスタート位置を記録
        this.canvas.addEventListener('touchstart', (e) => {
            if (this.mode !== 'confirm') return;
            if (e.touches.length > 0) {
                touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });

        // タッチタップ（ドラッグでなければ削除）
        this.canvas.addEventListener('touchend', (e) => {
            if (this.mode !== 'confirm') return;

            const touch = e.changedTouches[0];
            if (!touch) return;

            // ドラッグ操作だった場合はスキップ
            if (touchStartPos) {
                const dx = touch.clientX - touchStartPos.x;
                const dy = touch.clientY - touchStartPos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance >= DRAG_THRESHOLD) {
                    touchStartPos = null;
                    return; // ドラッグだったので削除しない
                }
            }
            touchStartPos = null;

            const rect = this.canvas.getBoundingClientRect();
            const canvasX = touch.clientX - rect.left;
            const canvasY = touch.clientY - rect.top;

            const hitIndex = this.renderer.hitTestRegion(canvasX, canvasY);
            if (hitIndex >= 0) {
                e.preventDefault();
                this.deleteRegionAt(hitIndex);
            }
        });
    }

    /**
     * 指定インデックスの領域を削除
     * @param {number} index - 削除する領域のインデックス
     */
    deleteRegionAt(index) {
        // renderer と physics の両方から削除
        this.renderer.removeRegion(index);
        this.physics.removeRegion(index);

        // 描画を更新
        this.renderer.render(null);

        // 領域数を確認
        const count = this.renderer.getRegionCount();
        if (count === 0) {
            // 領域がなくなったら選択モードに戻る
            this.setMode('select');
        } else {
            // 領域数の表示を更新
            this.regionCount.textContent = `選択済み: ${count}個`;
        }
    }

    /**
     * ドラッグアンドドロップのセットアップ
     */
    setupDragAndDrop() {
        const dropTarget = document.body;

        // ドラッグオーバー時のデフォルト動作を防止
        dropTarget.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // uploadモードの時のみドロップを受け付ける
            if (this.mode === 'upload') {
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        // ドラッグエンター時
        dropTarget.addEventListener('dragenter', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // ドラッグリーブ時
        dropTarget.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        // ドロップ時
        dropTarget.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();

            // uploadモードの時のみ処理
            if (this.mode !== 'upload') return;

            const files = e.dataTransfer.files;
            if (files && files.length > 0) {
                const file = files[0];
                // 画像ファイルかチェック
                if (file.type.startsWith('image/')) {
                    this.loadImage(file);
                }
            }
        });
    }

    async loadImage(file) {
        try {
            // Base64データを保存（1回だけFileReaderを使用）
            this.currentImageData = await this.storage.imageToBase64(file);

            // Base64から画像を読み込む（FileReaderの競合を避ける）
            const img = await this.storage.base64ToImage(this.currentImageData);
            await this.renderer.loadImageElement(img);

            // 画像のアスペクト比を物理エンジンに設定
            this.physics.setImageAspectRatio(img.width, img.height);

            this.renderer.resize();
            this.setMode('select');

        } catch (error) {
            console.error('画像の読み込みに失敗:', error);
            alert('画像の読み込みに失敗しました');
        }
    }

    /**
     * Base64画像データから読み込み
     */
    async loadImageFromBase64(base64Data) {
        try {
            this.currentImageData = base64Data;
            const img = await this.storage.base64ToImage(base64Data);
            await this.renderer.loadImageElement(img);

            // 画像のアスペクト比を物理エンジンに設定
            this.physics.setImageAspectRatio(img.width, img.height);

            this.renderer.resize();
        } catch (error) {
            console.error('画像の読み込みに失敗:', error);
            throw error;
        }
    }

    setMode(mode) {
        this.mode = mode;
        const count = this.renderer.getRegionCount();

        switch (mode) {
            case 'upload':
                this.instruction.textContent = '画像を選択してください';
                this.regionCount.textContent = '';
                this.imageInputLabel.classList.remove('hidden');
                this.loadPresetBtn.classList.remove('hidden');
                this.startBtn.classList.add('hidden');
                this.autoSelect.classList.add('hidden');
                this.manualSelect.classList.add('hidden');
                this.savePresetBtn.classList.add('hidden');
                this.editRegionBtn.classList.add('hidden');
                this.settingsBtn.classList.add('hidden');
                this.sensorBtn.classList.add('hidden');
                this.resetBtn.classList.add('hidden');
                break;

            case 'select':
                if (count === 0) {
                    this.instruction.textContent = '1つ目の領域をドラッグで選択';
                } else {
                    this.instruction.textContent = '追加の領域をドラッグで選択';
                }
                this.regionCount.textContent = '';
                this.imageInputLabel.classList.add('hidden');
                this.loadPresetBtn.classList.add('hidden');
                this.startBtn.classList.add('hidden');
                this.autoSelect.classList.add('hidden');
                this.manualSelect.classList.add('hidden');
                this.savePresetBtn.classList.add('hidden');
                this.editRegionBtn.classList.add('hidden');
                this.settingsBtn.classList.add('hidden');
                this.sensorBtn.classList.add('hidden');
                this.resetBtn.classList.add('hidden');
                this.renderer.enableSelection();
                break;

            case 'confirm':
                this.instruction.textContent = 'ドラッグで追加、タップで削除';
                this.regionCount.textContent = `選択済み: ${count}個`;
                this.imageInputLabel.classList.add('hidden');
                this.loadPresetBtn.classList.add('hidden');
                this.startBtn.classList.remove('hidden');
                this.autoSelect.classList.add('hidden');
                this.manualSelect.classList.add('hidden');
                this.savePresetBtn.classList.remove('hidden');
                this.editRegionBtn.classList.add('hidden');
                this.settingsBtn.classList.add('hidden');
                this.sensorBtn.classList.add('hidden');
                this.resetBtn.classList.remove('hidden');
                // confirmモードでも選択（追加）を有効化
                this.renderer.enableSelection();
                break;

            case 'animate':
                this.instruction.textContent = 'スマホを揺らすか、画面をタップ';
                this.regionCount.textContent = '';
                this.imageInputLabel.classList.add('hidden');
                this.loadPresetBtn.classList.add('hidden');
                this.startBtn.classList.add('hidden');
                this.autoSelect.classList.remove('hidden');
                this.manualSelect.classList.remove('hidden');
                this.savePresetBtn.classList.remove('hidden');
                this.editRegionBtn.classList.remove('hidden');
                this.settingsBtn.classList.remove('hidden');
                this.sensorBtn.classList.remove('hidden');
                this.resetBtn.classList.remove('hidden');
                this.toggleUIBtn.classList.remove('hidden');
                this.renderer.disableSelection();
                // デフォルトで枠を非表示
                if (this.renderer.isShowingRegions()) {
                    this.renderer.toggleRegionDisplay();
                }
                break;
        }
    }

    onRegionSelected(region) {
        // 領域を追加
        this.renderer.addRegion(region);
        this.physics.addRegion(region);

        // 描画更新
        this.renderer.render(null);

        this.setMode('confirm');
    }

    /**
     * アニメーションを一時停止して領域編集モードに入る
     */
    enterEditMode() {
        // アニメーションを停止
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // モーションセンサーを停止
        if (this.motionSensor) {
            this.motionSensor.stop();
            this.motionSensor = null;
        }

        // 物理状態をリセット
        this.physics.reset();

        // 領域を表示
        if (!this.renderer.isShowingRegions()) {
            this.renderer.toggleRegionDisplay();
        }

        // confirmモードに移行
        this.renderer.render(null);
        this.setMode('confirm');
    }

    async startAnimation() {
        // 物理エンジンに領域を設定
        this.physics.setRegions(this.renderer.getRegions());

        // モーションセンサーを初期化（許可要求はセンサーボタン押下時に行う）
        this.motionSensor = new MotionSensor(this.boundHandleMotion);

        // 保存された自動強さを適用
        if (this.savedAutoStrength !== undefined) {
            this.motionSensor.setAutoStrength(this.savedAutoStrength);
            this.savedAutoStrength = undefined;
        }

        this.motionSensor.start();
        this.setMode('animate');
        this.isAnimating = true;
        this.animate();
    }

    handleMotion(data) {
        if (!this.isAnimating) return;

        if (data.type === 'tap') {
            this.physics.applyImpulse(data.impulse);
        } else if (data.type === 'pressStart') {
            // クライアント座標を正規化座標に変換
            const normalizedPos = this.renderer.clientToNormalized(data.clientX, data.clientY);
            this.physics.startPress(data.id, normalizedPos.x, normalizedPos.y);
        } else if (data.type === 'pressEnd') {
            this.physics.endPress(data.id);
        } else if (data.type === 'pointerMove') {
            // ポインタ位置を基準にした揺れ
            const normalizedPos = this.renderer.clientToNormalized(data.clientX, data.clientY);
            this.physics.applyForceAtPosition(data.force, normalizedPos.x, normalizedPos.y);
        } else {
            this.physics.update(data.force, data.patternId);
        }
    }

    animate() {
        if (!this.isAnimating) return;

        const displacements = this.physics.update({ x: 0, y: 0 });
        this.renderer.render(displacements);

        this.animationId = requestAnimationFrame(this.boundAnimate);
    }

    /**
     * 自動パターンを変更
     */
    changeAutoPattern() {
        if (!this.motionSensor) return;

        const patternId = this.autoSelect.value;
        if (patternId === '') {
            // OFFの場合
            this.motionSensor.setAutoEnabled(false);
        } else {
            // パターンがある場合
            this.motionSensor.setAutoEnabled(true);
            this.motionSensor.setPattern(patternId);
        }
    }

    /**
     * 手動モードを変更
     */
    changeManualMode() {
        if (!this.motionSensor) return;

        const modeId = this.manualSelect.value;
        if (modeId === '') {
            // OFFの場合
            this.motionSensor.setManualEnabled(false);
        } else {
            // モードがある場合
            this.motionSensor.setManualEnabled(true);
            this.motionSensor.setManualMode(modeId);
        }
    }

    toggleRegionDisplay() {
        const isShowing = this.renderer.toggleRegionDisplay();
        this.toggleRegionBtn.textContent = isShowing ? 'ON' : 'OFF';
        if (isShowing) {
            this.toggleRegionBtn.classList.add('active');
        } else {
            this.toggleRegionBtn.classList.remove('active');
        }
    }

    toggleMeshDisplay() {
        const isShowing = this.renderer.toggleMeshDisplay();
        this.toggleMeshBtn.textContent = isShowing ? 'ON' : 'OFF';
        if (isShowing) {
            this.toggleMeshBtn.classList.add('active');
        } else {
            this.toggleMeshBtn.classList.remove('active');
        }
    }

    toggleUI() {
        this.isUIVisible = !this.isUIVisible;
        if (this.isUIVisible) {
            this.controls.classList.remove('hidden');
        } else {
            this.controls.classList.add('hidden');
        }
    }

    /**
     * 加速度センサーの有効/無効を切り替え
     */
    async toggleSensor() {
        if (!this.motionSensor) return;

        if (!this.sensorEnabled) {
            // センサーを有効化（許可を要求）
            const granted = await this.motionSensor.requestPermission();
            if (granted) {
                this.sensorEnabled = true;
                this.motionSensor.setSensorEnabled(true);
                this.sensorBtn.textContent = '加速度センサ:ON';
                this.sensorBtn.classList.add('active');
            } else {
                alert('加速度センサーの許可が必要です');
            }
        } else {
            // センサーを無効化
            this.sensorEnabled = false;
            this.motionSensor.setSensorEnabled(false);
            this.sensorBtn.textContent = '加速度センサ:OFF';
            this.sensorBtn.classList.remove('active');
        }
    }

    reset() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        if (this.motionSensor) {
            this.motionSensor.stop();
            this.motionSensor = null;
        }

        this.physics.reset();
        this.physics.clearRegions();
        this.renderer.clearRegions();
        this.renderer.clearImage();
        this.currentImageData = null;

        // UI表示状態をリセット
        this.isUIVisible = true;
        this.controls.classList.remove('hidden');
        this.toggleUIBtn.classList.add('hidden');

        // センサー状態をリセット
        this.sensorEnabled = false;
        this.sensorBtn.textContent = '加速度センサ:OFF';
        this.sensorBtn.classList.remove('active');

        this.renderer.render(null);
        this.setMode('upload');
    }

    /**
     * プリセット一覧モーダルを開く
     */
    async openPresetModal() {
        try {
            await this.storage.ensureDb();
            const presets = await this.storage.listPresets();
            this.renderPresetList(presets);
            this.presetModal.classList.remove('hidden');
        } catch (error) {
            console.error('プリセット一覧の取得に失敗:', error);
            alert('保存データの読み込みに失敗しました: ' + error.message);
        }
    }

    /**
     * プリセット一覧を描画
     */
    renderPresetList(presets) {
        if (presets.length === 0) {
            this.presetList.innerHTML = '<p class="empty-message">保存データがありません</p>';
            return;
        }

        this.presetList.innerHTML = presets.map(preset => {
            const date = new Date(preset.createdAt).toLocaleDateString('ja-JP');
            return `
                <div class="preset-item" data-id="${preset.id}">
                    <div class="preset-info">
                        <div class="preset-name">${this.escapeHtml(preset.name)}</div>
                        <div class="preset-meta">領域: ${preset.regionCount}個 / ${date}</div>
                    </div>
                    <button class="preset-delete" data-id="${preset.id}">削除</button>
                </div>
            `;
        }).join('');

        // イベントリスナーを設定
        this.presetList.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (!e.target.classList.contains('preset-delete')) {
                    this.loadPreset(parseInt(item.dataset.id));
                }
            });
        });

        this.presetList.querySelectorAll('.preset-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (confirm('このデータを削除しますか？')) {
                    await this.deletePreset(parseInt(btn.dataset.id));
                }
            });
        });
    }

    /**
     * HTMLエスケープ
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * プリセットモーダルを閉じる
     */
    closePresetModal() {
        this.presetModal.classList.add('hidden');
    }

    /**
     * 保存モーダルを開く
     */
    openSaveModal() {
        // デフォルト名に現在の日付時刻を設定
        const now = new Date();
        const defaultName = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
        this.presetNameInput.value = defaultName;
        this.saveModal.classList.remove('hidden');
        this.presetNameInput.focus();
        this.presetNameInput.select();
    }

    /**
     * 保存モーダルを閉じる
     */
    closeSaveModal() {
        this.saveModal.classList.add('hidden');
    }

    /**
     * 現在の状態をプリセットとして保存
     */
    async saveCurrentPreset() {
        const name = this.presetNameInput.value.trim();
        if (!name) {
            alert('名前を入力してください');
            return;
        }

        if (!this.currentImageData) {
            alert('画像が読み込まれていません');
            return;
        }

        const regions = this.renderer.getRegions();
        if (regions.length === 0) {
            alert('領域が選択されていません');
            return;
        }

        try {
            await this.storage.savePreset({
                name: name,
                imageData: this.currentImageData,
                regions: regions,
                physicsParams: this.physics.getPhysicsParams(),
                autoStrength: this.motionSensor ? this.motionSensor.getAutoStrength() : 1.0,
                gridDensity: this.physics.getGridDensity()
            });

            this.closeSaveModal();
            alert('保存しました');
        } catch (error) {
            console.error('保存に失敗:', error);
            alert('保存に失敗しました');
        }
    }

    /**
     * プリセットを読み込む
     */
    async loadPreset(id) {
        try {
            const preset = await this.storage.getPreset(id);
            if (!preset) {
                alert('データが見つかりません');
                return;
            }

            // 現在の状態をリセット
            if (this.isAnimating) {
                this.isAnimating = false;
                if (this.animationId) {
                    cancelAnimationFrame(this.animationId);
                    this.animationId = null;
                }
                if (this.motionSensor) {
                    this.motionSensor.stop();
                    this.motionSensor = null;
                }
            }
            this.physics.reset();
            this.physics.clearRegions();
            this.renderer.clearRegions();

            // 画像を読み込む
            await this.loadImageFromBase64(preset.imageData);

            // 領域を復元
            for (const region of preset.regions) {
                this.renderer.addRegion(region);
                this.physics.addRegion(region);
            }

            // 物理パラメータを復元（保存されている場合）
            if (preset.physicsParams) {
                this.physics.setPhysicsParams(preset.physicsParams);
            }

            // グリッド密度を復元
            if (preset.gridDensity !== undefined) {
                this.physics.setGridDensity(preset.gridDensity);
            }

            // 自動強さを復元（アニメーション開始時にmotionSensorに設定）
            this.savedAutoStrength = preset.autoStrength || 1.0;

            this.closePresetModal();
            this.renderer.render(null);
            this.setMode('confirm');

        } catch (error) {
            console.error('読み込みに失敗:', error);
            alert('読み込みに失敗しました');
        }
    }

    /**
     * プリセットを削除
     */
    async deletePreset(id) {
        try {
            await this.storage.deletePreset(id);
            // 一覧を更新
            const presets = await this.storage.listPresets();
            this.renderPresetList(presets);
        } catch (error) {
            console.error('削除に失敗:', error);
            alert('削除に失敗しました');
        }
    }

    /**
     * 設定モーダルを開く
     */
    openSettingsModal() {
        // 表示設定
        const isShowingRegions = this.renderer.isShowingRegions();
        this.toggleRegionBtn.textContent = isShowingRegions ? 'ON' : 'OFF';
        if (isShowingRegions) {
            this.toggleRegionBtn.classList.add('active');
        } else {
            this.toggleRegionBtn.classList.remove('active');
        }

        const isShowingMesh = this.renderer.isShowingMesh();
        this.toggleMeshBtn.textContent = isShowingMesh ? 'ON' : 'OFF';
        if (isShowingMesh) {
            this.toggleMeshBtn.classList.add('active');
        } else {
            this.toggleMeshBtn.classList.remove('active');
        }

        // 自動強さ
        const autoStrength = this.motionSensor ? this.motionSensor.getAutoStrength() : 1.0;
        this.autoStrengthRange.value = autoStrength;
        this.autoStrengthValue.textContent = autoStrength.toFixed(1);

        // グリッド密度
        const gridDensity = this.physics.getGridDensity();
        this.gridDensityRange.value = gridDensity;
        this.gridDensityValue.textContent = gridDensity;

        // 物理パラメータをスライダーに反映
        const params = this.physics.getPhysicsParams();
        this.stiffnessRange.value = params.baseStiffness;
        this.dampingRange.value = params.baseDamping;
        this.sensitivityRange.value = params.sensitivity;
        this.posThresholdRange.value = params.posThreshold;
        this.velThresholdRange.value = params.velThreshold;

        // 表示値を更新
        this.stiffnessValue.textContent = params.baseStiffness.toFixed(2);
        this.dampingValue.textContent = params.baseDamping.toFixed(2);
        this.sensitivityValue.textContent = params.sensitivity.toFixed(1);
        this.posThresholdValue.textContent = params.posThreshold.toFixed(1);
        this.velThresholdValue.textContent = params.velThreshold.toFixed(2);

        this.settingsModal.classList.remove('hidden');
    }

    /**
     * 設定モーダルを閉じる
     */
    closeSettingsModal() {
        this.settingsModal.classList.add('hidden');
    }

    /**
     * 設定をデフォルトに戻す
     */
    resetPhysicsSettings() {
        // 自動強さをデフォルトに
        if (this.motionSensor) {
            this.motionSensor.setAutoStrength(1.0);
        }
        this.autoStrengthRange.value = 1.0;
        this.autoStrengthValue.textContent = '1.0';

        // グリッド密度をデフォルトに
        this.physics.setGridDensity(20);
        this.gridDensityRange.value = 20;
        this.gridDensityValue.textContent = '20';

        // 物理パラメータをデフォルトに
        this.physics.resetToDefaults();

        // スライダーと表示値を更新
        const params = this.physics.getPhysicsParams();
        this.stiffnessRange.value = params.baseStiffness;
        this.dampingRange.value = params.baseDamping;
        this.sensitivityRange.value = params.sensitivity;
        this.posThresholdRange.value = params.posThreshold;
        this.velThresholdRange.value = params.velThreshold;

        this.stiffnessValue.textContent = params.baseStiffness.toFixed(2);
        this.dampingValue.textContent = params.baseDamping.toFixed(2);
        this.sensitivityValue.textContent = params.sensitivity.toFixed(1);
        this.posThresholdValue.textContent = params.posThreshold.toFixed(1);
        this.velThresholdValue.textContent = params.velThreshold.toFixed(2);
    }
}

// アプリケーション起動
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
});
