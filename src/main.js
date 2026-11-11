// Composition root: the only module that imports every unit and wires them together.

import * as engine from './engine/index.js';
import * as history from './data/history.js';
import * as mapView from './ui/map-view.js';
import * as screens from './ui/screens.js';
import * as tutorial from './ui/tutorial.js';
import { createApp } from './ui/app.js';

/** Starts the game on the real page. */
function boot() {
  createApp({ doc: document, win: window, engine, history, mapView, screens, tutorial }).start();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
}
