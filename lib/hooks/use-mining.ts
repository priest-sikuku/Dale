"use client"

import { useState, useEffect, useCallback } from "react"
import { claimMining, getMiningStatus } from "@/lib/actions/mining"

export function useMining() {
  const [canMine, setCanMine] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(0)
  const [nextMine, setNextMine] = useState<string | null>(null)
  const [isClaiming, setIsClaiming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMiningStatus = useCallback(async () => {
    const result = await getMiningStatus()
    if (result.success) {
      setCanMine(result.canMine || false)
      setNextMine(result.nextMine || null)
      setTimeRemaining(result.timeRemaining || 0)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchMiningStatus()
    // Refresh status every 10 seconds
    const interval = setInterval(fetchMiningStatus, 10000)
    return () => clearInterval(interval)
  }, [fetchMiningStatus])

  // Update time remaining every second
  useEffect(() => {
    if (!canMine && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1000
          if (newTime <= 0) {
            setCanMine(true)
            return 0
          }
          return newTime
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [canMine, timeRemaining])

  const handleClaim = async () => {
    if (!canMine || isClaiming) return

    setIsClaiming(true)
    const result = await claimMining()

    if (result.success) {
      setCanMine(false)
      setNextMine(result.nextMine || null)
      // Calculate time remaining (3 hours)
      setTimeRemaining(3 * 60 * 60 * 1000)
      // Refresh status after a short delay
      setTimeout(fetchMiningStatus, 1000)
    } else {
      console.error("[v0] Mining claim failed:", result.error)
    }

    setIsClaiming(false)
    return result
  }

  return {
    canMine,
    timeRemaining,
    nextMine,
    isClaiming,
    isLoading,
    handleClaim,
    refreshStatus: fetchMiningStatus,
  }
}
