import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Markdown } from './Markdown.js';

const html = (text: string) => renderToStaticMarkup(<Markdown text={text} />);

describe('Markdown', () => {
  it('turns a dashed run glued to a sentence into a real list', () => {
    // The shape people actually type into the composer: a lead-in line with no
    // blank line before the dashes.
    const out = html('kotrain project.\n- first thing\n- second thing');
    expect(out).toContain('<p>kotrain project.</p>');
    expect(out.match(/<li>/g)).toHaveLength(2);
    expect(out).toContain('<li>first thing</li>');
    expect(out).toContain('list-style-type:disc');
  });

  it('nests deeper-indented items under the item above', () => {
    const out = html('- top\n  - child\n  - sibling\n- next top');
    expect(out).toContain('list-style-type:circle');
    // One outer list with two top-level items, one inner list with two.
    expect(out.match(/<ul/g)).toHaveLength(2);
    expect(out.match(/<li>/g)).toHaveLength(4);
  });

  it('keeps single newlines inside a paragraph as line breaks', () => {
    expect(html('one\ntwo')).toContain('one<br/>two');
  });

  it('starts a new list when a numbered run follows a bulleted one', () => {
    const out = html('- bullet\n1. number');
    expect(out).toContain('<ul');
    expect(out).toContain('<ol');
  });

  it('renders numbered lists, headings, quotes and rules', () => {
    expect(html('1. first\n2. second')).toContain('<ol');
    expect(html('## Heading')).toContain('Heading');
    expect(html('> quoted')).toContain('<blockquote');
    expect(html('---')).toContain('<hr');
  });

  it('renders a pipe table with a body', () => {
    const out = html('| Item | Count |\n| --- | --- |\n| Alpha | 1 |');
    expect(out).toContain('<table');
    expect(out).toContain('<th');
    expect(out).toContain('Alpha');
  });

  it('renders fenced code without treating its contents as markdown', () => {
    const out = html('```ts\n- not a bullet\n```');
    expect(out).toContain('<pre');
    expect(out).toContain('- not a bullet');
    expect(out).not.toContain('<li>');
  });

  it('covers inline bold, italic, strike, code and links', () => {
    const out = html('**b** *i* ~~s~~ `c` [text](https://kotrain.com)');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('>s</s>');
    expect(out).toContain('>c</code>');
    expect(out).toContain('href="https://kotrain.com"');
  });

  it('auto-links a bare url', () => {
    expect(html('see https://kotrain.com now')).toContain('href="https://kotrain.com"');
  });

  it('leaves snake_case and arithmetic alone', () => {
    const out = html('call some_long_name(x) when 2 * 3 * 4 is odd');
    expect(out).not.toContain('<em>');
    expect(out).toContain('some_long_name(x)');
  });

  it('renders nothing for empty text', () => {
    expect(html('')).not.toContain('<p>');
    expect(html('   \n  ')).not.toContain('<p>');
  });
});
