import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { subscriptionsApi } from '@/lib/api';
import { initiateRazorpayPayment, formatAmount } from '@/lib/razorpayUtils';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import Layout from '@/components/Layout';
import PlanCard from '@/components/PlanCard';
import UsageCard from '@/components/UsageCard';
import { Calendar, CreditCard, AlertTriangle, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  priceMonthly: number;
  maxStudents: number;
  maxInterviewsMonthly: number;
  maxVoiceInterviewsMonthly: number;
  features: string[];
  supportLevel: string;
  supportResponseTime: string;
  hasAnalytics: boolean;
  hasReports: boolean;
  hasApiAccess: boolean;
  hasWebhooks: boolean;
  hasCustomBranding: boolean;
  hasDedicatedServer: boolean;
  hasWhiteLabel: boolean;
}

interface Subscription {
  id: string;
  planId: string;
  planName: string;
  status: string;
  priceMonthly: number;
  maxStudents: number;
  maxInterviewsMonthly: number;
  maxVoiceInterviewsMonthly: number;
  features: string[];
  supportLevel: string;
  supportResponseTime: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
}

interface Usage {
  studentsCount: number;
  interviewsCount: number;
  voiceInterviewsCount: number;
  completedInterviews: number;
  averageScore: number;
  studentsPercentage: number;
  interviewsPercentage: number;
  voiceInterviewsPercentage: number;
}

interface Limits {
  maxStudents: number;
  maxInterviewsMonthly: number;
  maxVoiceInterviewsMonthly: number;
}

const SubscriptionPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [limits, setLimits] = useState<Limits | null>(null);
  const [loading, setLoading] = useState(true);
  const [subscribing, setSubscribing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch all data in parallel
      const [plansData, subscriptionData, usageData] = await Promise.all([
        subscriptionsApi.getPlans(),
        subscriptionsApi.getInstitutionSubscription(),
        subscriptionsApi.getUsage(),
      ]);

      setPlans(plansData.plans || []);
      setSubscription(subscriptionData.subscription || null);
      setUsage(usageData.usage || null);
      setLimits(usageData.limits || null);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load subscription data';
      console.error('Error fetching subscription data:', error);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    if (subscribing) return;

    try {
      setSubscribing(true);

      // Create/update subscription
      const response = await subscriptionsApi.subscribe(planId);

      // For demo purposes using test Razorpay key
      // In production, get this from environment variable
      const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXX';

      // Initiate Razorpay payment
      await initiateRazorpayPayment(
        {
          amount: response.amount,
          planName: response.planName,
          institutionName: user?.institutionName || user?.name || 'Institution',
          institutionEmail: user?.email || '',
          subscriptionId: response.subscriptionId,
          razorpayKeyId: RAZORPAY_KEY_ID,
        },
        (razorpayResponse) => {
          // Payment successful
          toast({
            title: 'Payment Successful!',
            description: `You have successfully subscribed to the ${response.planName} plan.`,
          });
          
          // Refresh data
          fetchData();
        },
        () => {
          // Payment failed or cancelled
          toast({
            title: 'Payment Cancelled',
            description: 'Your payment was cancelled. Please try again.',
            variant: 'destructive',
          });
        }
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to process subscription';
      console.error('Error subscribing:', error);
      toast({
        title: 'Subscription Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSubscribing(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Loading subscription data...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const showUsageWarning = usage && (
    usage.studentsPercentage >= 80 || 
    usage.interviewsPercentage >= 80 || 
    usage.voiceInterviewsPercentage >= 80
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/10">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
              Subscription Management
            </h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage your institution's subscription plan and monitor usage
          </p>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="usage">Usage</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Usage Warning Alert */}
            {showUsageWarning && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <AlertDescription className="text-orange-800 dark:text-orange-200">
                    You have used {Math.max(usage.studentsPercentage, usage.interviewsPercentage, usage.voiceInterviewsPercentage).toFixed(0)}% 
                    of your monthly quota. Consider upgrading your plan to avoid service disruption.
                  </AlertDescription>
                </Alert>
              </motion.div>
            )}

            {/* Current Plan Card */}
            {subscription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Card className="border-primary/20 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-2xl flex items-center gap-3">
                          {subscription.planName}
                          <Badge className="bg-green-100 text-green-700 border-green-200">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        </CardTitle>
                        <CardDescription className="text-base mt-2">
                          Your current subscription plan
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                          {formatAmount(subscription.priceMonthly)}
                        </div>
                        <div className="text-sm text-muted-foreground">per month</div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Next Billing</div>
                          <div className="font-semibold">
                            {new Date(subscription.nextBillingDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Auto Renew</div>
                          <div className="font-semibold">
                            {subscription.autoRenew ? 'Enabled' : 'Disabled'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <div className="text-sm text-muted-foreground">Support</div>
                          <div className="font-semibold">{subscription.supportLevel}</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Usage Overview */}
            {usage && limits && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <UsageCard
                    title="Students"
                    current={usage.studentsCount}
                    max={limits.maxStudents}
                    percentage={usage.studentsPercentage}
                    icon="students"
                    description="Active students"
                  />
                  <UsageCard
                    title="Interviews"
                    current={usage.interviewsCount}
                    max={limits.maxInterviewsMonthly}
                    percentage={usage.interviewsPercentage}
                    icon="interviews"
                    description="This month"
                  />
                  <UsageCard
                    title="Voice Interviews"
                    current={usage.voiceInterviewsCount}
                    max={limits.maxVoiceInterviewsMonthly}
                    percentage={usage.voiceInterviewsPercentage}
                    icon="voice"
                    description="This month"
                  />
                  <UsageCard
                    title="Average Score"
                    current={Math.round(usage.averageScore || 0)}
                    max={100}
                    percentage={(usage.averageScore || 0)}
                    icon="score"
                    description="Overall performance"
                  />
                </div>
              </motion.div>
            )}

            {/* No Subscription Message */}
            {!subscription && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="border-dashed">
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Active Subscription</h3>
                    <p className="text-muted-foreground text-center mb-6">
                      Choose a plan to unlock VidyaMitra's full potential for your institution
                    </p>
                    <button
                      onClick={() => setActiveTab('plans')}
                      className="px-6 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg hover:shadow-lg transition-all"
                    >
                      View Plans
                    </button>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-2">Choose Your Plan</h2>
              <p className="text-muted-foreground">
                Select the perfect plan for your institution's needs
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  currentPlan={subscription?.planId}
                  onSelectPlan={handleSelectPlan}
                  loading={subscribing}
                />
              ))}
            </div>
          </TabsContent>

          {/* Usage Tab */}
          <TabsContent value="usage" className="space-y-6">
            {usage && limits ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <UsageCard
                    title="Students"
                    current={usage.studentsCount}
                    max={limits.maxStudents}
                    percentage={usage.studentsPercentage}
                    icon="students"
                    description="Active students enrolled"
                  />
                  <UsageCard
                    title="Total Interviews"
                    current={usage.interviewsCount}
                    max={limits.maxInterviewsMonthly}
                    percentage={usage.interviewsPercentage}
                    icon="interviews"
                    description="Interviews this month"
                  />
                  <UsageCard
                    title="Voice Interviews"
                    current={usage.voiceInterviewsCount}
                    max={limits.maxVoiceInterviewsMonthly}
                    percentage={usage.voiceInterviewsPercentage}
                    icon="voice"
                    description="Voice-based interviews"
                  />
                </div>

                {/* Detailed Stats */}
                <Card>
                  <CardHeader>
                    <CardTitle>Usage Statistics</CardTitle>
                    <CardDescription>Detailed breakdown of your institution's usage</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Completed Interviews</span>
                          <span className="font-semibold text-lg">{usage.completedInterviews}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Average Score</span>
                          <span className="font-semibold text-lg">{usage.averageScore.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Students Enrolled</span>
                          <span className="font-semibold text-lg">{usage.studentsCount}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Remaining Interviews</span>
                          <span className="font-semibold text-lg">
                            {limits.maxInterviewsMonthly === 999999 
                              ? 'Unlimited' 
                              : limits.maxInterviewsMonthly - usage.interviewsCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-muted-foreground">No usage data available</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SubscriptionPage;
