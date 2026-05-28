import { describe, expect, it } from 'vitest';
import { extractProducerSurface } from '../producers.js';
import { tagAttributeContext } from '../componentNav.js';

const PRODUCER = [
  '<rozie name="Modal">',
  '<props>{ open: { type: Boolean }, title: { type: String } }</props>',
  '<script>function close() { $emit("close"); $emit("confirm", 1); }</script>',
  '<template>',
  '  <div><slot name="header" /><slot /><slot name="footer" /></div>',
  '</template>',
  '</rozie>',
].join('\n');

describe('extractProducerSurface', () => {
  it('extracts props, $emit events, and named/default slots', () => {
    const surface = extractProducerSurface(PRODUCER);
    expect(surface.props.map((p) => p.name)).toEqual(['open', 'title']);
    expect(surface.events.map((e) => e.name).sort()).toEqual(['close', 'confirm']);
    expect(surface.slots.map((s) => s.name)).toEqual(['header', 'default', 'footer']);
  });

  it('points slot locs at the producer name attr value', () => {
    const surface = extractProducerSurface(PRODUCER);
    const header = surface.slots.find((s) => s.name === 'header')!;
    expect(PRODUCER.slice(header.loc.start, header.loc.end)).toBe('header');
  });

  it('degrades to empty arrays on unparseable source', () => {
    const surface = extractProducerSurface('not a rozie file');
    expect(surface).toEqual({ props: [], events: [], slots: [] });
  });
});

describe('tagAttributeContext', () => {
  it('detects a prop-binding position on a tag', () => {
    const text = '<Modal :ti';
    const ctx = tagAttributeContext(text, text.length);
    expect(ctx?.tagName).toBe('Modal');
    expect(ctx?.prefix).toBe(':');
    expect(ctx?.partial).toBe('ti');
  });

  it('detects event and slot prefixes', () => {
    expect(tagAttributeContext('<Modal @', '<Modal @'.length)?.prefix).toBe('@');
    expect(tagAttributeContext('<Modal #', '<Modal #'.length)?.prefix).toBe('#');
  });

  it('rejects inside an attribute value and before the tag name', () => {
    expect(tagAttributeContext('<Modal :title="a', '<Modal :title="a'.length)).toBeNull();
    expect(tagAttributeContext('<Mod', '<Mod'.length)).toBeNull(); // no whitespace yet
    expect(tagAttributeContext('<Modal>text', '<Modal>text'.length)).toBeNull(); // tag closed
  });
});
