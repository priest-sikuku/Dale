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
import { ArrowLeft, TrendingUp, Lock } from "lucide-react"
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
      const { data, error } = await supabase.from("gx_current_price").select("price").single()

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
          p_gx_amount: Number.parseFloat(formData.afxAmount),
          p_price_per_gx: pricePerAFX,
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
            gx_amount: Number.parseFloat(formData.afxAmount),
            remaining_amount: Number.parseFloat(formData.afxAmount),
            price_per_gx: pricePerAFX,
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Header />
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <Button
            variant="ghost"
            className="mb-8 hover:bg-white/5 transition flex items-center gap-2"
            onClick={() => router.push("/p2p")}
          >
            <ArrowLeft size={20} />
            Back to P2P Market
          </Button>

          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                <TrendingUp size={24} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-white">Create Your Ad</h1>
              </div>
            </div>
            <p className="text-gray-400 ml-14">Set your prices and connect with traders (Minimum: 50 AFX)</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Form */}
            <div className="lg:col-span-2">
              <form
                onSubmit={handleSubmit}
                className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-8 rounded-2xl border border-white/10 backdrop-blur-xl space-y-6"
              >
                {/* Ad Type Section */}
                <div className="space-y-3 pb-6 border-b border-white/10">
                  <Label className="text-base font-semibold text-white">Ad Type</Label>
                  <RadioGroup
                    value={adType}
                    onValueChange={(value) => setAdType(value as "buy" | "sell")}
                    className="flex gap-6"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="buy" id="buy" />
                      <Label htmlFor="buy" className="cursor-pointer text-gray-300 hover:text-white transition">
                        🔵 Buy AFX
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sell" id="sell" />
                      <Label htmlFor="sell" className="cursor-pointer text-gray-300 hover:text-white transition">
                        📤 Sell AFX
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Amount Section */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="afxAmount" className="text-sm font-semibold text-white flex items-center gap-2">
                      <TrendingUp size={16} className="text-green-400" />
                      Amount of AFX * (Minimum: 50)
                    </Label>
                    <Input
                      id="afxAmount"
                      type="number"
                      step="0.01"
                      min="50"
                      placeholder="Enter AFX amount"
                      value={formData.afxAmount}
                      onChange={(e) => setFormData({ ...formData, afxAmount: e.target.value })}
                      required
                      className="bg-white/5 border border-white/10 text-white placeholder-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pricePerAFX" className="text-sm font-semibold text-white">
                      Price per AFX (KES) *
                    </Label>
                    <Input
                      id="pricePerAFX"
                      type="number"
                      step="0.01"
                      min={minAllowedPrice}
                      max={maxAllowedPrice}
                      placeholder={`Between ${minAllowedPrice} - ${maxAllowedPrice}`}
                      value={formData.pricePerAFX}
                      onChange={(e) => setFormData({ ...formData, pricePerAFX: e.target.value })}
                      required
                      className="bg-white/5 border border-white/10 text-white placeholder-gray-500"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                  <p className="text-xs text-blue-300">
                    Current AFX price: <span className="font-bold">{currentAFXPrice} KES</span> • Allowed range:{" "}
                    {minAllowedPrice} - {maxAllowedPrice} KES (±4%)
                  </p>
                </div>

                {/* Min/Max Section */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="minAmount" className="text-sm font-semibold text-white">
                      Min Amount (AFX) * (Minimum: 2)
                    </Label>
                    <Input
                      id="minAmount"
                      type="number"
                      step="0.01"
                      min="2"
                      placeholder="Minimum"
                      value={formData.minAmount}
                      onChange={(e) => setFormData({ ...formData, minAmount: e.target.value })}
                      required
                      className="bg-white/5 border border-white/10 text-white"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAmount" className="text-sm font-semibold text-white">
                      Max Amount (AFX) *
                    </Label>
                    <Input
                      id="maxAmount"
                      type="number"
                      step="0.01"
                      placeholder="Maximum"
                      value={formData.maxAmount}
                      onChange={(e) => setFormData({ ...formData, maxAmount: e.target.value })}
                      required
                      className="bg-white/5 border border-white/10 text-white"
                    />
                  </div>
                </div>

                {/* Payment Methods */}
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <h3 className="text-lg font-semibold text-white">Payment Methods</h3>

                  {adType === "buy" ? (
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: "mpesa", label: "M-Pesa" },
                        { id: "bankTransfer", label: "Bank Transfer" },
                        { id: "paybill", label: "M-Pesa Paybill" },
                        { id: "airtelMoney", label: "Airtel Money" },
                      ].map((method) => (
                        <div
                          key={method.id}
                          className="flex items-center space-x-3 p-3 rounded-lg hover:bg-white/5 transition"
                        >
                          <Checkbox
                            id={method.id}
                            checked={paymentMethods[method.id as keyof typeof paymentMethods]}
                            onCheckedChange={(checked) =>
                              setPaymentMethods({
                                ...paymentMethods,
                                [method.id]: checked as boolean,
                              })
                            }
                          />
                          <Label htmlFor={method.id} className="cursor-pointer text-gray-300">
                            {method.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="accountNumber" className="text-sm font-semibold text-white">
                        Account Number / Payment Details
                      </Label>
                      <Input
                        id="accountNumber"
                        type="text"
                        placeholder="Enter your payment details"
                        value={formData.accountNumber}
                        onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                        className="bg-white/5 border border-white/10 text-white"
                      />
                    </div>
                  )}
                </div>

                {/* Terms of Trade */}
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <Label htmlFor="termsOfTrade" className="text-sm font-semibold text-white">
                    Terms of Trade
                  </Label>
                  <Textarea
                    id="termsOfTrade"
                    placeholder="Enter your terms and conditions..."
                    rows={3}
                    value={formData.termsOfTrade}
                    onChange={(e) => setFormData({ ...formData, termsOfTrade: e.target.value })}
                    className="bg-white/5 border border-white/10 text-white placeholder-gray-500 resize-none"
                  />
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full h-12 text-base font-semibold bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:shadow-lg hover:shadow-green-500/50 transition mt-8"
                  disabled={loading}
                >
                  {loading ? "Posting Ad..." : "✓ Post Ad Now"}
                </Button>
              </form>
            </div>

            {/* Sidebar Info Cards */}
            <div className="space-y-6">
              {/* Tips Card */}
              <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 p-6 rounded-2xl border border-blue-500/30 backdrop-blur-xl">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">💡 Pro Tips</h3>
                <ul className="space-y-3 text-sm text-gray-300">
                  <li className="flex gap-2">
                    <span>✓</span>
                    <span>Set competitive prices to attract traders</span>
                  </li>
                  <li className="flex gap-2">
                    <span>✓</span>
                    <span>Offer multiple payment methods</span>
                  </li>
                  <li className="flex gap-2">
                    <span>✓</span>
                    <span>Respond quickly to build reputation</span>
                  </li>
                  <li className="flex gap-2">
                    <span>✓</span>
                    <span>Clear terms prevent disputes</span>
                  </li>
                </ul>
              </div>

              {/* Security Card */}
              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 p-6 rounded-2xl border border-green-500/30 backdrop-blur-xl">
                <h3 className="font-bold text-white mb-4 flex items-center gap-2">
                  <Lock size={18} className="text-green-400" />
                  Security
                </h3>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li>• Funds locked in escrow</li>
                  <li>• Dispute resolution available</li>
                  <li>• Rated seller/buyer badge</li>
                </ul>
              </div>

              {/* Stats Card */}
              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 p-6 rounded-2xl border border-purple-500/30 backdrop-blur-xl">
                <h3 className="font-bold text-white mb-4">Requirements</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>
                    Minimum post: <span className="text-green-400 font-semibold">50 AFX</span>
                  </p>
                  <p>
                    Minimum trade: <span className="text-green-400 font-semibold">2 AFX</span>
                  </p>
                  <p>
                    Price variance: <span className="text-green-400 font-semibold">±4%</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
