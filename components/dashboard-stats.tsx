"use client"

import { Users, Wallet } from "lucide-react"
import { AFXPriceDisplay } from "./afx-price-display"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export function DashboardStats() {
  const [balance, setBalance] = useState(0)
  const [availableBalance, setAvailableBalance] = useState(0)
  const [totalReferrals, setTotalReferrals] = useState(0)

  useEffect(() => {
    const fetchStats = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: coins } = await supabase.from("coins").select("amount").eq("user_id", user.id)

        if (coins) {
          const total = coins.reduce((sum, coin) => sum + Number(coin.amount), 0)
          setBalance(total)
        }

        const { data: availBal } = await supabase.rpc("get_available_balance", { p_user_id: user.id })
        if (availBal !== null) {
          setAvailableBalance(Number(availBal) || 0)
        }

        // Fetch referrals count
        const { data: referrals } = await supabase
          .from("referrals")
          .select("id", { count: "exact" })
          .eq("referrer_id", user.id)

        if (referrals) {
          setTotalReferrals(referrals.length)
        }
      }
    }

    fetchStats()
    // Refresh every 5 seconds
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AFXPriceDisplay />

      {/* Balance Card */}
      <div className="glass-card p-6 rounded-2xl border border-white/5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Total Balance</p>
            <p className="text-3xl font-bold text-white">{balance.toFixed(2)}</p>
            <p className="text-xs text-gray-500 mt-1">
              Available: <span className="text-green-400 font-semibold">{availableBalance.toFixed(2)} AFX</span>
            </p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg">
            <Wallet className="w-6 h-6 text-green-400" />
          </div>
        </div>
        <div className="text-xs text-green-400">AFX Coins</div>
      </div>

      {/* Total Referrals Card */}
      <div className="glass-card p-6 rounded-2xl border border-white/5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-gray-400 text-sm mb-1">Total Referrals</p>
            <p className="text-3xl font-bold text-white">{totalReferrals}</p>
            <p className="text-xs text-gray-500 mt-1">Active Downlines</p>
          </div>
          <div className="p-3 bg-blue-500/10 rounded-lg">
            <Users className="w-6 h-6 text-blue-400" />
          </div>
        </div>
        <div className="text-xs text-blue-400">Earn from referrals</div>
      </div>
    </div>
  )
}
