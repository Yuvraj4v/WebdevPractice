/**
 * 
 * CALC — Scientific Calculator  |  script.js
 * 
 *
 * Architecture:
 *   CalcState   — pure state object (no DOM knowledge)
 *   CalcEngine  — pure math / expression parsing
 *   CalcUI      — all DOM reads & writes
 *   CalcApp     — wires the three layers together
 *
 * No external libraries. Vanilla ES2020.
 * 
 */

'use strict';

/*  1. STATE  */
const CalcState = (() => {
  let state = {
    current:      '',     // what the user is currently typing
    expression:   '',     // full expression shown above result
    result:       '0',    // evaluated result
    waitForOperand: false, // after = or unary op, next digit replaces
    lastAction:   null,   // 'operator' | 'equals' | 'digit' | 'unary'
    history:      [],     // [{expr, result}]
    mode:         'basic',// 'basic' | 'scientific'
    theme:        'dark', // 'dark' | 'light'
  };

  // Restore persisted prefs from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('calcState') || '{}');
    if (saved.history) state.history = saved.history.slice(0, 100);
    if (saved.theme)   state.theme   = saved.theme;
    if (saved.mode)    state.mode    = saved.mode;
  } catch (_) {}

  function persist() {
    try {
      localStorage.setItem('calcState', JSON.stringify({
        history: state.history,
        theme:   state.theme,
        mode:    state.mode,
      }));
    } catch (_) {}
  }

  function reset() {
    state.current        = '';
    state.expression     = '';
    state.result         = '0';
    state.waitForOperand = false;
    state.lastAction     = null;
  }

  return { state, reset, persist };
})();

const S = CalcState.state;


/*  2. ENGINE — pure math  */
const CalcEngine = (() => {

  /** Format a number nicely — cap at 12 significant digits */
  function formatNum(n) {
    if (!isFinite(n)) return 'Error';
    // Use toPrecision to avoid floating-point noise, then strip trailing zeros
    const s = parseFloat(n.toPrecision(12)).toString();
    return s;
  }

  /** Safe factorial */
  function factorial(n) {
    n = Math.floor(n);
    if (n < 0 || n > 170) return Infinity;
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
  }

  /**
   * Evaluate a clean infix expression string.
   * Supports: +, -, *, /, %, unary minus, parentheses.
   * We convert to a safe JS expression and use Function() with strict sanitisation.
   */
  function evaluate(expr) {
    // Sanitise: allow only digits, operators, parens, dot, spaces
    const safe = expr.replace(/[^0-9+\-*/.()% ]/g, '');
    if (!safe.trim()) return null;
    try {
      // Replace % with /100 after a digit
      const jsExpr = safe.replace(/(\d)\s*%/g, '($1/100)');
      // eslint-disable-next-line no-new-func
      const val = new Function(`"use strict"; return (${jsExpr});`)();
      if (typeof val !== 'number') return null;
      if (!isFinite(val)) return val === Infinity ? 'Infinity' : 'Error';
      return formatNum(val);
    } catch (_) {
      return null;
    }
  }

  /**
   * Apply a unary scientific function to the current display value.
   * Returns { result, expression } or { error }.
   */
  function applyUnary(fn, valueStr) {
    const x = parseFloat(valueStr);
    if (isNaN(x)) return { error: 'Error' };
    const DEG = Math.PI / 180; // work in degrees for trig
    let res;
    let label;
    switch (fn) {
      case 'sin':     res = Math.sin(x * DEG);  label = `sin(${x}°)`;  break;
      case 'cos':     res = Math.cos(x * DEG);  label = `cos(${x}°)`;  break;
      case 'tan':
        // tan(90), tan(270), etc → undefined
        if (Math.abs(Math.cos(x * DEG)) < 1e-10) return { error: 'Undefined' };
        res = Math.tan(x * DEG); label = `tan(${x}°)`;
        break;
      case 'log':
        if (x <= 0) return { error: 'Domain Error' };
        res = Math.log10(x); label = `log(${x})`;
        break;
      case 'ln':
        if (x <= 0) return { error: 'Domain Error' };
        res = Math.log(x); label = `ln(${x})`;
        break;
      case 'sqrt':
        if (x < 0) return { error: 'Domain Error' };
        res = Math.sqrt(x); label = `√(${x})`;
        break;
      case 'square':   res = x * x;              label = `${x}²`;       break;
      case 'factorial':res = factorial(x);        label = `${x}!`;       break;
      case 'inverse':
        if (x === 0) return { error: 'Div/0 Error' };
        res = 1 / x;   label = `1/${x}`;
        break;
      default: return { error: 'Error' };
    }
    return { result: formatNum(res), expression: label };
  }

  return { evaluate, applyUnary, formatNum };
})();


/* 3. UI  */
const CalcUI = (() => {

  // Cache DOM references once
  const els = {
    result:       document.getElementById('result'),
    expression:   document.getElementById('expression'),
    display:      document.querySelector('.display'),
    historyPanel: document.getElementById('historyPanel'),
    historyList:  document.getElementById('historyList'),
    clearHistory: document.getElementById('clearHistory'),
    historyToggle:document.getElementById('historyToggle'),
    themeToggle:  document.getElementById('themeToggle'),
    copyBtn:      document.getElementById('copyBtn'),
    copyTooltip:  document.querySelector('.copy-tooltip'),
    sciPanel:     document.getElementById('sciPanel'),
    basicMode:    document.getElementById('basicMode'),
    sciMode:      document.getElementById('sciMode'),
    btnGrid:      document.getElementById('btnGrid'),
  };

  /** Update the result display, adjusting font-size for long numbers */
  function setResult(val) {
    els.result.textContent = val;
    els.result.classList.remove('shrink', 'shrink2', 'error');
    if (val === 'Error' || val === 'Infinity' || val.toLowerCase().includes('error') || val === 'Undefined') {
      els.result.classList.add('error');
    }
    const len = val.replace(/[^0-9.e+-]/g, '').length;
    if (len > 16) els.result.classList.add('shrink2');
    else if (len > 11) els.result.classList.add('shrink');
  }

  /** Update the expression line */
  function setExpression(val) {
    els.expression.textContent = val;
  }

  /** Pop animation on equals */
  function animatePop() {
    els.result.classList.remove('pop');
    // Force reflow to restart animation
    void els.result.offsetWidth;
    els.result.classList.add('pop');
  }

  /** Shake animation on error */
  function animateShake() {
    els.display.classList.remove('shake');
    void els.display.offsetWidth;
    els.display.classList.add('shake');
  }

  /** Ripple a button by its data-action */
  function rippleBtn(action) {
    const btn = document.querySelector(`[data-action="${CSS.escape(action)}"]`);
    if (!btn) return;
    btn.classList.remove('ripple');
    void btn.offsetWidth;
    btn.classList.add('ripple');
    setTimeout(() => btn.classList.remove('ripple'), 400);
  }

  /** Add item to history panel */
  function addHistoryItem(expr, result) {
    const empty = els.historyList.querySelector('.history-empty');
    if (empty) empty.remove();

    const li = document.createElement('li');
    li.className = 'history-item';
    li.innerHTML = `
      <div class="h-expr">${escapeHtml(expr)}</div>
      <div class="h-result">${escapeHtml(result)}</div>
    `;
    // Click to restore result
    li.addEventListener('click', () => {
      S.current        = result;
      S.result         = result;
      S.expression     = expr;
      S.waitForOperand = true;
      S.lastAction     = 'equals';
      setResult(result);
      setExpression(expr);
    });
    els.historyList.insertBefore(li, els.historyList.firstChild);
  }

  /** Rebuild history panel from state */
  function renderHistory() {
    els.historyList.innerHTML = '';
    if (S.history.length === 0) {
      els.historyList.innerHTML = '<li class="history-empty">No history yet</li>';
      return;
    }
    // Render latest first
    [...S.history].reverse().forEach(({ expr, result }) => addHistoryItem(expr, result));
  }

  /** Toggle history panel */
  function toggleHistory() {
    els.historyPanel.classList.toggle('hidden');
  }

  /** Show/hide history panel explicitly */
  function setHistoryVisible(visible) {
    if (visible) els.historyPanel.classList.remove('hidden');
    else els.historyPanel.classList.add('hidden');
  }

  /** Apply theme to <html> */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  /** Set mode (basic/scientific) */
  function applyMode(mode) {
    if (mode === 'scientific') {
      els.sciPanel.classList.add('visible');
      els.sciMode.classList.add('active');
      els.basicMode.classList.remove('active');
    } else {
      els.sciPanel.classList.remove('visible');
      els.basicMode.classList.add('active');
      els.sciMode.classList.remove('active');
    }
  }

  /** Flash copy tooltip */
  function showCopied() {
    els.copyTooltip.classList.add('show');
    setTimeout(() => els.copyTooltip.classList.remove('show'), 1500);
  }

  /** Escape HTML for safe innerHTML insertion */
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    els,
    setResult,
    setExpression,
    animatePop,
    animateShake,
    rippleBtn,
    addHistoryItem,
    renderHistory,
    toggleHistory,
    setHistoryVisible,
    applyTheme,
    applyMode,
    showCopied,
  };
})();


/*  4. APP — wires state + engine + UI */
const CalcApp = (() => {

  const { state: S } = CalcState;
  const engine = CalcEngine;
  const ui = CalcUI;

  /* ─ Helpers ─ */

  function currentDisplay() {
    return S.current || S.result;
  }

  /** Append a digit or decimal to S.current */
  function appendDigit(d) {
    if (S.waitForOperand) {
      S.current        = d;
      S.waitForOperand = false;
    } else {
      // Prevent leading zeros (0099 → 99), allow "0."
      if (S.current === '0' && d !== '.') {
        S.current = d;
      } else {
        // Limit input length
        if (S.current.length >= 20) return;
        S.current += d;
      }
    }
    S.result     = S.current;
    S.lastAction = 'digit';
    ui.setResult(S.current);
  }

  /** Append decimal */
  function appendDecimal() {
    if (S.waitForOperand) {
      S.current        = '0.';
      S.waitForOperand = false;
    } else {
      if (S.current.includes('.')) return; // already has one
      S.current = (S.current || '0') + '.';
    }
    S.result     = S.current;
    S.lastAction = 'digit';
    ui.setResult(S.current);
  }

  /** Handle an operator (+, -, *, /) */
  function handleOperator(op) {
    const opSymbol = { add: '+', subtract: '-', multiply: '*', divide: '/' }[op];
    const opDisplay= { add: '+', subtract: '−', multiply: '×', divide: '÷' }[op];

    // If previous action was also an operator, just replace it
    if (S.lastAction === 'operator' && S.expression) {
      S.expression = S.expression.slice(0, -3) + ` ${opDisplay} `;
      ui.setExpression(S.expression);
      S.lastAction = 'operator';
      return;
    }

    const val = currentDisplay();
    S.expression     += (S.expression ? '' : '') + val + ` ${opDisplay} `;
    // Track the actual operator for evaluation
    S.evalExpression  = (S.evalExpression || '') + val + ` ${opSymbol} `;
    S.waitForOperand  = true;
    S.lastAction      = 'operator';
    ui.setExpression(S.expression);
  }

  /** Evaluate the current expression */
  function handleEquals() {
    const val = currentDisplay();

    // Build complete expression for evaluation
    let exprForEval  = (S.evalExpression || '') + val;
    let exprForDisplay = (S.expression || val);

    // If just typing a number with no operator, re-evaluate last op if available
    if (!S.evalExpression && S.lastAction !== 'operator') {
      exprForEval   = val;
      exprForDisplay = val;
    }

    const result = engine.evaluate(exprForEval);

    if (result === null) {
      ui.animateShake();
      ui.setResult('Error');
      S.result = 'Error';
      clearAll();
      return;
    }

    // Save to history
    const histEntry = { expr: exprForDisplay + ' =', result };
    S.history.push(histEntry);
    if (S.history.length > 100) S.history.shift();
    CalcState.persist();
    ui.addHistoryItem(histEntry.expr, histEntry.result);

    ui.setExpression(exprForDisplay + ' =');
    ui.setResult(result);
    ui.animatePop();

    S.result         = result;
    S.current        = result;
    S.expression     = exprForDisplay + ' =';
    S.evalExpression = '';
    S.waitForOperand = true;
    S.lastAction     = 'equals';
  }

  /** Handle % */
  function handlePercent() {
    const val = parseFloat(currentDisplay());
    if (isNaN(val)) return;
    const result = engine.formatNum(val / 100);
    ui.setResult(result);
    ui.setExpression(`${val}%`);
    S.current        = result;
    S.result         = result;
    S.waitForOperand = true;
    S.lastAction     = 'digit';
  }

  /** Clear last character */
  function handleBackspace() {
    if (S.waitForOperand || S.lastAction === 'equals') return;
    S.current = S.current.slice(0, -1) || '0';
    S.result  = S.current;
    ui.setResult(S.current);
    if (S.current === '0') S.lastAction = null;
  }

  /** Clear current entry only */
  function clearEntry() {
    S.current        = '';
    S.result         = '0';
    S.waitForOperand = false;
    S.lastAction     = null;
    ui.setResult('0');
  }

  /** All clear */
  function clearAll() {
    S.current         = '';
    S.expression      = '';
    S.evalExpression  = '';
    S.result          = '0';
    S.waitForOperand  = false;
    S.lastAction      = null;
    ui.setResult('0');
    ui.setExpression('');
  }

  /** Handle scientific / unary functions */
  function handleScientific(fn) {
    // Constants
    if (fn === 'pi') {
      S.current        = String(Math.PI);
      S.result         = engine.formatNum(Math.PI);
      S.waitForOperand = false;
      ui.setResult(S.result);
      ui.setExpression('π');
      return;
    }
    if (fn === 'euler') {
      S.current        = String(Math.E);
      S.result         = engine.formatNum(Math.E);
      S.waitForOperand = false;
      ui.setResult(S.result);
      ui.setExpression('e');
      return;
    }
    if (fn === 'power') {
      // xʸ — treat like an operator using **
      const val = currentDisplay();
      S.expression     = `${val} ^ `;
      S.evalExpression = `${val} ** `;
      S.waitForOperand = true;
      S.lastAction     = 'operator';
      ui.setExpression(S.expression);
      return;
    }

    // Unary functions
    const val = currentDisplay();
    const { result, expression, error } = engine.applyUnary(fn, val);

    if (error) {
      ui.setResult(error);
      ui.setExpression(expression || '');
      ui.animateShake();
      S.result = error;
      clearAll();
      return;
    }

    ui.setResult(result);
    ui.setExpression(expression);
    ui.animatePop();

    S.current        = result;
    S.result         = result;
    S.expression     = expression;
    S.evalExpression = '';
    S.waitForOperand = true;
    S.lastAction     = 'unary';

    // Add to history
    const histEntry = { expr: expression + ' =', result };
    S.history.push(histEntry);
    if (S.history.length > 100) S.history.shift();
    CalcState.persist();
    ui.addHistoryItem(histEntry.expr, histEntry.result);
  }

  /* ─ Event dispatch ─ */

  function handleAction(action) {
    switch (true) {
      // Digits
      case /^[0-9]$/.test(action):
        appendDigit(action);
        break;

      case action === 'decimal':
        appendDecimal();
        break;

      // Operators
      case ['add', 'subtract', 'multiply', 'divide'].includes(action):
        handleOperator(action);
        break;

      case action === 'equals':
        handleEquals();
        break;

      case action === 'percent':
        handlePercent();
        break;

      case action === 'backspace':
        handleBackspace();
        break;

      case action === 'clear':
        clearEntry();
        break;

      case action === 'ac':
        clearAll();
        break;

      // Scientific
      case ['sin','cos','tan','log','ln','sqrt','square','factorial',
            'power','pi','euler','inverse'].includes(action):
        handleScientific(action);
        break;

      default:
        break;
    }
    ui.rippleBtn(action);
  }

  /* ─ Button click listeners ─ */

  function initButtons() {
    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        handleAction(btn.dataset.action);
      });
    });
  }

  /* ─ Keyboard listener ─ */

  function initKeyboard() {
    document.addEventListener('keydown', e => {
      // Don't intercept if typing in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      // Special app shortcuts
      if (e.key === 'h' || e.key === 'H') { ui.toggleHistory(); return; }
      if (e.key === 't' || e.key === 'T') { toggleTheme(); return; }

      // Ctrl+C to copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        copyResult(); return;
      }

      const map = {
        '0': '0', '1': '1', '2': '2', '3': '3', '4': '4',
        '5': '5', '6': '6', '7': '7', '8': '8', '9': '9',
        '.': 'decimal', ',': 'decimal',
        '+': 'add',
        '-': 'subtract',
        '*': 'multiply',
        '/': 'divide',
        'Enter': 'equals',
        '=': 'equals',
        '%': 'percent',
        'Backspace': 'backspace',
        'Delete': 'clear',
        'Escape': 'ac',
      };

      const action = map[e.key];
      if (action) {
        e.preventDefault();
        handleAction(action);
      }
    });
  }

  /* ─ Mode toggle ─ */

  function initModeToggle() {
    ui.els.basicMode.addEventListener('click', () => {
      S.mode = 'basic';
      ui.applyMode('basic');
      CalcState.persist();
    });
    ui.els.sciMode.addEventListener('click', () => {
      S.mode = 'scientific';
      ui.applyMode('scientific');
      CalcState.persist();
    });
  }

  /* ─ Theme toggle ─ */

  function toggleTheme() {
    S.theme = S.theme === 'dark' ? 'light' : 'dark';
    ui.applyTheme(S.theme);
    CalcState.persist();
  }

  function initThemeToggle() {
    ui.els.themeToggle.addEventListener('click', toggleTheme);
  }

  /* ─ History controls ─ */

  function initHistory() {
    ui.els.historyToggle.addEventListener('click', ui.toggleHistory);
    ui.els.clearHistory.addEventListener('click', () => {
      S.history = [];
      CalcState.persist();
      ui.renderHistory();
    });
    // Hide panel by default on mobile
    if (window.innerWidth < 769) {
      ui.setHistoryVisible(false);
    }
  }

  /* ─ Copy button ─ */

  function copyResult() {
    const text = ui.els.result.textContent;
    if (!text || text === '0') return;
    navigator.clipboard.writeText(text).then(() => ui.showCopied()).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      ui.showCopied();
    });
  }

  function initCopy() {
    ui.els.copyBtn.addEventListener('click', copyResult);
  }

  /* ─ Boot ─ */

  function init() {
    // Apply saved preferences
    ui.applyTheme(S.theme);
    ui.applyMode(S.mode);
    ui.renderHistory();

    // Start with history hidden if no history
    if (S.history.length === 0 || window.innerWidth < 769) {
      ui.setHistoryVisible(false);
    }

    initButtons();
    initKeyboard();
    initModeToggle();
    initThemeToggle();
    initHistory();
    initCopy();

    // Make sure evalExpression starts clean
    S.evalExpression = '';

    console.log('%cCALC loaded ✓', 'color:#aaff3e;font-weight:bold;');
  }

  return { init };
})();


/*  5. BOOTSTRAP */
document.addEventListener('DOMContentLoaded', CalcApp.init);
