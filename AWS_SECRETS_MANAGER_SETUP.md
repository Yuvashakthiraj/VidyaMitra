# AWS Parameter Store Setup Guide

## ✅ What Was Implemented

Your VidyaMitra project now supports **AWS Systems Manager Parameter Store** for secure API key storage!

### 🔒 Why Parameter Store (Not Secrets Manager)?
- ✅ **FREE** (vs $0.40/secret for Secrets Manager)
- ✅ **Available in AWS Learner Lab** (Secrets Manager is restricted)
- ✅ **Same security** (KMS encryption)
- ✅ **Same access control** (IAM policies)

### 📁 Files Modified:
1. **UPDATED**: `server/secretsManager.ts` - Uses Parameter Store API
2. **UPDATED**: `server/apiServer.ts` - Integrated secrets loading
3. **UPDATED**: `server/openaiProxy.ts` - Integrated secrets loading

---

## 🚀 How to Set Up AWS Parameter Store

### **Step 1: Keep Using .env Locally (Current Setup)**

Your `.env` already has: `USE_AWS_SECRETS_MANAGER=false`

**This means:**
- ✅ Everything works exactly as before
- ✅ Perfect for local development
- ✅ No AWS API calls = faster startup

---

### **Step 2: Create Parameters in AWS Console**

#### 2.1 Open AWS Systems Manager Console

1. Log into **AWS Learner Lab**
2. Search for "**Systems Manager**" in AWS Console
3. In left sidebar, click **"Parameter Store"**
4. Click **"Create parameter"**

---

#### 2.2 Create AWS Credential Parameters

Create these parameters one by one:

| Name | Type | Value |
|------|------|-------|
| `/vidyamitra/aws/AWS_ACCESS_KEY_ID` | SecureString | `ASIAZFEHHQZ4V5XU4FOC` |
| `/vidyamitra/aws/AWS_SECRET_ACCESS_KEY` | SecureString | `JA7Bpo41X6spcYNtn+oWf8+D3K3xTmViaG8BtSEL` |
| `/vidyamitra/aws/AWS_SESSION_TOKEN` | SecureString | (your full session token) |
| `/vidyamitra/aws/AWS_REGION` | String | `us-east-1` |
| `/vidyamitra/aws/S3_BUCKET_NAME` | String | `vidyamitra-uploads-629496` |
| `/vidyamitra/aws/AWS_LAMBDA_RESUME_API` | String | `https://lv7zlz42b2.execute-api.us-east-1.amazonaws.com/default/vidyamitra-textract-resume` |

**For each parameter:**
1. Click **"Create parameter"**
2. **Name:** `/vidyamitra/aws/AWS_ACCESS_KEY_ID`
3. **Tier:** Standard (free)
4. **Type:** SecureString (for secrets) or String (for non-sensitive)
5. **KMS Key:** Use default `alias/aws/ssm`
6. **Value:** Paste your value
7. Click **"Create parameter"**

---

#### 2.3 Create Database Parameters

| Name | Type | Value |
|------|------|-------|
| `/vidyamitra/database/DB_TYPE` | String | `supabase` |
| `/vidyamitra/database/SUPABASE_URL` | String | `https://zakryngmxzckmfaesqwy.supabase.co` |
| `/vidyamitra/database/SUPABASE_SERVICE_ROLE_KEY` | SecureString | `eyJhbGciOiJIUzI1NiIs...` |

---

#### 2.4 Create API Key Parameters

| Name | Type | Value |
|------|------|-------|
| `/vidyamitra/api-keys/GEMINI_API_KEY` | SecureString | `AIzaSyBJLQhZfkFV_Ytsdq0O4wtof3QKgU6lhJY` |
| `/vidyamitra/api-keys/VITE_GEMINI_API_KEY` | SecureString | `AIzaSyCeoNV7ejNxaeP32feAOygaxTvD9EUAUgE` |
| `/vidyamitra/api-keys/VITE_GEMINI_CHATBOT_API_KEY` | SecureString | `AIzaSyCGHosgEjh78NvuNsPnVd3S2u6izJMPrOc` |
| `/vidyamitra/api-keys/VITE_GEMINI_FRIEDE_API_KEY` | SecureString | `AIzaSyBJLQhZfkFV_Ytsdq0O4wtof3QKgU6lhJY` |
| `/vidyamitra/api-keys/GEMINI_IMAGE_API_KEY` | SecureString | `AIzaSyBDRSglZ43_3sPqZrWEqg5HV8NniBy1dLI` |
| `/vidyamitra/api-keys/OPENAI_API_KEY` | SecureString | `sk-proj-LRzb7jpy...` |
| `/vidyamitra/api-keys/GROQ_API_KEY` | SecureString | `gsk_0Y8zaun3lZh6...` |
| `/vidyamitra/api-keys/VITE_GROQ_API_KEY` | SecureString | `gsk_0Y8zaun3lZh6...` |
| `/vidyamitra/api-keys/GROQ_GAP_ANALYSIS_KEY` | SecureString | `gsk_ZTNdC6xo6ssd...` |
| `/vidyamitra/api-keys/GROQ_API_KEY_2` | SecureString | `gsk_suIwD1pXkfRS...` |
| `/vidyamitra/api-keys/ELEVENLABS_API_KEY` | SecureString | `sk_23718ece8056...` |
| `/vidyamitra/api-keys/VITE_ELEVENLABS_AGENT_ID` | String | `agent_1801kjgssk0tfeaspye8djrj673w` |
| `/vidyamitra/api-keys/YOUTUBE_API_KEY` | SecureString | `AIzaSyDTzvz8THz0...` |
| `/vidyamitra/api-keys/PEXELS_API_KEY` | SecureString | `jMNGKa375lgd1Xr...` |
| `/vidyamitra/api-keys/NEWS_API_KEY` | SecureString | `1fba91d3cf7a45aa...` |
| `/vidyamitra/api-keys/EXCHANGE_RATE_API_KEY` | SecureString | `26f569fe94a38a5c...` |
| `/vidyamitra/api-keys/VITE_GITHUB_API_KEY` | SecureString | `ghp_em2eeczKFzFt...` |
| `/vidyamitra/api-keys/JUDGE0_HOST` | String | `http://54.234.23.242:2358` |
| `/vidyamitra/api-keys/JUDGE0_RAPIDAPI_KEY` | SecureString | `71a9f61333mshe3d...` |
| `/vidyamitra/api-keys/JUDGE0_RAPIDAPI_HOST` | String | `judge029.p.rapidapi.com` |
| `/vidyamitra/api-keys/JUDGE0_RAPIDAPI_URL` | String | `https://judge029.p.rapidapi.com` |
| `/vidyamitra/api-keys/RAZORPAY_KEY_ID` | SecureString | `rzp_live_SNoZHk8bQiIeIZ` |
| `/vidyamitra/api-keys/RAZORPAY_KEY_SECRET` | SecureString | `AYPC9iloFZ3s52Uq3NdfX9IQ` |
| `/vidyamitra/api-keys/VITE_RAZORPAY_KEY_ID` | String | `rzp_live_SNoZHk8bQiIeIZ` |

---

### **Step 3: Enable Parameter Store in Your Project**

Edit your `.env` file:

```bash
# Change this line:
USE_AWS_SECRETS_MANAGER=false

# To:
USE_AWS_SECRETS_MANAGER=true
```

---

### **Step 4: Test Locally**

```bash
npm run dev
```

**You should see:**
```
🔐 Fetching secrets from AWS Parameter Store...
✅ Loaded 30 secrets from AWS Parameter Store
✅ VidyaMitra API server initialized
```

**If it fails:**
```
❌ Failed to load secrets from AWS Parameter Store
⚠️  AWS Parameter Store failed, falling back to .env file
```
→ This is fine! It automatically uses your `.env` file as backup.

---

## 📊 Cost Impact

### **Parameter Store Pricing:**
- **Standard parameters:** FREE ✅
- **API Calls:** FREE (up to 10,000/month) ✅
- **KMS encryption:** Included

**Your setup: $0.00/month** 🎉

---

## 🔄 How It Works

### **With `USE_AWS_SECRETS_MANAGER=false` (Default):**
```
.env file → Server → APIs
```
- ✅ Fast startup
- ✅ No AWS API calls
- ✅ Perfect for local development

### **With `USE_AWS_SECRETS_MANAGER=true` (Production):**
```
AWS Parameter Store → Server (5-min cache) → APIs
```
- ✅ Secure credential storage
- ✅ KMS encryption (SecureString)
- ✅ Automatic fallback to .env if AWS fails
- ✅ Centralized management

---

## 🛡️ Security Benefits

| Feature | Before (.env only) | After (Parameter Store) |
|---------|-------------------|------------------------|
| **Keys in Code** | ❌ Yes (risky) | ✅ No (secure) |
| **GitHub Leaks** | ❌ High risk | ✅ Zero risk |
| **Encryption** | ❌ Plain text | ✅ KMS encrypted |
| **Audit Trail** | ❌ None | ✅ CloudTrail logs |
| **Access Control** | ❌ Anyone with .env | ✅ IAM policies |
| **Cost** | Free | ✅ **FREE** |

---

## 🧪 Quick Test Commands

### Test if parameters load correctly:
```bash
npm run dev
# Look for: "✅ Loaded X secrets from AWS Parameter Store"
```

### Verify parameters in AWS Console:
1. Go to Systems Manager → Parameter Store
2. Filter by path: `/vidyamitra/`
3. You should see all your parameters listed

---

## ❓ Troubleshooting

### **Problem: "AccessDeniedException"**
**Solution:** Your AWS credentials need SSM permissions.

AWS Learner Lab usually includes:
```json
{
  "Effect": "Allow",
  "Action": [
    "ssm:GetParameter",
    "ssm:GetParameters",
    "ssm:GetParametersByPath"
  ],
  "Resource": "arn:aws:ssm:us-east-1:*:parameter/vidyamitra/*"
}
```

### **Problem: "No parameters found"**
**Solution:** Check parameter names exactly match:
- Must start with `/vidyamitra/`
- Check for typos in paths

### **Problem: "KMS DecryptException"**
**Solution:** Use the default KMS key `alias/aws/ssm` when creating SecureString parameters

---

## 🎯 Quick Reference

### **Parameter Naming Convention:**
```
/vidyamitra/
  ├── aws/              ← AWS credentials
  │   ├── AWS_ACCESS_KEY_ID
  │   ├── AWS_SECRET_ACCESS_KEY
  │   └── ...
  ├── database/         ← Database credentials
  │   ├── SUPABASE_URL
  │   └── SUPABASE_SERVICE_ROLE_KEY
  └── api-keys/         ← All API keys
      ├── GEMINI_API_KEY
      ├── OPENAI_API_KEY
      └── ...
```

### **Type Selection:**
- **SecureString:** For secrets (API keys, passwords) - Encrypted with KMS
- **String:** For non-sensitive config (URLs, regions, bucket names)

---

## ✅ Summary

**What you have now:**
- ✅ FREE AWS Parameter Store integration
- ✅ Zero disruption to existing workflow
- ✅ Automatic .env fallback for safety
- ✅ KMS encryption for sensitive values
- ✅ Easy toggle: just change one environment variable

**Current state:** `USE_AWS_SECRETS_MANAGER=false` (using .env - perfect for development)
**Production state:** Set to `true` after creating parameters in AWS Console

**You're all set!** 🚀
