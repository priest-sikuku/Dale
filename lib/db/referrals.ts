import { createClient } from "@/lib/supabase/server"

export async function getReferralData(userId: string) {
  const supabase = await createClient()

  const { data: referrals, error } = await supabase.from("referrals").select("*").eq("referrer_id", userId)

  if (error) throw error
  return referrals
}

export async function addTradingCommission(referrerId: string, referredId: string, amount: number, tradeId: string) {
  const supabase = await createClient()

  // Calculate 2% commission
  const commission = amount * 0.02

  const { error } = await supabase.from("referral_commissions").insert({
    referrer_id: referrerId,
    referred_id: referredId,
    commission_type: "trading",
    amount: commission,
    source_id: tradeId,
    status: "completed",
  })

  if (error) throw error

  // Update referral total
  const { data: referral } = await supabase
    .from("referrals")
    .select("total_trading_commission")
    .eq("referrer_id", referrerId)
    .eq("referred_id", referredId)
    .single()

  if (referral) {
    await supabase
      .from("referrals")
      .update({
        total_trading_commission: (referral.total_trading_commission || 0) + commission,
      })
      .eq("referrer_id", referrerId)
      .eq("referred_id", referredId)
  }

  // Update user's total commission
  const { data: profile } = await supabase.from("profiles").select("total_commission").eq("id", referrerId).single()

  if (profile) {
    await supabase
      .from("profiles")
      .update({
        total_commission: (profile.total_commission || 0) + commission,
      })
      .eq("id", referrerId)
  }

  return commission
}

export async function addClaimCommission(referrerId: string, referredId: string, claimAmount: number, coinId: string) {
  const supabase = await createClient()

  // Calculate 1% commission
  const commission = claimAmount * 0.01

  const { error } = await supabase.from("referral_commissions").insert({
    referrer_id: referrerId,
    referred_id: referredId,
    commission_type: "claim",
    amount: commission,
    source_id: coinId,
    status: "completed",
  })

  if (error) throw error

  // Update referral total
  const { data: referral } = await supabase
    .from("referrals")
    .select("total_claim_commission")
    .eq("referrer_id", referrerId)
    .eq("referred_id", referredId)
    .single()

  if (referral) {
    await supabase
      .from("referrals")
      .update({
        total_claim_commission: (referral.total_claim_commission || 0) + commission,
      })
      .eq("referrer_id", referrerId)
      .eq("referred_id", referredId)
  }

  // Update user's total commission
  const { data: profile } = await supabase.from("profiles").select("total_commission").eq("id", referrerId).single()

  if (profile) {
    await supabase
      .from("profiles")
      .update({
        total_commission: (profile.total_commission || 0) + commission,
      })
      .eq("id", referrerId)
  }

  return commission
}

export async function checkMaxSupply() {
  const supabase = await createClient()

  const { data, error } = await supabase.from("total_coins_in_circulation").select("*").single()

  if (error) throw error

  const maxSupply = 500000
  const totalCoins = data?.total_coins || 0
  const remainingSupply = maxSupply - totalCoins

  return {
    totalCoins,
    maxSupply,
    remainingSupply,
    percentageUsed: (totalCoins / maxSupply) * 100,
  }
}
