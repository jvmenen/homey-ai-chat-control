import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hoursSince, toEpochMs } from '../lib/utils/time';
import { positiveNumberArg, optionalPositiveNumberArg, optionalStringArg } from '../lib/utils/args';
import { escapeXml, xmlAttrs } from '../lib/formatters/xml-utils';

describe('time', () => {
  it('rounds hours to one decimal', () => {
    assert.equal(hoursSince(0, 5400000), 1.5);
  });

  it('normalizes Date, number and ISO string timestamps', () => {
    const ms = Date.parse('2026-09-25T12:00:00Z');
    assert.equal(toEpochMs(new Date(ms)), ms);
    assert.equal(toEpochMs(ms), ms);
    assert.equal(toEpochMs('2026-09-25T12:00:00Z'), ms);
    for (const invalid of [undefined, null, 0, 'not a date', {}]) assert.equal(toEpochMs(invalid), null);
  });
});

describe('args', () => {
  it('reads positive numbers with fallback and cap', () => {
    assert.equal(positiveNumberArg('12', 8), 12);
    assert.equal(positiveNumberArg(-1, 8), 8);
    assert.equal(positiveNumberArg(undefined, 8), 8);
    assert.equal(positiveNumberArg(500, 8, 50), 50);
    assert.equal(optionalPositiveNumberArg('abc'), undefined);
    assert.equal(optionalStringArg(''), undefined);
    assert.equal(optionalStringArg('x'), 'x');
  });
});

describe('xml-utils', () => {
  it('escapes special characters and skips empty attributes', () => {
    assert.equal(escapeXml('<a href="x">&\'</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;');
    assert.equal(xmlAttrs({
      a: 1, b: undefined, c: null, d: false,
    }), ' a="1" d="false"');
  });
});
