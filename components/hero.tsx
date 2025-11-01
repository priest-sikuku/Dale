"use client"

import Link from "next/link"
import { BalancePanel } from "./balance-panel"
import { FeatureGrid } from "./feature-grid"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function Hero() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        setIsLoggedIn(!!user)
      } catch (error) {
        console.error("Auth check error:", error)
        setIsLoggedIn(false)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()

    // Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user)
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Main Card */}
          <div className="glass-card p-8 rounded-2xl border border-white/5">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">AfriX — The Coin That Never Sleeps</h1>
            <p className="text-gray-400 text-lg leading-relaxed mb-6">
              Earn <strong className="text-white">daily</strong> growth on your holdings. Trade peer‑to‑peer across
              Africa and beyond. Built for continuous growth and community.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link
                href={isLoggedIn ? "/dashboard" : "/auth/sign-up"}
                className="px-6 py-3 rounded-lg btn-primary-afx font-semibold hover:shadow-lg hover:shadow-green-500/50 transition text-center"
              >
                {isLoggedIn ? "Go to Dashboard" : "Get Started"}
              </Link>
              <Link
                href={isLoggedIn ? "/market" : "/auth/sign-up"}
                className="px-6 py-3 rounded-lg btn-ghost-afx font-semibold border hover:bg-green-500/10 transition text-center"
              >
                P2P Market
              </Link>
            </div>
          </div>

          {/* Features Grid */}
          <FeatureGrid />

          {/* How It Works */}
          <div className="glass-card p-8 rounded-2xl border border-white/5">
            <h3 className="text-2xl font-bold mb-6">How it works</h3>
            <ol className="space-y-4 text-gray-400">
              <li className="flex gap-4">
                <span className="text-green-400 font-bold flex-shrink-0">1.</span>
                <span>Sign up with email, username, and password.</span>
              </li>
              <li className="flex gap-4">
                <span className="text-green-400 font-bold flex-shrink-0">2.</span>
                <span>Acquire AFX through P2P trading or referrals.</span>
              </li>
              <li className="flex gap-4">
                <span className="text-green-400 font-bold flex-shrink-0">3.</span>
                <span>Hold to compound daily or trade on P2P.</span>
              </li>
            </ol>
          </div>
        </div>

        {/* Right Panel */}
        {!loading && isLoggedIn && <BalancePanel />}
      </div>
    </div>
  )
}
