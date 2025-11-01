"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@supabase/ssr"
import { TrendingUp, Calendar } from "lucide-react"

interface PriceHistory {
  date: string
  avg_price: number
  min_price: number
  max_price: number
}

export function PriceHistoryChart() {
  const [history, setHistory] = useState<PriceHistory[]>([])
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  useEffect(() => {
    fetchPriceHistory()
  }, [])

  const fetchPriceHistory = async () => {
    try {
      const { data, error } = await supabase.from("price_history_5days").select("*").order("date", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching price history:", error)
        return
      }

      setHistory(data || [])
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card p-8 rounded-2xl border border-white/5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/5 rounded w-1/2"></div>
          <div className="h-40 bg-white/5 rounded"></div>
        </div>
      </div>
    )
  }

  const maxPrice = Math.max(...history.map((h) => h.max_price))
  const minPrice = Math.min(...history.map((h) => h.min_price))
  const priceRange = maxPrice - minPrice

  return (
    <div className="glass-card p-8 rounded-2xl border border-white/5">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <TrendingUp className="w-6 h-6 text-blue-400" />
        </div>
        <h2 className="text-2xl font-bold">GX Price History (5 Days)</h2>
      </div>

      {history.length === 0 ? (
        <div className="text-center py-8 text-gray-400">No price history available yet</div>
      ) : (
        <div className="space-y-4">
          {/* Chart */}
          <div className="relative h-40 flex items-end gap-2">
            {history.map((item, index) => {
              const heightPercent = ((item.avg_price - minPrice) / priceRange) * 100
              const isIncrease = index > 0 && item.avg_price > history[index - 1].avg_price

              return (
                <div key={item.date} className="flex-1 flex flex-col items-center gap-2">
                  <div className="relative w-full">
                    <div
                      className={`w-full rounded-t-lg transition-all ${isIncrease ? "bg-green-500" : "bg-red-500"}`}
                      style={{ height: `${Math.max(heightPercent, 10)}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-400 text-center">
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Price Details */}
          <div className="grid grid-cols-1 gap-3 pt-4 border-t border-white/10">
            {history.map((item, index) => {
              const isIncrease = index > 0 && item.avg_price > history[index - 1].avg_price
              const change =
                index > 0 ? ((item.avg_price - history[index - 1].avg_price) / history[index - 1].avg_price) * 100 : 0

              return (
                <div key={item.date} className="flex items-center justify-between p-3 rounded-lg bg-white/5">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-300">
                      {new Date(item.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{item.avg_price.toFixed(2)} KES</div>
                    {index > 0 && (
                      <div className={`text-xs ${isIncrease ? "text-green-400" : "text-red-400"}`}>
                        {isIncrease ? "+" : ""}
                        {change.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
