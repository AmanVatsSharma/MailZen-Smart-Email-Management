'use client';

import React, { useState } from 'react';
import { useMutation } from '@apollo/client';
import { CheckCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { SEND_PHONE_OTP, VERIFY_PHONE_OTP } from '@/lib/apollo/queries/phone';

type Step = 'phone' | 'otp' | 'success';

interface PhoneVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified?: () => void;
}

export function PhoneVerificationDialog({
  open,
  onOpenChange,
  onVerified,
}: PhoneVerificationDialogProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');

  const [sendOtp, { loading: sending }] = useMutation(SEND_PHONE_OTP, {
    onCompleted: () => {
      setStep('otp');
      toast({ title: 'OTP sent', description: `A 6-digit code was sent to ${phoneNumber}` });
    },
    onError: (err) => {
      toast({ title: 'Failed to send OTP', description: err.message, variant: 'destructive' });
    },
  });

  const [verifyOtp, { loading: verifying }] = useMutation(VERIFY_PHONE_OTP, {
    onCompleted: (data) => {
      if (data.verifyPhoneOtp) {
        setStep('success');
        onVerified?.();
      } else {
        toast({ title: 'Invalid OTP', description: 'The code you entered is incorrect.', variant: 'destructive' });
      }
    },
    onError: (err) => {
      toast({ title: 'Verification failed', description: err.message, variant: 'destructive' });
    },
  });

  function handleClose(o: boolean) {
    if (!o) {
      setStep('phone');
      setPhoneNumber('');
      setOtp('');
    }
    onOpenChange(o);
  }

  function handleSendOtp() {
    if (!phoneNumber.trim()) return;
    sendOtp({ variables: { phoneNumber } });
  }

  function handleVerify() {
    if (!otp.trim()) return;
    verifyOtp({ variables: { code: otp } });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Verification
          </DialogTitle>
          <DialogDescription>
            {step === 'phone' && 'Enter your phone number to receive a one-time code.'}
            {step === 'otp' && `Enter the 6-digit code sent to ${phoneNumber}.`}
            {step === 'success' && 'Your phone number has been verified.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'phone' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="phone-input">Phone Number (E.164 format)</Label>
              <Input
                id="phone-input"
                type="tel"
                placeholder="+1234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Include country code, e.g. +1 for US
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendOtp} disabled={sending || !phoneNumber.trim()}>
                {sending ? 'Sending…' : 'Send OTP'}
              </Button>
            </div>
          </div>
        )}

        {step === 'otp' && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="otp-input">6-Digit Code</Label>
              <Input
                id="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="123456"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                className="mt-1.5 text-center text-lg tracking-widest font-mono"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              />
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setOtp('');
                  setStep('phone');
                }}
              >
                Use a different number
              </button>
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={handleSendOtp}
                disabled={sending}
              >
                {sending ? 'Resending…' : 'Resend code'}
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleVerify} disabled={verifying || otp.length !== 6}>
                {verifying ? 'Verifying…' : 'Verify'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
            <p className="text-sm font-medium">Phone verified successfully!</p>
            <Button onClick={() => handleClose(false)} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
