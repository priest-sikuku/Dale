"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, User, CheckCircle, XCircle, Send, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Header from "@/components/header"
import Footer from "@/components/footer"
import { createClient } from "@/lib/supabase/client"

interface Trade {
  id: string
  ad_id: string
  buyer_id: string
  seller_id: string
  gx_amount: number
  escrow_amount: number
  status: string
  payment_confirmed_at: string | null
  coins_released_at: string | null
  expires_at: string
  created_at: string
  buyer_username?: string | null
  buyer_email?: string | null
  seller_username?: string | null
  seller_email?: string | null
  ad_account_number?: string | null
  ad_mpesa_number?: string | null
  ad_paybill_number?: string | null
  ad_airtel_money?: string | null
  ad_terms_of_trade?: string | null
}

interface Message {
  id: string
  trade_id: string
  sender_id: string
  message: string
  created_at: string
}

export default function TradePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [trade, setTrade] = useState<Trade | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [showRatingForm, setShowRatingForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [ratingComment, setRatingComment] = useState("")
  const [submittingRating, setSubmittingRating] = useState(false)
  const [existingRating, setExistingRating] = useState<any>(null)

  useEffect(() => {
    fetchTrade()
    getCurrentUser()
    fetchMessages()
    checkExistingRating()
    const unsubscribe = subscribeToMessages()
    return () => {
      unsubscribe()
    }
  }, [params.id])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function getCurrentUser() {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    setCurrentUserId(user?.id || null)
  }

  async function fetchTrade() {
    try {
      const { data: tradeData, error: tradeError } = await supabase
        .from("p2p_trades")
        .select("*")
        .eq("id", params.id)
        .single()

      if (tradeError) {
        console.error("[v0] Error fetching trade:", tradeError)
        setLoading(false)
        return
      }

      if (!tradeData) {
        setLoading(false)
        return
      }

      // Fetch buyer profile
      const { data: buyerData } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", tradeData.buyer_id)
        .single()

      // Fetch seller profile
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("username, email")
        .eq("id", tradeData.seller_id)
        .single()

      // Fetch ad details
      const { data: adData } = await supabase
        .from("p2p_ads")
        .select("account_number, mpesa_number, paybill_number, airtel_money, terms_of_trade")
        .eq("id", tradeData.ad_id)
        .single()

      // Combine all data
      const combinedTrade: Trade = {
        ...tradeData,
        buyer_username: buyerData?.username || null,
        buyer_email: buyerData?.email || null,
        seller_username: sellerData?.username || null,
        seller_email: sellerData?.email || null,
        ad_account_number: adData?.account_number || null,
        ad_mpesa_number: adData?.mpesa_number || null,
        ad_paybill_number: adData?.paybill_number || null,
        ad_airtel_money: adData?.airtel_money || null,
        ad_terms_of_trade: adData?.terms_of_trade || null,
      }

      setTrade(combinedTrade)
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMessages() {
    try {
      const { data, error } = await supabase
        .from("trade_messages")
        .select("*")
        .eq("trade_id", params.id)
        .order("created_at", { ascending: true })

      if (error) {
        console.error("[v0] Error fetching messages:", error)
        return
      }

      setMessages(data || [])
    } catch (error) {
      console.error("[v0] Error:", error)
    }
  }

  function subscribeToMessages() {
    const channel = supabase
      .channel(`trade_messages:${params.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `trade_id=eq.${params.id}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !currentUserId) return

    try {
      setSendingMessage(true)
      const { error } = await supabase.from("trade_messages").insert({
        trade_id: params.id,
        sender_id: currentUserId,
        message: newMessage.trim(),
      })

      if (error) {
        console.error("[v0] Error sending message:", error)
        alert("Failed to send message")
        return
      }

      setNewMessage("")
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to send message")
    } finally {
      setSendingMessage(false)
    }
  }

  async function markPaymentSent() {
    if (!trade || !currentUserId) return

    try {
      setActionLoading(true)
      const { error } = await supabase.rpc("mark_payment_sent", {
        p_trade_id: trade.id,
        p_buyer_id: currentUserId,
      })

      if (error) {
        alert(error.message || "Failed to mark payment as sent")
        return
      }

      alert("Payment marked as sent! Waiting for seller to release coins.")
      fetchTrade()
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to mark payment as sent")
    } finally {
      setActionLoading(false)
    }
  }

  async function releaseCoins() {
    if (!trade || !currentUserId) return

    try {
      setActionLoading(true)
      const { error } = await supabase.rpc("release_p2p_coins", {
        p_trade_id: trade.id,
        p_seller_id: currentUserId,
      })

      if (error) {
        alert(error.message || "Failed to release coins")
        return
      }

      alert("Coins released successfully! Trade completed.")
      fetchTrade()
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to release coins")
    } finally {
      setActionLoading(false)
    }
  }

  async function cancelTrade() {
    if (!trade || !currentUserId) return

    if (!confirm("Are you sure you want to cancel this trade? Coins will be returned to the seller.")) {
      return
    }

    try {
      setActionLoading(true)
      const { error } = await supabase.rpc("cancel_p2p_trade", {
        p_trade_id: trade.id,
        p_user_id: currentUserId,
      })

      if (error) {
        alert(error.message || "Failed to cancel trade")
        return
      }

      alert("Trade cancelled successfully")
      router.push("/p2p")
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to cancel trade")
    } finally {
      setActionLoading(false)
    }
  }

  async function checkExistingRating() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return

    const { data } = await supabase
      .from("p2p_ratings")
      .select("*")
      .eq("trade_id", params.id)
      .eq("rater_id", user.id)
      .single()

    if (data) {
      setExistingRating(data)
    }
  }

  async function submitRating() {
    if (!trade || !currentUserId || rating === 0) return

    try {
      setSubmittingRating(true)
      const ratedUserId = currentUserId === trade.buyer_id ? trade.seller_id : trade.buyer_id

      const { error } = await supabase.from("p2p_ratings").insert({
        trade_id: trade.id,
        rater_id: currentUserId,
        rated_user_id: ratedUserId,
        rating: rating,
        comment: ratingComment.trim() || null,
      })

      if (error) {
        alert(error.message || "Failed to submit rating")
        return
      }

      alert("Rating submitted successfully!")
      setShowRatingForm(false)
      checkExistingRating()
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("Failed to submit rating")
    } finally {
      setSubmittingRating(false)
    }
  }

  function getStatusBadge(status: string) {
    const statusConfig: Record<
      string,
      { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
    > = {
      pending: { label: "Pending", variant: "secondary" },
      escrowed: { label: "In Escrow", variant: "default" },
      payment_sent: { label: "Payment Sent", variant: "default" },
      completed: { label: "Completed", variant: "default" },
      cancelled: { label: "Cancelled", variant: "destructive" },
      disputed: { label: "Disputed", variant: "destructive" },
    }
    const config = statusConfig[status] || { label: status, variant: "outline" }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  function getPaymentMethods() {
    if (!trade) return ["Not specified"]
    const methods = []
    if (trade.ad_mpesa_number) methods.push(`M-Pesa: ${trade.ad_mpesa_number}`)
    if (trade.ad_paybill_number) methods.push(`Paybill: ${trade.ad_paybill_number}`)
    if (trade.ad_airtel_money) methods.push(`Airtel: ${trade.ad_airtel_money}`)
    if (trade.ad_account_number) methods.push(`Account: ${trade.ad_account_number}`)
    return methods.length > 0 ? methods : ["Not specified"]
  }

  const isBuyer = currentUserId === trade?.buyer_id
  const isSeller = currentUserId === trade?.seller_id

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <p className="text-gray-400">Loading trade...</p>
        </main>
        <Footer />
      </div>
    )
  }

  if (!trade) {
    return (
      <div className="min-h-screen flex flex-col bg-black">
        <Header />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 mb-4">Trade not found</p>
            <Button onClick={() => router.push("/p2p")}>Back to P2P</Button>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col bg-black">
      <Header />
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <Button variant="ghost" className="mb-6 hover:bg-white/5" onClick={() => router.push("/p2p")}>
            <ArrowLeft size={20} className="mr-2" />
            Back to P2P
          </Button>

          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-4xl font-bold">Trade Details</h1>
              {getStatusBadge(trade.status)}
            </div>
            <p className="text-gray-400">Trade ID: {trade.id}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="glass-card p-6 rounded-xl border border-white/10">
              <p className="text-gray-400 text-sm mb-2">Trade Amount</p>
              <p className="text-3xl font-bold text-green-400">{trade.gx_amount} GX</p>
            </div>
            <div className="glass-card p-6 rounded-xl border border-white/10">
              <p className="text-gray-400 text-sm mb-2">Escrow Amount</p>
              <p className="text-3xl font-bold text-yellow-400">{trade.escrow_amount} GX</p>
            </div>
            <div className="glass-card p-6 rounded-xl border border-white/10">
              <p className="text-gray-400 text-sm mb-2">Status</p>
              <div className="mt-2">{getStatusBadge(trade.status)}</div>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl border border-white/10 mb-6">
            <h3 className="text-xl font-semibold mb-6">Trade Information</h3>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Buyer</p>
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                    <User size={16} className="text-green-400" />
                    <p className="font-semibold">{trade.buyer_username || trade.buyer_email || "Anonymous"}</p>
                    {isBuyer && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">You</span>}
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-1">Seller</p>
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg">
                    <User size={16} className="text-red-400" />
                    <p className="font-semibold">{trade.seller_username || trade.seller_email || "Anonymous"}</p>
                    {isSeller && <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded">You</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Created</p>
                  <p className="text-sm p-3 bg-white/5 rounded-lg">{new Date(trade.created_at).toLocaleString()}</p>
                </div>
                {trade.expires_at && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Expires</p>
                    <p className="text-sm p-3 bg-white/5 rounded-lg">{new Date(trade.expires_at).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="glass-card p-8 rounded-xl border border-white/10 mb-6">
            <h3 className="text-xl font-semibold mb-4">Payment Details</h3>
            <div className="space-y-2">
              {getPaymentMethods().map((method, index) => (
                <p key={index} className="text-sm p-3 bg-white/5 rounded-lg">
                  {method}
                </p>
              ))}
            </div>
            {trade.ad_terms_of_trade && (
              <div className="mt-4">
                <p className="text-sm text-gray-400 mb-2">Terms of Trade</p>
                <p className="text-sm p-3 bg-white/5 rounded-lg">{trade.ad_terms_of_trade}</p>
              </div>
            )}
          </div>

          <div className="glass-card p-8 rounded-xl border border-white/10 mb-6">
            <h3 className="text-xl font-semibold mb-4">Trade Chat</h3>
            <div className="bg-black/20 rounded-lg p-4 h-64 overflow-y-auto mb-4 border border-white/5">
              {messages.length === 0 ? (
                <p className="text-center text-gray-500 text-sm">No messages yet. Start the conversation!</p>
              ) : (
                <div className="space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_id === currentUserId ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg p-3 ${
                          msg.sender_id === currentUserId ? "bg-blue-600 text-white" : "bg-white/10 text-gray-200"
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">{new Date(msg.created_at).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                disabled={sendingMessage || trade.status === "completed" || trade.status === "cancelled"}
                className="bg-white/5 border-white/10"
              />
              <Button
                onClick={sendMessage}
                disabled={
                  sendingMessage || !newMessage.trim() || trade.status === "completed" || trade.status === "cancelled"
                }
                className="bg-gradient-to-r from-green-500 to-green-600 text-black hover:shadow-lg hover:shadow-green-500/50 transition"
              >
                <Send size={18} />
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          {trade.status !== "completed" && trade.status !== "cancelled" && (
            <div className="glass-card p-8 rounded-xl border border-white/10 mb-6">
              <h3 className="text-xl font-semibold mb-4">Actions</h3>
              <div className="flex flex-wrap gap-3">
                {isBuyer && trade.status === "escrowed" && (
                  <Button
                    onClick={markPaymentSent}
                    disabled={actionLoading}
                    className="bg-gradient-to-r from-green-500 to-green-600 text-black hover:shadow-lg hover:shadow-green-500/50 transition"
                  >
                    <CheckCircle size={18} className="mr-2" />
                    {actionLoading ? "Processing..." : "I Have Paid"}
                  </Button>
                )}

                {isSeller && (trade.status === "payment_sent" || trade.status === "escrowed") && (
                  <Button
                    onClick={releaseCoins}
                    disabled={actionLoading}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:shadow-lg hover:shadow-blue-500/50 transition text-white"
                  >
                    <CheckCircle size={18} className="mr-2" />
                    {actionLoading ? "Processing..." : "Release Coins"}
                  </Button>
                )}

                <Button onClick={cancelTrade} disabled={actionLoading} variant="destructive">
                  <XCircle size={18} className="mr-2" />
                  {actionLoading ? "Processing..." : "Cancel Trade"}
                </Button>
              </div>
            </div>
          )}

          {/* Completed Message */}
          {trade.status === "completed" && (
            <div className="glass-card p-8 bg-green-500/10 border-green-500/20 rounded-xl mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle size={24} className="text-green-400" />
                <div>
                  <p className="font-semibold text-green-400">Trade Completed!</p>
                  <p className="text-sm text-gray-400">Coins have been successfully transferred to the buyer.</p>
                </div>
              </div>
            </div>
          )}

          {trade.status === "completed" && !existingRating && (
            <div className="glass-card p-8 rounded-xl border border-white/10 mb-6">
              <h3 className="text-xl font-semibold mb-4">Rate this Trade</h3>
              {!showRatingForm ? (
                <Button
                  onClick={() => setShowRatingForm(true)}
                  className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-black hover:shadow-lg hover:shadow-yellow-500/50"
                >
                  <Star size={18} className="mr-2" />
                  Rate {isBuyer ? "Seller" : "Buyer"}
                </Button>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Rating *</Label>
                    <div className="flex gap-2 mt-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setRating(star)}
                          className="transition-transform hover:scale-110"
                        >
                          <Star
                            size={32}
                            className={star <= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ratingComment">Comment (Optional)</Label>
                    <Textarea
                      id="ratingComment"
                      placeholder="Share your experience with this trader..."
                      rows={3}
                      value={ratingComment}
                      onChange={(e) => setRatingComment(e.target.value)}
                      className="bg-white/5 border-white/10"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={submitRating}
                      disabled={submittingRating || rating === 0}
                      className="bg-gradient-to-r from-green-500 to-green-600 text-black hover:shadow-lg hover:shadow-green-500/50"
                    >
                      {submittingRating ? "Submitting..." : "Submit Rating"}
                    </Button>
                    <Button variant="outline" onClick={() => setShowRatingForm(false)} className="border-white/10">
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {existingRating && (
            <div className="glass-card p-8 rounded-xl border border-green-500/30 bg-green-500/10 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-green-400">You rated this trade</h3>
              <div className="flex gap-1 mb-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    size={20}
                    className={star <= existingRating.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600"}
                  />
                ))}
              </div>
              {existingRating.comment && <p className="text-sm text-gray-300">{existingRating.comment}</p>}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
