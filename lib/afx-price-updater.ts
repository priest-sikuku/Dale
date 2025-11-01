"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Renamed from checkAndUpdateGXPrice to checkAndUpdateAFXPrice
 * Server action to check and update AFX price if needed
 */
export async function checkAndUpdateAFXPrice() {
  const supabase = await createClient()

  try {
    // Call the database function that auto-updates if needed
    const { data, error } = await supabase.rpc("get_current_afx_price_with_auto_update").single()

    if (error) {
      console.error("[v0] Error checking AFX price:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] AFX Price check:", {
      price: data.price,
      needsUpdate: data.needs_update,
      lastUpdated: data.last_updated,
    })

    return {
      success: true,
      price: data.price,
      previousPrice: data.previous_price,
      changePercent: data.change_percent,
      needsUpdate: data.needs_update,
    }
  } catch (error) {
    console.error("[v0] Exception in checkAndUpdateAFXPrice:", error)
    return { success: false, error: "Failed to check price" }
  }
}

/**
 * Manually trigger a price update
 */
export async function manuallyUpdateAFXPrice() {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase.rpc("manual_price_update").single()

    if (error) {
      console.error("[v0] Error manually updating price:", error)
      return { success: false, error: error.message }
    }

    console.log("[v0] Manual price update result:", data)

    return {
      success: data.success,
      message: data.message,
      newPrice: data.new_price,
      oldPrice: data.old_price,
    }
  } catch (error) {
    console.error("[v0] Exception in manuallyUpdateAFXPrice:", error)
    return { success: false, error: "Failed to update price" }
  }
}
