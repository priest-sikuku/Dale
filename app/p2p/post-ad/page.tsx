"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { ArrowLeft } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

export default function PostAdPage() {
  const router = useRouter()
  const [adType, setAdType] = useState<"buy" | "sell">("sell")
  const [loading, setLoading] = useState(false)
  const [currentAFXPrice, setCurrentAFXPrice] = useState<number>(16)
  const [formData, setFormData] = useState({
    afxAmount: "",
    pricePerAFX: "",
    minAmount: "",
    maxAmount: "",
    accountNumber: "",
    termsOfTrade: "",
  })

  const [paymentMethods, setPaymentMethods] = useState({
    mpesa: false,
    bankTransfer: false,
    paybill: false,
    airtelMoney: false,
  })

  useEffect(() => {
    const fetchAFXPrice = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.from("afx_current_price").select("price").single()

      if (!error && data) {
        setCurrentAFXPrice(data.price)
        setFormData((prev) => ({ ...prev, pricePerAFX: data.price.toString() }))
      }
    }

    fetchAFXPrice()
  }, [])

  const minAllowedPrice = (currentAFXPrice * 0.96).toFixed(2)
  const maxAllowedPrice = (currentAFXPrice * 1.04).toFixed(2)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      if (Number.parseFloat(formData.afxAmount) < 50) {
        alert("Minimum amount to post an ad is 50 AFX")
        setLoading(false)
        return
      }

      const pricePerAFX = Number.parseFloat(formData.pricePerAFX)
      if (pricePerAFX < Number.parseFloat(minAllowedPrice) || pricePerAFX > Number.parseFloat(maxAllowedPrice)) {
        alert(`Price must be between ${minAllowedPrice} and ${maxAllowedPrice} KES (±4% of current price)`)
        setLoading(false)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        alert("Please sign in to post an ad")
        router.push("/auth/sign-in")
        return
      }

      const selectedPaymentMethods = []
      if (paymentMethods.mpesa) selectedPaymentMethods.push("M-Pesa")
      if (paymentMethods.bankTransfer) selectedPaymentMethods.push("Bank Transfer")
      if (paymentMethods.paybill) selectedPaymentMethods.push("M-Pesa Paybill")
      if (paymentMethods.airtelMoney) selectedPaymentMethods.push("Airtel Money")

      const paymentMethodsString = selectedPaymentMethods.join(", ")

      if (adType === "sell") {
        const { data, error } = await supabase.rpc("post_sell_ad_with_escrow", {
          p_user_id: user.id,
          p_afx_amount: Number.parseFloat(formData.afxAmount),
          p_price_per_afx: pricePerAFX,
          p_min_amount: Number.parseFloat(formData.minAmount),
          p_max_amount: Number.parseFloat(formData.maxAmount),
          p_account_number: formData.accountNumber || null,
          p_mpesa_number: null,
          p_paybill_number: null,
          p_airtel_money: null,
          p_terms_of_trade: formData.termsOfTrade || null,
        })

        if (error) {
          console.error("[v0] Error creating sell ad:", error)
          alert("Failed to create ad: " + error.message)
          return
        }

        alert("Sell ad posted successfully! Your coins have been locked for this ad.")
        router.push("/p2p")
      } else {
        const { data, error } = await supabase
          .from("p2p_ads")
          .insert({
            user_id: user.id,
            ad_type: adType,
            afx_amount: Number.parseFloat(formData.afxAmount),
            remaining_amount: Number.parseFloat(formData.afxAmount),
            price_per_afx: pricePerAFX,
            min_amount: Number.parseFloat(formData.minAmount),
            max_amount: Number.parseFloat(formData.maxAmount),
            account_number: paymentMethodsString || null,
            mpesa_number: null,
            paybill_number: null,
            airtel_money: null,
            terms_of_trade: formData.termsOfTrade || null,
          })
          .select()
          .single()

        if (error) {
          console.error("[v0] Error creating buy ad:", error)
          alert("Failed to create ad: " + error.message)
          return
        }

        alert("Buy ad posted successfully!")
        router.push("/p2p")
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("An error occurred while posting the ad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <Button variant="ghost" className="mb-6 hover:bg-white/5 transition" onClick={() => router.push("/p2p")}>
            <ArrowLeft size={20} className="mr-2" />
            Back to P2P Market
          </Button>

          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">Post an Ad</h1>
            <p className="text-gray-400">Create a buy or sell ad for AFX coins (Minimum: 50 AFX)</p>
          </div>

          <form onSubmit={handleSubmit} className="glass-card p-8 rounded-xl border border-white/10 space-y-6">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Ad Type</Label>
              <RadioGroup
                value={adType}
                onValueChange={(value) => setAdType(value as "buy" | "sell")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="buy" id="buy" />
                  <Label htmlFor="buy" className="cursor-pointer">
                    Buy AFX
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="sell" id="sell" />
                  <Label htmlFor="sell" className="cursor-pointer">
                    Sell AFX
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="afxAmount">Amount of AFX * (Minimum: 50 AFX)</Label>
              <Input
                id="afxAmount"
                type="number"
                step="0.01"
                min="50"
                placeholder="Enter AFX amount (min 50)"
                value={formData.afxAmount}
                onChange={(e) => setFormData({ ...formData, afxAmount: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pricePerAFX">Price per AFX (KES) *</Label>
              <Input
                id="pricePerAFX"
                type="number"
                step="0.01"
                min={minAllowedPrice}
                max={maxAllowedPrice}
                placeholder={`Between ${minAllowedPrice} - ${maxAllowedPrice} KES`}
                value={formData.pricePerAFX}
                onChange={(e) => setFormData({ ...formData, pricePerAFX: e.target.value })}
                required
              />
              <p className="text-xs text-gray-400">
                Current AFX price: {currentAFXPrice} KES. Allowed range: {minAllowedPrice} - {maxAllowedPrice} KES (±4%)
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minAmount">Min Amount (AFX) * (Minimum: 2 AFX)</Label>
                <Input
                  id="minAmount"
                  type="number"
                  step="0.01"
                  min="2"
                  placeholder="Minimum (min 2)"
                  value={formData.minAmount}
                  onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAmount">Max Amount (AFX) *</Label>
                <Input
                  id="maxAmount"
                  type="number"
                  step="0.01"
                  placeholder="Maximum"
                  value={formData.maxAmount}
                  onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Payment Methods</h3>

              {adType === "buy" ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">Select payment methods you accept:</p>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mpesa"
                      checked={paymentMethods.mpesa}
                      onCheckedChange={(checked) => setPaymentMethods({ ...paymentMethods, mpesa: checked as boolean })}
                    />
                    <Label htmlFor="mpesa" className="cursor-pointer">
                      M-Pesa
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="bankTransfer"
                      checked={paymentMethods.bankTransfer}
                      onCheckedChange={(checked) =>
                        setPaymentMethods({ ...paymentMethods, bankTransfer: checked as boolean })
                      }
                    />
                    <Label htmlFor="bankTransfer" className="cursor-pointer">
                      Bank Transfer
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="paybill"
                      checked={paymentMethods.paybill}
                      onCheckedChange={(checked) =>
                        setPaymentMethods({ ...paymentMethods, paybill: checked as boolean })
                      }
                    />
                    <Label htmlFor="paybill" className="cursor-pointer">
                      M-Pesa Paybill
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="airtelMoney"
                      checked={paymentMethods.airtelMoney}
                      onCheckedChange={(checked) =>
                        setPaymentMethods({ ...paymentMethods, airtelMoney: checked as boolean })
                      }
                    />
                    <Label htmlFor="airtelMoney" className="cursor-pointer">
                      Airtel Money
                    </Label>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number / Payment Details</Label>
                  <Input
                    id="accountNumber"
                    type="text"
                    placeholder="Enter your payment details"
                    value={formData.accountNumber}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="termsOfTrade">Terms of Trade</Label>
              <Textarea
                id="termsOfTrade"
                placeholder="Enter your terms and conditions for this trade..."
                rows={4}
                value={formData.termsOfTrade}
                onChange={(e) => setFormData({ ...formData, termsOfTrade: e.target.value })}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-500 to-green-600 text-black hover:shadow-lg hover:shadow-green-500/50 transition"
              disabled={loading}
            >
              {loading ? "Posting Ad..." : "Post Ad"}
            </Button>
          </form>

          <div className="mt-8 glass-card p-8 rounded-xl border border-blue-500/30 bg-blue-500/10">
            <h3 className="font-bold text-white mb-4">Tips for Creating Successful Ads</h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>Minimum posting amount: 50 AFX</li>
              <li>Minimum trade amount: 2 AFX</li>
              <li>Price must be within ±4% of current AFX price</li>
              <li>Set competitive prices to attract more traders</li>
              <li>Provide multiple payment methods for flexibility</li>
              <li>Write clear terms to avoid misunderstandings</li>
              <li>Respond quickly to trade requests for better ratings</li>
            </ul>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
