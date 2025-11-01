"use client"

import { useMining } from "@/lib/hooks/use-mining"
import { CircularMiningCountdown } from "./circular-mining-countdown"
import { Pickaxe, Loader2, Zap } from "lucide-react"
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
      <div className="glass-card p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/50 to-slate-800/30">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-green-500" />
        </div>
      </div>
    )
  }

  return (
    <div className="glass-card p-8 rounded-2xl border border-white/5 bg-gradient-to-br from-slate-900/50 to-slate-800/30">
      <div className="flex flex-col items-center space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="relative">
              <Zap className="w-6 h-6 text-green-500 absolute animate-pulse" />
              <Pickaxe className="w-6 h-6 text-green-400" />
            </div>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
              AFX Mining
            </h3>
          </div>
          <p className="text-sm text-gray-400">Claim 0.73 AFX every 3 hours</p>
        </div>

        {/* Circular Countdown */}
        <div className="py-4">
          <CircularMiningCountdown timeRemaining={timeRemaining} />
        </div>

        {/* Claim Button */}
        <div className="w-full">
          {showSuccess ? (
            <div className="text-center py-4 bg-green-500/10 rounded-lg border border-green-500/30">
              <div className="text-green-400 font-semibold text-lg mb-1">✓ Successfully claimed 0.73 AFX!</div>
              <div className="text-sm text-gray-400">Come back in 3 hours</div>
            </div>
          ) : (
            <Button
              onClick={onClaim}
              disabled={!canMine || isClaiming}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 hover:from-green-600 hover:via-emerald-600 hover:to-green-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-green-500/50"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Claiming...
                </>
              ) : canMine ? (
                <>
                  <Pickaxe className="w-5 h-5 mr-2" />
                  Claim 0.73 AFX
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

        <div className="w-full pt-6 border-t border-white/10">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Reward Amount</div>
              <div className="text-lg font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                0.73 AFX
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-xs text-gray-400 mb-1">Interval</div>
              <div className="text-lg font-bold text-blue-400">3 Hours</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
