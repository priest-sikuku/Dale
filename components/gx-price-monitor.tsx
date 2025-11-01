"use client"

import { useEffect } from "react"
import { checkAndUpdateGXPrice } from "@/lib/gx-price-updater"

/**
 * Background component that monitors and updates GX price
 * Place this in the root layout to ensure it runs on all pages
 */
export function GXPriceMonitor() {
  useEffect(() => {
    // Check price immediately on mount
    checkAndUpdateGXPrice()

    // Check every 5 minutes
    const interval = setInterval(
      () => {
        checkAndUpdateGXPrice()
      },
      5 * 60 * 1000,
    ) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  // This component doesn't render anything
  return null
}
