"use client"

import { useEffect, useState } from "react"

interface CircularMiningCountdownProps {
  timeRemaining: number
  totalTime?: number
  size?: number
  strokeWidth?: number
}

export function CircularMiningCountdown({
  timeRemaining,
  totalTime = 3 * 60 * 60 * 1000,
  size = 220,
  strokeWidth = 14,
}: CircularMiningCountdownProps) {
  const [percentage, setPercentage] = useState(0)

  useEffect(() => {
    const percent = Math.max(0, Math.min(100, (timeRemaining / totalTime) * 100))
    setPercentage(percent)
  }, [timeRemaining, totalTime])

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
  }

  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference
  const opacity = 0.3 + (percentage / 100) * 0.7

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90 drop-shadow-lg">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-800"
        />
        <defs>
          <linearGradient id="miningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00ff88" />
            <stop offset="100%" stopColor="#00c853" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#miningGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-linear drop-shadow-md"
          style={{ opacity }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
          {Math.round(percentage)}%
        </div>
        <div className="text-sm text-gray-500 mt-2 font-medium">{formatTime(timeRemaining)}</div>
      </div>
    </div>
  )
}
