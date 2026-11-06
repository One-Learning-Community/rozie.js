import { describe, expect, it } from 'vitest'
import { rangeFillTargets } from '../src/helpers/rangeFill'

describe('rangeFillTargets', () => {
  it('targets the active cell alone when there is no range', () => {
    expect(rangeFillTargets(null, 2, 1)).toEqual({ top: 2, bottom: 2, col: 1, size: 1 })
  })

  it('targets every range row in the active column', () => {
    expect(rangeFillTargets({ r0: 0, r1: 3, c0: 1, c1: 1 }, 3, 1)).toEqual({ top: 0, bottom: 3, col: 1, size: 4 })
  })

  it('normalizes reversed corners', () => {
    expect(rangeFillTargets({ r0: 4, r1: 1, c0: 2, c1: 2 }, 1, 2)).toEqual({ top: 1, bottom: 4, col: 2, size: 4 })
  })

  it('fills only the active column of a multi-column range', () => {
    expect(rangeFillTargets({ r0: 0, r1: 2, c0: 1, c1: 3 }, 2, 2)).toEqual({ top: 0, bottom: 2, col: 2, size: 3 })
  })

  it('falls back to the active cell when it lies outside the range', () => {
    expect(rangeFillTargets({ r0: 0, r1: 2, c0: 1, c1: 1 }, 5, 4)).toEqual({ top: 5, bottom: 5, col: 4, size: 1 })
    expect(rangeFillTargets({ r0: 0, r1: 2, c0: 1, c1: 1 }, 1, 4)).toEqual({ top: 1, bottom: 1, col: 4, size: 1 })
  })
})
