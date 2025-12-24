# 開発ガイド

## ローカル開発

```powershell
# Pythonの簡易サーバーで起動
python -m http.server 8000

# ブラウザでアクセス
# http://localhost:8000
```

スマートフォンでテストする場合は、HTTPSが必要です。

```powershell
ngrok http 8000
```

## ファイル構成

```
nanoprin/
├── index.html          # メインHTML
├── css/
│   └── style.css       # スタイルシート
├── js/
│   ├── app.js          # メインアプリケーション
│   ├── motion.js       # 加速度センサー/入力処理
│   ├── physics.js      # 揺れの物理計算
│   ├── renderer.js     # Canvas描画処理
│   └── storage.js      # IndexedDB保存処理
├── README.md           # プレイヤー向け説明
├── DEVELOPMENT.md      # このファイル
└── CLAUDE.md           # Claude Code用指示
```

## 技術スタック

- HTML5 / CSS3 / JavaScript（バニラ）
- Canvas 2D API
- DeviceMotionEvent API（加速度センサー）
- IndexedDB（プリセット保存）
- バネ・ダンパーモデルによる物理シミュレーション

## 主要クラス

### App (app.js)
- アプリケーション全体の制御
- UI状態管理
- イベントハンドラ

### MotionSensor (motion.js)
- 加速度センサー入力
- マウス/タッチ入力
- 自動揺れパターン生成

### PhysicsEngine (physics.js)
- 頂点ベースの物理シミュレーション
- バネ・ダンパー計算
- 領域ごとのパラメータ管理

### Renderer (renderer.js)
- Canvas描画
- メッシュ変形
- 領域選択UI

### PresetStorage (storage.js)
- IndexedDBによるプリセット保存/読み込み

## ホスティング

静的ファイルのみで構成されているため、以下のサービスで公開可能:

- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
