# 🚀 QUICK START GUIDE - VidyaMitra Subscription System

## ⚡ 2-Minute Setup

### Step 1: Environment Variables
Add these to your `.env` file:
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
```

**Get Your Keys:**
1. Go to https://dashboard.razorpay.com/
2. Sign Up / Login
3. Go to Settings → API Keys
4. Generate Test Keys (for development)
5. Copy Key ID and Key Secret

### Step 2: Run Database Migrations
1. Open Supabase Dashboard → SQL Editor
2. Open file: `supabase/subscription-schema.sql`
3. Copy all content
4. Paste in SQL Editor
5. Click "Run"

✅ **Done!** Your subscription system is now active.

---

## 🎯 How to Use

### For Admin:
1. Login as admin
2. Go to Admin Dashboard
3. Create institution account
4. Send credentials to institution

### For Institution:
1. Login with institution credentials
2. Click "Subscription" in sidebar
3. Choose a plan
4. Complete payment via Razorpay
5. Start using the system!

---

## 📊 How to Track Usage

Add this to your interview completion code:

```typescript
import { useUsageTracking } from '@/hooks/useUsageTracking';

const { trackInterviewCompletion } = useUsageTracking();

// After interview completes:
await trackInterviewCompletion(
  interviewId,
  'ai',      // Type: 'ai', 'company', 'mock', 'practice'
  false      // isVoice: true for voice interviews
);
```

**Add tracking to:**
- ✅ AI Interview completion
- ✅ Company Interview completion
- ✅ Mock Interview completion
- ✅ Practice Interview completion

---

## 🎨 What You Get

### 4 Subscription Plans:
1. **Starter** - ₹1,999/month
   - 100 students, 300 interviews

2. **Professional** - ₹4,999/month
   - 300 students, 900 interviews, 100 voice

3. **Enterprise** - ₹14,999/month
   - 1000 students, 3000 interviews, unlimited voice

4. **Mega** - ₹49,999/month
   - Unlimited everything

### Features:
✅ Beautiful pricing cards with animations
✅ Real-time usage tracking
✅ Progress bars with color alerts
✅ Razorpay payment integration
✅ Usage alerts at 80% threshold
✅ Responsive design
✅ Dark mode support
✅ Payment history
✅ Automatic renewal

---

## 🔥 Test Razorpay

### Test Card Details:
**Card Number:** 4111 1111 1111 1111
**CVV:** Any 3 digits
**Expiry:** Any future date
**Name:** Any name

### Test UPI:
**UPI ID:** success@razorpay

---

## 📁 New Files Created

```
✅ supabase/subscription-schema.sql
✅ server/subscriptionRoutes.ts
✅ src/lib/razorpayUtils.ts
✅ src/hooks/useUsageTracking.ts
✅ src/components/PlanCard.tsx
✅ src/components/UsageCard.tsx
✅ src/pages/SubscriptionPage.tsx
✅ Updated: src/lib/api.ts
✅ Updated: src/App.tsx
✅ Updated: src/components/Sidebar.tsx
✅ Updated: server/apiServer.ts
```

---

## ⚠️ Important Notes

### Development:
- Use **test keys** (starts with `rzp_test_`)
- Test mode payments are FREE

### Production:
- Switch to **live keys** (starts with `rzp_live_`)
- Configure webhook URL in Razorpay dashboard
- Enable HTTPS/SSL

---

## 🆘 Troubleshooting

### Payment not working?
1. Check Razorpay keys in `.env`
2. Verify keys start with `rzp_test_`
3. Check browser console for errors
4. Try test card: 4111 1111 1111 1111

### Usage not tracking?
1. Verify user has `institutionId`
2. Check if API endpoint is called
3. Look for errors in console
4. Verify database triggers ran successfully

### Page not showing?
1. Clear browser cache
2. Restart dev server: `npm run dev`
3. Check if route is added in App.tsx
4. Verify sidebar menu item is visible

---

## 📞 Need Help?

### Razorpay Support:
- Docs: https://razorpay.com/docs/
- Test Cards: https://razorpay.com/docs/payments/payments/test-card-details/

### Supabase Support:
- Docs: https://supabase.com/docs

---

## ✅ Verification Checklist

After setup, verify:
- [ ] Can login as institution
- [ ] "Subscription" menu visible in sidebar
- [ ] Can view all 4 pricing plans
- [ ] Can click "Choose Plan" button
- [ ] Razorpay modal opens
- [ ] Can complete test payment
- [ ] Usage cards show correct data
- [ ] Progress bars display properly
- [ ] Page is responsive on mobile

---

## 🎉 You're All Set!

Your institution subscription system is now fully operational with:
- ✅ Payment gateway integration
- ✅ Usage tracking
- ✅ Beautiful UI
- ✅ Real-time monitoring
- ✅ Automatic alerts

**Start accepting subscriptions and grow your platform!**
