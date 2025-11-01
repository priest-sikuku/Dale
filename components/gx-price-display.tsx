"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface PriceData {
  price: number
  previousPrice: number
  changePercent: number
  volatility?: number
}

export function GXPriceDisplay() {
  const [priceData, setPriceData] = useState<PriceData>({
    price: 16.0,
    previousPrice: 16.0,
    changePercent: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchPrice = async () => {
    try {
      const response = await fetch("/api/gx-price", {
        cache: "no-store",
      })
      const data = await response.json()
      setPriceData(data)
      setIsLoading(false)
    } catch (error) {
      console.error("[v0] Error fetching GX price:", error)
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchPrice()

    // Refresh every 2 seconds
    const interval = setInterval(fetchPrice, 2000)

    return () => clearInterval(interval)
  }, [])

  const isIncreasing = priceData.changePercent > 0
  const isDecreasing = priceData.changePercent < 0
  const priceColor = isIncreasing ? "text-green-400" : isDecreasing ? "text-red-400" : "text-white"
  const bgColor = isIncreasing ? "bg-green-500/10" : isDecreasing ? "bg-red-500/10" : "bg-blue-500/10"
  const borderColor = isIncreasing ? "border-green-500/20" : isDecreasing ? "border-red-500/20" : "border-blue-500/20"

  return (
    <div className={`glass-card p-6 rounded-2xl border ${borderColor} transition-all duration-300`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-gray-400 text-sm mb-1">Current GX Price</p>
          <div className="flex items-baseline gap-2">
            <p className={`text-3xl font-bold ${priceColor} transition-colors duration-300`}>
              {isLoading ? "..." : `KES ${priceData.price.toFixed(2)}`}
            </p>
            {!isLoading && (
              <div className={`flex items-center gap-1 text-sm ${priceColor}`}>
                {isIncreasing ? <TrendingUp size={16} /> : isDecreasing ? <TrendingDown size={16} /> : null}
                <span>
                  {priceData.changePercent > 0 ? "+" : ""}
                  {priceData.changePercent.toFixed(2)}%
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-1">Live Price • Updates every 2s</p>
        </div>
        <div className={`p-3 ${bgColor} rounded-lg transition-colors duration-300`}>
          {isIncreasing ? (
            <TrendingUp className="w-6 h-6 text-green-400" />
          ) : isDecreasing ? (
            <TrendingDown className="w-6 h-6 text-red-400" />
          ) : (
            <TrendingUp className="w-6 h-6 text-blue-400" />
          )}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-400">Base: KES 16.00</span>
        <span className="text-gray-400">+3% daily @ 3pm</span>
      </div>
    </div>
  )
}
