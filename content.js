// Eyes Chrome Extension - Content Script
// Applies accessibility modes (Dark, Grayscale, Sepia, Blue Light, High Contrast)
// with brightness, contrast, font scaling, custom colors, and readability.
// Smart native dark theme detection (Wikipedia etc.) + automatic filter fallback.
// Preserves site's original design fidelity where possible. Sharp minimal design.

'use strict';

const CONFIG = {
  STYLE_ID: 'eyes-mode-style',
  REAPPLY_INTERVAL_MS: 1500,
  DEFAULT_BRIGHTNESS: 100,
  DEFAULT_CONTRAST: 100,
  DEFAULT_FONT_SCALE: 1.0,
  DEFAULT_LINE_HEIGHT: 1.55,
  DEFAULT_LETTER_SPACING: 0,
};

let state = {
  currentMode: null,
  brightness: CONFIG.DEFAULT_BRIGHTNESS,
  contrast: CONFIG.DEFAULT_CONTRAST,
  fontScale: CONFIG.DEFAULT_FONT_SCALE,
  lineHeight: CONFIG.DEFAULT_LINE_HEIGHT,
  letterSpacing: CONFIG.DEFAULT_LETTER_SPACING,
  customColors: { text: '', bg: '', link: '' },
  siteSpecific: false, // whether current settings are site-specific
  reapplyInterval: null,
  usingNativeDark: false, // internal: whether current dark mode is using site's native theme
};

const MODES = {
  dark: {
    // Pure Dark cssFilter-style: html gets invert(100%) hue-rotate(180deg) + bright/contrast.
    // No forced text colors (preserves site hues/accents). Media get reverse filter to preserve images.
    htmlFilter: (b, c) => `invert(100%) hue-rotate(180deg) brightness(${b}%) contrast(${c}%)`,
    background: '#1a1a1a',
    // textColor etc removed from use in pure filter; custom handled via special rules if provided
    mediaFilter: 'invert(100%) hue-rotate(180deg)',
  },
  grayscale: {
    htmlFilter: (b, c) => `grayscale(100%) brightness(${b}%) contrast(${c}%)`,
    background: '#f8f9fa',
    textColor: '#212529',
    linkColor: '#495057',
    mediaFilter: 'grayscale(100%)',
  },
  sepia: {
    htmlFilter: (b, c) => `sepia(100%) brightness(${b}%) contrast(${c}%)`,
    background: '#f5f0e7',
    textColor: '#5c4b3a',
    linkColor: '#7a5e3f',
    mediaFilter: 'sepia(100%)',
  },
  'blue-light': {
    htmlFilter: (b, c) => `brightness(${b}%) contrast(${c}%)`,
    background: '#fff8e1',
    textColor: '#333333',
    linkColor: '#444444',
    extraStyles: `
      * {
        color: color-mix(in srgb, currentColor, #ffca28 25%) !important;
        background-color: color-mix(in srgb, currentBackgroundColor, #ffe0b2 15%) !important;
      }
    `,
  },
  'high-contrast': {
    htmlFilter: (b, c) => `contrast(${c}%) brightness(${b}%)`,
    background: '#000000',
    textColor: '#ffffff',
    linkColor: '#ffffff',
    borderColor: '#ffffff',
    mediaFilter: 'contrast(100%)',
  },
};

// --- Native Dark Theme Helpers (v1.0) ---
function siteSupportsNativeDarkTheme() {
  try {
    const root = document.documentElement;
    const body = document.body;

    // 1. Check current classes indicating dark is active or supported
    if (root.classList.contains('dark') || root.classList.contains('dark-mode') || root.classList.contains('theme-dark')) {
      return true;
    }
    if (body && (body.classList.contains('dark') || body.classList.contains('dark-mode') || body.classList.contains('theme-dark'))) {
      return true;
    }

    // Wikipedia / MediaWiki Vector 2022 dark mode (skin-theme-clientpref-night etc.)
    // Even if not currently active, presence of these or their CSS rules indicates support
    if (root.classList.contains('skin-theme-clientpref-night') || 
        root.classList.contains('skin-theme-clientpref-os') ||
        root.classList.contains('skin-theme-clientpref-day') ||
        (body && (body.classList.contains('skin-theme-clientpref-night') || 
                  body.classList.contains('skin-theme-clientpref-os') ||
                  body.classList.contains('skin-theme-clientpref-day')))) {
      return true;
    }

    // 2. Check data-* theme attributes
    const themeAttrs = ['data-theme', 'data-color-mode', 'data-mode', 'data-color-scheme', 'data-bs-theme'];
    for (const attr of themeAttrs) {
      const val = ((root.getAttribute(attr) || (body && body.getAttribute(attr))) || '').toLowerCase();
      if (val.includes('dark') || val === 'dark' || val === 'dark_dimmed') {
        return true;
      }
    }

    // 3. Check meta tag for color-scheme support
    const metaColor = document.querySelector('meta[name="color-scheme"]');
    if (metaColor && metaColor.content && metaColor.content.toLowerCase().includes('dark')) {
      return true;
    }

    // 4. Best-effort scan of stylesheets for dark mode selectors (may miss some due to CORS)
    const sheets = Array.from(document.styleSheets || []);
    for (const sheet of sheets) {
      try {
        const rules = sheet.cssRules || sheet.rules || [];
        for (const rule of rules) {
          const text = (rule.selectorText || rule.cssText || '').toLowerCase();
          if (text.includes('.dark ') || text.includes('.dark,') || text.includes('.dark{') ||
              text.includes('[data-theme="dark"]') || text.includes('[data-theme=dark]') ||
              text.includes('[data-color-mode="dark"]') || text.includes('prefers-color-scheme: dark') ||
              text.includes('.dark-mode') || text.includes('data-bs-theme="dark"') ||
              text.includes('skin-theme-clientpref-night') || text.includes('skin-theme-clientpref-') ||
              text.includes('clientpref-night')) {
            return true;
          }
        }
      } catch (e) {
        // cross-origin stylesheet or security error - skip
      }
    }
    return false;
  } catch (e) {
    return false;
  }
}

function activateNativeDarkTheme() {
  const root = document.documentElement;
  const body = document.body || document.getElementsByTagName('body')[0];
  let changed = false;

  // Add/ensure dark classes, remove light ones
  const lightClasses = ['light', 'light-mode', 'theme-light'];
  lightClasses.forEach(cls => {
    if (root.classList.contains(cls)) { root.classList.remove(cls); changed = true; }
  });
  if (!root.classList.contains('dark')) { root.classList.add('dark'); changed = true; }

  if (body) {
    lightClasses.forEach(cls => {
      if (body.classList.contains(cls)) { body.classList.remove(cls); changed = true; }
    });
    if (!body.classList.contains('dark')) { body.classList.add('dark'); changed = true; }
  }

  // Wikipedia/MediaWiki Vector dark mode: add skin-theme-clientpref-night, remove conflicting
  const mwDarkClass = 'skin-theme-clientpref-night';
  const mwLightClasses = ['skin-theme-clientpref-day', 'skin-theme-clientpref-os'];
  mwLightClasses.forEach(cls => {
    if (root.classList.contains(cls)) { root.classList.remove(cls); changed = true; }
  });
  if (!root.classList.contains(mwDarkClass)) { root.classList.add(mwDarkClass); changed = true; }

  if (body) {
    mwLightClasses.forEach(cls => {
      if (body.classList.contains(cls)) { body.classList.remove(cls); changed = true; }
    });
    if (!body.classList.contains(mwDarkClass)) { body.classList.add(mwDarkClass); changed = true; }
  }

  // Set data attrs to dark
  const themeAttrs = ['data-theme', 'data-color-mode', 'data-mode', 'data-color-scheme', 'data-bs-theme'];
  themeAttrs.forEach(attr => {
    const cur = root.getAttribute(attr);
    if (cur && cur.toLowerCase().includes('light')) {
      root.setAttribute(attr, cur.replace(/light/gi, 'dark'));
      changed = true;
    } else if (!cur || cur.toLowerCase() === 'light') {
      root.setAttribute(attr, 'dark');
      changed = true;
    }
  });
  if (body) {
    themeAttrs.forEach(attr => {
      const cur = body.getAttribute(attr);
      if (cur && cur.toLowerCase().includes('light')) {
        body.setAttribute(attr, cur.replace(/light/gi, 'dark'));
        changed = true;
      } else if (!cur || cur.toLowerCase() === 'light') {
        body.setAttribute(attr, 'dark');
        changed = true;
      }
    });
  }
  return changed;
}

function revertNativeThemeToLight() {
  const root = document.documentElement;
  const body = document.body || document.getElementsByTagName('body')[0];
  let changed = false;

  if (root.classList.contains('dark')) { root.classList.remove('dark'); root.classList.add('light'); changed = true; }
  if (root.classList.contains('dark-mode')) { root.classList.remove('dark-mode'); changed = true; }

  if (body) {
    if (body.classList.contains('dark')) { body.classList.remove('dark'); body.classList.add('light'); changed = true; }
    if (body.classList.contains('dark-mode')) { body.classList.remove('dark-mode'); changed = true; }
  }

  // Wikipedia/MediaWiki: remove dark class, optionally leave without forcing day (CSS often defaults)
  if (root.classList.contains('skin-theme-clientpref-night')) { root.classList.remove('skin-theme-clientpref-night'); changed = true; }
  if (body && body.classList.contains('skin-theme-clientpref-night')) { body.classList.remove('skin-theme-clientpref-night'); changed = true; }

  const themeAttrs = ['data-theme', 'data-color-mode', 'data-mode', 'data-color-scheme', 'data-bs-theme'];
  themeAttrs.forEach(attr => {
    const cur = root.getAttribute(attr);
    if (cur && cur.toLowerCase().includes('dark')) {
      root.setAttribute(attr, cur.replace(/dark/gi, 'light'));
      changed = true;
    }
  });
  if (body) {
    themeAttrs.forEach(attr => {
      const cur = body.getAttribute(attr);
      if (cur && cur.toLowerCase().includes('dark')) {
        body.setAttribute(attr, cur.replace(/dark/gi, 'light'));
        changed = true;
      }
    });
  }
  return changed;
}

// Heuristic to check if native dark theme actually applied dark styles (for fallback logic)
function isPageEffectivelyDark() {
  try {
    let el = document.documentElement;
    let bg = getComputedStyle(el).backgroundColor;
    // Fallback to body if html is transparent
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)' || bg === 'rgb(255, 255, 255)') {
      el = document.body || document.getElementsByTagName('body')[0];
      if (el) bg = getComputedStyle(el).backgroundColor;
    }
    if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') return false;

    const match = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (match) {
      const r = parseInt(match[1], 10);
      const g = parseInt(match[2], 10);
      const b = parseInt(match[3], 10);
      // Perceived luminance (Rec. 709)
      const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      return luminance < 0.35; // threshold: below ~35% luminance = dark theme active
    }
    return false;
  } catch (e) {
    return false;
  }
}

// Apply or update the mode styles on the page
function applyMode(mode, newBrightness = CONFIG.DEFAULT_BRIGHTNESS, newContrast = CONFIG.DEFAULT_CONTRAST, force = false) {
  if (!force && !mode && !state.currentMode) return;

  const existingStyle = document.getElementById(CONFIG.STYLE_ID);
  if (existingStyle) existingStyle.remove();

  if (!mode) {
    if (state.usingNativeDark) {
      revertNativeThemeToLight();
    }
    state.currentMode = null;
    state.brightness = CONFIG.DEFAULT_BRIGHTNESS;
    state.contrast = CONFIG.DEFAULT_CONTRAST;
    state.usingNativeDark = false;
    document.documentElement.style.removeProperty('--font-scale');
    document.documentElement.style.removeProperty('--line-height');
    document.documentElement.style.removeProperty('--letter-spacing');
    document.documentElement.style.removeProperty('--custom-text');
    document.documentElement.style.removeProperty('--custom-bg');
    document.documentElement.style.removeProperty('--custom-link');
    if (state.reapplyInterval) {
      clearInterval(state.reapplyInterval);
      state.reapplyInterval = null;
    }
    // Notify popup of state change (if open)
    chrome.runtime.sendMessage({ action: 'stateChanged', state: getCurrentState() }).catch(() => {});
    return;
  }

  // mode is truthy - apply it
  const wasUsingNative = state.usingNativeDark;
  state.currentMode = mode;
  state.brightness = newBrightness;
  state.contrast = newContrast;

  let useNativeDark = false;
  if (mode === 'dark') {
    if (siteSupportsNativeDarkTheme()) {
      activateNativeDarkTheme();
      // Verify that native dark actually took effect (background became dark).
      // If not (e.g. Wikipedia class added but styles not matching, or site doesn't fully support),
      // revert and fall back to extension's filter for reliability.
      if (isPageEffectivelyDark()) {
        useNativeDark = true;
        state.usingNativeDark = true;
      } else {
        revertNativeThemeToLight();
        state.usingNativeDark = false;
        useNativeDark = false;
      }
    } else {
      state.usingNativeDark = false;
      useNativeDark = false;
    }
  } else {
    if (wasUsingNative) {
      revertNativeThemeToLight();
    }
    state.usingNativeDark = false;
  }

  const style = document.createElement('style');
  style.id = CONFIG.STYLE_ID;

  let css = '';
  if (useNativeDark) {
    // Native dark theme path (v1.0): site provides its own dark styles.
    // We only inject readability (font scale, line-height, letter-spacing) + custom color overrides if any.
    // No html filter, no media reverse (native handles visuals cleanly).
    css = `
      :root {
        --font-scale: ${state.fontScale};
        --line-height: ${state.lineHeight};
        --letter-spacing: ${state.letterSpacing}px;
        ${state.customColors.text ? `--custom-text: ${state.customColors.text};` : ''}
        ${state.customColors.bg ? `--custom-bg: ${state.customColors.bg};` : ''}
        ${state.customColors.link ? `--custom-link: ${state.customColors.link};` : ''}
      }

      /* Font scaling (exclude UI elements and fixed-size) */
      *:not(svg, [style*="font-size"], input, textarea, select, button) {
        font-size: calc(var(--font-scale) * 100%) !important;
      }

      /* Readability + optional custom color overrides (applied on top of site's native dark) */
      body, div, section, article, main, header, footer, p, h1, h2, h3, h4, h5, h6, span, li, td, th {
        line-height: var(--line-height, 1.55) !important;
        letter-spacing: var(--letter-spacing, 0) !important;
        ${state.customColors.text ? `color: var(--custom-text, inherit) !important;` : ''}
        ${state.customColors.bg ? `background-color: var(--custom-bg, transparent) !important;` : ''}
      }

      a, button, input, textarea, select, [role="button"] {
        ${state.customColors.link ? `color: var(--custom-link, inherit) !important;` : ''}
      }
    `;
  } else {
    // Filter-based modes
    const modeConfig = MODES[mode] || {};

    // Pure filter modes (dark, grayscale, sepia) rely on CSS filter transform.
    // We do NOT force text/link colors here (unlike high-contrast/blue-light).
    const isPureFilterMode = mode === 'dark' || mode === 'grayscale' || mode === 'sepia';

    css = `
      :root {
        --font-scale: ${state.fontScale};
        --line-height: ${state.lineHeight};
        --letter-spacing: ${state.letterSpacing}px;
        ${state.customColors.text ? `--custom-text: ${state.customColors.text};` : ''}
        ${state.customColors.bg ? `--custom-bg: ${state.customColors.bg};` : ''}
        ${state.customColors.link ? `--custom-link: ${state.customColors.link};` : ''}
      }

      /* Font scaling (exclude UI elements and fixed-size) */
      *:not(svg, [style*="font-size"], input, textarea, select, button) {
        font-size: calc(var(--font-scale) * 100%) !important;
      }

      /* Core page styles - filter applied to html for transformation (Dark Reader inspired) */
      html {
        filter: ${modeConfig.htmlFilter ? modeConfig.htmlFilter(state.brightness, state.contrast) : ''} !important;
        background: var(--custom-bg, ${modeConfig.background || '#ffffff'}) !important;
      }

      /* Media elements get reverse filter so they keep original colors (double transform cancels inversion for photos/videos) */
      img, video, iframe, [style*="background-image"], canvas, picture {
        filter: ${modeConfig.mediaFilter || 'none'} !important;
      }

      /* Readability controls + transparent backgrounds always; color forcing ONLY for non-pure-filter modes */
      body, div, section, article, main, header, footer, p, h1, h2, h3, h4, h5, h6, span, li, td, th {
        background: transparent !important;
        ${isPureFilterMode ? '' : `color: var(--custom-text, ${modeConfig.textColor || '#000000'}) !important;`}
        line-height: var(--line-height, 1.55) !important;
        letter-spacing: var(--letter-spacing, 0) !important;
      }

      a, button, input, textarea, select, [role="button"] {
        ${isPureFilterMode ? '' : `color: var(--custom-link, ${modeConfig.linkColor || '#000000'}) !important;`}
        ${!isPureFilterMode && modeConfig.secondaryBg ? `background: var(--custom-bg, ${modeConfig.secondaryBg}) !important;` : ''}
        ${!isPureFilterMode && modeConfig.borderColor ? `border-color: ${modeConfig.borderColor} !important;` : ''}
      }

      /* Custom colors support for pure filter modes (dark/grayscale/sepia):
         Apply desired custom color + reverse filter so it appears as picked (cancels html filter).
         This makes custom colors work correctly even in dark mode! */
      ${isPureFilterMode && (state.customColors.text || state.customColors.bg || state.customColors.link) ? `
        body, div, section, article, main, header, footer, p, h1, h2, h3, h4, h5, h6, span, li, td, th,
        a, button, input, textarea, select, [role="button"] {
          ${state.customColors.text ? `color: ${state.customColors.text} !important;` : ''}
          ${state.customColors.bg ? `background-color: ${state.customColors.bg} !important;` : ''}
          /* reverse filter (no brightness/contrast to avoid double-adjust) */
          filter: ${modeConfig.mediaFilter || 'invert(100%) hue-rotate(180deg)'} brightness(100%) contrast(100%) !important;
        }
      ` : ''}

      ${modeConfig.extraStyles || ''}
    `;
  }

  style.textContent = css;
  document.head.appendChild(style);

  // Auto-reapply protection (in case site scripts remove our style)
  if (!state.reapplyInterval) {
    state.reapplyInterval = setInterval(() => {
      if (state.currentMode && !document.getElementById(CONFIG.STYLE_ID)) {
        applyMode(state.currentMode, state.brightness, state.contrast, true);
      }
    }, CONFIG.REAPPLY_INTERVAL_MS);
  }

  chrome.runtime.sendMessage({ action: 'stateChanged', state: getCurrentState() }).catch(() => {});
}

// Get serializable current state for popup
function getCurrentState() {
  return {
    currentMode: state.currentMode,
    brightness: state.brightness,
    contrast: state.contrast,
    fontScale: state.fontScale,
    lineHeight: state.lineHeight,
    letterSpacing: state.letterSpacing,
    customColors: { ...state.customColors },
    siteSpecific: state.siteSpecific,
  };
}

// Update font scale (callable from popup)
function updateFontScale(scale) {
  state.fontScale = parseFloat(scale) || CONFIG.DEFAULT_FONT_SCALE;
  document.documentElement.style.setProperty('--font-scale', state.fontScale);
  
  if (state.currentMode) {
    applyMode(state.currentMode, state.brightness, state.contrast);
  }
  chrome.runtime.sendMessage({ action: 'stateChanged', state: getCurrentState() }).catch(() => {});
}

// Update custom colors
function updateCustomColors(colors) {
  state.customColors = { ...state.customColors, ...colors };
  if (state.currentMode) {
    applyMode(state.currentMode, state.brightness, state.contrast);
  } else {
    // Apply colors even without mode for font scaling + colors
    const root = document.documentElement;
    if (colors.text) root.style.setProperty('--custom-text', colors.text);
    if (colors.bg) root.style.setProperty('--custom-bg', colors.bg);
    if (colors.link) root.style.setProperty('--custom-link', colors.link);
  }
  chrome.runtime.sendMessage({ action: 'stateChanged', state: getCurrentState() }).catch(() => {});
}

// Message listener from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getState') {
    sendResponse(getCurrentState());
    return true;
  }

  if (message.action === 'applyMode') {
    const { mode, brightness, contrast } = message;
    applyMode(mode, brightness, contrast);
    sendResponse({ success: true, state: getCurrentState() });
    return true;
  }

  if (message.action === 'updateSliders') {
    if (state.currentMode) {
      applyMode(state.currentMode, message.brightness, message.contrast);
    }
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'updateFontScale') {
    updateFontScale(message.scale);
    sendResponse({ success: true, state: getCurrentState() });
    return true;
  }

  if (message.action === 'updateCustomColors') {
    updateCustomColors(message.colors);
    sendResponse({ success: true, state: getCurrentState() });
    return true;
  }

  if (message.action === 'resetAll') {
    applyMode(null);
    state.fontScale = CONFIG.DEFAULT_FONT_SCALE;
    state.lineHeight = CONFIG.DEFAULT_LINE_HEIGHT;
    state.letterSpacing = CONFIG.DEFAULT_LETTER_SPACING;
    document.documentElement.style.removeProperty('--font-scale');
    document.documentElement.style.removeProperty('--line-height');
    document.documentElement.style.removeProperty('--letter-spacing');
    state.customColors = { text: '', bg: '', link: '' };
    document.documentElement.style.removeProperty('--custom-text');
    document.documentElement.style.removeProperty('--custom-bg');
    document.documentElement.style.removeProperty('--custom-link');
    chrome.storage.local.remove(['eyesState', 'eyesSiteState']);
    sendResponse({ success: true, state: getCurrentState() });
    return true;
  }

  if (message.action === 'updateReadability') {
    state.lineHeight = message.lineHeight || CONFIG.DEFAULT_LINE_HEIGHT;
    state.letterSpacing = message.letterSpacing || CONFIG.DEFAULT_LETTER_SPACING;
    document.documentElement.style.setProperty('--line-height', state.lineHeight);
    document.documentElement.style.setProperty('--letter-spacing', `${state.letterSpacing}px`);
    
    if (state.currentMode) {
      applyMode(state.currentMode, state.brightness, state.contrast);
    }
    sendResponse({ success: true, state: getCurrentState() });
    return true;
  }

  if (message.action === 'setSiteSpecific') {
    state.siteSpecific = !!message.enable;
    sendResponse({ success: true, siteSpecific: state.siteSpecific });
    return true;
  }

  if (message.action === 'togglePageTheme') {
    // Best-effort toggle for common website dark mode implementations (Tailwind, data attrs, etc.)
    const html = document.documentElement;
    const body = document.body || document.getElementsByTagName('body')[0];

    let toggled = false;

    // Helper to toggle dark/light class on an element
    function toggleDarkClass(el) {
      if (!el) return false;
      if (el.classList.contains('dark')) {
        el.classList.remove('dark');
        el.classList.add('light');
        return true;
      } else if (el.classList.contains('light')) {
        el.classList.remove('light');
        el.classList.add('dark');
        return true;
      } else if (el.classList.contains('dark-mode')) {
        el.classList.remove('dark-mode');
        el.classList.add('light-mode');
        return true;
      } else if (el.classList.contains('light-mode')) {
        el.classList.remove('light-mode');
        el.classList.add('dark-mode');
        return true;
      } else if (!el.classList.contains('dark') && !el.classList.contains('light') && !el.classList.contains('dark-mode')) {
        // Default to enabling dark if none present
        el.classList.add('dark');
        return true;
      }
      return false;
    }

    // Toggle on html and body
    if (toggleDarkClass(html)) toggled = true;
    if (toggleDarkClass(body)) toggled = true;

    // Pattern: data-theme, data-color-mode, data-mode
    const themeAttrs = ['data-theme', 'data-color-mode', 'data-mode', 'data-color-scheme'];
    for (const attr of themeAttrs) {
      const val = html.getAttribute(attr);
      if (val === 'dark' || val === 'dark_dimmed' || val === 'dark-mode') {
        html.setAttribute(attr, 'light');
        toggled = true;
        break;
      } else if (val === 'light' || val === 'light-mode') {
        html.setAttribute(attr, 'dark');
        toggled = true;
        break;
      } else if (!val && attr === 'data-theme') {
        html.setAttribute(attr, 'dark');
        toggled = true;
        break;
      }
    }

    // Also try body for data attrs
    if (!toggled && body) {
      for (const attr of themeAttrs) {
        const val = body.getAttribute(attr);
        if (val === 'dark' || val === 'dark_dimmed' || val === 'dark-mode') {
          body.setAttribute(attr, 'light');
          toggled = true;
          break;
        } else if (val === 'light' || val === 'light-mode') {
          body.setAttribute(attr, 'dark');
          toggled = true;
          break;
        }
      }
    }

    sendResponse({ success: true, toggled });
    return true;
  }

  return false;
});

// Initialize: load saved state from storage and apply
function initialize() {
  // Try site-specific first, then global (popup will manage which one is authoritative)
  chrome.storage.local.get(['eyesSiteState', 'eyesState'], (result) => {
    let saved = result.eyesSiteState || result.eyesState;
    
    if (saved) {
      state.fontScale = saved.fontScale || CONFIG.DEFAULT_FONT_SCALE;
      state.lineHeight = saved.lineHeight || CONFIG.DEFAULT_LINE_HEIGHT;
      state.letterSpacing = saved.letterSpacing || CONFIG.DEFAULT_LETTER_SPACING;
      state.customColors = saved.customColors || { text: '', bg: '', link: '' };
      state.siteSpecific = !!saved.siteSpecific;

      // Apply readability vars immediately
      document.documentElement.style.setProperty('--font-scale', state.fontScale);
      document.documentElement.style.setProperty('--line-height', state.lineHeight);
      document.documentElement.style.setProperty('--letter-spacing', `${state.letterSpacing}px`);

      if (saved.currentMode) {
        setTimeout(() => {
          applyMode(saved.currentMode, saved.brightness || CONFIG.DEFAULT_BRIGHTNESS, saved.contrast || CONFIG.DEFAULT_CONTRAST, true);
        }, 350);
      }
    } else {
      document.documentElement.style.setProperty('--font-scale', CONFIG.DEFAULT_FONT_SCALE);
      document.documentElement.style.setProperty('--line-height', CONFIG.DEFAULT_LINE_HEIGHT);
      document.documentElement.style.setProperty('--letter-spacing', '0px');
    }
  });
}

// Also save when we receive stateChanged? No, popup will save after changes.
// But to be robust, we can add a storage save on significant changes, but for now popup handles save.

initialize();

// Expose for debugging
window.EYES = { applyMode, getCurrentState };