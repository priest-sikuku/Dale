import { createClient } from "@/lib/supabase/client"

/**
 * Fetches the available balance for the current user
 * Available balance = total balance from coins table - coins locked in active sell ads
 * Updated to use coins table as primary source and fallback to RPC function
 */
export async function fetchAvailableBalance(
  setAvailableBalance: (balance: number | null) => void,
  setIsLoading: (loading: boolean) => void,
) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    setIsLoading(false)
    return
  }

  try {
    // Use unified balance function that works for both dashboard and P2P
    const { data, error } = await supabase.rpc("get_unified_available_balance", { p_user_id: user.id })

    if (error) {
      console.error("[v0] Error fetching unified available balance:", error)
      // Fallback to direct coins query
      const { data: coinsData } = await supabase
        .from("coins")
        .select("amount")
        .eq("user_id", user.id)
        .eq("status", "active")

      if (coinsData) {
        const totalBalance = coinsData.reduce((sum, coin) => sum + (coin.amount || 0), 0)
        setAvailableBalance(totalBalance || 0)
      } else {
        setAvailableBalance(0)
      }
    } else if (data !== null) {
      setAvailableBalance(data)
    } else {
      setAvailableBalance(0)
    }
  } catch (err) {
    console.error("[v0] Exception in fetchAvailableBalance:", err)
    setAvailableBalance(0)
  }

  setIsLoading(false)
}

/**
 * New function to fetch user's referral code and stats
 */
export async function fetchUserReferralInfo(userId: string) {
  const supabase = createClient()

  try {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("referral_code, total_referrals, total_commission, referred_by")
      .eq("id", userId)
      .single()

    if (error) {
      console.error("[v0] Error fetching referral info:", error)
      return null
    }

    return profile
  } catch (err) {
    console.error("[v0] Exception in fetchUserReferralInfo:", err)
    return null
  }
}

/**
 * New function to validate referral code and get referrer info
 */
export async function validateReferralCode(referralCode: string) {
  const supabase = createClient()

  try {
    const { data: referrer, error } = await supabase
      .from("profiles")
      .select("id, username, referral_code")
      .eq("referral_code", referralCode)
      .single()

    if (error || !referrer) {
      return { valid: false, referrerId: null }
    }

    return { valid: true, referrerId: referrer.id }
  } catch (err) {
    console.error("[v0] Exception in validateReferralCode:", err)
    return { valid: false, referrerId: null }
  }
}
