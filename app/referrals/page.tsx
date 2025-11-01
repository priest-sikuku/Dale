"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Copy, Share2, TrendingUp, Users, Zap, DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Referral {
  id: string
  referred_id: string
  referral_code: string
  total_trading_commission: number
  total_claim_commission: number
  created_at: string
}

interface ReferredUser {
  id: string
  username: string
  email: string
}

export default function ReferralsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const [downlineTransactions, setDownlineTransactions] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (!authUser) {
          router.push("/auth/sign-in")
          return
        }

        setUser(authUser)

        // Fetch user profile
        const { data: profileData } = await supabase.from("profiles").select("*").eq("id", authUser.id).single()

        setProfile(profileData)

        const { data: referralsData, error: referralsError } = await supabase
          .from("referrals")
          .select("*")
          .eq("referrer_id", authUser.id)
          .order("created_at", { ascending: false })

        if (referralsError) {
          console.error("[v0] Error fetching referrals:", referralsError)
        } else {
          setReferrals(referralsData || [])
        }

        const { data: transactionsData, error: transactionsError } = await supabase.rpc(
          "get_upline_downline_transactions",
          { upline_user_id: authUser.id },
        )

        if (transactionsError) {
          console.error("[v0] Error fetching downline transactions:", transactionsError)
        } else {
          setDownlineTransactions(transactionsData || [])
        }

        // Fetch referred users details
        if (referralsData && referralsData.length > 0) {
          const referredIds = referralsData.map((r) => r.referred_id)
          const { data: usersData, error: usersError } = await supabase
            .from("profiles")
            .select("id, username, email")
            .in("id", referredIds)

          if (usersError) {
            console.error("[v0] Error fetching referred users:", usersError)
          } else {
            setReferredUsers(usersData || [])
          }
        }
      } catch (error) {
        console.error("[v0] Error fetching referral data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase, router])

  const referralLink = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/sign-up?ref=${profile?.referral_code}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareOnWhatsApp = () => {
    const message = `Join Afrix AFX and earn passive income! Use my referral code: ${profile?.referral_code} or click: ${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  const shareOnTwitter = () => {
    const text = `Join Afrix AFX - The Coin That Never Sleeps! Use my referral code: ${profile?.referral_code} and earn 2% trading commission + 1.5% transaction commission! ${referralLink}`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank")
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header isLoggedIn={true} setIsLoggedIn={() => {}} />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading referral data...</p>
        </main>
        <Footer />
      </div>
    )
  }

  const totalTradingCommission = referrals.reduce((sum, r) => sum + (r.total_trading_commission || 0), 0)
  const totalClaimCommission = referrals.reduce((sum, r) => sum + (r.total_claim_commission || 0), 0)
  const totalCommission = totalTradingCommission + totalClaimCommission

  const totalTransactionCommission = downlineTransactions.reduce(
    (sum: number, t: any) => sum + (t.commission_earned || 0),
    0,
  )

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header isLoggedIn={true} setIsLoggedIn={() => {}} />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                <Users size={24} className="text-green-400" />
              </div>
              <h1 className="text-4xl font-bold text-white">Referral Program</h1>
            </div>
            <p className="text-gray-400 ml-14">Earn commissions from your referrals and their trading activity</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-xl border border-blue-500/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Total Referrals</p>
                  <p className="text-3xl font-bold text-blue-400">{referrals.length}</p>
                </div>
                <Users size={32} className="text-blue-500/50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-xl border border-green-500/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Trading Commission</p>
                  <p className="text-3xl font-bold text-green-400">{totalTradingCommission.toFixed(2)}</p>
                </div>
                <TrendingUp size={32} className="text-green-500/50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-6 rounded-xl border border-yellow-500/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Transaction Commission</p>
                  <p className="text-3xl font-bold text-yellow-400">{totalTransactionCommission.toFixed(2)}</p>
                </div>
                <Zap size={32} className="text-yellow-500/50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-xl border border-purple-500/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Claim Commission</p>
                  <p className="text-3xl font-bold text-purple-400">{totalClaimCommission.toFixed(2)}</p>
                </div>
                <DollarSign size={32} className="text-purple-500/50" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 p-6 rounded-xl border border-orange-500/30 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm mb-2">Total Earned</p>
                  <p className="text-3xl font-bold text-orange-400">
                    {(totalCommission + totalTransactionCommission).toFixed(2)}
                  </p>
                </div>
                <TrendingUp size={32} className="text-orange-500/50" />
              </div>
            </div>
          </div>

          {/* Referral Link Section */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl mb-8">
            <h2 className="text-2xl font-bold mb-6 text-white">Your Referral Link</h2>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-6 flex items-center justify-between">
              <code className="text-green-400 text-sm break-all font-mono">{referralLink}</code>
              <button
                onClick={copyToClipboard}
                className="ml-4 p-2 hover:bg-white/10 rounded-lg transition"
                title="Copy to clipboard"
              >
                <Copy size={20} className={copied ? "text-green-400" : "text-gray-400"} />
              </button>
            </div>

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={copyToClipboard}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition font-semibold"
              >
                <Copy size={18} />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition font-semibold"
              >
                <Share2 size={18} />
                WhatsApp
              </button>
              <button
                onClick={shareOnTwitter}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 hover:bg-blue-500/30 transition font-semibold"
              >
                <Share2 size={18} />
                Twitter
              </button>
            </div>

            <div className="mt-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <p className="text-green-300 text-sm font-mono">
                <strong>Your Code:</strong> {profile?.referral_code}
              </p>
              <p className="text-green-300 text-sm mt-3">
                Earn <strong>2%</strong> trading commission + <strong>1.5%</strong> transaction commission from your
                referrals
              </p>
            </div>
          </div>

          {/* Downline Transactions */}
          {downlineTransactions.length > 0 && (
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl mb-8">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
                <Zap size={24} className="text-yellow-400" />
                Downline Transactions
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Downline</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Trade Value</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">1.5% Commission</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Date</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {downlineTransactions.map((tx: any, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-4 text-white">{tx.downline_username}</td>
                        <td className="py-3 px-4 text-right text-gray-300">{tx.trade_value?.toFixed(2)} KES</td>
                        <td className="py-3 px-4 text-right text-yellow-400 font-semibold">
                          {tx.commission_earned?.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-sm">
                          {new Date(tx.trade_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-500/20 text-green-400">
                            {tx.trade_status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Referrals List */}
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-white">
              <Users size={24} className="text-green-400" />
              Your Referrals ({referrals.length})
            </h2>

            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No referrals yet. Share your link to get started!</p>
                <button
                  onClick={copyToClipboard}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition font-semibold"
                >
                  Copy Referral Link
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Username</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Email</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Trading Commission</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Claim Commission</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Total</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Joined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referrals.map((referral) => {
                      const referredUser = referredUsers.find((u) => u.id === referral.referred_id)
                      const total = (referral.total_trading_commission || 0) + (referral.total_claim_commission || 0)
                      return (
                        <tr key={referral.id} className="border-b border-white/5 hover:bg-white/5 transition">
                          <td className="py-3 px-4 text-white font-semibold">{referredUser?.username || "Unknown"}</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">{referredUser?.email || "-"}</td>
                          <td className="py-3 px-4 text-right text-green-400">
                            {(referral.total_trading_commission || 0).toFixed(2)} AFX
                          </td>
                          <td className="py-3 px-4 text-right text-green-400">
                            {(referral.total_claim_commission || 0).toFixed(2)} AFX
                          </td>
                          <td className="py-3 px-4 text-right text-yellow-400 font-semibold">{total.toFixed(2)} AFX</td>
                          <td className="py-3 px-4 text-gray-400 text-xs">
                            {new Date(referral.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Back to Dashboard */}
          <div className="mt-8">
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition font-semibold"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
