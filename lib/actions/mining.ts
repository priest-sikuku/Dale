"use server"

import { createClient } from "@/lib/supabase/server"
import { createTransaction } from "@/lib/db/transactions"

const MINING_AMOUNT = 0.73
const MINING_INTERVAL_HOURS = 3

export async function claimMining() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    // Get user's mining status from profiles
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("last_mine, next_mine")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[v0] Error fetching profile:", profileError)
      return { success: false, error: "Failed to fetch profile" }
    }

    // Check if user can mine
    const now = new Date()
    const nextMine = profile.next_mine ? new Date(profile.next_mine) : null

    if (nextMine && now < nextMine) {
      return {
        success: false,
        error: "Mining not available yet",
        nextMine: nextMine.toISOString(),
      }
    }

    // Calculate next mining time (3 hours from now)
    const newNextMine = new Date(now.getTime() + MINING_INTERVAL_HOURS * 60 * 60 * 1000)

    // Update profile with new mining times
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        last_mine: now.toISOString(),
        next_mine: newNextMine.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq("id", user.id)

    if (updateError) {
      console.error("[v0] Error updating profile:", updateError)
      return { success: false, error: "Failed to update mining status" }
    }

    // Add coins to user's balance
    const { error: coinsError } = await supabase.from("coins").insert({
      user_id: user.id,
      amount: MINING_AMOUNT,
      claim_type: "mining",
      status: "available",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    })

    if (coinsError) {
      console.error("[v0] Error adding coins:", coinsError)
      return { success: false, error: "Failed to add coins" }
    }

    // Log transaction
    await createTransaction(user.id, "mining", MINING_AMOUNT, "Mining reward claimed")

    console.log("[v0] Mining claimed successfully:", {
      userId: user.id,
      amount: MINING_AMOUNT,
      nextMine: newNextMine.toISOString(),
    })

    return {
      success: true,
      amount: MINING_AMOUNT,
      nextMine: newNextMine.toISOString(),
    }
  } catch (error) {
    console.error("[v0] Exception in claimMining:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}

export async function getMiningStatus() {
  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { success: false, error: "Not authenticated" }
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("last_mine, next_mine")
      .eq("id", user.id)
      .single()

    if (profileError) {
      console.error("[v0] Error fetching mining status:", profileError)
      return { success: false, error: "Failed to fetch mining status" }
    }

    const now = new Date()
    const nextMine = profile.next_mine ? new Date(profile.next_mine) : now
    const canMine = now >= nextMine

    return {
      success: true,
      canMine,
      lastMine: profile.last_mine,
      nextMine: profile.next_mine,
      timeRemaining: canMine ? 0 : nextMine.getTime() - now.getTime(),
    }
  } catch (error) {
    console.error("[v0] Exception in getMiningStatus:", error)
    return { success: false, error: "An unexpected error occurred" }
  }
}
