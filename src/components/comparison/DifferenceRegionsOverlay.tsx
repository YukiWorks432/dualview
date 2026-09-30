import type { NormalizedDifferenceRegion } from '../../lib/difference/regions'
import { cn } from '../../lib/utils'

interface DifferenceRegionsOverlayProps {
  regions: readonly NormalizedDifferenceRegion[]
  aspectRatio: number
  className?: string
}

export function DifferenceRegionsOverlay({
  regions,
  aspectRatio,
  className,
}: DifferenceRegionsOverlayProps) {
  if (regions.length === 0 || !Number.isFinite(aspectRatio) || aspectRatio <= 0) return null

  return (
    <svg
      data-testid="difference-regions-overlay"
      className={cn(
        'pointer-events-none absolute inset-0 z-10 h-full w-full overflow-visible text-accent',
        className,
      )}
      viewBox={`0 0 ${aspectRatio} 1`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      {regions.map((region, index) => {
        const x = region.x * aspectRatio
        const width = region.width * aspectRatio

        return (
          <g key={`${index}-${region.x}-${region.y}`}>
            <rect
              x={x}
              y={region.y}
              width={width}
              height={region.height}
              fill="none"
              stroke="rgba(0, 0, 0, 0.9)"
              strokeWidth={4}
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x}
              y={region.y}
              width={width}
              height={region.height}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}
