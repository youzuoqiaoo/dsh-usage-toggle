/**
 * dsh-usage-toggle — client (browser) half.
 *
 * Replaces the `stats` cell of `conversation.composer.dock` (the token/step
 * usage line below the composer) with a faithful rendering, controlled by a
 * small eye-icon toggle placed in `conversation.input.right`, immediately
 * before the model selector. Clicking the eye shows/hides the usage line.
 *
 * State lives in a module-scoped store so the toggle and the line stay in
 * sync across the two separate slot seats.
 */
import { createElement, useState, useSyncExternalStore } from 'react'

type UseChat = (selector: (s: any) => any) => any
type UseProjection = (key: string) => any
type T = (key: string, params?: Record<string, any>) => string

/* eslint-disable @typescript-eslint/no-explicit-any */

function makeUsageStore() {
  let value = true
  const listeners = new Set<() => void>()
  return {
    get: () => value,
    set: (next: boolean) => {
      if (next === value) return
      value = next
      listeners.forEach((fn) => fn())
    },
    subscribe: (fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
  }
}

function usageOutputTokens(usage: any): number | null {
  if (typeof usage !== 'object' || usage === null) return null
  const value = usage.outputTokens
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function assistantStepReading(node: any) {
  const timing = node.timing
  return {
    ttftMs:
      timing !== undefined && timing.stepStartTime !== null && timing.firstTokenTime !== null
        ? Math.max(0, timing.firstTokenTime - timing.stepStartTime)
        : null,
    decodeMs:
      timing !== undefined && timing.firstTokenTime !== null
        ? Math.max(0, timing.completedTime - timing.firstTokenTime)
        : null,
    outputTokens: usageOutputTokens(node.usage),
  }
}

function deriveStats(nodes: any[]) {
  const turns = new Set<number>()
  let steps = 0
  let llmMs = 0
  let toolMs = 0
  let ttftMs = 0
  let ttftSteps = 0
  let decodeMs = 0
  let decodeTokens = 0
  for (const node of nodes) {
    if (node.kind === 'tool-result') {
      if (node.callTime !== null) toolMs += Math.max(0, node.time - node.callTime)
      continue
    }
    if (node.kind !== 'assistant') continue
    turns.add(node.turn)
    steps += 1
    if (node.timing !== undefined && node.timing.stepStartTime !== null)
      llmMs += Math.max(0, node.timing.completedTime - node.timing.stepStartTime)
    const reading = assistantStepReading(node)
    if (reading.ttftMs !== null) {
      ttftMs += reading.ttftMs
      ttftSteps += 1
    }
    if (reading.decodeMs !== null && reading.outputTokens !== null) {
      decodeMs += reading.decodeMs
      decodeTokens += reading.outputTokens
    }
  }
  return { turns: turns.size, steps, llmMs, toolMs, ttftMs, ttftSteps, decodeMs, decodeTokens }
}

function formatDuration(ms: number, t: T): string {
  const s = ms / 1e3
  if (s < 60) return t('duration.compactSeconds', { seconds: Math.round(s * 10) / 10 })
  const whole = Math.round(s)
  return t('duration.compactMinutes', { minutes: Math.floor(whole / 60), seconds: whole % 60 })
}

function formatTokens(value: number, t: T): string {
  const scaled = (candidate: number) =>
    candidate >= 100 ? String(Math.round(candidate)) : String(Math.round(candidate * 10) / 10)
  if (value < 1e3) return String(value)
  if (value < 1e6) return t('number.thousand', { value: scaled(value / 1e3) })
  return t('number.million', { value: scaled(value / 1e6) })
}

function formatTokensPerSecond(tps: number): string {
  const clamped = Math.max(0, tps)
  return clamped >= 10 ? String(Math.round(clamped)) : String(Math.round(clamped * 10) / 10)
}

function roundedPercentUnits(cacheReadTokens: number, denominator: number, decimalPlaces: number) {
  const scale = (decimalPlaces === 0 ? 1 : 10) * 100
  const doubledScale = scale * 2
  const denominatorQuotient = Math.floor(denominator / doubledScale)
  const denominatorRemainder = denominator % doubledScale
  let lower = 0
  let upper = scale
  while (lower < upper) {
    const candidate = Math.floor((lower + upper + 1) / 2)
    const factor = candidate * 2 - 1
    if (cacheReadTokens >= factor * denominatorQuotient + Math.ceil((factor * denominatorRemainder) / doubledScale))
      lower = candidate
    else upper = candidate - 1
  }
  return lower
}

function displayPercentUnits(units: number, decimalPlaces: number): string {
  if (decimalPlaces === 0) return String(units)
  const whole = Math.floor(units / 10)
  const tenths = units % 10
  return tenths === 0 ? String(whole) : `${whole}.${tenths}`
}

function formatCacheHitPercent(cacheReadTokens: number, promptTokens: number, decimalPlaces = 0): string | null {
  if (promptTokens === 0) return null
  const missedInputTokens = promptTokens - cacheReadTokens
  if (missedInputTokens === 0) return '100'
  const roundedUnits = roundedPercentUnits(cacheReadTokens, promptTokens, decimalPlaces)
  if (roundedUnits < (decimalPlaces === 0 ? 100 : 1e3)) return displayPercentUnits(roundedUnits, decimalPlaces)
  let distinguishingPlaces = 1
  let scaledDoubleGap = missedInputTokens * 200
  const denominatorTens = Math.floor(promptTokens / 10)
  while (scaledDoubleGap <= denominatorTens) {
    scaledDoubleGap *= 10
    distinguishingPlaces += 1
  }
  const denominatorOnes = promptTokens % 10
  let roundedLoss = 5
  for (let loss = 1; loss < 5; loss += 1) {
    const factor = loss * 2 + 1
    const threshold = factor * denominatorTens + Math.floor((factor * denominatorOnes) / 10)
    if (scaledDoubleGap <= threshold) {
      roundedLoss = loss
      break
    }
  }
  return `99.${'9'.repeat(distinguishingPlaces - 1)}${10 - roundedLoss}`
}

function billedInputTokens(usage: any): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

function cacheHitPercent(usage: any): string | null {
  const denominator = billedInputTokens(usage)
  return formatCacheHitPercent(usage.cacheReadTokens, denominator)
}

/** Build the display groups for the usage line, formatted in the active locale. */
function usageLine(useChat: UseChat | undefined, useProjection: UseProjection | undefined, t: T): string[] {
  const groups: string[] = []
  try {
    let nodes: any[] | null = null
    let usage: any
    let projected: any
    let stats: any = null
    if (typeof useChat === 'function') nodes = useChat((s: any) => s.legacy.nodes)
    if (typeof useProjection === 'function') {
      usage = useProjection('tokenUsage')
      projected = useProjection('sessionStats')
    }
    stats = projected !== undefined && projected !== null ? projected : Array.isArray(nodes) ? deriveStats(nodes) : null
    if (stats !== null && stats.steps > 0) {
      groups.push(t('stats.counts', { turns: stats.turns, steps: stats.steps }))
      const durations: string[] = []
      if (stats.llmMs > 0) durations.push(t('stats.llm', { duration: formatDuration(stats.llmMs, t) }))
      if (stats.toolMs > 0) durations.push(t('stats.toolCall', { duration: formatDuration(stats.toolMs, t) }))
      if (durations.length > 0) groups.push(durations.join(' · '))
      const speeds: string[] = []
      if (stats.ttftSteps > 0)
        speeds.push(t('stats.ttftAverage', { duration: formatDuration(stats.ttftMs / stats.ttftSteps, t) }))
      if (stats.decodeMs > 0)
        speeds.push(
          t('stats.tokensPerSecond', { throughput: formatTokensPerSecond(stats.decodeTokens / (stats.decodeMs / 1e3)) }),
        )
      if (speeds.length > 0) groups.push(speeds.join(' · '))
    }
    if (usage !== undefined && usage !== null && (billedInputTokens(usage) > 0 || usage.outputTokens > 0)) {
      const cacheHit = cacheHitPercent(usage)
      if (cacheHit !== null) groups.push(t('stats.cacheHit', { percent: cacheHit }))
      groups.push(
        t('stats.tokens', {
          input: formatTokens(billedInputTokens(usage), t),
          output: formatTokens(usage.outputTokens, t),
        }),
      )
    }
  } catch {
    /* degrade silently */
  }
  return groups
}

function EyeIcon({ off }: { off: boolean }) {
  const common = {
    viewBox: '0 0 16 16',
    width: '14',
    height: '14',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.2',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  const parts: any[] = [
    createElement('path', { d: 'M1.8 8 C3.6 5.4 5.7 4 8 4 C10.3 4 12.4 5.4 14.2 8 C12.4 10.6 10.3 12 8 12 C5.7 12 3.6 10.6 1.8 8 Z' }),
    createElement('circle', { cx: '8', cy: '8', r: '1.8' }),
  ]
  if (off) parts.push(createElement('line', { x1: '3', y1: '13', x2: '13', y2: '3' }))
  return createElement('svg', common, parts)
}

/** In-memory preference store used by both slot seats. */
const store = makeUsageStore()

function UsageLine(props: { useChat?: UseChat; useProjection?: UseProjection; t: T }) {
  const shown = useSyncExternalStore(store.subscribe, store.get)
  const groups = usageLine(props.useChat, props.useProjection, props.t)
  const line = groups.join(' | ')
  if (!shown || groups.length === 0) return null
  return createElement(
    'span',
    { className: 'udline-line', title: line, style: { whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' } },
    line,
  )
}

function UsageToggle() {
  const shown = useSyncExternalStore(store.subscribe, store.get)
  const label = shown ? '隐藏用量信息' : '显示用量信息'
  return createElement(
    'button',
    {
      className: 'udtoggle',
      type: 'button',
      onClick: () => store.set(!shown),
      title: label,
      'aria-label': label,
      'aria-pressed': shown,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'var(--dsw-alias-label-tertiary)',
        background: 'none',
        border: 'none',
        padding: '4px',
        borderRadius: '6px',
        lineHeight: '0',
      },
    },
    createElement(EyeIcon, { off: !shown }),
  )
}

export const inject = ['slots']

/** Client plugin body. */
export function apply(ctx: any): void {
  const slots = ctx.get('slots') ?? ctx.slots
  if (slots === undefined) return

  slots.inject('conversation.composer.dock', () =>
    slots.register(
      { name: 'conversation.composer.dock', id: 'stats', order: 0, priority: -1, locale: 'chat' },
      (props: any) =>
        createElement(
          'div',
          {
            className: 'udline-root',
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              maxWidth: 'var(--dsh-chat-content-width)',
              boxSizing: 'border-box',
              width: '100%',
              padding: '4px calc(var(--dsh-composer-side-clearance) + 16px) 0',
              fontSize: 'var(--dsh-content-font-size-secondary,13px)',
              lineHeight: 'calc(20px + var(--dsh-content-font-delta-secondary,0px))',
              color: 'var(--dsw-alias-label-tertiary)',
              margin: '0 auto',
            },
          },
          [createElement(UsageLine, { useChat: props.useChat, useProjection: props.useProjection, t: props.t })],
        ),
    ),
  )

  slots.inject('conversation.input.right', () =>
    slots.register(
      { name: 'conversation.input.right', id: 'usage-toggle', order: 0, label: 'usage' },
      () => createElement(UsageToggle),
    ),
  )
}
