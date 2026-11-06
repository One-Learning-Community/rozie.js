import { describe, expect, it } from 'vitest'
import { resolveFollow, sameIdSequence } from '../src/helpers/activeFollow'

describe('resolveFollow', () => {
  it('same id at the same index → stay', () => {
    expect(resolveFollow(['a', 'b', 'c'], 1, ['x', 'b', 'y'], true)).toEqual({ kind: 'stay' })
  })

  it('moved → move with the new index', () => {
    expect(resolveFollow(['a', 'b', 'c'], 0, ['b', 'c', 'a'], true)).toEqual({ kind: 'move', index: 2 })
    expect(resolveFollow(['a', 'b', 'c'], 0, ['b', 'c', 'a'], false)).toEqual({ kind: 'move', index: 2 })
  })

  it('gone after a view change or write → park', () => {
    expect(resolveFollow(['a', 'b', 'c'], 0, ['b', 'c'], true)).toEqual({ kind: 'park' })
  })

  it('gone after navigation / reset → clamp', () => {
    expect(resolveFollow(['a', 'b', 'c'], 0, ['d', 'e'], false)).toEqual({ kind: 'clamp' })
  })

  it('no previous ids → clamp', () => {
    expect(resolveFollow(null, 0, ['a'], true)).toEqual({ kind: 'clamp' })
  })

  it('active row out of range of the previous ids → clamp', () => {
    expect(resolveFollow(['a', 'b'], 5, ['b', 'a'], true)).toEqual({ kind: 'clamp' })
    expect(resolveFollow(['a', 'b'], -1, ['b', 'a'], true)).toEqual({ kind: 'clamp' })
  })
})

describe('sameIdSequence', () => {
  it('identical → true', () => {
    expect(sameIdSequence(['a', 'b'], ['a', 'b'])).toBe(true)
  })

  it('reordered → false', () => {
    expect(sameIdSequence(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('different length → false', () => {
    expect(sameIdSequence(['a', 'b'], ['a'])).toBe(false)
  })

  it('null → false', () => {
    expect(sameIdSequence(null, ['a'])).toBe(false)
  })
})
