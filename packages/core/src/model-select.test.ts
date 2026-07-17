import { describe, it, expect } from 'vitest';
import { recommendModel, isComplexPrompt, modelTier } from '@kotrain/shared';
import type { ModelInfo } from '@kotrain/shared';

const model = (id: string, name = id): ModelInfo => ({ id, providerId: 'p', name });

describe('isComplexPrompt', () => {
  it('treats coding/architecture asks as complex', () => {
    expect(isComplexPrompt('Implement a binary search tree')).toBe(true);
    expect(isComplexPrompt('Help me debug this crash')).toBe(true);
    expect(isComplexPrompt('refactor the auth module')).toBe(true);
  });
  it('treats short factual asks as simple', () => {
    expect(isComplexPrompt('what is the capital of France?')).toBe(false);
    expect(isComplexPrompt('thanks!')).toBe(false);
  });
  it('long prompts and code blocks are complex', () => {
    expect(isComplexPrompt('x'.repeat(700))).toBe(true);
    expect(isComplexPrompt('look at ```const x=1```')).toBe(true);
  });
});

describe('modelTier', () => {
  it('ranks frontier > mid > small', () => {
    expect(modelTier(model('claude-opus-4'))).toBeGreaterThan(modelTier(model('claude-sonnet-4')));
    expect(modelTier(model('claude-sonnet-4'))).toBeGreaterThan(modelTier(model('claude-haiku')));
    expect(modelTier(model('gpt-4o'))).toBeGreaterThan(modelTier(model('gpt-4o-mini')));
  });
});

describe('recommendModel', () => {
  const models = [model('claude-haiku', 'Haiku'), model('claude-sonnet-4', 'Sonnet'), model('claude-opus-4', 'Opus')];

  it('returns null for no models, the only model for one', () => {
    expect(recommendModel([], 'hi')).toBeNull();
    expect(recommendModel([model('solo')], 'hi')).toBe('solo');
  });

  it('picks the strongest model for complex prompts', () => {
    expect(recommendModel(models, 'Implement and debug a distributed lock')).toBe('claude-opus-4');
  });

  it('picks a small capable model for quick prompts', () => {
    expect(recommendModel(models, 'what time is it in Tokyo?')).toBe('claude-haiku');
  });

  it('breaks ties toward preferred (favorited) models', () => {
    const two = [model('a-mini', 'A mini'), model('b-mini', 'B mini')];
    // both small tier → favorite wins
    expect(recommendModel(two, 'hello', new Set(['b-mini']))).toBe('b-mini');
  });
});
