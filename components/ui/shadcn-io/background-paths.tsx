'use client'

import * as React from 'react'
import { motion } from 'framer-motion'

import { cn } from '@/lib/utils'

type FloatingPathsProps = {
  position: number
  className?: string
}

const PATH_COUNT = 36

const createPathData = (index: number, position: number) => {
  const offset = index * 5 * position
  const curveOffset = index * 6

  const moveX = 380 - offset
  const moveY = 189 + curveOffset
  const control1X = 312 - offset
  const control1Y = 216 - curveOffset
  const control2X = 152 - offset
  const control2Y = 343 - curveOffset
  const control3X = 616 - offset
  const control3Y = 470 - curveOffset
  const control4X = 684 - offset
  const control4Y = 875 - curveOffset

  return `M-${moveX} -${moveY}C-${moveX} -${moveY} -${control1X} ${control1Y} ${control2X} ${control2Y}C${control3X} ${control3Y} ${control4X} ${control4Y} ${control4X} ${control4Y}`
}

const FloatingPaths = ({ position, className }: FloatingPathsProps) => {
  const paths = React.useMemo(
    () =>
      Array.from({ length: PATH_COUNT }, (_, index) => {
        const d = createPathData(index, position)
        const width = 0.5 + index * 0.032
        const opacity = Math.min(0.9, 0.12 + index * 0.025)
        const duration = 18 + (index % 7) * 2.4
        const delay = (index % 12) * 0.22

        return {
          id: index,
          d,
          width,
          opacity,
          duration,
          delay,
        }
      }),
    [position]
  )

  return (
    <svg
      className={cn(
        'h-full w-full text-slate-900/35 dark:text-white/30',
        className
      )}
      viewBox="0 0 696 316"
      fill="none"
    >
      <title>Background Paths</title>
      {paths.map(({ id, d, width, opacity, duration, delay }) => (
        <motion.path
          key={`${position}-${id}`}
          d={d}
          stroke="currentColor"
          strokeWidth={width}
          strokeOpacity={opacity}
          initial={{ pathLength: 0.3, opacity: opacity * 0.6 }}
          animate={{
            pathLength: [0.3, 1, 0.3],
            opacity: [opacity * 0.4, opacity, opacity * 0.4],
            pathOffset: [0, 1, 0],
          }}
          transition={{
            duration,
            delay,
            repeat: Number.POSITIVE_INFINITY,
            ease: 'linear',
          }}
        />
      ))}
    </svg>
  )
}

export interface BackgroundPathsProps {
  className?: string
  containerClassName?: string
  style?: React.CSSProperties
}

export const BackgroundPaths = ({ className, containerClassName, style }: BackgroundPathsProps) => {
  return (
    <div
      className={cn(
        'pointer-events-none absolute inset-0 overflow-hidden',
        containerClassName
      )}
      style={style}
      aria-hidden
    >
      <FloatingPaths position={1} className={className} />
      <FloatingPaths position={-1} className={className} />
    </div>
  )
}
