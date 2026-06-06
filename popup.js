// Eyes Chrome Extension - Popup Controller
// Handles UI interactions, Tailwind theming, messaging with content script,
// state persistence via chrome.storage, and applies design philosophy.

document.addEventListener('DOMContentLoaded', () => {
  // ============================================================
  // CONFIG & CONSTANTS (DRY, no magic strings/numbers scattered)
  // ============================================================
  const CONFIG = {
    DEFAULT_BRIGHTNESS: 100,
    DEFAULT_CONTRAST: 100,
    DEFAULT_FONT_SCALE: 1.0,
    DEFAULT_LINE_HEIGHT: 1.55,
    DEFAULT_LETTER_SPACING: 0,
  };

  // DOM Elements
  const elements = {
    statusDot: document.getElementById('status-dot'),
    statusText: document.getElementById('status-text'),
    currentModeBadge: document.getElementById('current-mode-badge'),
    adjustmentsPanel: document.getElementById('adjustments-panel'),
    
    // Mode buttons
    modeButtons: document.querySelectorAll('.mode-btn'),
    
    // Sliders
    brightnessSlider: document.getElementById('brightness-slider'),
    brightnessValue: document.getElementById('brightness-value'),
    contrastSlider: document.getElementById('contrast-slider'),
    contrastValue: document.getElementById('contrast-value'),
    fontSlider: document.getElementById('font-slider'),
    fontValue: document.getElementById('font-value'),
    
    // Readability sliders
    lineHeightSlider: document.getElementById('line-height-slider'),
    lineHeightValue: document.getElementById('line-height-value'),
    letterSpacingSlider: document.getElementById('letter-spacing-slider'),
    letterSpacingValue: document.getElementById('letter-spacing-value'),
    
    // Color inputs
    colorText: document.getElementById('color-text'),
    colorBg: document.getElementById('color-bg'),
    colorLink: document.getElementById('color-link'),
    resetColorsBtn: document.getElementById('reset-colors'),
    
    // Actions
    resetBtn: document.getElementById('reset-btn'),
    applyAllBtn: document.getElementById('apply-all-btn'),
  };

  // Current tab info
  let currentTabId = null;
  let currentState = {
    currentMode: null,
    brightness: CONFIG.DEFAULT_BRIGHTNESS,
    contrast: CONFIG.DEFAULT_CONTRAST,
    fontScale: CONFIG.DEFAULT_FONT_SCALE,
    lineHeight: CONFIG.DEFAULT_LINE_HEIGHT,
    letterSpacing: CONFIG.DEFAULT_LETTER_SPACING,
    customColors: { text: '', bg: '', link: '' },
    siteSpecific: false,
  };

  // Update UI from state
  function updateUIFromState(state) {
    currentState = { ...state };

    // Status
    if (state.currentMode) {
      elements.statusDot.style.background = '#dc2626';
      elements.statusDot.style.boxShadow = '0 0 0 3px rgba(220, 38, 38, 0.25)';
      elements.statusText.textContent = `${state.currentMode.charAt(0).toUpperCase() + state.currentMode.slice(1)} active`;
      elements.statusText.className = 'font-medium text-[#f1f5f9]';
      
      elements.currentModeBadge.textContent = state.currentMode.toUpperCase();
      elements.currentModeBadge.classList.remove('hidden');
      elements.currentModeBadge.style.background = '#dc2626';
      
      elements.adjustmentsPanel.classList.remove('hidden');
    } else {
      elements.statusDot.style.background = '#64748b';
      elements.statusDot.style.boxShadow = 'none';
      elements.statusText.textContent = 'No mode active';
      elements.statusText.className = 'font-medium text-[#94a3b8]';
      elements.currentModeBadge.classList.add('hidden');
      elements.adjustmentsPanel.classList.add('hidden');
    }

    // Mode buttons active state
    elements.modeButtons.forEach(btn => {
      const mode = btn.dataset.mode;
      if (mode === state.currentMode) {
        btn.classList.add('active', 'border-[#dc2626]');
        btn.style.borderColor = '#dc2626';
      } else {
        btn.classList.remove('active', 'border-[#dc2626]');
        btn.style.borderColor = '#475569';
      }
    });

    // Sliders
    if (elements.brightnessSlider) {
      elements.brightnessSlider.value = state.brightness || 100;
      elements.brightnessValue.textContent = `${state.brightness || 100}%`;
    }
    if (elements.contrastSlider) {
      elements.contrastSlider.value = state.contrast || 100;
      elements.contrastValue.textContent = `${state.contrast || 100}%`;
    }
    if (elements.fontSlider) {
      elements.fontSlider.value = state.fontScale || 1.0;
      elements.fontValue.textContent = `${Math.round((state.fontScale || 1.0) * 100)}%`;
    }

    // New readability sliders (v1.1)
    if (elements.lineHeightSlider) {
      const lh = state.lineHeight || 1.55;
      elements.lineHeightSlider.value = lh;
      elements.lineHeightValue.textContent = lh.toFixed(2);
    }
    if (elements.letterSpacingSlider) {
      const ls = state.letterSpacing || 0;
      elements.letterSpacingSlider.value = ls;
      elements.letterSpacingValue.textContent = `${ls} px`;
    }

    // Custom colors (only update if not empty to avoid overriding user pick)
    if (state.customColors) {
      if (state.customColors.text && elements.colorText) elements.colorText.value = state.customColors.text;
      if (state.customColors.bg && elements.colorBg) elements.colorBg.value = state.customColors.bg;
      if (state.customColors.link && elements.colorLink) elements.colorLink.value = state.customColors.link;
    }
  }

  // Get active tab and query content script state
  async function queryCurrentState() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) return;
      
      currentTabId = tab.id;
      
      // Show current site (simple hostname)
      try {
        if (tab.url) {
          const hostname = new URL(tab.url).hostname;
          if (hostname && elements.statusText) {
            // Append site info if not in mode status
            if (!currentState.currentMode) {
              elements.statusText.textContent = `Ready on ${hostname}`;
            }
          }
        }
      } catch (e) {}
      
      chrome.tabs.sendMessage(tab.id, { action: 'getState' }, (response) => {
        if (chrome.runtime.lastError) {
          // Content script may not be ready (e.g. chrome:// pages, PDFs)
          console.log('Content script not reachable on this page');
          elements.statusText.textContent = 'Not available on this page (try reload)';
          elements.statusText.className = 'font-medium text-[#f87171] text-xs';
          return;
        }
        
        if (response) {
          updateUIFromState(response);
        }
      });
    } catch (err) {
      console.error('Failed to query state:', err);
    }
  }

  // Send message to content script
  function sendToContent(action, payload = {}) {
    if (!currentTabId) return Promise.resolve(null);
    
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(currentTabId, { action, ...payload }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn('Message failed:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response);
      });
    });
  }

  // Save full state to chrome.storage.local
  async function saveStateToStorage(stateToSave) {
    try {
      const key = stateToSave.siteSpecific ? 'eyesSiteState' : 'eyesState';
      await chrome.storage.local.set({ [key]: stateToSave });
      
      // Also notify content script of siteSpecific flag
      if (currentTabId) {
        chrome.tabs.sendMessage(currentTabId, { 
          action: 'setSiteSpecific', 
          enable: !!stateToSave.siteSpecific 
        }).catch(() => {});
      }
    } catch (e) {
      console.error('Failed to save state', e);
    }
  }

  // Apply mode (from button click or slider)
  async function applyMode(mode, brightness = null, contrast = null) {
    const b = brightness !== null ? brightness : (currentState.brightness || 100);
    const c = contrast !== null ? contrast : (currentState.contrast || 100);
    
    const response = await sendToContent('applyMode', { mode, brightness: b, contrast: c });
    
    if (response && response.state) {
      updateUIFromState(response.state);
      await saveStateToStorage(response.state);
      
      if (mode) {
        showToast(`${mode.charAt(0).toUpperCase() + mode.slice(1)} mode applied`);
      } else {
        showToast('Mode turned off');
      }
    } else {
      // Fallback: re-query
      setTimeout(queryCurrentState, 150);
    }
  }

  // Live slider updates (brightness/contrast)
  function setupSliderListeners() {
    // Brightness
    elements.brightnessSlider.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value, 10);
      elements.brightnessValue.textContent = `${val}%`;
      
      if (currentState.currentMode) {
        const response = await sendToContent('updateSliders', { 
          brightness: val, 
          contrast: currentState.contrast 
        });
        if (response) {
          currentState.brightness = val;
          await saveStateToStorage(currentState);
        }
      }
    });

    // Contrast
    elements.contrastSlider.addEventListener('input', async (e) => {
      const val = parseInt(e.target.value, 10);
      elements.contrastValue.textContent = `${val}%`;
      
      if (currentState.currentMode) {
        const response = await sendToContent('updateSliders', { 
          brightness: currentState.brightness, 
          contrast: val 
        });
        if (response) {
          currentState.contrast = val;
          await saveStateToStorage(currentState);
        }
      }
    });

    // Font Scale (always live)
    elements.fontSlider.addEventListener('input', async (e) => {
      const val = parseFloat(e.target.value);
      elements.fontValue.textContent = `${Math.round(val * 100)}%`;
      
      const response = await sendToContent('updateFontScale', { scale: val });
      if (response && response.state) {
        currentState.fontScale = val;
        await saveStateToStorage(currentState);
      }
    });

    // Line Height (v1.1)
    if (elements.lineHeightSlider) {
      elements.lineHeightSlider.addEventListener('input', async (e) => {
        const val = parseFloat(e.target.value);
        elements.lineHeightValue.textContent = val.toFixed(2);
        
        const response = await sendToContent('updateReadability', { 
          lineHeight: val, 
          letterSpacing: currentState.letterSpacing 
        });
        if (response && response.state) {
          currentState.lineHeight = val;
          await saveStateToStorage(currentState);
        }
      });
    }

    // Letter Spacing (v1.1)
    if (elements.letterSpacingSlider) {
      elements.letterSpacingSlider.addEventListener('input', async (e) => {
        const val = parseFloat(e.target.value);
        elements.letterSpacingValue.textContent = `${val} px`;
        
        const response = await sendToContent('updateReadability', { 
          lineHeight: currentState.lineHeight, 
          letterSpacing: val 
        });
        if (response && response.state) {
          currentState.letterSpacing = val;
          await saveStateToStorage(currentState);
        }
      });
    }
  }

  // Mode button clicks
  function setupModeButtons() {
    elements.modeButtons.forEach(btn => {
      btn.addEventListener('click', async () => {
        const mode = btn.dataset.mode;
        const isActive = currentState.currentMode === mode;
        
        if (isActive) {
          // Toggle off
          await applyMode(null);
        } else {
          // Apply new mode with current or default sliders
          await applyMode(mode);
        }
      });
    });
  }

  // (Keyboard shortcuts completely removed in this version)

  // Custom color handlers
  function setupColorInputs() {
    const colorInputs = [
      { el: elements.colorText, key: 'text' },
      { el: elements.colorBg, key: 'bg' },
      { el: elements.colorLink, key: 'link' },
    ];

    colorInputs.forEach(({ el, key }) => {
      if (!el) return;
      
      el.addEventListener('input', async (e) => {
        const newColors = { ...currentState.customColors, [key]: e.target.value };
        
        const response = await sendToContent('updateCustomColors', { colors: newColors });
        if (response && response.state) {
          currentState.customColors = response.state.customColors;
          await saveStateToStorage(currentState);
        }
      });
    });

    // Reset colors
    elements.resetColorsBtn.addEventListener('click', async () => {
      const defaultColors = { text: '', bg: '', link: '' };
      
      elements.colorText.value = '#e0e0e0';
      elements.colorBg.value = '#1a1a1a';
      elements.colorLink.value = '#b0b0b0';
      
      const response = await sendToContent('updateCustomColors', { colors: defaultColors });
      if (response && response.state) {
        currentState.customColors = defaultColors;
        await saveStateToStorage(currentState);
      }
    });
  }

  // Action buttons
  function setupActionButtons() {
    // Reset All
    elements.resetBtn.addEventListener('click', async () => {
      const response = await sendToContent('resetAll');
      if (response && response.state) {
        updateUIFromState(response.state);
        await chrome.storage.local.remove(['eyesState', 'eyesSiteState']);
        
        showToast('All settings reset to defaults');
        
        // Reset UI elements to defaults
        elements.brightnessSlider.value = 100;
        elements.contrastSlider.value = 100;
        elements.fontSlider.value = 1.0;
        elements.lineHeightSlider.value = 1.55;
        elements.letterSpacingSlider.value = 0;
        elements.brightnessValue.textContent = '100%';
        elements.contrastValue.textContent = '100%';
        elements.fontValue.textContent = '100%';
        elements.lineHeightValue.textContent = '1.55';
        elements.letterSpacingValue.textContent = '0 px';
        elements.colorText.value = '#e0e0e0';
        elements.colorBg.value = '#1a1a1a';
        elements.colorLink.value = '#b0b0b0';
      }
    });

    // Apply Globally (forces global save, ignores site-specific)
    elements.applyAllBtn.addEventListener('click', async () => {
      const globalState = { ...currentState, siteSpecific: false };
      await chrome.storage.local.set({ eyesState: globalState });
      
      showToast('Settings saved globally for all sites');
      
      // Visual feedback
      const originalText = elements.applyAllBtn.innerHTML;
      elements.applyAllBtn.innerHTML = `<i class="fa-solid fa-check"></i> <span>SAVED GLOBALLY</span>`;
      elements.applyAllBtn.style.background = '#16a34a';
      
      setTimeout(() => {
        elements.applyAllBtn.innerHTML = originalText;
        elements.applyAllBtn.style.background = '#dc2626';
      }, 1600);
    });

  }

  // Keyboard support inside popup (nice to have)
  function setupKeyboardSupport() {
    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement.tagName === 'BODY') {
        e.preventDefault();
        elements.fontSlider.focus();
      }
    });
  }

  async function init() {
    setupSliderListeners();
    setupModeButtons();
    setupColorInputs();
    setupActionButtons();
    setupKeyboardSupport();
    
    // Initial state from active tab
    await queryCurrentState();
    
    // If no mode but we have saved global state, show it in UI (read-only hint)
    chrome.storage.local.get(['eyesState'], (result) => {
      if (result.eyesState && !currentState.currentMode) {
        // Show saved global config as hint (optional)
        const saved = result.eyesState;
        if (saved.currentMode) {
          elements.statusText.textContent = `Global: ${saved.currentMode} (reload page)`;
          elements.statusText.style.color = '#64748b';
        }
      }
    });

    // Periodic re-query in case user interacts with page directly (rare)
    setInterval(() => {
      if (document.hasFocus()) {
        queryCurrentState();
      }
    }, 4500);
  }

  // Simple toast notification (red accent, sharp, auto dismiss)
  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toast-icon');
    const msgEl = document.getElementById('toast-message');

    if (!container || !toast) return;

    msgEl.textContent = message;
    
    if (type === 'success') {
      toast.style.borderColor = '#dc2626';
      icon.className = 'fa-solid fa-check text-[#dc2626]';
    } else if (type === 'info') {
      toast.style.borderColor = '#64748b';
      icon.className = 'fa-solid fa-info-circle text-[#64748b]';
    }

    container.classList.remove('hidden');
    container.style.display = 'block';

    // Auto hide after 2.2s
    setTimeout(() => {
      container.style.transition = 'opacity 0.2s ease';
      container.style.opacity = '0';
      setTimeout(() => {
        container.style.opacity = '1';
        container.style.transition = '';
        container.style.display = 'none';
        container.classList.add('hidden');
      }, 200);
    }, 2200);
  }

  // Boot
  init();
});

