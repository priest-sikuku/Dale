"use client"

import { useMining } from "@/lib/hooks/use-mining"
import { CircularMiningCountdown } from "./circular-mining-countdown"
import { Pickaxe, Loader2 } from "lucide-react"
import { Button } from "./ui/button"
import { useState } from "react"

export function MiningWidget() {
  const { canMine, timeRemaining, isClaiming, isLoading, handleClaim } = useMining()
  const [showSuccess, setShowSuccess] = useState(false)

  const onClaim = async () => {
    const result = await handleClaim()
    if (result?.success) {
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    }
  }

  if (isLoading) {
    return (
      <div className="glass-card p-8 rounded-2xl border border-white/5">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-8 rounded-2xl border border-white/5">
      <div className="flex flex-col items-center space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Pickaxe className="w-6 h-6 text-green-500" />
            <h3 className="text-2xl font-bold text-white">GX Mining</h3>
          </div>
          <p className="text-sm text-gray-400">Claim 0.73 GX every 3 hours</p>
        </div>

        {/* Circular Countdown */}
        <div className="py-4">
          <CircularMiningCountdown timeRemaining={timeRemaining} />
        </div>

        {/* Claim Button */}
        <div className="w-full">
          {showSuccess ? (
            <div className="text-center py-4">
              <div className="text-green-500 font-semibold text-lg mb-1">✓ Successfully claimed 0.73 GX!</div>
              <div className="text-sm text-gray-400">Come back in 3 hours</div>
            </div>
          ) : (
            <Button
              onClick={onClaim}
              disabled={!canMine || isClaiming}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : canMine ? (
                <>
                  <Pickaxe className="w-5 h-5 mr-2" />
                  Claim 0.73 GX
                </>
              ) : (
                <>
                  <Pickaxe className="w-5 h-5 mr-2" />
                  Mining in Progress
                </>
              )}
            </Button>
          )}
        </div>

        {/* Info */}
        <div className="w-full pt-4 border-t border-white/5">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-400 mb-1">Reward Amount</div>
              <div className="text-lg font-bold text-green-400">0.73 GX</div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Interval</div>
              <div className="text-lg font-bold text-blue-400">3 Hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
