import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// Calculate current price with volatility
async function calculateCurrentPrice() {
  const supabase = await createClient()

  // Get latest reference price
  const { data: latestRef } = await supabase
    .from("gx_price_references")
    .select("*")
    .order("reference_date", { ascending: false })
    .limit(1)
    .single()

  if (!latestRef) {
    return { price: 16.0, previousPrice: 16.0, changePercent: 0 }
  }

  // Get current time and 3pm reference time
  const now = new Date()
  const today3pm = new Date()
  today3pm.setHours(15, 0, 0, 0)

  const tomorrow3pm = new Date(today3pm)
  tomorrow3pm.setDate(tomorrow3pm.getDate() + 1)

  // Calculate target price (next 3pm reference)
  const targetPrice = latestRef.price * 1.03

  // Calculate time progress towards next 3pm (0 to 1)
  let timeProgress = 0
  if (now >= today3pm) {
    const timeSince3pm = now.getTime() - today3pm.getTime()
    const timeUntilNext3pm = tomorrow3pm.getTime() - today3pm.getTime()
    timeProgress = timeSince3pm / timeUntilNext3pm
  }

  // Get volatility based on trading activity
  const { data: recentTrades } = await supabase
    .from("trades")
    .select("id")
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())

  const tradeCount = recentTrades?.length || 0
  const baseVolatility = 0.02 // 2%
  const volatility = Math.min(baseVolatility + tradeCount * 0.01, 0.2) // Max 20%

  // Generate random fluctuation within volatility range
  const randomFactor = (Math.random() - 0.5) * 2 // -1 to 1
  const fluctuation = randomFactor * volatility

  // Calculate price with trend towards target and random fluctuation
  const trendComponent = (targetPrice - latestRef.price) * timeProgress
  const currentPrice = latestRef.price + trendComponent + latestRef.price * fluctuation

  // Ensure price doesn't go below 80% or above 120% of reference
  const minPrice = latestRef.price * 0.8
  const maxPrice = latestRef.price * 1.2
  const boundedPrice = Math.max(minPrice, Math.min(maxPrice, currentPrice))

  // Get previous price for comparison
  const { data: currentPriceData } = await supabase.from("gx_current_price").select("*").single()

  const previousPrice = currentPriceData?.price || latestRef.price
  const changePercent = ((boundedPrice - previousPrice) / previousPrice) * 100

  // Update current price in database
  await supabase
    .from("gx_current_price")
    .update({
      price: boundedPrice.toFixed(2),
      previous_price: previousPrice.toFixed(2),
      change_percent: changePercent.toFixed(2),
      volatility_factor: volatility.toFixed(4),
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentPriceData?.id)

  // Store in price history
  await supabase.from("gx_price_history").insert({
    price: boundedPrice.toFixed(2),
    timestamp: new Date().toISOString(),
  })

  return {
    price: Number.parseFloat(boundedPrice.toFixed(2)),
    previousPrice: Number.parseFloat(previousPrice.toFixed(2)),
    changePercent: Number.parseFloat(changePercent.toFixed(2)),
    volatility: Number.parseFloat((volatility * 100).toFixed(2)),
    referencePrice: latestRef.price,
    targetPrice: Number.parseFloat(targetPrice.toFixed(2)),
  }
}

export async function GET() {
  try {
    const priceData = await calculateCurrentPrice()
    return NextResponse.json(priceData)
  } catch (error) {
    console.error("[v0] Error calculating GX price:", error)
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 })
  }
}
