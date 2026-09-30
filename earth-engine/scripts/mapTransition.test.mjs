import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createMapTransition} from '../src/mapTransition.js';

test('an already-warm arrival does not revive a stale approaching cue', async () => {
  const previousDocument = globalThis.document;
  const makeElement = () => {
    const classes = new Set();
    return {
      hidden:false, textContent:'', src:'',
      classList:{add:value=>classes.add(value), remove:value=>classes.delete(value)},
      append(...children){ this.children = children; },
      removeAttribute(name){ delete this[name]; },
      setAttribute(){},
    };
  };
  globalThis.document = {createElement:makeElement};
  try {
    const map = new EventEmitter();
    map.getCanvas = () => ({toDataURL:() => `data:image/jpeg;base64,${'a'.repeat(6000)}`});
    map.triggerRepaint = () => setTimeout(() => map.emit('render'), 0);
    map.jumpTo = () => setTimeout(() => map.emit('render'), 0);
    map.isSourceLoaded = () => true;
    const container = {append(veil, cue){ this.veil = veil; this.cue = cue; }};
    const transition = createMapTransition(map, {container});
    await transition.jump({center:[11.66,48.26],zoom:13.8}, 'Munich');
    await new Promise(resolve => setTimeout(resolve, 520));
    assert.equal(container.veil.hidden, true);
    assert.equal(container.cue.hidden, true);
    transition.cancel();
  } finally {
    globalThis.document = previousDocument;
  }
});
