"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * Custom hook to manage and sync balance across dashboard and P2P
 * Fetches available balance from coins table and refreshes at intervals
 */
export function useBalance() {
  const [balance, setBalance] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchBalance = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data, error } = await supabase.rpc("get_available_balance", { user_id: user.id })

      if (error) {
        console.error("[v0] Error fetching balance:", error)
        const { data: coinsData } = await supabase
          .from("coins")
          .select("amount")
          .eq("user_id", user.id)
          .eq("status", "active")

        if (coinsData) {
          const totalBalance = coinsData.reduce((sum, coin) => sum + (coin.amount || 0), 0)
          setBalance(totalBalance || 0)
        }
      } else if (data !== null) {
        setBalance(data)
      } else {
        setBalance(0)
      }
    } catch (error) {
      console.error("[v0] Exception in fetchBalance:", error)
      setBalance(0)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchBalance()
    // Sync balance every 5 seconds to ensure P2P and Dashboard are in sync
    const interval = setInterval(fetchBalance, 5000)
    return () => clearInterval(interval)
  }, [fetchBalance])

  return { balance, loading, refreshBalance: fetchBalance }
}
