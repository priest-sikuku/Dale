"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertCircle } from "lucide-react"

interface PaymentMethodFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (details: PaymentDetails) => Promise<void>
  loading?: boolean
}

export interface PaymentDetails {
  method_type: "mpesa_personal" | "mpesa_paybill" | "bank_transfer" | "airtel_money"
  full_name?: string
  phone_number?: string
  paybill_number?: string
  account_number?: string
  bank_name?: string
  airtel_money_number?: string
}

export default function PaymentMethodForm({ open, onOpenChange, onSubmit, loading = false }: PaymentMethodFormProps) {
  const [methodType, setMethodType] = useState<PaymentDetails["method_type"]>("mpesa_personal")
  const [details, setDetails] = useState<Partial<PaymentDetails>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validatePhoneNumber = (phone: string): boolean => {
    const phoneRegex = /^(\+254|0)7\d{8}$/
    return phoneRegex.test(phone.replace(/\s/g, ""))
  }

  const validateAccountNumber = (account: string): boolean => {
    return /^\d{5,20}$/.test(account.replace(/\s/g, ""))
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (methodType === "mpesa_personal") {
      if (!details.full_name?.trim()) newErrors.full_name = "Full name is required"
      if (!details.phone_number?.trim()) {
        newErrors.phone_number = "M-Pesa number is required"
      } else if (!validatePhoneNumber(details.phone_number)) {
        newErrors.phone_number = "Invalid phone number. Use 07xxxxxxxx or +254xxxxxxxx"
      }
    }

    if (methodType === "mpesa_paybill") {
      if (!details.paybill_number?.trim()) newErrors.paybill_number = "Paybill number is required"
      if (!details.account_number?.trim()) {
        newErrors.account_number = "Account number is required"
      } else if (!validateAccountNumber(details.account_number)) {
        newErrors.account_number = "Account number must be 5-20 digits"
      }
    }

    if (methodType === "bank_transfer") {
      if (!details.bank_name?.trim()) newErrors.bank_name = "Bank name is required"
      if (!details.account_number?.trim()) {
        newErrors.account_number = "Account number is required"
      } else if (!validateAccountNumber(details.account_number)) {
        newErrors.account_number = "Account number must be 5-20 digits"
      }
    }

    if (methodType === "airtel_money") {
      if (!details.airtel_money_number?.trim()) {
        newErrors.airtel_money_number = "Airtel Money number is required"
      } else if (!validatePhoneNumber(details.airtel_money_number)) {
        newErrors.airtel_money_number = "Invalid phone number. Use 07xxxxxxxx or +254xxxxxxxx"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleMethodChange = (newMethod: PaymentDetails["method_type"]) => {
    setMethodType(newMethod)
    setDetails({})
    setErrors({})
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    try {
      await onSubmit({
        method_type: methodType,
        ...details,
      } as PaymentDetails)
      setDetails({})
      setErrors({})
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error submitting payment details:", error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-black border border-white/10">
        <DialogHeader>
          <DialogTitle>Add Payment Method</DialogTitle>
          <DialogDescription>Select and verify your payment method before proceeding with the sale</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Payment Method Selection */}
          <div className="space-y-2">
            <Label className="text-sm">Payment Method *</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "mpesa_personal", label: "M-Pesa Personal" },
                { id: "mpesa_paybill", label: "M-Pesa Paybill" },
                { id: "bank_transfer", label: "Bank Transfer" },
                { id: "airtel_money", label: "Airtel Money" },
              ].map((method) => (
                <button
                  key={method.id}
                  onClick={() => handleMethodChange(method.id as PaymentDetails["method_type"])}
                  className={`p-2 rounded-lg text-xs font-medium transition ${
                    methodType === method.id
                      ? "bg-emerald-600 text-white"
                      : "bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* M-Pesa Personal */}
          {methodType === "mpesa_personal" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="full_name" className="text-sm">
                  Full Name *
                </Label>
                <Input
                  id="full_name"
                  placeholder="John Doe"
                  value={details.full_name || ""}
                  onChange={(e) => setDetails({ ...details, full_name: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.full_name ? "border-red-500" : ""}`}
                />
                {errors.full_name && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.full_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="phone_number" className="text-sm">
                  M-Pesa Number *
                </Label>
                <Input
                  id="phone_number"
                  placeholder="0712345678"
                  value={details.phone_number || ""}
                  onChange={(e) => setDetails({ ...details, phone_number: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.phone_number ? "border-red-500" : ""}`}
                />
                {errors.phone_number && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.phone_number}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* M-Pesa Paybill */}
          {methodType === "mpesa_paybill" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="paybill" className="text-sm">
                  Paybill Number *
                </Label>
                <Input
                  id="paybill"
                  placeholder="247247"
                  value={details.paybill_number || ""}
                  onChange={(e) => setDetails({ ...details, paybill_number: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.paybill_number ? "border-red-500" : ""}`}
                />
                {errors.paybill_number && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.paybill_number}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="paybill_account" className="text-sm">
                  Account Number *
                </Label>
                <Input
                  id="paybill_account"
                  placeholder="123456"
                  value={details.account_number || ""}
                  onChange={(e) => setDetails({ ...details, account_number: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.account_number ? "border-red-500" : ""}`}
                />
                {errors.account_number && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.account_number}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bank Transfer */}
          {methodType === "bank_transfer" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="bank_name" className="text-sm">
                  Bank Name *
                </Label>
                <Input
                  id="bank_name"
                  placeholder="KCB, Equity, etc"
                  value={details.bank_name || ""}
                  onChange={(e) => setDetails({ ...details, bank_name: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.bank_name ? "border-red-500" : ""}`}
                />
                {errors.bank_name && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.bank_name}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="bank_account" className="text-sm">
                  Account Number *
                </Label>
                <Input
                  id="bank_account"
                  placeholder="123456789"
                  value={details.account_number || ""}
                  onChange={(e) => setDetails({ ...details, account_number: e.target.value })}
                  className={`bg-white/5 border-white/10 ${errors.account_number ? "border-red-500" : ""}`}
                />
                {errors.account_number && (
                  <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.account_number}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Airtel Money */}
          {methodType === "airtel_money" && (
            <div>
              <Label htmlFor="airtel" className="text-sm">
                Airtel Money Number *
              </Label>
              <Input
                id="airtel"
                placeholder="0712345678"
                value={details.airtel_money_number || ""}
                onChange={(e) => setDetails({ ...details, airtel_money_number: e.target.value })}
                className={`bg-white/5 border-white/10 ${errors.airtel_money_number ? "border-red-500" : ""}`}
              />
              {errors.airtel_money_number && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.airtel_money_number}
                </p>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1" disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
              {loading ? "Saving..." : "Confirm Payment Method"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
