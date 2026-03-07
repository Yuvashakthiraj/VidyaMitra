# 🎯 VidyaMitra Subscription System - Visual Guide

## 🏗️ System Architecture Diagram

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    VIDYAMITRA SUBSCRIPTION SYSTEM            ┃
┃                     Complete Architecture                     ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐ │
│  │  Sidebar Menu  │  │ Subscription   │  │   PlanCard   │ │
│  │   Component    │──│     Page       │──│  Component   │ │
│  │  [CreditCard]  │  │  [3 Tabs]      │  │  [Gradient]  │ │
│  └────────────────┘  └────────────────┘  └──────────────┘ │
│                             │                              │
│                             │                              │
│                      ┌──────▼──────┐                       │
│                      │  UsageCard  │                       │
│                      │  Component  │                       │
│                      │ [Progress]  │                       │
│                      └─────────────┘                       │
│                                                             │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           │ API Calls (subscriptionsApi)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      API LAYER                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  GET  /api/subscription/plans                              │
│  GET  /api/institution/subscription                        │
│  GET  /api/institution/usage                               │
│  POST /api/institution/subscribe                           │
│  POST /api/institution/track-interview                     │
│  POST /api/payments/razorpay/webhook                       │
│  GET  /api/institution/payment-history                     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │     subscriptionRoutes.ts (API Logic)                 │  │
│  │     - Plan management                                 │  │
│  │     - Subscription CRUD                               │  │
│  │     - Usage tracking                                  │  │
│  │     - Payment processing                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└──────────────────┬──────────────────┬───────────────────────┘
                   │                  │
         ┌─────────▼─────────┐       │
         │   Razorpay API    │       │
         │  Payment Gateway   │       │
         │  ┌──────────────┐ │       │
         │  │ Test Mode    │ │       │
         │  │ Live Mode    │ │       │
         │  │ Webhooks     │ │       │
         │  └──────────────┘ │       │
         └───────────────────┘       │
                                     │
                   ┌─────────────────▼──────────────────────┐
                   │         DATABASE LAYER                  │
                   ├─────────────────────────────────────────┤
                   │   Supabase PostgreSQL                   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  subscription_plans             │   │
                   │  │  - 4 Pre-configured Plans       │   │
                   │  │  - Features & Limits            │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  subscriptions                  │   │
                   │  │  - Active Subscriptions         │   │
                   │  │  - Plan Details                 │   │
                   │  │  - Billing Info                 │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  institution_usage              │   │
                   │  │  - Monthly Usage Tracking       │   │
                   │  │  - Student Count                │   │
                   │  │  - Interview Count              │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  payment_history                │   │
                   │  │  - Transaction Logs             │   │
                   │  │  - Invoice Data                 │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  usage_alerts                   │   │
                   │  │  - 80% Threshold Alerts         │   │
                   │  │  - Notification Status          │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   │  ┌─────────────────────────────────┐   │
                   │  │  Database Functions:            │   │
                   │  │  - increment_interview_usage()   │   │
                   │  │  - update_student_count()       │   │
                   │  │  - get_institution_usage()      │   │
                   │  └─────────────────────────────────┘   │
                   │                                         │
                   └─────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. Subscription Purchase Flow
```
Institution User                 VidyaMitra System           Razorpay
      │                                │                        │
      │  1. Clicks "Choose Plan"       │                        │
      ├────────────────────────────────▶                        │
      │                                │                        │
      │  2. Creates Subscription       │                        │
      │    (status: payment_pending)   │                        │
      │◀────────────────────────────────                        │
      │                                │                        │
      │  3. Opens Payment Modal        │                        │
      │◀────────────────────────────────                        │
      │                                │                        │
      │  4. Processes Payment          │                        │
      ├─────────────────────────────────────────────────────────▶
      │                                │                        │
      │  5. Payment Success            │                        │
      │◀─────────────────────────────────────────────────────────│
      │                                │                        │
      │  6. Webhook Notification       │                        │
      │                                │◀───────────────────────│
      │                                │                        │
      │  7. Updates Subscription       │                        │
      │    (status: active)            │                        │
      │◀────────────────────────────────                        │
      │                                │                        │
      │  8. Shows Success Message      │                        │
      │◀────────────────────────────────                        │
      │                                │                        │
```

### 2. Usage Tracking Flow
```
Student                    Interview System         Usage Tracking
  │                              │                        │
  │  1. Completes Interview      │                        │
  ├──────────────────────────────▶                        │
  │                              │                        │
  │                              │  2. Track Usage API    │
  │                              ├────────────────────────▶
  │                              │                        │
  │                              │  3. Increment Counter  │
  │                              │    Update Database     │
  │                              │◀────────────────────────
  │                              │                        │
  │                              │  4. Check Threshold    │
  │                              │    (80% warning?)      │
  │                              │                        │
  │                              │  5. Create Alert?      │
  │                              │◀────────────────────────
  │                              │                        │
  │  6. Continue Interview Flow  │                        │
  │◀──────────────────────────────                        │
  │                              │                        │
```

### 3. Usage Alert Flow
```
Background Job              Usage Monitor           Institution Admin
      │                          │                        │
      │  1. Check Usage          │                        │
      ├──────────────────────────▶                        │
      │                          │                        │
      │  2. Usage > 80%?         │                        │
      │  Yes!                    │                        │
      │◀──────────────────────────                        │
      │                          │                        │
      │  3. Create Alert         │                        │
      ├──────────────────────────▶                        │
      │                          │                        │
      │                          │  4. Show Alert Banner  │
      │                          ├────────────────────────▶
      │                          │                        │
      │                          │  5. View Subscription  │
      │                          │◀────────────────────────
      │                          │                        │
      │                          │  6. Consider Upgrade   │
      │                          │                        │
```

---

## 📱 User Interface Flow

### Institution Dashboard Navigation
```
┌─────────────────────────────────────────────────────────┐
│  VidyaMitra Logo        [Dark Mode]  [Profile] [Logout] │
├─────────────────────────────────────────────────────────┤
│ Sidebar                 │  Main Content Area            │
├─────────────────────────┼───────────────────────────────┤
│                         │                               │
│ ► Dashboard             │  [Current Content]            │
│                         │                               │
│ ► Subscription  ◄───────┼──┐                            │
│   (New Menu Item)       │  │ Clicks Here                │
│                         │  │                            │
│ ► Students              │  ▼                            │
│                         │                               │
│ ► Analytics             │  Subscription Page Loads      │
│                         │  ┌──────────────────────┐     │
│                         │  │  Tab: Overview       │     │
│                         │  │  Tab: Plans          │     │
│                         │  │  Tab: Usage          │     │
│                         │  └──────────────────────┘     │
│                         │                               │
│                         │  Current Plan Card            │
│                         │  ┌──────────────────────┐     │
│                         │  │ Professional ✅       │     │
│                         │  │ ₹4,999/month         │     │
│                         │  │ Next: Jan 15, 2026   │     │
│                         │  └──────────────────────┘     │
│                         │                               │
│                         │  Usage Cards Grid             │
│                         │  [Students] [Interviews]      │
│                         │  [Voice] [Score]              │
│                         │                               │
└─────────────────────────┴───────────────────────────────┘
```

### Subscription Plans Page
```
┌─────────────────────────────────────────────────────────────┐
│           Choose Your Subscription Plan                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ STARTER  │  │   PRO    │  │ENTERPRISE│  │   MEGA   │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │ ₹1,999   │  │ ₹4,999   │  │ ₹14,999  │  │ ₹49,999  │  │
│  │ /month   │  │ /month   │  │ /month   │  │ /month   │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │ 100      │  │ 300      │  │ 1,000    │  │Unlimited │  │
│  │ Students │  │ Students │  │ Students │  │ Students │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │ 300      │  │ 900      │  │ 3,000    │  │Unlimited │  │
│  │Interviews│  │Interviews│  │Interviews│  │Interviews│  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │ ✓ Basic  │  │ ✓ Adv.   │  │ ✓ API    │  │ ✓ Dedic. │  │
│  │Dashboard │  │Analytics │  │ Access   │  │ Server   │  │
│  │          │  │ ✓ Reports│  │ ✓ Custom │  │ ✓ White  │  │
│  │          │  │ ✓ Voice  │  │ Brand    │  │ Label    │  │
│  ├──────────┤  ├──────────┤  ├──────────┤  ├──────────┤  │
│  │[Choose]  │  │[Current] │  │[Choose]  │  │[Choose]  │  │
│  │  Plan    │  │  Plan ✓  │  │  Plan    │  │  Plan    │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Usage Monitoring Dashboard
```
┌─────────────────────────────────────────────────────────────┐
│           Usage Statistics - Current Month                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ Alert: 85% of your monthly quota used!                  │
│     Consider upgrading your plan.                           │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │ 👥 Students         │  │ 📄 Interviews       │         │
│  │                     │  │                     │         │
│  │ 250 / 300           │  │ 765 / 900           │         │
│  │ ████████████░░░ 83% │  │ ████████████░░░ 85% │         │
│  │                     │  │                     │         │
│  │ 50 remaining        │  │ 135 remaining       │         │
│  └─────────────────────┘  └─────────────────────┘         │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │ 🎙️ Voice Interviews │  │ 📊 Avg Score        │         │
│  │                     │  │                     │         │
│  │ 42 / 100            │  │ 78 / 100            │         │
│  │ ███████░░░░░░░░░ 42%│  │ ████████████░░ 78%  │         │
│  │                     │  │                     │         │
│  │ 58 remaining        │  │ Performance Good    │         │
│  └─────────────────────┘  └─────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Scheme Guide

### Plan Colors (Gradients)
```
Starter:       🔵 Blue → Cyan
               from-blue-500 to-cyan-500

Professional:  🟣 Purple → Pink
               from-purple-500 to-pink-500

Enterprise:    🟠 Orange → Red
               from-orange-500 to-red-500

Mega:          🟣 Violet → Purple
               from-violet-600 to-purple-600
```

### Usage Status Colors
```
Healthy:   🟢 Green   (0-60%)    bg-green-500
Monitor:   🟡 Yellow  (60-80%)   bg-yellow-500
Warning:   🟠 Orange  (80-90%)   bg-orange-500
Critical:  🔴 Red     (90-100%)  bg-red-500
```

---

## 📊 Database Entity Relationship

```
┌──────────────────────┐
│   institutions       │
│──────────────────────│
│ id (PK)              │
│ name                 │
│ email                │
│ password_hash        │
│ institution_code     │
│ student_count        │
└──────────────────────┘
         │
         │ 1:1
         ▼
┌──────────────────────┐       ┌──────────────────────┐
│   subscriptions      │ N:1   │ subscription_plans   │
│──────────────────────│───────│──────────────────────│
│ id (PK)              │       │ id (PK)              │
│ institution_id (FK)  │       │ name                 │
│ plan_id (FK) ─────────────────▶ price_monthly       │
│ status               │       │ max_students         │
│ next_billing_date    │       │ max_interviews       │
│ razorpay_sub_id      │       │ features             │
└──────────────────────┘       └──────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐       ┌──────────────────────┐
│ institution_usage    │       │ payment_history      │
│──────────────────────│       │──────────────────────│
│ id (PK)              │       │ id (PK)              │
│ institution_id (FK)  │       │ subscription_id (FK) │
│ month_year           │       │ razorpay_payment_id  │
│ students_count       │       │ amount               │
│ interviews_count     │       │ status               │
│ voice_count          │       │ payment_date         │
└──────────────────────┘       └──────────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────────┐
│   usage_alerts       │
│──────────────────────│
│ id (PK)              │
│ institution_id (FK)  │
│ alert_type           │
│ threshold_type       │
│ message              │
│ is_read              │
└──────────────────────┘
```

---

## 🔄 State Management Flow

```
Component State               React Query Cache           API Server
     │                              │                         │
     │  useEffect()                 │                         │
     │  fetchData()                 │                         │
     ├──────────────────────────────▶                         │
     │                              │                         │
     │                              │  Cache Miss             │
     │                              ├─────────────────────────▶
     │                              │                         │
     │                              │  API Response           │
     │                              │◀─────────────────────────
     │                              │                         │
     │                              │  Store in Cache         │
     │                              │  (5 min stale time)     │
     │  State Update                │                         │
     │◀──────────────────────────────                         │
     │                              │                         │
     │  Re-render                   │                         │
     │  Display Data                │                         │
     │                              │                         │
     │                              │                         │
     │  User Action                 │                         │
     │  (Subscribe)                 │                         │
     ├──────────────────────────────▶                         │
     │                              │  Send Request           │
     │                              ├─────────────────────────▶
     │                              │                         │
     │                              │  Success Response       │
     │                              │◀─────────────────────────
     │                              │                         │
     │                              │  Invalidate Cache       │
     │                              │  Trigger Refetch        │
     │  Fresh Data                  │                         │
     │◀──────────────────────────────                         │
     │                              │                         │
```

---

## 📱 Responsive Breakpoints

```
┌────────────────────────────────────────────────────────┐
│                  DESKTOP (1920px+)                      │
│  ┌────────────┬───────────────────────────────────┐    │
│  │  Sidebar   │  Content Area (4-column grid)     │    │
│  │  (Full)    │  [Plan] [Plan] [Plan] [Plan]      │    │
│  └────────────┴───────────────────────────────────┘    │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                  LAPTOP (1024px)                        │
│  ┌──────┬─────────────────────────────────────┐        │
│  │ Side │  Content (3-column grid)            │        │
│  │ bar  │  [Plan] [Plan] [Plan]               │        │
│  └──────┴─────────────────────────────────────┘        │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                  TABLET (768px)                         │
│  [☰]    Header                                          │
│  ┌──────────────────────────────────────────────┐      │
│  │  Content (2-column grid)                     │      │
│  │  ┌───────────┐  ┌───────────┐               │      │
│  │  │   Plan    │  │   Plan    │               │      │
│  │  └───────────┘  └───────────┘               │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│                  MOBILE (375px)                         │
│  [☰]    VidyaMitra                            [👤]     │
│  ┌──────────────────────────────────────────────┐      │
│  │  Content (1-column stack)                    │      │
│  │  ┌───────────────────────────────┐           │      │
│  │  │         Plan Card             │           │      │
│  │  └───────────────────────────────┘           │      │
│  │  ┌───────────────────────────────┐           │      │
│  │  │         Plan Card             │           │      │
│  │  └───────────────────────────────┘           │      │
│  └──────────────────────────────────────────────┘      │
└────────────────────────────────────────────────────────┘
```

---

## 🎯 Component Hierarchy

```
SubscriptionPage
│
├── Layout
│   ├── Sidebar (with "Subscription" menu)
│   └── Main Content
│
├── Header Section
│   ├── Title with icon
│   └── Description
│
├── Tabs Component
│   │
│   ├── Tab: Overview
│   │   ├── Usage Warning Alert (if 80%+)
│   │   ├── Current Plan Card
│   │   │   ├── Plan name & badge
│   │   │   ├── Price display
│   │   │   ├── Billing info
│   │   │   └── Support level
│   │   │
│   │   └── Usage Cards Grid
│   │       ├── UsageCard (Students)
│   │       ├── UsageCard (Interviews)
│   │       ├── UsageCard (Voice)
│   │       └── UsageCard (Score)
│   │
│   ├── Tab: Plans
│   │   ├── Section Header
│   │   └── Plans Grid
│   │       ├── PlanCard (Starter)
│   │       ├── PlanCard (Professional)
│   │       ├── PlanCard (Enterprise)
│   │       └── PlanCard (Mega)
│   │
│   └── Tab: Usage
│       ├── Usage Cards Grid
│       └── Detailed Statistics Card
│
└── Payment Modal (Razorpay)
    ├── Card Payment option
    ├── UPI option
    ├── Net Banking option
    └── Wallet option
```

---

## 🚀 Deployment Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    PRODUCTION SETUP                      │
└─────────────────────────────────────────────────────────┘

                      ┌───────────┐
                      │   CDN     │
                      │  Cloudflare│
                      └─────┬─────┘
                            │
                    ┌───────▼───────┐
                    │   Load        │
                    │   Balancer    │
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
        ┌─────▼─────┐ ┌────▼─────┐ ┌────▼─────┐
        │ Vite      │ │ Vite     │ │ Vite     │
        │ Instance1 │ │Instance2 │ │Instance3 │
        └─────┬─────┘ └────┬─────┘ └────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │  PostgreSQL │
                    │  (Managed)  │
                    └─────────────┘

External Services:
┌──────────────┐     ┌──────────────┐
│  Razorpay    │     │   Email      │
│  Gateway     │     │   Service    │
└──────────────┘     └──────────────┘
```

---

This visual guide provides a complete overview of the VidyaMitra Subscription System architecture, data flows, and user interface design. Use it as a reference for understanding how all components work together.
