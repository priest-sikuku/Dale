import { createClient } from "@/lib/supabase/client"

/**
 * Fetches the available balance for the current user
 * Available balance = coins with status 'available' (excluding locked coins in P2P)
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

  const { data, error } = await supabase.rpc("get_available_balance", { p_user_id: user.id })

  if (error) {
    console.error("[v0] Error fetching available balance:", error)
    // Fallback to direct query if function fails
    const { data: coinsData } = await supabase
      .from("coins")
      .select("amount")
      .eq("user_id", user.id)
      .eq("status", "available")

    if (coinsData) {
      const total = coinsData.reduce((sum, coin) => sum + Number(coin.amount), 0)
      setAvailableBalance(total)
    }
  } else if (data !== null) {
    setAvailableBalance(data)
  }

  setIsLoading(false)
}
