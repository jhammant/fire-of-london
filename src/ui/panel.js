// Renders the controller's view models into the side panel (bottom sheet on phones).

const LOG_SHOWN = 6;
const SWATCH_SIZE = 20;
const END_TURN_TEXT = 'End turn';
const END_TURN_BUSY_TEXT = 'The fire spreads…';

/** Creates the panel renderer for the 6a elements of doc; onAction(id) is called when an action button is pressed. */
export function createPanel({ doc, mapView, dpr = 1, onAction }) {
  const byId = (id) => doc.getElementById(id);
  const actionItems = new Map();
  let lastLive = '';
  let legendList = null;

  function make(tag, attrs = {}, text) {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function fill(node, children) {
    clear(node);
    for (const child of children) node.appendChild(child);
  }

  function buildAction(model) {
    const item = make('div', { class: 'action-item' });
    const noteId = `action-note-${model.id}`;
    const button = make('button', {
      type: 'button',
      class: 'btn action-btn',
      'data-action': model.id,
      'aria-keyshortcuts': model.key,
      'aria-describedby': noteId
    });
    const key = make('kbd', { class: 'action-key', 'aria-hidden': 'true' }, model.key);
    const label = make('span', { class: 'action-label' });
    const cost = make('span', { class: 'action-cost' });
    const note = make('p', { class: 'action-note', id: noteId });
    button.appendChild(key);
    button.appendChild(label);
    button.appendChild(cost);
    button.addEventListener('click', () => onAction(model.id));
    item.appendChild(button);
    item.appendChild(note);
    return { item, button, label, cost, note };
  }

  function updateAction(parts, model) {
    parts.label.textContent = model.label;
    parts.cost.textContent = model.costText;
    if (model.enabled) {
      parts.button.removeAttribute('aria-disabled');
      parts.note.setAttribute('class', 'action-note');
      parts.note.textContent = model.description || '';
    } else {
      parts.button.setAttribute('aria-disabled', 'true');
      parts.note.setAttribute('class', 'action-note is-reason');
      parts.note.textContent = model.reason;
    }
  }

  return {
    /** Shows the date, the wind and the resources. */
    renderHeader(model) {
      if (!model) return;
      fill(byId('date-time'), [
        make('span', { class: 'date-main' }, model.timeLabel),
        make('span', { class: 'date-sub' }, model.turnsLeftText)
      ]);
      const shown = make('span', { class: 'wind-shown', 'aria-hidden': 'true' });
      if (model.windArrow) shown.appendChild(make('span', { class: 'wind-arrow' }, model.windArrow));
      shown.appendChild(make('span', { class: 'wind-label' }, model.windLabel));
      fill(byId('wind-info'), [shown, make('span', { class: 'visually-hidden' }, model.windSentence)]);
      fill(
        byId('resources'),
        model.resources.map((resource) => {
          const row = make('div', { class: `resource resource-${resource.id}` });
          row.appendChild(make('dt', {}, resource.label));
          row.appendChild(make('dd', {}, resource.text));
          return row;
        })
      );
    },

    /** Shows the selected tile, or a hint when nothing is selected. */
    renderTile(model) {
      const box = byId('tile-info');
      if (!model) {
        fill(box, [make('p', { class: 'tile-hint' }, 'Choose a square on the map. Click it, tap it or use the arrow keys.')]);
        return;
      }
      const list = make('dl', { class: 'tile-rows' });
      for (const row of model.rows) {
        const pair = make('div', { class: 'tile-row' });
        pair.appendChild(make('dt', {}, row.label));
        pair.appendChild(make('dd', {}, row.value));
        list.appendChild(pair);
      }
      fill(box, [make('h3', { class: 'tile-heading' }, model.heading), list]);
    },

    /** Creates or updates one button per action model, keeping focus on buttons that already exist. */
    renderActions(models) {
      const box = byId('actions');
      const sameSet = models.length === actionItems.size && models.every((model) => actionItems.has(model.id));
      if (!sameSet) {
        actionItems.clear();
        clear(box);
        for (const model of models) {
          const parts = buildAction(model);
          actionItems.set(model.id, parts);
          box.appendChild(parts.item);
        }
      }
      for (const model of models) updateAction(actionItems.get(model.id), model);
    },

    /** Shows the last few log lines, newest first. */
    renderLog(lines) {
      const recent = lines.slice(-LOG_SHOWN).reverse();
      fill(byId('log'), recent.map((line) => make('li', {}, line)));
    },

    /** Fills the map key with mapView.LEGEND labels and swatches drawn by mapView.drawLegendSwatch. */
    renderLegend() {
      const legend = byId('legend');
      const list = make('ul', { class: 'legend-list' });
      for (const entry of mapView.LEGEND) {
        const item = make('li', { class: 'legend-item' });
        const canvas = make('canvas', { class: 'legend-swatch', 'aria-hidden': 'true' });
        canvas.width = Math.round(SWATCH_SIZE * dpr);
        canvas.height = Math.round(SWATCH_SIZE * dpr);
        canvas.style.width = `${SWATCH_SIZE}px`;
        canvas.style.height = `${SWATCH_SIZE}px`;
        const ctx = typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
        if (ctx) {
          ctx.scale(dpr, dpr);
          mapView.drawLegendSwatch(ctx, entry.id, SWATCH_SIZE);
        }
        item.appendChild(canvas);
        item.appendChild(make('span', { class: 'legend-label' }, entry.label));
        list.appendChild(item);
      }
      if (legendList) legend.removeChild(legendList);
      legendList = list;
      legend.appendChild(list);
    },

    /** Sends a message to the polite live region (repeats are still read out). */
    announce(text) {
      if (!text) return;
      const live = byId('live');
      const message = text === lastLive ? `${text} ` : text;
      lastLive = message;
      live.textContent = message;
    },

    /** Marks End Turn as busy (while the fire spreads) or unavailable, without taking focus away from it. */
    setEndTurn({ enabled, busy = false }) {
      const button = byId('btn-end-turn');
      button.textContent = busy ? END_TURN_BUSY_TEXT : END_TURN_TEXT;
      if (enabled && !busy) button.removeAttribute('aria-disabled');
      else button.setAttribute('aria-disabled', 'true');
      button.setAttribute('aria-busy', busy ? 'true' : 'false');
    }
  };
}
