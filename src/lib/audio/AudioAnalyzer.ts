import { createAudioTaskYield, throwIfAudioAborted } from './audioTask'

/**
 * Professional Audio Analysis Library
 *
 * Implements industry-standard audio metrics:
 * - LUFS (Loudness Units Full Scale) - EBU R128 / ITU-R BS.1770
 * - Sample Peak
 * - RMS (Root Mean Square)
 * - Crest Factor (Peak to RMS ratio)
 * - Phase Correlation
 * - Stereo Width
 * - Dynamic Range
 * - Frequency spectrum analysis
 */

export interface LoudnessMetrics {
  // LUFS measurements
  momentary: number // 400ms window
  shortTerm: number // 3s window
  integrated: number // Full duration
  loudnessRange: number // LRA - dynamic range in LU

  // Peak measurements
  // Kept for compatibility; this currently mirrors samplePeak and is not a standards-compliant dBTP value.
  truePeak: number
  samplePeak: number // dBFS

  // RMS
  rms: number // dBFS

  // Crest factor (peak to RMS ratio in dB)
  crestFactor: number
}

export interface StereoMetrics {
  // Phase correlation (-1 to +1)
  correlation: number

  // Stereo width (0 to 1, where 0 is mono)
  width: number

  // Balance (-1 left, 0 center, +1 right)
  balance: number

  // Mid/Side ratio
  midLevel: number
  sideLevel: number
}

export interface SpectralData {
  frequencies: Float32Array
  magnitudes: Float32Array
  phases: Float32Array
  binCount: number
  sampleRate: number
  fftSize: number
}

export interface AudioAnalysisResult {
  loudness: LoudnessMetrics
  stereo: StereoMetrics
  spectral: SpectralData
  waveformPeaks: Float32Array
  duration: number
  sampleRate: number
  channels: number
}

// K-weighting filter coefficients for LUFS calculation
// Based on ITU-R BS.1770-4
const K_WEIGHT_HIGH_SHELF = {
  b0: 1.53512485958697,
  b1: -2.69169618940638,
  b2: 1.19839281085285,
  a1: -1.69065929318241,
  a2: 0.73248077421585,
}

const K_WEIGHT_HIGH_PASS = {
  b0: 1.0,
  b1: -2.0,
  b2: 1.0,
  a1: -1.99004745483398,
  a2: 0.99007225036621,
}

interface BiquadState {
  x1: number
  x2: number
  y1: number
  y2: number
}

function createBiquadState(): BiquadState {
  return { x1: 0, x2: 0, y1: 0, y2: 0 }
}

function filterSample(
  value: number,
  state: BiquadState,
  coeffs: typeof K_WEIGHT_HIGH_SHELF,
): number {
  const filtered =
    coeffs.b0 * value +
    coeffs.b1 * state.x1 +
    coeffs.b2 * state.x2 -
    coeffs.a1 * state.y1 -
    coeffs.a2 * state.y2
  state.x2 = state.x1
  state.x1 = value
  state.y2 = state.y1
  state.y1 = filtered
  // 元の各段のFloat32Arrayへの書込み位置だけで丸める。帰還状態は倍精度を保つ。
  return Math.fround(filtered)
}

/**
 * Convert linear value to dB
 */
function linearToDb(value: number): number {
  return value > 0 ? 20 * Math.log10(value) : -Infinity
}

/**
 * Calculate LUFS from mean square (with K-weighting already applied)
 */
function meanSquareToLUFS(meanSquare: number): number {
  return meanSquare > 0 ? -0.691 + 10 * Math.log10(meanSquare) : -Infinity
}

/**
 * Generate waveform peaks for visualization
 */
export function generateWaveformPeaks(
  channels: readonly Float32Array[],
  numPeaks: number,
): Float32Array {
  if (channels.length === 0 || numPeaks <= 0) return new Float32Array(0)

  const length = Math.max(...channels.map((channel) => channel.length))
  const peaks = new Float32Array(numPeaks)
  if (length === 0) return peaks

  for (let i = 0; i < numPeaks; i++) {
    const start = Math.floor((i * length) / numPeaks)
    const end = Math.min(length, Math.max(start + 1, Math.floor(((i + 1) * length) / numPeaks)))
    let maxVal = 0

    for (const channel of channels) {
      const channelEnd = Math.min(end, channel.length)
      for (let j = start; j < channelEnd; j++) {
        maxVal = Math.max(maxVal, Math.abs(channel[j]))
      }
    }

    peaks[i] = maxVal
  }

  return peaks
}

function loudnessWindowSizes(sampleRate: number) {
  const blockSize = Math.max(1, Math.floor(0.4 * sampleRate))
  return { blockSize, hopSize: Math.max(1, Math.floor(blockSize * 0.25)) }
}

// PCMの全長ではなく、重複窓の結果だけを保持する。LRAの並べ替えも同じ領域を使う。
export function estimateAudioAnalysisBytes(
  length: number,
  sampleRate: number,
  channels: number,
): number {
  const { blockSize, hopSize } = loudnessWindowSizes(sampleRate)
  const blocks = Math.max(0, Math.floor((length - blockSize) / hopSize) + 1)
  return blocks * Float64Array.BYTES_PER_ELEMENT + channels * 8 * 8 + 500 * 4 + 256
}

/**
 * Analyze audio buffer and return comprehensive metrics.
 * 取消を確認しながら処理を譲り、全長のフィルター済みPCMや二乗和配列は保持しない。
 */
export async function analyzeAudio(
  audioBuffer: AudioBuffer,
  signal?: AbortSignal,
): Promise<AudioAnalysisResult> {
  throwIfAudioAborted(signal)
  const sampleRate = audioBuffer.sampleRate
  const channels = audioBuffer.numberOfChannels
  const duration = audioBuffer.duration
  const length = audioBuffer.length
  const channelData = Array.from({ length: channels }, (_, channel) =>
    audioBuffer.getChannelData(channel),
  )
  const leftChannel = channelData[0]
  const rightChannel = channels > 1 ? channelData[1] : leftChannel
  const filters = channelData.map(() => ({
    shelf: createBiquadState(),
    highPass: createBiquadState(),
  }))
  const yieldTask = createAudioTaskYield(signal)
  const { blockSize, hopSize } = loudnessWindowSizes(sampleRate)
  const blockCount = Math.max(0, Math.floor((length - blockSize) / hopSize) + 1)
  const blockLoudness = new Float64Array(blockCount)
  const overlap = Math.ceil(blockSize / hopSize)
  const blockSums = new Float64Array(overlap)
  const blockEnds = new Float64Array(overlap)
  let firstBlock = 0,
    activeBlocks = 0,
    nextBlockStart = 0,
    acceptedBlocks = 0
  const momentarySamples = Math.min(Math.floor(0.4 * sampleRate), length)
  const shortTermSamples = Math.min(Math.floor(3 * sampleRate), length)
  let momentarySum = 0,
    shortTermSum = 0
  let samplePeak = 0,
    leftSum = 0,
    rightSum = 0,
    sumLR = 0,
    midSum = 0,
    sideSum = 0
  const waveformPeaks = new Float32Array(500)
  let peakIndex = 0
  let peakEnd = Math.floor(length / waveformPeaks.length)

  for (let start = 0; start < length; start += 1024) {
    const end = Math.min(length, start + 1024)
    for (let index = start; index < end; index++) {
      let squared = 0
      let peak = 0
      for (let channel = 0; channel < channels; channel++) {
        const value = channelData[channel][index]
        const state = filters[channel]
        const weighted = filterSample(
          filterSample(value, state.shelf, K_WEIGHT_HIGH_SHELF),
          state.highPass,
          K_WEIGHT_HIGH_PASS,
        )
        squared += weighted * weighted
        peak = Math.max(peak, Math.abs(value))
      }
      // 元の全チャンネル二乗和配列もFloat32だった。
      squared = Math.fround(squared)
      if (index === nextBlockStart && index + blockSize <= length) {
        const slot = (firstBlock + activeBlocks) % overlap
        blockSums[slot] = 0
        blockEnds[slot] = index + blockSize
        activeBlocks++
        nextBlockStart += hopSize
      }
      for (let block = 0; block < activeBlocks; block++) {
        blockSums[(firstBlock + block) % overlap] += squared
      }
      if (activeBlocks > 0 && index + 1 === blockEnds[firstBlock]) {
        const lufs = meanSquareToLUFS(blockSums[firstBlock] / blockSize)
        if (lufs > -70) blockLoudness[acceptedBlocks++] = lufs
        firstBlock = (firstBlock + 1) % overlap
        activeBlocks--
      }
      if (index >= length - momentarySamples) momentarySum += squared
      if (index >= length - shortTermSamples) shortTermSum += squared

      const left = leftChannel[index],
        right = rightChannel[index]
      const absLeft = Math.abs(left),
        absRight = Math.abs(right)
      if (absLeft > samplePeak) samplePeak = absLeft
      if (absRight > samplePeak) samplePeak = absRight
      leftSum += left * left
      rightSum += right * right
      sumLR += left * right
      const mid = (left + right) / 2,
        side = (left - right) / 2
      midSum += mid * mid
      sideSum += side * side
      if (length >= waveformPeaks.length) {
        if (index === peakEnd) {
          peakIndex++
          peakEnd = Math.floor(((peakIndex + 1) * length) / waveformPeaks.length)
        }
        waveformPeaks[peakIndex] = Math.max(waveformPeaks[peakIndex], peak)
      }
    }
    const pending = yieldTask()
    if (pending) await pending
  }

  let integrated = -Infinity
  if (acceptedBlocks > 0) {
    let ungatedSum = 0
    for (let index = 0; index < acceptedBlocks; index++) {
      ungatedSum += Math.pow(10, blockLoudness[index] / 10)
      if (index % 1024 === 0) {
        const pending = yieldTask()
        if (pending) await pending
      }
    }
    const relativeThreshold = 10 * Math.log10(ungatedSum / acceptedBlocks) - 10
    let gatedSum = 0,
      gatedCount = 0
    for (let index = 0; index < acceptedBlocks; index++) {
      if (blockLoudness[index] > relativeThreshold) {
        gatedSum += Math.pow(10, blockLoudness[index] / 10)
        gatedCount++
      }
      if (index % 1024 === 0) {
        const pending = yieldTask()
        if (pending) await pending
      }
    }
    if (gatedCount > 0) integrated = 10 * Math.log10(gatedSum / gatedCount)
  }

  let loudnessRange = 0
  if (acceptedBlocks > 10) {
    // 1入力512MiBでは小さな窓表に収まり、全長PCMの複製を作らない。
    const sorted = blockLoudness.subarray(0, acceptedBlocks).sort()
    loudnessRange =
      sorted[Math.floor(sorted.length * 0.95)] - sorted[Math.floor(sorted.length * 0.1)]
  }
  if (length < waveformPeaks.length) waveformPeaks.set(generateWaveformPeaks(channelData, 500))
  throwIfAudioAborted(signal)

  const leftRms = Math.sqrt(leftSum / length),
    rightRms = Math.sqrt(rightSum / length)
  const rms = Math.sqrt((leftRms * leftRms + rightRms * rightRms) / 2)
  const denominator = Math.sqrt(leftSum * rightSum)
  const midRms = Math.sqrt(midSum / length),
    sideRms = Math.sqrt(sideSum / length)
  const totalEnergy = midRms + sideRms,
    maxLR = Math.max(leftRms, rightRms)

  return {
    loudness: {
      momentary: meanSquareToLUFS(momentarySum / momentarySamples),
      shortTerm: meanSquareToLUFS(shortTermSum / shortTermSamples),
      integrated,
      loudnessRange,
      // 標本ピークの互換フィールド。標準準拠のdBTP値ではない。
      truePeak: linearToDb(samplePeak),
      samplePeak: linearToDb(samplePeak),
      rms: linearToDb(rms),
      crestFactor: linearToDb(samplePeak) - linearToDb(rms),
    },
    stereo: {
      correlation: denominator > 0 ? sumLR / denominator : 0,
      width: totalEnergy > 0 ? sideRms / totalEnergy : 0,
      balance: maxLR > 0 ? (rightRms - leftRms) / maxLR : 0,
      midLevel: linearToDb(midRms),
      sideLevel: linearToDb(sideRms),
    },
    spectral: {
      frequencies: new Float32Array(0),
      magnitudes: new Float32Array(0),
      phases: new Float32Array(0),
      binCount: 0,
      sampleRate,
      fftSize: 2048,
    },
    waveformPeaks,
    duration,
    sampleRate,
    channels,
  }
}

/**
 * Calculate difference between two audio analyses
 */
export function calculateAudioDifference(
  a: AudioAnalysisResult,
  b: AudioAnalysisResult,
): {
  loudnessDiff: number
  correlationDiff: number
  spectralDiff: number
  phaseDiff: number
} {
  return {
    loudnessDiff: Math.abs(a.loudness.integrated - b.loudness.integrated),
    correlationDiff: Math.abs(a.stereo.correlation - b.stereo.correlation),
    spectralDiff: 0, // Will be calculated in real-time
    phaseDiff: Math.abs(a.stereo.width - b.stereo.width),
  }
}

/**
 * Format LUFS value for display
 */
export function formatLUFS(value: number): string {
  if (!isFinite(value)) return '-∞'
  return value.toFixed(1) + ' LUFS'
}

/**
 * Format dB value for display
 */
export function formatDb(value: number): string {
  if (!isFinite(value)) return '-∞ dB'
  return value.toFixed(1) + ' dB'
}

/**
 * Get loudness target for different platforms
 */
export const LOUDNESS_TARGETS = {
  spotify: -14,
  youtube: -14,
  appleMusic: -16,
  amazonMusic: -14,
  tidal: -14,
  ebuR128: -23,
  atscA85: -24,
  cinema: -27,
  podcast: -16,
} as const

export const LOUDNESS_TARGET_LABELS: Record<keyof typeof LOUDNESS_TARGETS, string> = {
  spotify: 'Spotify',
  youtube: 'YouTube',
  appleMusic: 'Apple Music',
  amazonMusic: 'Amazon Music',
  tidal: 'TIDAL',
  ebuR128: 'EBU R128',
  atscA85: 'ATSC A/85',
  cinema: 'Cinema reference',
  podcast: 'Podcast reference',
}

/**
 * Check if audio is within ±1 LU of a selected reference target.
 * This is a convenience comparison, not a certification of platform or broadcast compliance.
 */
export function checkLoudnessCompliance(
  integrated: number,
  platform: keyof typeof LOUDNESS_TARGETS,
): { compliant: boolean; difference: number; target: number } {
  const target = LOUDNESS_TARGETS[platform]
  const difference = integrated - target
  return {
    compliant: Math.abs(difference) <= 1, // 1 LU tolerance
    difference,
    target,
  }
}
