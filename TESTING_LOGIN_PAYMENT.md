# ✅ LOGIN & PAYMENT TESTING GUIDE

## 🐛 Issue Fixed
**Error:** `Failed to load resource: the server responded with a status of 500 (Internal Server Error)`  
**Root Cause:** Database column type mismatch - `is_active` column was INTEGER but queries used boolean TRUE  
**Solution:** Changed all queries from `is_active = TRUE` to `is_active = 1`

---

## 🧪 Testing the Login Fix

### 1. Student Login
Navigate to: http://localhost:8080/login

**Test Credentials** (if you have user data):
```
Email: your-test-email@example.com
Password: your-password
```

### 2. Institution Login
Navigate to: http://localhost:8080/login
1. Click the "Institution" button
2. The dropdown should now show all active institutions (no more 500 error!)
3. Select an institution from the list

**Available Test Institutions** (from your database):
- VIT Bhopal University (VITBHO) 
- IIT Delhi (IITD)
- BITS Pilani (BITS)
- Anna University (AU)
- NIT Trichy (NITT)
- Tech Mahindra (TM)
- Wipro Technologies (WIPRO)
- Mailam Engineering College (MEC)

**Institution Login Credentials:**
```
Institution: Select from dropdown
Password: [The password set during institution creation]
```

**Note:** If you don't know the institution passwords, you'll need to:
1. Create a new institution via the admin panel
2. Or reset the password using the admin dashboard
3. Or check your initial seed data

---

## 💳 Testing Payment Integration

### Setup Razorpay Test Mode

Your `.env` already has Razorpay keys configured:
```env
RAZORPAY_KEY_ID=rzp_live_SNoZHk8bQiIeIZ 
RAZORPAY_KEY_SECRET=AYPC9iloFZ3s52Uq3NdfX9IQ
VITE_RAZORPAY_KEY_ID=rzp_live_SNoZHk8bQiIeIZ
```

⚠️ **IMPORTANT:** These are LIVE keys! For testing, use TEST keys instead:
1. Go to https://dashboard.razorpay.com/
2. Switch to "Test Mode" (top left toggle)
3. Get your test keys from Settings > API Keys
4. Replace in `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
   RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
   VITE_RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXX
   ```

### Test Payment Flow

1. **Login as Institution:**
   - Navigate to http://localhost:8080/login
   - Select "Institution" login type
   - Choose an institution from dropdown
   - Enter password and login

2. **Access Subscription Page:**
   - Should redirect to `/institution/dashboard`
   - Look for "Subscription" or "Plans" section
   - Click to view available plans

3. **Select a Plan:**
   - Choose any subscription plan
   - Click "Subscribe" or "Choose Plan"

4. **Test Payment with Razorpay:**
   
   **Test Card Details** (for successful payment):
   ```
   Card Number: 4111 1111 1111 1111
   CVV: Any 3 digits
   Expiry: Any future date
   Name: Any name
   ```

   **Test UPI** (for successful payment):
   ```
   UPI ID: success@razorpay
   ```

   **Test Card for Failure** (to test error handling):
   ```
   Card Number: 4000 0000 0000 0002
   CVV: Any 3 digits
   Expiry: Any future date
   ```

5. **Verify Payment Success:**
   - After payment, you should be redirected back
   - Subscription status should update
   - Check institution dashboard for active subscription

### Payment Endpoints

All these endpoints should be working:
- `GET /api/subscription/plans` - Get available plans ✅
- `POST /api/institution/subscribe` - Create subscription ✅
- `GET /api/institution/subscription` - Get current subscription ✅
- `GET /api/institution/usage` - Get usage statistics ✅
- `POST /api/payments/razorpay/webhook` - Razorpay webhook ✅

---

## 🔍 Debugging Tips

### Check Server Logs
The server terminal will show:
```
✅ Database mode: SUPABASE
✅ VidyaMitra API server initialized
```

### Check Browser Console
1. Open DevTools (F12)
2. Go to Console tab
3. Look for any errors when:
   - Loading login page
   - Fetching institutions
   - Making payments

### Test API Directly

**Test institutions list:**
```bash
curl http://localhost:8080/api/institutions/list
```

Should return JSON with institutions array.

**Test subscription plans:**
```bash
curl http://localhost:8080/api/subscription/plans
```

Should return available subscription plans.

---

## 📋 Quick Checklist

- [x] Fix database boolean query issue
- [x] Restart development server
- [ ] Test student login
- [ ] Test institution login (verify dropdown loads)
- [ ] Switch Razorpay to test mode
- [ ] Test payment flow with test card
- [ ] Verify subscription activation
- [ ] Check usage tracking

---

## 🆘 Common Issues

### Issue: "Invalid credentials" for institution
**Solution:** Use the admin panel to create a new test institution or reset password

### Issue: Razorpay modal not opening
**Solution:** Check browser console for script loading errors. Ensure `VITE_RAZORPAY_KEY_ID` is set correctly

### Issue: Payment succeeds but subscription not activated
**Solution:** Check server logs for webhook errors. Razorpay webhook URL should be configured in Razorpay dashboard

### Issue: Still seeing 500 error
**Solution:** 
1. Ensure server is restarted
2. Check if database has institutions with `is_active = 1`
3. Check server terminal for detailed error messages

---

## 🎯 Next Steps After Testing

1. **Switch to Production Keys** (when ready to go live)
2. **Set up Razorpay Webhook** in production:
   - Razorpay Dashboard > Webhooks > Add Webhook
   - URL: `https://your-domain.com/api/payments/razorpay/webhook`
   - Events: `payment.captured`, `subscription.activated`, `subscription.charged`, etc.

3. **Test with Real Institution**
4. **Monitor Payment Logs**
5. **Set up Email Notifications** for successful payments

---

## 📞 Support

If you encounter any issues:
1. Check the error in browser console
2. Check server terminal logs
3. Verify database connections
4. Ensure all environment variables are set correctly

**Server is now running at:** http://localhost:8080/
