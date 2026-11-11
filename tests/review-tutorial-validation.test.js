import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as vm from 'node:vm';
import * as scanner from './helpers/scan-imports.js';

// Exercise the actual integration assertions without depending on the five
// unmerged units. Other test callbacks are registered but are not run.
async function tutorialChecks(steps) {
  const testUrl = new URL('./integration.test.js', import.meta.url);
  const source = readFileSync(testUrl, 'utf8');
  const context = vm.createContext({ URL });
  const checks = new Map();
  const engine = {
    LAST_TURN: 16,
    ACTIONS: ['douse', 'hooks', 'gunpowder', 'evacuate', 'guard', 'appeal'].map((id) => ({ id })),
    newGame: () => ({ over: true })
  };
  const modules = {
    'node:test': {
      describe: (_name, body) => body(),
      it: (name, body) => checks.set(name, body)
    },
    'node:assert/strict': { default: assert },
    'node:fs': { readFileSync: () => '<main id="actions"></main>' },
    'node:url': { fileURLToPath },
    '../src/engine/index.js': engine,
    '../src/data/history.js': {},
    '../src/ui/tutorial.js': { TUTORIAL_STEPS: vm.runInContext(JSON.stringify(steps), context) },
    './helpers/scan-imports.js': scanner
  };
  const module = new vm.SourceTextModule(source, {
    context,
    identifier: testUrl.href,
    initializeImportMeta: (meta) => { meta.url = testUrl.href; }
  });
  await module.link((specifier) => {
    assert.ok(Object.hasOwn(modules, specifier), `Unexpected dependency: ${specifier}`);
    const values = modules[specifier];
    return new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) {
        this.setExport(name, value);
      }
    }, { context });
  });
  await module.evaluate();
  return checks;
}

const vmOptions = { skip: !vm.SourceTextModule && 'Run this review fixture with --experimental-vm-modules.' };

it('null-action-type must be rejected when waitFor.type is present', vmOptions, async () => {
  const steps = [{
    id: 'wait-for-douse',
    title: 'Use the buckets',
    text: 'Throw water on a house.',
    target: '[data-action="douse"]',
    waitFor: { event: 'action-done', type: 'douse' }
  }];
  const validChecks = await tutorialChecks(steps);
  assert.doesNotThrow(validChecks.get('tutorial steps have unique ids and valid waitFor values'),
    'Control: a real action id must be accepted.');
  steps[0].waitFor.type = null;
  const checks = await tutorialChecks(steps);
  const check = checks.get('tutorial steps have unique ids and valid waitFor values');

  assert.equal(typeof check, 'function', 'The integration suite must validate tutorial waitFor values.');
  assert.throws(check, { name: 'AssertionError' },
    'A present null type is not an ACTIONS id; accepting it lets an unfulfillable wait through.');
});

it('selector-whitespace must not reject a contract-valid data-action selector', vmOptions, async () => {
  const steps = [{
    id: 'show-douse',
    title: 'Use the buckets',
    text: 'Throw water on a house.',
    target: '#actions [data-action="douse"]',
    waitFor: null
  }];
  const validChecks = await tutorialChecks(steps);
  assert.doesNotThrow(validChecks.get('tutorial targets use only 6a ids in index.html and [data-action] action ids'),
    'Control: the equivalent selector without spaces must be accepted.');
  steps[0].target = '#actions [data-action = "douse"]';
  const checks = await tutorialChecks(steps);
  const check = checks.get('tutorial targets use only 6a ids in index.html and [data-action] action ids');

  assert.equal(typeof check, 'function', 'The integration suite must validate tutorial selectors.');
  assert.doesNotThrow(check,
    'Whitespace around an attribute selector operator is valid CSS and changes neither id nor action.');
});
