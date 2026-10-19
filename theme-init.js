// theme-init.js - Synchronous theme initialization to prevent Flash of Unstyled Content (FOUC)
// Loaded via <script src="theme-init.js"> in <head> to comply with Manifest V3 Content Security Policy (CSP)
(function () {
  'use strict';
  try {
    var theme = localStorage.getItem('ugaan_theme_mode') || 'light';
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add('theme-' + theme);
    if (document.body) {
      document.body.classList.remove('theme-dark', 'theme-light');
      document.body.classList.add('theme-' + theme);
    }
  } catch (e) {}
})();
