"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { DashboardStats } from "@/components/dashboard-stats"
import { TransactionHistory } from "@/components/transaction-history"
import { UserStatsCard } from "@/components/user-stats-card"
import { PriceHistoryChart } from "@/components/price-history-chart"
import { MiningWidget } from "@/components/mining-widget"
import { ArrowLeftRight } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(true)

  useEffect(() => {
    const fetchReferralsCount = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data, error } = await supabase
          .from("referrals")
          .select("id", { count: "exact" })
          .eq("referrer_id", user.id)

        if (!error && data) {
          const countElement = document.getElementById("total-referrals-count")
          if (countElement) {
            countElement.textContent = data.length.toString()
          }
        }
      }
    }

    fetchReferralsCount()
  }, [])

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400">Please sign in to access your dashboard</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn} />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-12">
          {/* Welcome Section */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Welcome back!</h1>
              <p className="text-gray-400">Your dashboard is ready. Trade AFX on the P2P marketplace.</p>
            </div>
            <Link
              href="/p2p"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-black font-semibold hover:shadow-lg hover:shadow-green-500/50 transition"
            >
              <ArrowLeftRight size={20} />
              P2P Trading
            </Link>
          </div>

          {/* Stats Grid */}
          <DashboardStats />

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            {/* Left Column - Wallet & Stats */}
            <div className="lg:col-span-2 space-y-8">
              <MiningWidget />
              <UserStatsCard />
              <PriceHistoryChart />
            </div>

            {/* Right Column - History */}
            <div>
              <TransactionHistory />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
