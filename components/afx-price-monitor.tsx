"use client"

import { useEffect } from "react"
import { checkAndUpdateAFXPrice } from "@/lib/afx-price-updater"

/**
 * Renamed from GXPriceMonitor to AFXPriceMonitor
 * Background component that monitors and updates AFX price
 */
export function AFXPriceMonitor() {
  useEffect(() => {
    // Check price immediately on mount
    checkAndUpdateAFXPrice()

    // Check every 5 minutes
    const interval = setInterval(
      () => {
        checkAndUpdateAFXPrice()
      },
      5 * 60 * 1000,
    ) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  // This component doesn't render anything
  return null
}
