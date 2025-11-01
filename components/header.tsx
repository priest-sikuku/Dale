"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Menu, X } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function Header() {
  const router = useRouter()
  const supabase = createClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [loading, setLoading] = useState(true)

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

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      setIsLoggedIn(false)
      router.push("/")
    } catch (error) {
      console.error("Sign out error:", error)
    }
  }

  return (
    <header className="border-b border-white/5">
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="w-12 h-12" aria-hidden="true">
              <defs>
                <linearGradient id="g1" x1="0" x2="1">
                  <stop offset="0%" stopColor="#00ff88" />
                  <stop offset="100%" stopColor="#00c853" />
                </linearGradient>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="6" stdDeviation="10" floodColor="#051428" floodOpacity="0.6" />
                </filter>
              </defs>
              <g filter="url(#shadow)">
                <path d="M18 62 L40 30 L50 40 L28 72 Z" fill="url(#g1)" />
                <path d="M82 62 L60 30 L50 40 L72 72 Z" fill="url(#g1)" />
                <circle cx="50" cy="55" r="9" fill="rgba(255,255,255,0.06)" />
              </g>
            </svg>
            <div>
              <div className="font-bold text-lg bg-gradient-to-r from-green-400 to-emerald-500 bg-clip-text text-transparent">
                Afrix <span className="text-emerald-400">AFX</span>
              </div>
              <div className="text-xs text-gray-400">The Coin That Never Sleeps</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {!loading && isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm hover:text-green-400 transition">
                  Dashboard
                </Link>
                <Link href="/p2p" className="text-sm hover:text-green-400 transition">
                  P2P Market
                </Link>
                <Link href="/referrals" className="text-sm hover:text-green-400 transition">
                  Referrals
                </Link>
                <Link href="/transactions" className="text-sm hover:text-green-400 transition">
                  Transactions
                </Link>
                <Link href="/ratings" className="text-sm hover:text-green-400 transition">
                  Ratings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className="px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-black font-semibold hover:shadow-lg hover:shadow-green-500/50 transition text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-white/5 pt-4 flex flex-col gap-3">
            {!loading && isLoggedIn ? (
              <>
                <Link href="/dashboard" className="text-sm hover:text-green-400 transition">
                  Dashboard
                </Link>
                <Link href="/p2p" className="text-sm hover:text-green-400 transition">
                  P2P Market
                </Link>
                <Link href="/referrals" className="text-sm hover:text-green-400 transition">
                  Referrals
                </Link>
                <Link href="/transactions" className="text-sm hover:text-green-400 transition">
                  Transactions
                </Link>
                <Link href="/ratings" className="text-sm hover:text-green-400 transition">
                  Ratings
                </Link>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition text-sm"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/sign-in"
                  className="px-4 py-2 rounded-lg border border-green-500/30 text-green-400 hover:bg-green-500/10 transition text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 text-black font-semibold hover:shadow-lg hover:shadow-green-500/50 transition text-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
