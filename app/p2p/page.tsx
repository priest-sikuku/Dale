"use client"

import { Plus, History, FileText, Wallet, CheckCircle2, Shield, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { fetchAvailableBalance } from "@/lib/supabase/utils" // Declare fetchAvailableBalance

interface Ad {
  id: string
  user_id: string
  ad_type: string
  gx_amount: number
  min_amount: number
  max_amount: number
  account_number: string | null
  mpesa_number: string | null
  paybill_number: string | null
  airtel_money: string | null
  terms_of_trade: string | null
  created_at: string
  profiles: {
    username: string | null
    email: string | null
    rating: number | null
  }
  remaining_amount?: number
  price_per_gx?: number
}

interface UserStats {
  total_trades: number
  completed_trades: number
  completion_rate: number
  average_rating: number
  total_ratings: number
}

export default function P2PMarket() {
  const router = useRouter()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<"buy" | "sell">("buy")
  const [ads, setAds] = useState<Ad[]>([])
  const [loading, setLoading] = useState(true)
  const [availableBalance, setAvailableBalance] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [initiatingTrade, setInitiatingTrade] = useState<string | null>(null)
  const [tradeAmounts, setTradeAmounts] = useState<{ [key: string]: string }>({})

  const [userStats, setUserStats] = useState<{ [key: string]: UserStats }>({})

  useEffect(() => {
    fetchAvailableBalance(setAvailableBalance, setIsLoading)
    getCurrentUser()
    const interval = setInterval(() => fetchAvailableBalance(setAvailableBalance, setIsLoading), 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    fetchAds()
  }, [activeTab])

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  async function fetchAds() {
    setLoading(true)
    try {
      const adType = activeTab === "buy" ? "sell" : "buy"
      const { data, error } = await supabase
        .from("p2p_ads")
        .select(`
          *,
          profiles:user_id (
            username,
            email,
            rating
          )
        `)
        .eq("ad_type", adType)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error fetching ads:", error)
        return
      }

      setAds(data || [])

      if (data && data.length > 0) {
        const uniqueUserIds = [...new Set(data.map((ad) => ad.user_id))]
        await fetchUserStats(uniqueUserIds)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchUserStats(userIds: string[]) {
    const statsPromises = userIds.map(async (userId) => {
      const { data, error } = await supabase.rpc("get_user_p2p_stats", { p_user_id: userId }).single()

      if (error) {
        console.error(`[v0] Error fetching stats for user ${userId}:`, error)
        return { userId, stats: null }
      }

      return { userId, stats: data }
    })

    const results = await Promise.all(statsPromises)
    const statsMap: { [key: string]: UserStats } = {}

    results.forEach(({ userId, stats }) => {
      if (stats) {
        statsMap[userId] = stats
      }
    })

    setUserStats(statsMap)
  }

  async function initiateTrade(ad: Ad) {
    try {
      setInitiatingTrade(ad.id)

      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        alert("Please sign in to trade")
        return
      }

      if (user.id === ad.user_id) {
        alert("You cannot trade with yourself")
        setInitiatingTrade(null)
        return
      }

      const customAmount = Number.parseFloat(tradeAmounts[ad.id] || "0")
      const tradeAmount = customAmount > 0 ? customAmount : ad.min_amount
      const availableAmount = ad.remaining_amount || ad.gx_amount

      if (tradeAmount < 2) {
        alert("Minimum trade amount is 2 GX")
        setInitiatingTrade(null)
        return
      }

      if (tradeAmount > availableAmount) {
        alert(`Maximum available amount is ${availableAmount} GX`)
        setInitiatingTrade(null)
        return
      }

      const { data: tradeId, error } = await supabase.rpc("initiate_p2p_trade_v2", {
        p_ad_id: ad.id,
        p_buyer_id: user.id,
        p_gx_amount: tradeAmount,
      })

      if (error) {
        console.error("[v0] Error initiating trade:", error)
        alert(error.message || "Failed to initiate trade")
        return
      }

      router.push(`/p2p/trade/${tradeId}`)
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to initiate trade")
    } finally {
      setInitiatingTrade(null)
    }
  }

  function getPaymentMethods(ad: Ad) {
    const methods = []
    if (ad.mpesa_number) methods.push("M-Pesa")
    if (ad.paybill_number) methods.push("Paybill")
    if (ad.airtel_money) methods.push("Airtel Money")
    if (ad.account_number) methods.push("Bank Account")
    return methods.join(", ") || "Not specified"
  }

  function renderStarRating(rating: number) {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(<Star key={i} size={12} className="fill-yellow-500 text-yellow-500" />)
      } else if (i === fullStars && hasHalfStar) {
        stars.push(<Star key={i} size={12} className="fill-yellow-500/50 text-yellow-500" />)
      } else {
        stars.push(<Star key={i} size={12} className="text-gray-600" />)
      }
    }

    return stars
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">P2P Trading</h1>
            <p className="text-gray-400 text-sm">Buy and sell GX directly with verified traders</p>
          </div>

          <div className="bg-[#1a1d24] rounded-xl p-4 mb-6 border border-white/5">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              {/* Left side: Buy/Sell tabs */}
              <div className="flex gap-2">
                <Button
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "buy"
                      ? "bg-[#0ecb81] text-black hover:bg-[#0ecb81]/90"
                      : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => setActiveTab("buy")}
                >
                  Buy
                </Button>
                <Button
                  className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === "sell"
                      ? "bg-[#f6465d] text-white hover:bg-[#f6465d]/90"
                      : "bg-transparent text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                  onClick={() => setActiveTab("sell")}
                >
                  Sell
                </Button>
              </div>

              {/* Center: Available balance */}
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10">
                <Wallet size={18} className="text-[#0ecb81]" />
                <span className="text-sm text-gray-400">Available:</span>
                <span className="font-semibold text-white">
                  {isLoading ? "..." : availableBalance !== null ? `${availableBalance.toFixed(2)} GX` : "0.00 GX"}
                </span>
              </div>

              {/* Right side: Action buttons */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/post-ad")}
                >
                  <Plus size={16} />
                  Post Ad
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/my-ads")}
                >
                  <FileText size={16} />
                  My Ads
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 bg-white/5 border-white/10 hover:bg-white/10 text-sm"
                  onClick={() => router.push("/p2p/my-trades")}
                >
                  <History size={16} />
                  My Trades
                </Button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#0ecb81]" />
              <p className="text-gray-400 mt-4">Loading offers...</p>
            </div>
          ) : ads.length === 0 ? (
            <div className="text-center py-20 bg-[#1a1d24] rounded-xl border border-white/5">
              <p className="text-gray-400 mb-2">No {activeTab === "buy" ? "sell" : "buy"} offers available</p>
              <p className="text-sm text-gray-500">Be the first to post an ad!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {ads.map((ad, index) => {
                const isPromoted = index === 0
                const stats = userStats[ad.user_id] || {
                  total_trades: 0,
                  completed_trades: 0,
                  completion_rate: 0,
                  average_rating: 0,
                  total_ratings: 0,
                }

                return (
                  <div
                    key={ad.id}
                    className={`bg-[#1a1d24] rounded-xl p-5 border transition-all hover:border-white/20 ${
                      isPromoted ? "border-yellow-500/50 shadow-lg shadow-yellow-500/10" : "border-white/5"
                    }`}
                  >
                    {isPromoted && (
                      <div className="mb-3 flex items-center gap-2">
                        <div className="bg-yellow-500/20 text-yellow-500 text-xs font-semibold px-2 py-1 rounded">
                          ⭐ PROMOTED
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-shrink-0 lg:w-48">
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0ecb81] to-[#0ea76f] flex items-center justify-center text-white font-bold">
                            {(ad.profiles?.username || ad.profiles?.email || "A")[0].toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold text-white text-sm">
                                {ad.profiles?.username || ad.profiles?.email?.split("@")[0] || "Anonymous"}
                              </span>
                              <CheckCircle2 size={14} className="text-[#0ecb81]" />
                            </div>
                            {currentUserId === ad.user_id && (
                              <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Your Ad</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-gray-400">
                            <span>{stats.total_trades} trades</span>
                            <span className="text-gray-600">|</span>
                            <span className="text-[#0ecb81]">{stats.completion_rate.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex gap-0.5">{renderStarRating(stats.average_rating)}</div>
                            <span className="text-gray-400">
                              {stats.average_rating > 0 ? stats.average_rating.toFixed(1) : "No ratings"}
                            </span>
                            {stats.total_ratings > 0 && <span className="text-gray-600">({stats.total_ratings})</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex-1 border-l border-white/5 pl-6">
                        <div className="mb-4">
                          <div className="text-2xl font-bold text-white mb-1">
                            KSh {ad.price_per_gx || "16.29"} <span className="text-base text-gray-400">/ GX</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Available </span>
                              <span className="text-white font-medium">{ad.remaining_amount || ad.gx_amount} GX</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Limit </span>
                              <span className="text-white font-medium">
                                {ad.min_amount}-{ad.max_amount} GX
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mb-4">
                          <div className="text-xs text-gray-500 mb-2">Payment</div>
                          <div className="flex flex-wrap gap-2">
                            {ad.mpesa_number && (
                              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 rounded-full bg-green-500" />
                                <span className="text-xs text-gray-300">M-Pesa</span>
                              </div>
                            )}
                            {ad.paybill_number && (
                              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-xs text-gray-300">Paybill</span>
                              </div>
                            )}
                            {ad.airtel_money && (
                              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-xs text-gray-300">Airtel Money</span>
                              </div>
                            )}
                            {ad.account_number && (
                              <div className="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                                <div className="w-2 h-2 rounded-full bg-blue-500" />
                                <span className="text-xs text-gray-300">Bank</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Terms */}
                        {ad.terms_of_trade && <div className="text-xs text-gray-400 italic">"{ad.terms_of_trade}"</div>}
                      </div>

                      <div className="flex-shrink-0 lg:w-56 flex flex-col justify-between gap-3">
                        {currentUserId !== ad.user_id && (
                          <>
                            <div>
                              <Label htmlFor={`amount-${ad.id}`} className="text-xs text-gray-400 mb-2 block">
                                Enter amount (GX)
                              </Label>
                              <Input
                                id={`amount-${ad.id}`}
                                type="number"
                                min="2"
                                max={ad.remaining_amount || ad.gx_amount}
                                step="0.01"
                                placeholder={`${ad.min_amount}-${ad.remaining_amount || ad.gx_amount}`}
                                value={tradeAmounts[ad.id] || ""}
                                onChange={(e) => setTradeAmounts((prev) => ({ ...prev, [ad.id]: e.target.value }))}
                                className="bg-white/5 border-white/10 text-white h-10"
                              />
                            </div>
                            <Button
                              className={`w-full h-11 rounded-lg font-semibold transition-all ${
                                activeTab === "buy"
                                  ? "bg-[#0ecb81] text-black hover:bg-[#0ecb81]/90 hover:shadow-lg hover:shadow-[#0ecb81]/20"
                                  : "bg-[#f6465d] text-white hover:bg-[#f6465d]/90 hover:shadow-lg hover:shadow-[#f6465d]/20"
                              }`}
                              onClick={() => initiateTrade(ad)}
                              disabled={initiatingTrade === ad.id}
                            >
                              {initiatingTrade === ad.id ? "Processing..." : activeTab === "buy" ? "Buy GX" : "Sell GX"}
                            </Button>
                          </>
                        )}
                        {currentUserId === ad.user_id && (
                          <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                              <Shield size={24} className="text-blue-400 mx-auto mb-2" />
                              <p className="text-sm text-gray-400">Your Ad</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
