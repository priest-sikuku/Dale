"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { Copy, Share2, TrendingUp } from "lucide-react"
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
          console.log("[v0] Fetched referrals:", referralsData?.length ?? 0)
          setReferrals(referralsData || [])
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
    const message = `Join AfriX and earn passive income! Use my referral code: ${profile?.referral_code} or click: ${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  const shareOnTwitter = () => {
    const text = `Join AfriX - The Coin That Never Sleeps! Use my referral code: ${profile?.referral_code} and earn 2% trading commission + 1% mining commission! ${referralLink}`
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header isLoggedIn={true} setIsLoggedIn={() => {}} />
      <main className="flex-1 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Referral Program</h1>
            <p className="text-gray-400">Earn commissions from your referrals</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="glass-card p-6 rounded-xl border border-white/5">
              <p className="text-gray-400 text-sm mb-2">Total Referrals</p>
              <p className="text-3xl font-bold text-green-400">{referrals.length}</p>
            </div>
            <div className="glass-card p-6 rounded-xl border border-white/5">
              <p className="text-gray-400 text-sm mb-2">Trading Commission</p>
              <p className="text-3xl font-bold text-green-400">{totalTradingCommission.toFixed(2)} AFX</p>
            </div>
            <div className="glass-card p-6 rounded-xl border border-white/5">
              <p className="text-gray-400 text-sm mb-2">Mining Commission</p>
              <p className="text-3xl font-bold text-green-400">{totalClaimCommission.toFixed(2)} AFX</p>
            </div>
            <div className="glass-card p-6 rounded-xl border border-white/5">
              <p className="text-gray-400 text-sm mb-2">Total Commission</p>
              <p className="text-3xl font-bold text-yellow-400">{totalCommission.toFixed(2)} AFX</p>
            </div>
          </div>

          {/* Referral Link Section */}
          <div className="glass-card p-8 rounded-xl border border-white/5 mb-8">
            <h2 className="text-2xl font-bold mb-4">Your Referral Link</h2>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4 flex items-center justify-between">
              <code className="text-green-400 text-sm break-all">{referralLink}</code>
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
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition"
              >
                <Copy size={18} />
                {copied ? "Copied!" : "Copy Link"}
              </button>
              <button
                onClick={shareOnWhatsApp}
                className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition"
              >
                <Share2 size={18} />
                Share on WhatsApp
              </button>
              <button
                onClick={shareOnTwitter}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-400 hover:bg-blue-500/30 transition"
              >
                <Share2 size={18} />
                Share on Twitter
              </button>
            </div>

            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
              <p className="text-blue-300 text-sm">
                <strong>Your Referral Code:</strong> {profile?.referral_code}
              </p>
              <p className="text-blue-300 text-sm mt-2">
                Earn <strong>2%</strong> commission on all trading volume from your referrals and <strong>1%</strong> on
                all mined AFX coins.
              </p>
            </div>
          </div>

          {/* Referrals List */}
          <div className="glass-card p-8 rounded-xl border border-white/5">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <TrendingUp size={24} className="text-green-400" />
              Your Referrals ({referrals.length})
            </h2>

            {referrals.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-4">No referrals yet. Share your link to get started!</p>
                <button
                  onClick={copyToClipboard}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                >
                  Copy Referral Link
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Username</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-semibold">Email</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Trading Commission</th>
                      <th className="text-right py-3 px-4 text-gray-400 font-semibold">Mining Commission</th>
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
                          <td className="py-3 px-4 text-white">{referredUser?.username || "Unknown"}</td>
                          <td className="py-3 px-4 text-gray-400 text-sm">{referredUser?.email || "-"}</td>
                          <td className="py-3 px-4 text-right text-green-400">
                            {(referral.total_trading_commission || 0).toFixed(2)} AFX
                          </td>
                          <td className="py-3 px-4 text-right text-green-400">
                            {(referral.total_claim_commission || 0).toFixed(2)} AFX
                          </td>
                          <td className="py-3 px-4 text-right text-yellow-400 font-semibold">{total.toFixed(2)} AFX</td>
                          <td className="py-3 px-4 text-gray-400 text-sm">
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
              className="inline-block px-6 py-2 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition"
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
