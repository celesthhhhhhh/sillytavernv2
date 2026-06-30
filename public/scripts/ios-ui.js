/**
 * SillyTavern iOS UI — Shell Layer
 * Runs after the main ST script.js to inject the iOS navigation chrome
 * and wire up gesture/animation behaviour.
 */

(function () {
  'use strict';

  /* ── Helpers ── */
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const el = (tag, attrs = {}, ...children) => {
    const e = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') e.className = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    });
    children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  };

  /* ── iOS App Shell ── */
  function buildShell() {
    // Scrim (backdrop for panels)
    const scrim = el('div', { id: 'ios-scrim' });
    document.body.appendChild(scrim);

    // We rely on existing ST elements:
    //  #top-bar / #top-settings-holder  → already styled via CSS as iOS NavBar
    //  #sheld / #chat / #form_sheld     → already styled as iOS chat
    //  .drawer-content.fillLeft/.fillRight → already styled as iOS side panels
  }

  /* ── Panel open / close logic ── */
  let openPanels = new Set();
  const scrim = () => document.getElementById('ios-scrim');

  function openPanel(panelEl) {
    panelEl.classList.add('openDrawer');
    openPanels.add(panelEl);
    scrim()?.classList.add('visible');
  }

  function closePanel(panelEl) {
    panelEl.classList.remove('openDrawer');
    openPanels.delete(panelEl);
    if (openPanels.size === 0) scrim()?.classList.remove('visible');
  }

  function closeAllPanels() {
    $$('.drawer-content.openDrawer').forEach(p => p.classList.remove('openDrawer'));
    openPanels.clear();
    scrim()?.classList.remove('visible');
  }

  /* Close panels on scrim click */
  document.addEventListener('click', e => {
    if (e.target.id === 'ios-scrim') closeAllPanels();
  });

  /* Close panels on Escape */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAllPanels();
  });

  /* ── NavBar title update ── */
  function getActiveCharacterName() {
    // 1) Selected character in the management list (most reliable)
    const selected = document.querySelector('.character_select.selected .ch_name_select, .group_select.selected .group_name_select');
    if (selected?.textContent?.trim()) return selected.textContent.trim();

    // 2) Top character name block (shown above chat in some ST layouts)
    const nameBlock = document.querySelector('.character_name_block .ch_name');
    if (nameBlock?.textContent?.trim()) return nameBlock.textContent.trim();

    // 3) Fallback: last bot message name
    const nameEls = document.querySelectorAll('#chat .mes:not([is_user="true"]) .name_text');
    const last = nameEls[nameEls.length - 1];
    if (last?.textContent?.trim()) return last.textContent.trim();

    return null;
  }

  function updateNavbarTitle() {
    const charName = getActiveCharacterName();

    const apiStatus = document.getElementById('API-status-top');
    const connected = apiStatus?.classList.contains('fa-plug-circle-check');

    const titleEl = document.getElementById('ios-chat-title');
    const subtitleEl = document.getElementById('ios-chat-subtitle');

    if (titleEl) {
      titleEl.textContent = charName || 'SillyTavern';
    }
    if (subtitleEl) {
      subtitleEl.textContent = connected ? 'Online' : '';
    }
  }

  /* Observe chat changes */
  const chatObs = new MutationObserver(updateNavbarTitle);
  const chatEl = document.getElementById('chat');
  if (chatEl) {
    chatObs.observe(chatEl, { childList: true, subtree: false });
  }

  // Observe character list selection changes (class toggling on .selected)
  const charListEl = document.getElementById('rm_print_characters_block');
  if (charListEl) {
    const charListObs = new MutationObserver(updateNavbarTitle);
    charListObs.observe(charListEl, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  /* ── Smooth scroll to bottom on new message ── */
  function scrollChatToBottom(smooth = true) {
    const chat = document.getElementById('chat');
    if (!chat) return;
    chat.scrollTo({ top: chat.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  }

  // Patch: observe chat for new messages and auto-scroll
  if (chatEl) {
    const scrollObs = new MutationObserver(mutations => {
      const hasNew = mutations.some(m =>
        [...m.addedNodes].some(n => n.classList?.contains('mes'))
      );
      if (hasNew) {
        // Small delay to let content render
        setTimeout(() => scrollChatToBottom(), 60);
      }
    });
    scrollObs.observe(chatEl, { childList: true });
  }

  /* ── iOS-style send button enable/disable ── */
  function updateSendButton() {
    const ta = document.getElementById('send_textarea');
    const btn = document.getElementById('send_but');
    if (!ta || !btn) return;
    const hasText = ta.value.trim().length > 0;
    btn.style.opacity = hasText ? '1' : '0.4';
    btn.style.transform = hasText ? 'scale(1)' : 'scale(0.92)';
  }

  const sendTextarea = document.getElementById('send_textarea');
  if (sendTextarea) {
    sendTextarea.addEventListener('input', updateSendButton);
    updateSendButton();
  }

  /* ── Textarea auto-height ── */
  function autoResizeTextarea(ta) {
    ta.style.height = 'auto';
    const max = 140;
    ta.style.height = Math.min(ta.scrollHeight, max) + 'px';
    // Switch border-radius when multiline
    ta.style.borderRadius = ta.scrollHeight > 48 ? '16px' : '20px';
  }

  if (sendTextarea) {
    sendTextarea.addEventListener('input', () => autoResizeTextarea(sendTextarea));
  }

  /* ── Connection dot on API button ── */
  function monitorApiStatus() {
    const apiIcon = document.getElementById('API-status-top');
    if (!apiIcon) return;

    const connDot = document.getElementById('ios-conn-dot');

    const obs = new MutationObserver(() => {
      const isConnected = apiIcon.classList.contains('fa-plug-circle-check');
      const isConnecting = apiIcon.classList.contains('fa-plug-circle-bolt') ||
                           apiIcon.classList.contains('fa-circle-notch');

      if (connDot) {
        connDot.className = 'ios-conn-dot' +
          (isConnected ? ' connected' : isConnecting ? ' connecting' : '');
      }

      // Also update the drawer icon colour via class
      apiIcon.dataset.iosConnected = isConnected ? 'true' : 'false';
      updateNavbarTitle();
    });

    obs.observe(apiIcon, { attributes: true, attributeFilter: ['class'] });
  }

  /* ── Bubble entrance animation deduplication ── */
  // Remove animation from already-rendered messages (only animate new ones)
  function initExistingMessages() {
    $$('#chat .mes .mes_text').forEach(t => {
      t.style.animation = 'none';
      t.style.opacity = '1';
      t.style.transform = 'none';
    });
  }

  /* ── Typing indicator ── */
  let typingIndicator = null;

  function showTypingIndicator(charName = '') {
    if (typingIndicator) return;
    const chat = document.getElementById('chat');
    if (!chat) return;

    typingIndicator = el('div', { class: 'mes ios-typing-mes' },
      el('div', { class: 'mesAvatarWrapper' },
        el('div', { class: 'avatar' },
          el('img', { src: '' })
        )
      ),
      el('div', { class: 'mes_block' },
        el('div', { class: 'ios-typing-bubble' },
          el('div', { class: 'ios-loading-dots' },
            el('span'), el('span'), el('span')
          )
        )
      )
    );

    chat.appendChild(typingIndicator);
    scrollChatToBottom();
  }

  function hideTypingIndicator() {
    typingIndicator?.remove();
    typingIndicator = null;
  }

  /* Intercept ST generation events */
  document.addEventListener('generate_start', showTypingIndicator);
  document.addEventListener('generation_ended', hideTypingIndicator);
  // Also watch body data-generating attribute
  const genObs = new MutationObserver(() => {
    if (document.body.dataset.generating === 'true') {
      showTypingIndicator();
    } else {
      hideTypingIndicator();
    }
  });
  genObs.observe(document.body, { attributes: true, attributeFilter: ['data-generating'] });

  /* ── Swipe gestures for side panels ── */
  let touchStartX = 0;
  let touchStartY = 0;
  const SWIPE_THRESHOLD = 60;
  const SWIPE_VELOCITY = 0.4;
  const EDGE_ZONE = 30;

  document.addEventListener('touchstart', e => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Horizontal swipe detection
    if (absDx < SWIPE_THRESHOLD || absDy > absDx * 0.8) return;

    const rightNav  = document.getElementById('right-nav-panel');
    const leftNav   = document.getElementById('left-nav-panel');

    if (dx > 0 && touchStartX < EDGE_ZONE) {
      // Swipe right from left edge → open left panel
      if (leftNav) openPanel(leftNav);
    } else if (dx < 0 && touchStartX > window.innerWidth - EDGE_ZONE) {
      // Swipe left from right edge → open right panel
      if (rightNav) openPanel(rightNav);
    } else if (dx < 0 && Math.abs(dx) > SWIPE_THRESHOLD) {
      // Swipe left anywhere → close left panel
      if (leftNav?.classList.contains('openDrawer')) closePanel(leftNav);
    } else if (dx > 0 && Math.abs(dx) > SWIPE_THRESHOLD) {
      // Swipe right anywhere → close right panel
      if (rightNav?.classList.contains('openDrawer')) closePanel(rightNav);
    }
  }, { passive: true });

  /* ── Apply character avatar to typing indicator ── */
  function getActiveCharacterAvatar() {
    const img = document.querySelector('#chat .mes:not([is_user="true"]) .avatar img');
    return img?.src || '';
  }

  /* ── Message grouping: hide avatar for consecutive same-sender ── */
  function groupMessages() {
    const messages = $$('#chat .mes:not(.ios-typing-mes)');
    let prevUser = null;
    let groupCount = 0;

    messages.forEach((mes, i) => {
      const isUser = mes.getAttribute('is_user') === 'true';
      const isSystem = mes.getAttribute('is_system') === 'true';

      if (isSystem) { prevUser = null; groupCount = 0; return; }

      if (prevUser === isUser) {
        groupCount++;
        // Hide avatar after first in group (show only on last)
        const avatarWrapper = mes.querySelector('.mesAvatarWrapper');
        if (avatarWrapper && !isUser) {
          avatarWrapper.style.visibility = 'hidden';
        }
        // Tighten spacing within group
        mes.style.paddingTop = '1px';
        // Adjust bubble radius for middle messages
        const mesText = mes.querySelector('.mes_text');
        if (mesText && !isUser) {
          if (i < messages.length - 1 && messages[i+1]?.getAttribute('is_user') !== 'true'
              && messages[i+1]?.getAttribute('is_system') !== 'true') {
            mesText.style.borderRadius = '4px 18px 18px 4px';
          }
        }
      } else {
        groupCount = 0;
        const avatarWrapper = mes.querySelector('.mesAvatarWrapper');
        if (avatarWrapper) avatarWrapper.style.visibility = 'visible';
        mes.style.paddingTop = '';
      }
      prevUser = isUser;
    });
  }

  // Group on chat changes
  if (chatEl) {
    const groupObs = new MutationObserver(() => setTimeout(groupMessages, 50));
    groupObs.observe(chatEl, { childList: true });
  }

  /* ── iOS-style range slider live track fill ── */
  function updateRangeTrack(input) {
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value) || 0;
    const pct = ((val - min) / (max - min) * 100).toFixed(1);
    input.style.background = `linear-gradient(to right, var(--c-blue) ${pct}%, var(--c-bg3) ${pct}%)`;
  }

  document.addEventListener('input', e => {
    if (e.target.matches('input[type="range"].neo-range-slider')) {
      updateRangeTrack(e.target);
    }
  });

  // Init existing sliders
  function initSliders() {
    $$('input[type="range"].neo-range-slider').forEach(updateRangeTrack);
  }

  /* ── Panel snap close on outside tap (desktop) ── */
  document.addEventListener('mousedown', e => {
    const panels = $$('.drawer-content.fillLeft.openDrawer, .drawer-content.fillRight.openDrawer');
    panels.forEach(p => {
      if (!p.contains(e.target) && !e.target.closest('.drawer-toggle')) {
        closePanel(p);
      }
    });
  });

  /* ── iOS Tab Bar wiring ── */
  const TAB_MAP = {
    'ios-tab-chat':        null, // chat is always "active" baseline, just closes all panels
    'ios-tab-characters':  'rightNavDrawerIcon',
    'ios-tab-config':      'leftNavDrawerIcon',
    'ios-tab-worldinfo':   'WIDrawerIcon',
    'ios-tab-settings':    'userSettingsDrawerIcon',
  };

  function findDrawerToggle(iconId) {
    const icon = document.getElementById(iconId);
    if (!icon) return null;
    // The clickable toggle is the icon itself or its .drawer-toggle parent
    return icon.closest('.drawer-toggle') || icon;
  }

  function setActiveTab(tabId) {
    $$('.ios-tab').forEach(t => t.classList.toggle('active', t.id === tabId));
  }

  function wireTabBar() {
    Object.entries(TAB_MAP).forEach(([tabId, iconId]) => {
      const tabBtn = document.getElementById(tabId);
      if (!tabBtn) return;

      tabBtn.addEventListener('click', () => {
        haptic('light');

        if (tabId === 'ios-tab-chat') {
          closeAllPanels();
          setActiveTab(tabId);
          return;
        }

        const toggle = findDrawerToggle(iconId);
        const icon = document.getElementById(iconId);
        const isCurrentlyOpen = icon?.classList.contains('openIcon');

        // Close any other open fillLeft/fillRight panels first (single-panel-at-a-time UX)
        $$('.drawer-content.openDrawer').forEach(p => {
          const ownerIcon = p.parentElement?.querySelector('.drawer-icon');
          if (ownerIcon && ownerIcon.id !== iconId) {
            ownerIcon.click();
          }
        });

        if (toggle && !isCurrentlyOpen) {
          toggle.click();
          setActiveTab(tabId);
        } else if (toggle && isCurrentlyOpen) {
          toggle.click();
          setActiveTab('ios-tab-chat');
        }
      });
    });

    // Keep tab bar in sync if a panel is closed via its own close button / scrim
    const syncObs = new MutationObserver(() => {
      const anyOpen = $$('.drawer-content.openDrawer').length > 0;
      if (!anyOpen) setActiveTab('ios-tab-chat');
    });
    syncObs.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
  }

  /* ── Haptic feedback (iOS) ── */
  function haptic(style = 'light') {
    if ('vibrate' in navigator) {
      const patterns = { light: [5], medium: [15], heavy: [30] };
      navigator.vibrate(patterns[style] || [5]);
    }
  }

  // Add haptic to send button
  const sendBtn = document.getElementById('send_but');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => haptic('light'));
  }

  /* ── Dark status bar on iOS ── */
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.content = '#000000';

  /* ── Init ── */
  function init() {
    buildShell();
    monitorApiStatus();
    initExistingMessages();
    initSliders();
    groupMessages();
    updateNavbarTitle();
    wireTabBar();

    // Watch for new sliders (drawers opening)
    const sliderObs = new MutationObserver(initSliders);
    sliderObs.observe(document.body, { childList: true, subtree: true });

    console.log('[ST iOS] Shell initialised');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* ── Typing indicator CSS (injected so it works without extra file) ── */
  const style = document.createElement('style');
  style.textContent = `
    .ios-typing-mes {
      padding: 6px 12px !important;
      animation: none !important;
    }
    .ios-typing-bubble {
      background: var(--c-bg2);
      border-radius: 4px 18px 18px 18px;
      padding: 10px 16px;
      border: .5px solid rgba(255,255,255,.06);
      box-shadow: 0 2px 8px rgba(0,0,0,.55);
      animation: ios-bubble-left 200ms cubic-bezier(.34,1.56,.64,1) both;
      min-width: 60px;
      display: flex;
      justify-content: center;
    }
    .ios-loading-dots {
      display: inline-flex;
      gap: 5px;
      align-items: center;
    }
    .ios-loading-dots span {
      width: 7px; height: 7px;
      border-radius: 50%;
      background: var(--c-label2);
      animation: ios-dot-bounce 1.3s infinite cubic-bezier(.25,.1,.25,1);
    }
    .ios-loading-dots span:nth-child(2) { animation-delay: .18s; }
    .ios-loading-dots span:nth-child(3) { animation-delay: .36s; }
    @keyframes ios-dot-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: .4; }
      40% { transform: translateY(-6px); opacity: 1; }
    }
    /* Smooth scroll-to-bottom button */
    #ios-scroll-btn {
      position: fixed;
      right: 16px;
      bottom: calc(var(--tabbar-h) + 16px);
      z-index: 2000;
      width: 34px; height: 34px;
      border-radius: 50%;
      background: var(--glass-bg);
      backdrop-filter: blur(20px);
      border: .5px solid var(--glass-border);
      box-shadow: 0 4px 16px rgba(0,0,0,.5);
      color: var(--c-blue);
      font-size: 16px;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      opacity: 0;
      transform: scale(.8) translateY(8px);
      transition: opacity 200ms ease, transform 200ms cubic-bezier(.34,1.56,.64,1);
      pointer-events: none;
    }
    #ios-scroll-btn.visible {
      opacity: 1;
      transform: scale(1) translateY(0);
      pointer-events: auto;
    }
    #ios-scroll-btn:active { transform: scale(.88); }
    /* Ghost icon */
    .mes_ghost { color: var(--c-orange) !important; font-size: 11px !important; }
  `;
  document.head.appendChild(style);

  /* ── Scroll-to-bottom button ── */
  function buildScrollButton() {
    const chat = document.getElementById('chat');
    if (!chat) return;

    const btn = el('div', { id: 'ios-scroll-btn' },
      el('i', { class: 'fa-solid fa-chevron-down' })
    );
    document.body.appendChild(btn);

    btn.addEventListener('click', () => {
      scrollChatToBottom(true);
      haptic('light');
    });

    chat.addEventListener('scroll', () => {
      const isNearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 200;
      btn.classList.toggle('visible', !isNearBottom);
    }, { passive: true });
  }

  buildScrollButton();

})();
