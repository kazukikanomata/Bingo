# 3D クリスマスビンゴ

500 人規模のパーティでスクリーン投影するための 3D ビンゴ抽選システム（Vite + React + Three.js / R3F）。

## 本番（会場）での使い方

```bash
npm install
npm run build
```

`dist/index.html` が 1 ファイルで完成します（JS・CSS・フォントをすべて埋め込み済み）。
**Chrome にドラッグ＆ドロップ（または `file://` で開く）だけで、インターネットもサーバーも使わずに動きます。**
USB メモリ等で会場 PC に持ち込めます。

開発時は `npm run dev`。

## デスクトップアプリ版（Tauri）

ブラウザの代わりに、全画面で起動する専用アプリとしても使えます。

### 初回準備（1 回だけ）

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # Rust のインストール
xcode-select --install                                           # macOS: 未導入なら
```

Windows は [Rust](https://rustup.rs/) と「Microsoft C++ Build Tools」を入れてください。WebView2 は Windows 10/11 に標準で入っています。

### 起動・ビルド

```bash
npm run app:dev     # 開発用に起動（ホットリロード）
npm run app:build   # 配布用アプリを作成
```

成果物は `src-tauri/target/release/bundle/` に出力されます。

- macOS: `macos/Xmas BINGO.app`、`dmg/Xmas BINGO_1.0.0_*.dmg`
- Windows: `nsis/*-setup.exe`、`msi/*.msi`

Windows 版は Windows 上でビルドしてください。macOS からクロスビルドはできません。

### ブラウザ版との違い

- 起動と同時に全画面になります。F キーでウィンドウ表示と切り替えられます。
- 描画エンジンは OS 標準の WebView です（macOS は Safari 系の WKWebView、Windows は Chromium 系の WebView2）。macOS ではブラウザ版（Chrome）と見た目や速度が少し変わることがあります。
- localStorage はアプリ専用の保存領域に保存されるため、ブラウザ版の履歴とは共有されません。
- アプリのアイコンは `app-icon.svg` から作っています。変更したら `npx tauri icon app-icon.svg` で作り直してください。

## キー操作

| キー | 動作 |
| --- | --- |
| Space | 抽選開始 / 演出スキップ（即時確定）/ ジャックポット終了 |
| B | ビンゴ達成演出（ジャックポット）の ON/OFF |
| H | 75 マス表の表示/非表示 |
| M | ミュート切替 |
| F | フルスクリーン切替 |
| R | リセット（確認モーダル：Enter で実行 / Esc でキャンセル） |
| C | オペレーター パネル（音量・演出速度・抽選順の履歴） |

- 最初のキー操作で音声が有効になります（ブラウザの自動再生制限のため）。本番前に一度 Space 以外のキー（例: H を 2 回）を押しておくと安全です。
- 抽選結果は演出開始時点で localStorage に保存されます。リロードやタブを閉じても履歴と最新番号が復元されます。
- 演出速度：巻き進行（約 4 秒）/ 標準（約 7 秒）/ じっくり（約 9 秒）。

## 構成

| パス | 内容 |
| --- | --- |
| `src/store/useBingo.ts` | 抽選ロジック（`crypto.getRandomValues` による偏りのない抽選）、状態、localStorage 保存 |
| `src/useController.ts` | 演出の進行（rolling → reveal → shown）、効果音のタイミング、キー操作 |
| `src/audio/sound.ts` | Web Audio API による効果音・BGM のリアルタイム合成（音声ファイル不要） |
| `src/scene/` | 3D シーン（ツリー、雪、抽選箱、オーナメント、紙吹雪、ジャックポット、カメラワーク、ブルーム） |
| `src-tauri/` | Tauri（Rust）側の設定。ウィンドウ設定は `tauri.conf.json`、権限は `capabilities/default.json` |
| `src/ui/Overlay.tsx` | HTML オーバーレイ（特大番号、直近 5 件、75 マス表、操作パネル、リセット確認） |

### 要件定義書の推奨スタックからの変更点

- **Howler.js は不採用**：効果音・BGM をすべて Web Audio API で合成しているため、音声ファイルのプリロードが不要で遅延もありません。
  実際の音源に差し替える場合は `src/audio/sound.ts` の各メソッドを置き換えてください。
- **`dist/index.html` を 1 ファイルに集約**（vite-plugin-singlefile）：会場でローカルサーバーを立てる手間と、それが失敗するリスクをなくすため。
# Bingo
