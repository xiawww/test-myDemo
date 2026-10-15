/**
 * Lumina Stroke Gallery — 绘画工具箱公共组件 (paint-toolbox)
 *
 * 说明:
 *   通用绘画工具箱, 样式完全自包含(不依赖 Tailwind / lucide / 页面 CSS 变量),
 *   主题通过 --pt-* CSS 变量定制, 功能分组通过布尔属性开关。
 *
 * 用法示例:
 *   <paint-toolbox brush-types shapes clear-text="Clear"></paint-toolbox>
 *   <paint-toolbox lang="zh" undo ref custom-color size-slider
 *                  colors="#222222,#ffffff,..."></paint-toolbox>
 *
 * 功能分组属性(出现即开启):
 *   brush-types  画笔类型(pencil/brush/spray)
 *   shapes       形状工具(圆/方/三角/直线)
 *   undo         撤销按钮
 *   ref          参考图导入与控制
 *   custom-color 自定义颜色选择器
 *   size-slider  粗细用滑块(1-50px); 默认为 4 档按钮
 * 文本属性:
 *   lang         en(默认) | zh 内置文案语言
 *   colors       逗号分隔的预设色板, 默认 Lumina 10 色
 *   clear-text / save-text  覆盖按钮文字
 *
 * 对外接口:
 *   1. 事件 "toolbox-change" (bubbles + composed), detail = { type, value, state }
 *        type='brush'  value: 'pencil'|'brush'|'spray'
 *        type='color'  value: '#RRGGBB'
 *        type='size'   value: 档位 1-4 或像素 1-50(取决于 size-slider)
 *        type='shape'  value: 'circle'|'square'|'triangle'|'line'|null
 *        type='tool'   value: 'brush'|'eraser'
 *        type='action' value: 'clear'|'save'|'undo'
 *        type='ref'    value: { action:'import'|'toggle'|'opacity'|'remove', url?, visible?, opacity? }
 *   2. 属性 .state —— 当前状态快照
 *   3. 方法 toggleEraser() / toggleRef() / loadRefFile(file)
 */
(function () {
  'use strict';

  /* ---------- 内联图标(取自 lucide 图形, 组件零外部依赖) ---------- */
  var ICONS = {
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    brush: '<path d="m9.06 11.9 8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02z"/>',
    spray: '<path d="M3 3h.01"/><path d="M7 5h.01"/><path d="M11 7h.01"/><path d="M3 7h.01"/><path d="M7 9h.01"/><path d="M3 11h.01"/><rect width="4" height="4" x="15" y="5"/><path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2"/><path d="m15 22 0-8"/><path d="M15 11V9.5A4.5 4.5 0 0 1 19.5 5"/>',
    eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"/>',
    image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    minus: '<path d="M5 12h14"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>';
  }

  /* ---------- 内置文案 ---------- */
  var I18N = {
    en: {
      brush: 'Brush', colors: 'Colors', size: 'Size', shapes: 'Shapes', ref: 'Reference',
      eraser: 'Eraser', undo: 'Undo', clear: 'Clear Canvas', save: 'Save',
      importRef: 'Import Reference', hideRef: 'Hide Reference', showRef: 'Show Reference',
      removeRef: 'Remove', customColor: 'Custom color',
    },
    zh: {
      brush: '画笔', colors: '颜色', size: '粗细', shapes: '形状', ref: '参考图',
      eraser: '橡皮擦', undo: '撤销', clear: '清空', save: '保存图片',
      importRef: '导入参考图', hideRef: '隐藏参考图', showRef: '显示参考图',
      removeRef: '移除', customColor: '自定义颜色',
    },
  };

  /* ---------- 默认色板(Lumina 10 色) ---------- */
  var DEFAULT_COLORS = ['#1a1a1a', '#ef4444', '#f59e0b', '#eab308', '#22c55e',
                        '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#ffffff'];

  /* ---------- 组件样式(一次性注入全局, class 以 pt- 前缀隔离) ---------- */
  var STYLE_ID = 'paint-toolbox-style';
  if (!document.getElementById(STYLE_ID)) {
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      'paint-toolbox { display: block; max-height: 100%; }',
      '.pt-box {',
      '  display: flex; flex-direction: column; gap: 24px;',
      '  background: var(--pt-surface, #fff);',
      '  border: 1px solid var(--pt-border, #E9D5FF);',
      '  border-radius: 16px;',
      '  box-shadow: var(--pt-shadow, 0 8px 24px -8px rgba(74,29,106,.18));',
      '  padding: 20px;',
      '  height: fit-content;',
      '  max-height: 100%;',
      '  overflow-y: auto;',
      '  color: var(--pt-ink, #4A1D6A);',
      '  font-family: inherit;',
      '  box-sizing: border-box;',
      '}',
      '.pt-box::-webkit-scrollbar { width: 6px; }',
      '.pt-box::-webkit-scrollbar-thumb { background: var(--pt-border, #E9D5FF); border-radius: 3px; }',
      '.pt-title { font-size: 14px; font-weight: 600; color: var(--pt-ink, #4A1D6A); margin: 0 0 12px; }',
      '.pt-grid { display: grid; gap: 8px; }',
      '.pt-grid.cols-3 { grid-template-columns: repeat(3, 1fr); }',
      '.pt-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }',
      '.pt-grid.cols-5 { grid-template-columns: repeat(5, 1fr); }',
      '.pt-btn { display: flex; align-items: center; justify-content: center; height: 40px;',
      '  border: none; background: transparent; border-radius: 8px; cursor: pointer;',
      '  color: var(--pt-ink-2, #7C3AED); font-family: inherit; font-size: 14px;',
      '  transition: background .15s, color .15s; }',
      '.pt-btn:hover { background: rgba(0,0,0,.05); }',
      '.pt-btn.active { background: var(--pt-primary-soft, #FAF5FF); color: var(--pt-primary-deep, #7C3AED); }',
      '.pt-btn svg { width: 16px; height: 16px; }',
      '.pt-swatches { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }',
      '.pt-swatch { width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff;',
      '  box-shadow: 0 1px 2px rgba(0,0,0,.12); cursor: pointer; padding: 0; justify-self: center;',
      '  transition: transform .12s, box-shadow .15s; }',
      '.pt-swatch:hover { transform: scale(1.12); }',
      '.pt-swatch.active { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--pt-primary, #A855F7); }',
      '.pt-custom { position: relative; width: 32px; height: 32px; border-radius: 50%;',
      '  border: 1px solid var(--pt-border, #e4e7ee); overflow: hidden; cursor: pointer; padding: 0;',
      '  background: conic-gradient(red, yellow, lime, aqua, blue, magenta, red); justify-self: center;',
      '  transition: box-shadow .15s; }',
      '.pt-custom.active { box-shadow: 0 0 0 2px #fff, 0 0 0 5px var(--pt-primary, #A855F7); }',
      '.pt-custom input { position: absolute; width: 150%; height: 150%; left: -25%; top: -25%;',
      '  opacity: 0; cursor: pointer; border: none; }',
      '.pt-steps { display: flex; gap: 12px; }',
      '.pt-step { width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--pt-border, #E9D5FF);',
      '  background: transparent; display: flex; align-items: center; justify-content: center;',
      '  cursor: pointer; padding: 0; transition: border-color .15s, background .15s; }',
      '.pt-step.active { border-color: var(--pt-primary, #A855F7); background: var(--pt-primary-soft, #FAF5FF); }',
      '.pt-step .pt-dot { border-radius: 50%; background: var(--pt-ink, #4A1D6A); display: block; }',
      '.pt-shape-btn { height: 36px; border-radius: 8px; border: 1px solid var(--pt-border, #E9D5FF);',
      '  background: transparent; display: flex; align-items: center; justify-content: center;',
      '  cursor: pointer; padding: 0; color: var(--pt-ink-2, #7C3AED);',
      '  transition: border-color .15s, background .15s, color .15s; }',
      '.pt-shape-btn.active { border-color: var(--pt-primary, #A855F7); background: var(--pt-primary-soft, #FAF5FF); color: var(--pt-primary-deep, #7C3AED); }',
      '.pt-shape-btn svg { width: 16px; height: 16px; }',
      '.pt-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 4px;',
      '  border-radius: 4px; background: #dfe3ec; outline: none; cursor: pointer; }',
      '.pt-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px;',
      '  border-radius: 50%; background: var(--pt-primary, #4f6ef7); border: 2px solid #fff;',
      '  box-shadow: 0 1px 4px rgba(0,0,0,.25); cursor: pointer; }',
      '.pt-slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%;',
      '  background: var(--pt-primary, #4f6ef7); border: 2px solid #fff; cursor: pointer; }',
      '.pt-slider-row { display: flex; align-items: center; gap: 8px; }',
      '.pt-slider-val { font-size: 13px; color: var(--pt-ink-2, #8a91a0); min-width: 30px; text-align: right; }',
      '.pt-preview { display: flex; align-items: center; justify-content: center; height: 36px; margin-top: 8px; }',
      '.pt-preview span { display: block; border-radius: 50%; }',
      '.pt-actions { display: flex; flex-direction: column; padding-top: 20px;',
      '  border-top: 1px solid var(--pt-border, #E9D5FF); }',
      '.pt-action { width: 100%; min-height: 40px; border: none; background: transparent;',
      '  border-radius: 8px; font-size: 14px; font-weight: 500; font-family: inherit;',
      '  color: var(--pt-ink-2, #7C3AED); display: flex; align-items: center; justify-content: center;',
      '  gap: 8px; cursor: pointer; padding: 10px 12px; transition: background .15s, color .15s; }',
      '.pt-action + .pt-action { margin-top: 8px; }',
      '.pt-action:hover { background: rgba(0,0,0,.05); }',
      '.pt-action.active { background: var(--pt-primary-soft, #FAF5FF); color: var(--pt-primary-deep, #7C3AED); }',
      '.pt-action.primary { background: var(--pt-primary, #A855F7); color: #fff; margin-top: 12px; }',
      '.pt-action.primary:hover { background: var(--pt-primary, #A855F7); filter: brightness(1.08); }',
      '.pt-action.danger { color: var(--pt-danger, #ef4444); }',
      '.pt-action.danger:hover { background: rgba(239,68,68,.08); color: var(--pt-danger, #ef4444); }',
      '.pt-action svg { width: 16px; height: 16px; flex-shrink: 0; }',
      '.pt-ref-controls { display: flex; flex-direction: column; gap: 8px; }',
      '.pt-ref-row { display: flex; align-items: center; gap: 8px; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  class PaintToolbox extends HTMLElement {
    constructor() {
      super();
      // 组件内部维护的选中状态
      this.toolboxState = {
        brush: 'pencil',     // 画笔类型
        color: '#1a1a1a',    // 当前颜色(默认色板第一个)
        sizeStep: 3,         // 粗细档位 1-4(档位模式)
        sizePx: 6,           // 粗细像素 1-50(滑块模式)
        shape: null,         // 待绘制形状, null 表示自由绘制
        tool: 'brush',       // 当前工具: brush 画笔 | eraser 橡皮
        ref: { url: null, visible: true, opacity: 0.35 },   // 参考图状态
      };
      this._customActive = false;   // 自定义颜色按钮是否为当前选中来源
      this._refURL = null;          // 参考图 objectURL(组件负责创建/回收)
    }

    connectedCallback() {
      if (this._initialized) return;
      this._initialized = true;

      // 读取配置
      var attrColors = this.getAttribute('colors');
      this.colors = attrColors
        ? attrColors.split(',').map(function (c) { return c.trim(); }).filter(Boolean)
        : DEFAULT_COLORS.slice();
      this.toolboxState.color = this.colors[0] || '#1a1a1a';

      var lang = this.getAttribute('lang') === 'zh' ? 'zh' : 'en';
      this.t = Object.assign({}, I18N[lang]);
      this.t.clear = this.getAttribute('clear-text') || this.t.clear;
      this.t.save = this.getAttribute('save-text') || this.t.save;

      this._sliderMode = this.hasAttribute('size-slider');
      this._showBrush = this.hasAttribute('brush-types');
      this._showShapes = this.hasAttribute('shapes');
      this._showUndo = this.hasAttribute('undo');
      this._showRef = this.hasAttribute('ref');
      this._showCustom = this.hasAttribute('custom-color');

      this.render();
      this.bindEvents();
      this.refreshActive();
      this.updateRefUI();
      this.updatePreview();
    }

    /** 对外只读的状态快照 */
    get state() {
      var s = this.toolboxState;
      return {
        brush: s.brush,
        color: s.color,
        size: this._sliderMode ? s.sizePx : s.sizeStep,
        shape: s.shape,
        tool: s.tool,
        ref: { url: s.ref.url, visible: s.ref.visible, opacity: s.ref.opacity },
      };
    }

    render() {
      this.innerHTML = this.template();
    }

    template() {
      var t = this.t;
      var parts = [];

      // 画笔类型组(可选)
      if (this._showBrush) {
        var brushIcons = { pencil: 'pencil', brush: 'brush', spray: 'spray' };
        var brushBtns = ['pencil', 'brush', 'spray'].map(function (id) {
          return '<button type="button" data-brush="' + id + '" class="pt-btn" title="' + id + '">' + icon(brushIcons[id]) + '</button>';
        }).join('');
        parts.push(
          '<section class="pt-group">' +
            '<h3 class="pt-title">' + t.brush + '</h3>' +
            '<div class="pt-grid cols-3">' + brushBtns + '</div>' +
          '</section>');
      }

      // 颜色组(色板 + 可选自定义色)
      var swatches = this.colors.map(function (c) {
        return '<button type="button" data-color="' + c + '" class="pt-swatch" style="background:' + c + ';" title="' + c + '"></button>';
      }).join('');
      if (this._showCustom) {
        swatches += '<label class="pt-custom" title="' + t.customColor + '">' +
          '<input type="color" data-color-input value="' + this.toolboxState.color + '"></label>';
      }
      parts.push(
        '<section class="pt-group">' +
          '<h3 class="pt-title">' + t.colors + '</h3>' +
          '<div class="pt-swatches">' + swatches + '</div>' +
        '</section>');

      // 粗细组: 档位按钮 或 滑块 + 数值 + 笔迹预览
      if (this._sliderMode) {
        parts.push(
          '<section class="pt-group">' +
            '<h3 class="pt-title">' + t.size + '</h3>' +
            '<div class="pt-slider-row">' +
              '<input type="range" class="pt-slider" data-size-slider min="1" max="50" value="' + this.toolboxState.sizePx + '">' +
              '<span class="pt-slider-val" data-size-val>' + this.toolboxState.sizePx + '</span>' +
            '</div>' +
            '<div class="pt-preview"><span data-preview-dot></span></div>' +
          '</section>');
      } else {
        var sizeBtns = [1, 2, 3, 4].map(function (n) {
          return '<button type="button" data-size="' + n + '" class="pt-step">' +
            '<span class="pt-dot" style="width:' + (n * 4) + 'px;height:' + (n * 4) + 'px;"></span></button>';
        }).join('');
        parts.push(
          '<section class="pt-group">' +
            '<h3 class="pt-title">' + t.size + '</h3>' +
            '<div class="pt-steps">' + sizeBtns + '</div>' +
          '</section>');
      }

      // 形状组(可选)
      if (this._showShapes) {
        var shapes = [
          { id: 'circle', html: '<span style="width:16px;height:16px;border-radius:50%;border:1.5px solid currentColor;display:block;"></span>' },
          { id: 'square', html: '<span style="width:16px;height:16px;border:1.5px solid currentColor;display:block;"></span>' },
          { id: 'triangle', html: '<span style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-bottom:9px solid currentColor;display:block;"></span>' },
          { id: 'line', html: icon('minus') },
        ];
        var shapeBtns = shapes.map(function (s) {
          return '<button type="button" data-shape="' + s.id + '" class="pt-shape-btn" title="' + s.id + '">' + s.html + '</button>';
        }).join('');
        parts.push(
          '<section class="pt-group">' +
            '<h3 class="pt-title">' + t.shapes + '</h3>' +
            '<div class="pt-grid cols-4">' + shapeBtns + '</div>' +
          '</section>');
      }

      // 操作组: 橡皮 / 撤销(可选) / 清空 / 保存
      var actions =
        '<button type="button" data-tool="eraser" class="pt-action">' + icon('eraser') + '<span>' + t.eraser + '</span></button>';
      if (this._showUndo) {
        actions += '<button type="button" data-action="undo" class="pt-action">' + icon('undo') + '<span>' + t.undo + '</span></button>';
      }
      actions += '<button type="button" data-action="clear" class="pt-action">' + icon('trash') + '<span>' + t.clear + '</span></button>';
      actions += '<button type="button" data-action="save" class="pt-action primary">' + icon('download') + '<span>' + t.save + '</span></button>';
      parts.push('<section class="pt-actions">' + actions + '</section>');

      // 参考图组(可选): 导入按钮 + 导入后的控制条
      if (this._showRef) {
        parts.push(
          '<section class="pt-group">' +
            '<h3 class="pt-title">' + t.ref + '</h3>' +
            '<button type="button" data-ref="import" class="pt-action">' + icon('image') + '<span>' + t.importRef + '</span></button>' +
            '<div class="pt-ref-controls" data-ref-controls style="display:none;">' +
              '<button type="button" data-ref="toggle" class="pt-action">' + icon('eye') + '<span>' + t.hideRef + '</span></button>' +
              '<div class="pt-ref-row">' +
                '<input type="range" class="pt-slider" data-ref-opacity min="5" max="100" value="' + Math.round(this.toolboxState.ref.opacity * 100) + '">' +
                '<span class="pt-slider-val" data-ref-opacity-val>' + Math.round(this.toolboxState.ref.opacity * 100) + '%</span>' +
              '</div>' +
              '<button type="button" data-ref="remove" class="pt-action danger">' + icon('x') + '<span>' + t.removeRef + '</span></button>' +
            '</div>' +
            '<input type="file" accept="image/*" data-ref-file hidden>' +
          '</section>');
      }

      return '<div class="pt-box">' + parts.join('') + '</div>';
    }

    bindEvents() {
      var self = this;

      // 按钮点击统一委托
      this.addEventListener('click', function (e) { self.handleClick(e); });

      // 粗细滑块
      var sizeSlider = this.querySelector('[data-size-slider]');
      if (sizeSlider) {
        sizeSlider.addEventListener('input', function () {
          self.toolboxState.sizePx = Number(this.value);
          var val = self.querySelector('[data-size-val]');
          if (val) val.textContent = this.value;
          self.emit('size', self.toolboxState.sizePx);
          self.updatePreview();
        });
      }

      // 自定义颜色选择器
      var colorInput = this.querySelector('[data-color-input]');
      if (colorInput) {
        colorInput.addEventListener('input', function () {
          self.setColor(this.value, true);
        });
      }

      // 参考图透明度滑块
      var refOpacity = this.querySelector('[data-ref-opacity]');
      if (refOpacity) {
        refOpacity.addEventListener('input', function () {
          var v = Number(this.value);
          self.toolboxState.ref.opacity = v / 100;
          var valEl = self.querySelector('[data-ref-opacity-val]');
          if (valEl) valEl.textContent = v + '%';
          self.emit('ref', { action: 'opacity', opacity: v / 100 });
        });
      }

      // 参考图文件选择
      var fileInput = this.querySelector('[data-ref-file]');
      if (fileInput) {
        fileInput.addEventListener('change', function () {
          if (this.files && this.files[0]) self.loadRefFile(this.files[0]);
          this.value = '';   // 重置后允许再次选择同一个文件
        });
      }
    }

    handleClick(e) {
      var btn = e.target.closest('button');
      if (!btn) return;

      if (btn.dataset.brush) {
        // 切换画笔类型(同时退出橡皮模式)
        this.toolboxState.brush = btn.dataset.brush;
        this.toolboxState.tool = 'brush';
        this.emit('brush', this.toolboxState.brush);
      } else if (btn.dataset.color) {
        this.setColor(btn.dataset.color, false);
      } else if (btn.dataset.size) {
        // 切换粗细档位
        this.toolboxState.sizeStep = Number(btn.dataset.size);
        this.emit('size', this.toolboxState.sizeStep);
      } else if (btn.dataset.shape) {
        // 再次点击同一形状取消选中, 回到自由绘制
        this.toolboxState.shape = this.toolboxState.shape === btn.dataset.shape ? null : btn.dataset.shape;
        if (this.toolboxState.shape && this.toolboxState.tool === 'eraser') this.toolboxState.tool = 'brush';
        this.emit('shape', this.toolboxState.shape);
      } else if (btn.dataset.tool === 'eraser') {
        this.toggleEraser();
      } else if (btn.dataset.action === 'undo') {
        this.emit('action', 'undo');
      } else if (btn.dataset.action === 'clear') {
        this.emit('action', 'clear');
      } else if (btn.dataset.action === 'save') {
        this.emit('action', 'save');
      } else if (btn.dataset.ref === 'import') {
        var fileInput = this.querySelector('[data-ref-file]');
        if (fileInput) fileInput.click();
      } else if (btn.dataset.ref === 'toggle') {
        this.toggleRef();
      } else if (btn.dataset.ref === 'remove') {
        this.removeRef();
      } else {
        return;
      }
      this.refreshActive();
    }

    /** 选择颜色; fromCustom 标记是否来自自定义取色器 */
    setColor(c, fromCustom) {
      this.toolboxState.color = c;
      this._customActive = !!fromCustom;
      // 橡皮模式下选色自动切回画笔
      if (this.toolboxState.tool === 'eraser') this.toolboxState.tool = 'brush';
      this.emit('color', c);
      this.refreshActive();
    }

    /** 橡皮切换(再点一次回到画笔) —— 供页面快捷键调用 */
    toggleEraser() {
      this.toolboxState.tool = this.toolboxState.tool === 'eraser' ? 'brush' : 'eraser';
      this.emit('tool', this.toolboxState.tool);
      this.refreshActive();
    }

    /** 参考图显示/隐藏切换 —— 供页面快捷键调用 */
    toggleRef() {
      if (!this._refURL) return;
      this.toolboxState.ref.visible = !this.toolboxState.ref.visible;
      this.updateRefUI();
      this.emit('ref', { action: 'toggle', visible: this.toolboxState.ref.visible });
    }

    /** 从 File 导入参考图(创建 objectURL 并派发 import 事件) */
    loadRefFile(file) {
      if (!file || !/^image\//.test(file.type)) return false;
      if (this._refURL) URL.revokeObjectURL(this._refURL);
      this._refURL = URL.createObjectURL(file);
      this.toolboxState.ref = { url: this._refURL, visible: true, opacity: this.toolboxState.ref.opacity };
      this.updateRefUI();
      this.emit('ref', { action: 'import', url: this._refURL, visible: true, opacity: this.toolboxState.ref.opacity });
      return true;
    }

    /** 移除参考图(回收 objectURL) */
    removeRef() {
      if (this._refURL) { URL.revokeObjectURL(this._refURL); this._refURL = null; }
      this.toolboxState.ref = { url: null, visible: true, opacity: 0.35 };
      this.updateRefUI();
      this.emit('ref', { action: 'remove' });
    }

    /** 根据状态刷新各分组按钮的选中样式 */
    refreshActive() {
      var s = this.toolboxState;

      // 画笔类型
      this.querySelectorAll('[data-brush]').forEach(function (btn) {
        var active = s.tool === 'brush' && btn.dataset.brush === s.brush;
        btn.classList.toggle('active', active);
      });

      // 预设色板
      this.querySelectorAll('.pt-swatch').forEach(function (btn) {
        var active = !this._customActive && btn.dataset.color.toLowerCase() === s.color.toLowerCase();
        btn.classList.toggle('active', active);
      }.bind(this));

      // 自定义颜色
      var custom = this.querySelector('.pt-custom');
      if (custom) custom.classList.toggle('active', this._customActive);

      // 粗细档位
      this.querySelectorAll('[data-size]').forEach(function (btn) {
        var active = Number(btn.dataset.size) === s.sizeStep;
        btn.classList.toggle('active', active);
      });

      // 形状
      this.querySelectorAll('[data-shape]').forEach(function (btn) {
        var active = s.tool === 'brush' && btn.dataset.shape === s.shape;
        btn.classList.toggle('active', active);
      });

      // 橡皮
      this.querySelectorAll('[data-tool="eraser"]').forEach(function (btn) {
        btn.classList.toggle('active', s.tool === 'eraser');
      });

      this.updatePreview();
    }

    /** 更新笔迹预览点(仅滑块模式存在) */
    updatePreview() {
      var dot = this.querySelector('[data-preview-dot]');
      if (!dot) return;
      var s = this.toolboxState;
      var d = Math.max(3, Math.min(30, s.sizePx));
      dot.style.width = d + 'px';
      dot.style.height = d + 'px';
      dot.style.background = s.tool === 'eraser' ? '#fff' : s.color;
      dot.style.border = s.tool === 'eraser' ? '1px dashed #bbb' : 'none';
    }

    /** 更新参考图组的界面(导入按钮 / 控制条的显示与文案) */
    updateRefUI() {
      var importBtn = this.querySelector('[data-ref="import"]');
      var controls = this.querySelector('[data-ref-controls]');
      var toggleBtn = this.querySelector('[data-ref="toggle"]');
      var opSlider = this.querySelector('[data-ref-opacity]');
      var opVal = this.querySelector('[data-ref-opacity-val]');
      var has = !!this._refURL;
      var s = this.toolboxState.ref;

      if (importBtn) importBtn.style.display = has ? 'none' : '';
      if (controls) controls.style.display = has ? '' : 'none';
      if (toggleBtn) {
        toggleBtn.innerHTML = icon(s.visible ? 'eye' : 'eyeOff') +
          '<span>' + (s.visible ? this.t.hideRef : this.t.showRef) + '</span>';
      }
      var op = Math.round(s.opacity * 100);
      if (opSlider) opSlider.value = op;
      if (opVal) opVal.textContent = op + '%';
    }

    /** 统一对外派发 toolbox-change 事件 */
    emit(type, value) {
      this.dispatchEvent(new CustomEvent('toolbox-change', {
        detail: { type: type, value: value, state: this.state },
        bubbles: true,
        composed: true,
      }));
    }
  }

  customElements.define('paint-toolbox', PaintToolbox);
})();
