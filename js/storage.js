/**
 * IndexedDBを使用したストレージ管理
 * 画像と領域データを保存・読み込み
 */
class Storage {
    constructor() {
        this.dbName = 'nanoprin';
        this.dbVersion = 1;
        this.db = null;
    }

    /**
     * データベースを初期化
     * @returns {Promise<void>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            if (!indexedDB) {
                reject(new Error('このブラウザはIndexedDBをサポートしていません'));
                return;
            }

            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(new Error('IndexedDBの初期化に失敗しました: ' + (event.target.error?.message || 'unknown error')));
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // プリセット保存用ストア
                if (!db.objectStoreNames.contains('presets')) {
                    const store = db.createObjectStore('presets', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    /**
     * 画像をBase64に変換
     * @param {File|Blob} file - 画像ファイル
     * @returns {Promise<string>} - Base64文字列
     */
    async imageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Base64から画像を復元
     * @param {string} base64 - Base64文字列
     * @returns {Promise<HTMLImageElement>} - 画像要素
     */
    async base64ToImage(base64) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = base64;
        });
    }

    /**
     * プリセットを保存
     * @param {Object} preset - プリセットデータ
     * @param {string} preset.name - プリセット名
     * @param {string} preset.imageData - Base64画像データ
     * @param {Array} preset.regions - 揺れ領域
     * @param {Array} preset.fixedRegions - 固定領域
     * @returns {Promise<number>} - 保存されたプリセットのID
     */
    async savePreset(preset) {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');

            const data = {
                name: preset.name,
                imageData: preset.imageData,
                regions: preset.regions,
                fixedRegions: preset.fixedRegions || [],
                physicsParams: preset.physicsParams || null,
                autoStrength: preset.autoStrength || 1.0,
                gridDensity: preset.gridDensity || 10,
                createdAt: new Date().toISOString()
            };

            const request = store.add(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error('プリセットの保存に失敗しました'));
        });
    }

    /**
     * プリセットを更新
     * @param {number} id - プリセットID
     * @param {Object} preset - プリセットデータ
     * @returns {Promise<void>}
     */
    async updatePreset(id, preset) {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');

            const data = {
                id: id,
                name: preset.name,
                imageData: preset.imageData,
                regions: preset.regions,
                fixedRegions: preset.fixedRegions || [],
                createdAt: preset.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            const request = store.put(data);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('プリセットの更新に失敗しました'));
        });
    }

    /**
     * プリセットを取得
     * @param {number} id - プリセットID
     * @returns {Promise<Object|null>} - プリセットデータ
     */
    async getPreset(id) {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readonly');
            const store = transaction.objectStore('presets');
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error('プリセットの取得に失敗しました'));
        });
    }

    /**
     * 全プリセットの一覧を取得（画像データは含まない）
     * @returns {Promise<Array>} - プリセット一覧
     */
    async listPresets() {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readonly');
            const store = transaction.objectStore('presets');
            const request = store.getAll();

            request.onsuccess = () => {
                // 画像データを除いた軽量な一覧を返す
                const presets = request.result.map(p => ({
                    id: p.id,
                    name: p.name,
                    regionCount: p.regions.length,
                    fixedRegionCount: p.fixedRegions ? p.fixedRegions.length : 0,
                    createdAt: p.createdAt,
                    updatedAt: p.updatedAt
                }));
                // 作成日時の新しい順にソート
                presets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                resolve(presets);
            };
            request.onerror = () => reject(new Error('プリセット一覧の取得に失敗しました'));
        });
    }

    /**
     * プリセットを削除
     * @param {number} id - プリセットID
     * @returns {Promise<void>}
     */
    async deletePreset(id) {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('プリセットの削除に失敗しました'));
        });
    }

    /**
     * データベースが初期化されているか確認
     */
    async ensureDb() {
        if (!this.db) {
            await this.init();
        }
    }

    /**
     * 全データを削除（デバッグ用）
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.ensureDb();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['presets'], 'readwrite');
            const store = transaction.objectStore('presets');
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error('データの削除に失敗しました'));
        });
    }
}
