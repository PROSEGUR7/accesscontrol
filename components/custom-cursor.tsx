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
  const [forceSystemCursor, setForceSystemCursor] = useState(false)
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 })

  useEffect(() => {
    if (typeof window === 'undefined') return

    const finePointer = window.matchMedia(FINE_POINTER_QUERY)
    if (!finePointer.matches) return

    setIsEnabled(true)

    const handlePointerMove = (event: PointerEvent) => {
      const target = event.target
      const shouldForceSystemCursor =
        target instanceof HTMLElement && !!target.closest('[data-system-cursor]')

      setForceSystemCursor(shouldForceSystemCursor)
      setPosition({ x: event.clientX, y: event.clientY })
      setIsVisible(!shouldForceSystemCursor)
    }

    const hideCursor = () => {
      setIsVisible(false)
      setForceSystemCursor(false)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', hideCursor)
    window.addEventListener('blur', hideCursor)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', hideCursor)
      window.removeEventListener('blur', hideCursor)
    }
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return undefined

    const body = document.body
    if (!body) return undefined

    if (isEnabled && isVisible && !forceSystemCursor) {
      body.classList.add('custom-cursor-hidden')
    } else {
      body.classList.remove('custom-cursor-hidden')
    }

    return () => {
      body.classList.remove('custom-cursor-hidden')
    }
  }, [isEnabled, isVisible, forceSystemCursor])

  if (!isEnabled || forceSystemCursor) return null

  return (
    <Cursor
      aria-hidden
      className={cn(
        'pointer-events-none fixed z-[2147483647] flex -translate-x-[1px] -translate-y-[1px] transition-opacity duration-150 ease-out',
        isVisible ? 'opacity-100' : 'opacity-0'
      )}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
    >
      <CursorPointer className="text-primary" />
    </Cursor>
  )
}

export default CustomCursor
