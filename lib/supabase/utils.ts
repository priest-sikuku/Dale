import { createClient } from "@/lib/supabase/client"

/**
 * Fetches the available balance for the current user
 * Available balance = total_mined - coins locked in active sell ads
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

  const { data, error } = await supabase.rpc("get_available_balance", { user_id: user.id })

  if (error) {
    console.error("[v0] Error fetching available balance:", error)
    // Fallback to total_mined if function fails
    const { data: profileData } = await supabase.from("profiles").select("total_mined").eq("id", user.id).single()

    if (profileData) {
      setAvailableBalance(profileData.total_mined || 0)
    }
  } else if (data !== null) {
    setAvailableBalance(data)
  }

  setIsLoading(false)
}
