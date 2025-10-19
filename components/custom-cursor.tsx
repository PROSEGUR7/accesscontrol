'use client'

import { useEffect, useState } from 'react'

import { Cursor, CursorPointer } from '@/components/ui/shadcn-io/cursor'
import { cn } from '@/lib/utils'

const FINE_POINTER_QUERY = '(pointer: fine)'

type Position = {
  x: number
  y: number
}

export const CustomCursor = () => {
  const [isEnabled, setIsEnabled] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const finePointer = window.matchMedia(FINE_POINTER_QUERY)
    if (!finePointer.matches) return

    setIsEnabled(true)

    const handlePointerMove = (event: PointerEvent) => {
      setPosition({ x: event.clientX, y: event.clientY })
      setIsVisible(true)
    }

    const hideCursor = () => setIsVisible(false)

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', hideCursor)
    window.addEventListener('blur', hideCursor)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', hideCursor)
      window.removeEventListener('blur', hideCursor)
    }
  }, [])

  if (!isEnabled) return null

  return (
    <Cursor
      aria-hidden
      className={cn(
        'pointer-events-none fixed z-[100] flex -translate-x-[1px] -translate-y-[1px] transition-opacity duration-150 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <CursorPointer className="text-primary" />
    </Cursor>
  )
}

export default CustomCursor
