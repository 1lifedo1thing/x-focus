import { describe, it, expect } from 'vitest'
import {
  parseNumberWithSuffix,
  calculateTweetVelocity,
  classifyTweetVelocity,
  formatVelocityBadge,
} from '../../shared/viral-radar-parser'

describe('viral-radar-parser', () => {
  describe('parseNumberWithSuffix', () => {
    it('parses standard numbers with commas', () => {
      expect(parseNumberWithSuffix('1,234')).toBe(1234)
      expect(parseNumberWithSuffix('500')).toBe(500)
      expect(parseNumberWithSuffix('0')).toBe(0)
    })

    it('parses English K/M/B suffixes', () => {
      expect(parseNumberWithSuffix('1.2K')).toBe(1200)
      expect(parseNumberWithSuffix('15.3k')).toBe(15300)
      expect(parseNumberWithSuffix('2.5M')).toBe(2500000)
      expect(parseNumberWithSuffix('1.2B')).toBe(1200000000)
    })

    it('parses Chinese units (万 / 千 / 亿)', () => {
      expect(parseNumberWithSuffix('1.2万')).toBe(12000)
      expect(parseNumberWithSuffix('15.5萬')).toBe(155000)
      expect(parseNumberWithSuffix('1.5千')).toBe(1500)
      expect(parseNumberWithSuffix('1.2亿')).toBe(120000000)
    })

    it('parses embedded text in aria-label or status links', () => {
      expect(parseNumberWithSuffix('1,234 Views')).toBe(1234)
      expect(parseNumberWithSuffix('1.2K 次查看')).toBe(1200)
      expect(parseNumberWithSuffix('1.5万 次浏览')).toBe(15000)
      expect(parseNumberWithSuffix('1.8万 查看')).toBe(18000)
      expect(parseNumberWithSuffix('1273 次查看。查看帖子分析')).toBe(1273)
      expect(parseNumberWithSuffix('1074 次查看。查看帖子分析')).toBe(1074)
      expect(parseNumberWithSuffix('353 次查看。查看帖子分析')).toBe(353)
    })

    it('returns null for invalid inputs', () => {
      expect(parseNumberWithSuffix('')).toBeNull()
      expect(parseNumberWithSuffix('abc')).toBeNull()
    })
  })

  describe('calculateTweetVelocity', () => {
    it('calculates views per hour accurately', () => {
      const now = 1000 * 60 * 60 * 10 // 10 hours
      const publishTime = 1000 * 60 * 60 * 8 // 8 hours (2 hours ago)
      const views = 10000
      expect(calculateTweetVelocity(views, publishTime, now)).toBe(5000) // 10000 / 2 = 5000/h
    })

    it('clamps elapsed time to 1 minute minimum to prevent spikes', () => {
      const now = 1000 * 60 * 10
      const publishTime = now - 1000 * 10 // 10 seconds ago
      const views = 60
      // effectiveHours = 1 / 60
      expect(calculateTweetVelocity(views, publishTime, now)).toBe(3600) // 60 / (1/60)
    })
  })

  describe('classifyTweetVelocity', () => {
    it('classifies normal, potential, and viral tweets', () => {
      expect(classifyTweetVelocity(500, 1000, 10000)).toBe('normal')
      expect(classifyTweetVelocity(1000, 1000, 10000)).toBe('potential')
      expect(classifyTweetVelocity(5000, 1000, 10000)).toBe('potential')
      expect(classifyTweetVelocity(10000, 1000, 10000)).toBe('viral')
      expect(classifyTweetVelocity(25000, 1000, 10000)).toBe('viral')
    })
  })

  describe('formatVelocityBadge', () => {
    it('formats velocity numbers into readable strings', () => {
      expect(formatVelocityBadge(500)).toBe('500/h')
      expect(formatVelocityBadge(1200)).toBe('1.2k/h')
      expect(formatVelocityBadge(6900)).toBe('6.9k/h')
      expect(formatVelocityBadge(15800)).toBe('1.6万/h')
      expect(formatVelocityBadge(127000)).toBe('12.7万/h')
    })
  })
})
