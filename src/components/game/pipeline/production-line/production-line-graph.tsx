'use client'

import { useId } from 'react'
import type { AncestryChartModel } from './ancestry-layout'
import styles from './production-line-overlay.module.css'

type Props = {
  chart: AncestryChartModel
}

/** Icon + label production-line chart for one core demand. */
export function ProductionLineGraph({ chart }: Props) {
  const markerId = useId().replace(/:/g, '')

  return (
    <figure
      className={styles.chart}
      style={{ width: chart.width, height: chart.height }}
      aria-label={chart.ariaLabel}
    >
      <svg
        className={styles.edges}
        width={chart.width}
        height={chart.height}
        aria-hidden
      >
        <defs>
          <marker
            id={markerId}
            markerWidth="7"
            markerHeight="7"
            refX="6"
            refY="3.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L7 3.5 L0 7 Z" className={styles.arrowHead} />
          </marker>
        </defs>
        {chart.edges.map((edge, index) => (
          <path
            key={index}
            className={styles.edge}
            fill="none"
            d={edge.d}
            markerEnd={edge.arrow ? `url(#${markerId})` : undefined}
          />
        ))}
        {chart.plusMarks.map((mark, index) => (
          <text
            key={`plus-${index}`}
            x={mark.x}
            y={mark.y + 4}
            textAnchor="middle"
            className={styles.op}
          >
            +
          </text>
        ))}
      </svg>
      {chart.nodes.map((node) => (
        <div
          key={node.key}
          className={[
            styles.node,
            node.isTarget ? styles.nodeTarget : '',
            node.isRepeat ? styles.nodeRepeat : '',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{
            left: node.x,
            top: node.y,
            width: node.w,
          }}
        >
          <span
            className={styles.glyph}
            style={{
              width: node.iconSize,
              height: node.iconSize,
              backgroundColor: node.fill,
              maskImage: `url(${node.glyph})`,
              WebkitMaskImage: `url(${node.glyph})`,
            }}
            aria-hidden
          />
          <span className={styles.label}>{node.namePt}</span>
        </div>
      ))}
    </figure>
  )
}
