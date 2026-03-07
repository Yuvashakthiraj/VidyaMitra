/**
 * AWSUsageDashboard
 *
 * Comprehensive AWS API usage & cost tracking panel for the Admin Dashboard.
 * Auto-detects all configured AWS services and shows live CloudWatch metrics,
 * usage totals, cost estimates, and health checks.
 */

import { useState, useCallback } from 'react';
import {
  Cloud, Zap, RefreshCw, CheckCircle2, XCircle, AlertCircle,
  HardDrive, BarChart2, Clock, DollarSign, Shield, Activity,
  Server, Package, Wifi, WifiOff, TrendingUp, ChevronDown, ChevronUp,
  Megaphone,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';

import { apiFetch } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────────

interface S3Stats {
  service: string;
  status: 'ok' | 'error';
  bucket: string;
  region: string;
  metrics: {
    objectCount: number;
    sizeGB: number;
    sizeMB: number;
    folderBreakdown: Record<string, { count: number; sizeBytes: number }>;
  };
  costs: { storageCostMonthly: number; freeTierNote: string };
  error?: string;
}

interface DailyPoint { date: string; value: number }

interface LambdaStats {
  service: string;
  status: 'ok' | 'error';
  functionName: string;
  apiId: string;
  stage: string;
  region: string;
  runtime: string;
  memoryMB: number;
  timeoutSec: number;
  lastModified: string;
  apiGatewayUrl: string;
  metrics: {
    invocations7d: number;
    errors7d: number;
    throttles7d: number;
    errorRate: number;
    avgDurationMs: number;
    apigwRequests7d: number;
    dailyInvocations: DailyPoint[];
  };
  costs: {
    lambdaMonthlyEstimate: number;
    textractMonthlyEstimate: number;
    totalMonthlyEstimate: number;
    freeTierNote: string;
  };
  error?: string;
}

interface ConfiguredService { name: string; envKey: string; configured: boolean; note: string }

interface HealthCheck { ok: boolean; detail: string }

interface SNSStats {
  service: string;
  status: 'ok' | 'error';
  region: string;
  metrics: {
    topicCount: number;
    totalSubscriptions: number;
    confirmedSubscriptions: number;
    pendingSubscriptions: number;
    messagesPublished7d: number;
    messagesFailed7d: number;
    emailDelivered7d: number;
    deliveryRate: number;
    dailyPublishes: DailyPoint[];
    topicDetails: Array<{
      topicArn: string;
      topicName: string;
      displayName: string;
      subscriptionsConfirmed: number;
      subscriptionsPending: number;
      subscriptionsDeleted: number;
    }>;
  };
  costs: {
    monthlyCostEstimate: number;
    freeTierNote: string;
  };
  error?: string;
}

interface UsageResponse {
  configured: boolean;
  region?: string;
  credentialsType?: string;
  budget?: number;
  isLearnerLab?: boolean;
  totalMonthlyCost?: number;
  remainingBudget?: number;
  configuredServices?: ConfiguredService[];
  services?: { s3: S3Stats | null; lambda: LambdaStats | null; sns: SNSStats | null };
  fetchedAt?: string;
  message?: string;
}

interface HealthResponse {
  checks: Record<string, HealthCheck>;
  checkedAt: string;
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function fetchUsage(): Promise<UsageResponse> {
  return apiFetch('/api/aws/usage');
}

async function fetchHealth(): Promise<HealthResponse> {
  return apiFetch('/api/aws/health');
}

// ── Tiny sparkline bar chart ───────────────────────────────────────────────────

function SparkBars({ data }: { data: DailyPoint[] }) {
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground italic">No chart data</p>;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-10 mt-1">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center group relative">
          <div
            className="w-full bg-yellow-400/80 hover:bg-yellow-400 rounded-sm transition-all"
            style={{ height: `${Math.max(2, (d.value / max) * 40)}px` }}
          />
          <div className="absolute bottom-full mb-1 hidden group-hover:block bg-card border text-xs px-1 py-0.5 rounded shadow whitespace-nowrap z-10">
            {d.date}: {d.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Metric Card ───────────────────────────────────────────────────────────────

function MetricCard({
  label, value, sub, color = 'blue',
}: { label: string; value: string | number; sub?: string; color?: string }) {
  const bg: Record<string, string> = {
    blue: 'bg-blue-950/20 border-blue-800/30',
    green: 'bg-green-950/20 border-green-800/30',
    yellow: 'bg-yellow-950/20 border-yellow-800/30',
    orange: 'bg-orange-950/20 border-orange-800/30',
    red: 'bg-red-950/20 border-red-800/30',
    purple: 'bg-purple-950/20 border-purple-800/30',
  };
  const txt: Record<string, string> = {
    blue: 'text-blue-400', green: 'text-green-400', yellow: 'text-yellow-400',
    orange: 'text-orange-400', red: 'text-red-400', purple: 'text-purple-400',
  };
  return (
    <div className={`rounded-lg border p-3 ${bg[color] ?? bg.blue}`}>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${txt[color] ?? txt.blue}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ── S3 Panel ───────────────────────────────────────────────────────────────────

function S3Panel({ data }: { data: S3Stats }) {
  const [showFolders, setShowFolders] = useState(false);
  const folders = Object.entries(data.metrics.folderBreakdown ?? {});

  return (
    <Card className="border-l-4 border-l-orange-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-orange-400" /> S3 Object Storage
          </CardTitle>
          <Badge variant="outline" className="text-orange-400 border-orange-600/40 text-[10px]">
            {data.region}
          </Badge>
        </div>
        <CardDescription className="text-[11px]">Bucket: {data.bucket}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.error && <p className="text-xs text-red-400">{data.error}</p>}

        <div className="grid grid-cols-3 gap-2">
          <MetricCard label="Objects" value={data.metrics.objectCount.toLocaleString()} color="orange" />
          <MetricCard label="Size" value={data.metrics.sizeMB > 1024 ? `${data.metrics.sizeGB.toFixed(2)} GB` : `${data.metrics.sizeMB} MB`} color="orange" />
          <MetricCard label="Est. Cost/mo" value={`$${data.costs.storageCostMonthly.toFixed(4)}`} sub={data.costs.storageCostMonthly === 0 ? 'Free tier' : undefined} color="green" />
        </div>

        {folders.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowFolders(v => !v)}
            >
              {showFolders ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showFolders ? 'Hide' : 'Show'} folder breakdown ({folders.length})
            </button>
            {showFolders && (
              <div className="mt-2 space-y-1">
                {folders.map(([folder, stats]) => (
                  <div key={folder} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="text-muted-foreground font-mono">{folder}</span>
                    <span>{stats.count} objects · {(stats.sizeBytes / (1024 ** 2)).toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-muted-foreground italic">{data.costs.freeTierNote}</p>
      </CardContent>
    </Card>
  );
}

// ── Lambda / Textract Panel ────────────────────────────────────────────────────

function LambdaPanel({ data }: { data: LambdaStats }) {
  const hasErrors = data.metrics.errors7d > 0;

  return (
    <Card className="border-l-4 border-l-yellow-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" /> Lambda + Textract
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasErrors && (
              <Badge variant="destructive" className="text-[10px]">
                {data.metrics.errors7d} errors
              </Badge>
            )}
            <Badge variant="outline" className="text-yellow-400 border-yellow-600/40 text-[10px]">
              {data.runtime}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-[11px]">
          Function: <span className="font-mono">{data.functionName}</span> · {data.memoryMB} MB · {data.timeoutSec}s timeout
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.error && <p className="text-xs text-red-400">{data.error}</p>}

        {/* Key metrics grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard label="Invocations (7d)" value={data.metrics.invocations7d} color="yellow" />
          <MetricCard label="Error Rate" value={`${data.metrics.errorRate}%`} color={data.metrics.errorRate > 5 ? 'red' : 'green'} />
          <MetricCard label="Avg Duration" value={`${data.metrics.avgDurationMs}ms`} color="blue" />
          <MetricCard label="Throttles (7d)" value={data.metrics.throttles7d} color={data.metrics.throttles7d > 0 ? 'red' : 'green'} />
        </div>

        {/* API Gateway */}
        {data.metrics.apigwRequests7d > 0 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-2 py-1.5 rounded bg-muted/30">
            <Server className="h-3 w-3" />
            API Gateway: <span className="font-medium text-foreground">{data.metrics.apigwRequests7d.toLocaleString()} requests (7d)</span>
          </div>
        )}

        {/* Sparkline */}
        {data.metrics.dailyInvocations.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Daily Invocations (7d)</p>
            <SparkBars data={data.metrics.dailyInvocations} />
          </div>
        )}

        {/* Cost breakdown */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
          <MetricCard label="Lambda/mo" value={`$${data.costs.lambdaMonthlyEstimate.toFixed(4)}`} color="purple" />
          <MetricCard label="Textract/mo" value={`$${data.costs.textractMonthlyEstimate.toFixed(4)}`} color="purple" />
          <MetricCard label="Total Est./mo" value={`$${data.costs.totalMonthlyEstimate.toFixed(4)}`} color={data.costs.totalMonthlyEstimate === 0 ? 'green' : 'yellow'} />
        </div>
        <p className="text-[10px] text-muted-foreground italic">{data.costs.freeTierNote}</p>

        {/* API GW URL (truncated) */}
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
          <Activity className="h-3 w-3 shrink-0" />
          <span className="font-mono truncate">{data.apiGatewayUrl}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── SNS Marketing Panel ─────────────────────────────────────────────────────────

function SNSPanel({ data }: { data: SNSStats }) {
  const [showTopics, setShowTopics] = useState(false);
  const hasActivity = data.metrics.messagesPublished7d > 0;

  return (
    <Card className="border-l-4 border-l-pink-500">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-pink-400" /> SNS Email Marketing
          </CardTitle>
          <div className="flex items-center gap-2">
            {data.metrics.messagesPublished7d > 0 && (
              <Badge variant="outline" className="text-pink-400 border-pink-600/40 text-[10px]">
                {data.metrics.messagesPublished7d} sent (7d)
              </Badge>
            )}
            <Badge variant="outline" className="text-pink-400 border-pink-600/40 text-[10px]">
              {data.region}
            </Badge>
          </div>
        </div>
        <CardDescription className="text-[11px]">
          {data.metrics.topicCount} topics · {data.metrics.confirmedSubscriptions} confirmed subscribers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.error && <p className="text-xs text-red-400">{data.error}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <MetricCard label="Topics" value={data.metrics.topicCount} color="pink" />
          <MetricCard label="Subscribers" value={data.metrics.confirmedSubscriptions} sub={`${data.metrics.pendingSubscriptions} pending`} color="pink" />
          <MetricCard label="Messages (7d)" value={data.metrics.messagesPublished7d} color="pink" />
          <MetricCard label="Delivery Rate" value={`${data.metrics.deliveryRate.toFixed(1)}%`} color={data.metrics.deliveryRate > 95 ? 'green' : data.metrics.deliveryRate > 80 ? 'yellow' : 'red'} />
        </div>

        {/* Failed messages warning */}
        {data.metrics.messagesFailed7d > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-600 px-2 py-1.5 rounded bg-amber-50 dark:bg-amber-950/30">
            <AlertCircle className="h-3 w-3 shrink-0" />
            <span>{data.metrics.messagesFailed7d} messages failed delivery in last 7 days</span>
          </div>
        )}

        {/* Sparkline */}
        {data.metrics.dailyPublishes.length > 0 && hasActivity && (
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Daily Messages Sent (7d)</p>
            <SparkBars data={data.metrics.dailyPublishes} />
          </div>
        )}

        {/* Topics breakdown */}
        {data.metrics.topicDetails.length > 0 && (
          <div>
            <button
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setShowTopics(v => !v)}
            >
              {showTopics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              {showTopics ? 'Hide' : 'Show'} topic breakdown ({data.metrics.topicDetails.length})
            </button>
            {showTopics && (
              <div className="mt-2 space-y-1">
                {data.metrics.topicDetails.map((topic) => (
                  <div key={topic.topicArn} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                    <span className="text-muted-foreground">{topic.displayName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">{topic.subscriptionsConfirmed} confirmed</span>
                      {topic.subscriptionsPending > 0 && <span className="text-amber-600">{topic.subscriptionsPending} pending</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cost */}
        <div className="grid grid-cols-1 gap-2 pt-1 border-t border-border/50">
          <MetricCard label="Est. Monthly Cost" value={`$${data.costs.monthlyCostEstimate.toFixed(4)}`} color={data.costs.monthlyCostEstimate === 0 ? 'green' : 'pink'} />
        </div>
        <p className="text-[10px] text-muted-foreground italic">{data.costs.freeTierNote}</p>
      </CardContent>
    </Card>
  );
}

// ── Service Inventory Panel ────────────────────────────────────────────────────

function ServiceInventory({ services }: { services: ConfiguredService[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4" /> AWS Service Inventory
        </CardTitle>
        <CardDescription className="text-[11px]">
          Auto-detected from environment variables — any new service added will appear here
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {services.map(svc => (
            <div
              key={svc.envKey}
              className={`flex items-start gap-2 rounded-lg border p-2.5 transition-colors ${
                svc.configured
                  ? 'border-green-700/30 bg-green-950/10'
                  : 'border-border/40 bg-muted/20 opacity-60'
              }`}
            >
              {svc.configured
                ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
                : <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              <div className="min-w-0">
                <p className={`text-xs font-medium ${svc.configured ? '' : 'text-muted-foreground'}`}>{svc.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono truncate">{svc.note}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Health Check Panel ─────────────────────────────────────────────────────────

function HealthPanel({
  health, loading, onCheck,
}: { health: HealthResponse | null; loading: boolean; onCheck: () => void }) {
  const SERVICE_LABELS: Record<string, string> = {
    s3: 'S3 Buckets',
    lambda: 'Lambda API',
    textract_lambda: 'Textract Lambda (HTTP)',
    rekognition: 'Rekognition',
    sns: 'SNS',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" /> Connectivity Health Check
          </CardTitle>
          <Button size="sm" variant="outline" onClick={onCheck} disabled={loading} className="gap-1 h-7 text-xs">
            {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Wifi className="h-3 w-3" />}
            Run Check
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!health ? (
          <p className="text-xs text-muted-foreground italic">Click "Run Check" to test connectivity</p>
        ) : (
          <div className="space-y-1.5">
            {Object.entries(health.checks).map(([key, check]) => (
              <div key={key} className={`flex items-center justify-between rounded-lg px-3 py-2 border ${
                check.ok ? 'border-green-700/30 bg-green-950/10' : 'border-red-700/30 bg-red-950/10'
              }`}>
                <div className="flex items-center gap-2">
                  {check.ok
                    ? <Wifi className="h-3.5 w-3.5 text-green-400" />
                    : <WifiOff className="h-3.5 w-3.5 text-red-400" />}
                  <span className="text-xs font-medium">{SERVICE_LABELS[key] ?? key}</span>
                </div>
                <span className={`text-[10px] font-mono ${check.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {check.detail}
                </span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground text-right">
              Checked at {new Date(health.checkedAt).toLocaleTimeString()}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AWSUsageDashboard() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<UsageResponse>({
    queryKey: ['aws-usage'],
    queryFn: fetchUsage,
    staleTime: 2 * 60 * 1000,   // 2 min cache
    retry: 1,
  });

  const runHealthCheck = useCallback(async () => {
    setHealthLoading(true);
    try {
      const r = await fetchHealth();
      setHealthData(r);
    } catch {
      setHealthData(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // ── Summary stats across all services ──
  const totalMonthlyEst = data?.totalMonthlyCost ?? (
    (data?.services?.lambda?.costs?.totalMonthlyEstimate ?? 0) +
    (data?.services?.s3?.costs?.storageCostMonthly ?? 0) +
    (data?.services?.sns?.costs?.monthlyCostEstimate ?? 0)
  );

  const budget = data?.budget ?? 50;
  const budgetUsedPct = Math.min(100, (totalMonthlyEst / budget) * 100);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-400" />
            AWS API Usage & Cost Tracking
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live metrics from CloudWatch · Budget: ${budget} (AWS Learner Lab)
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Loading / error states ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span className="text-sm">Fetching AWS metrics…</span>
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-950/10 p-4">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-400">Failed to fetch AWS usage data. Check server logs.</p>
        </div>
      )}

      {/* ── Not configured ── */}
      {data && !data.configured && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-700/40 bg-yellow-950/10 p-4">
          <AlertCircle className="h-4 w-4 text-yellow-400 shrink-0" />
          <p className="text-sm text-yellow-400">{data.message ?? 'AWS credentials not configured.'}</p>
        </div>
      )}

      {data?.configured && (
        <>
          {/* ── Learner Lab Warning ── */}
          {data.isLearnerLab && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
              <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-400">AWS Learner Lab Detected</p>
                <p className="text-xs text-amber-300/90 mt-1">
                  <strong>NO FREE TIER:</strong> All costs shown are actual charges against your ${budget} credit budget. 
                  Unlike regular AWS accounts, Learner Labs bill from the first byte/request with no free tier allowances.
                </p>
              </div>
            </div>
          )}

          {/* ── Summary ribbon ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Est. Total Cost</p>
                <p className="text-2xl font-bold text-green-400">${totalMonthlyEst.toFixed(4)}</p>
                <p className="text-[10px] text-muted-foreground">per month (projected)</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Learner Lab Budget</p>
                <p className="text-2xl font-bold text-blue-400">${budget}</p>
                <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${budgetUsedPct}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{budgetUsedPct.toFixed(3)}% used</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Region</p>
                <p className="text-lg font-bold text-purple-400">{data.region}</p>
                <p className="text-[10px] text-muted-foreground truncate">{data.credentialsType}</p>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-cyan-500">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Services Active</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {data.configuredServices?.filter(s => s.configured).length ?? 0}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  of {data.configuredServices?.length ?? 0} tracked
                </p>
              </CardContent>
            </Card>
          </div>

          {/* ── Per-service detail panels ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {data.services?.s3 && !('error' in data.services.s3 && !data.services.s3.metrics) && (
              <S3Panel data={data.services.s3 as S3Stats} />
            )}
            {data.services?.lambda && !('error' in data.services.lambda && !data.services.lambda.metrics) && (
              <LambdaPanel data={data.services.lambda as LambdaStats} />
            )}
            {data.services?.sns && !('error' in data.services.sns && !data.services.sns.metrics) && (
              <SNSPanel data={data.services.sns as SNSStats} />
            )}
          </div>

          {/* ── Error cards for failed services ── */}
          {(['s3', 'lambda', 'sns'] as const).map(key => {
            const svc = data.services?.[key] as any;
            if (svc && svc.error && !svc.metrics) {
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border border-red-700/40 bg-red-950/10 p-3">
                  <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                  <p className="text-sm text-red-400">{svc.service ?? key}: {svc.error}</p>
                </div>
              );
            }
            return null;
          })}

          {/* ── Lambda last-modified notice ── */}
          {data.services?.lambda && (data.services.lambda as LambdaStats).lastModified && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              Lambda last deployment: {new Date((data.services.lambda as LambdaStats).lastModified).toLocaleString()}
            </div>
          )}

          {/* ── Service Inventory ── */}
          {data.configuredServices && (
            <ServiceInventory services={data.configuredServices} />
          )}

          {/* ── Health Check ── */}
          <HealthPanel health={healthData} loading={healthLoading} onCheck={runHealthCheck} />

          {/* ── Pricing reference ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Pricing Reference (AWS US-East-1)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                {[
                  { service: 'S3 Storage', detail: '$0.023/GB/month (after 5 GB free)' },
                  { service: 'S3 Requests', detail: 'PUT: $0.005/1K · GET: $0.0004/1K' },
                  { service: 'Lambda', detail: '$0.20/1M req + $0.0000167/GB-sec (1M req + 400K GB-sec free)' },
                  { service: 'Textract', detail: '$0.0015/page sync (1,000 pages/month free)' },
                  { service: 'API Gateway', detail: '$3.50/1M calls (1M/month free)' },
                  { service: 'Rekognition', detail: '$0.001/1K images (1K images/month free)' },
                  { service: 'SNS', detail: '$0.50/1M API requests (1M free)' },
                  { service: 'SES', detail: '$0.10/1K emails (62K/month free from EC2)' },
                ].map(r => (
                  <div key={r.service} className="flex items-start gap-1.5 p-2 rounded bg-muted/30">
                    <BarChart2 className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                    <div>
                      <span className="font-medium">{r.service}</span>
                      <p className="text-muted-foreground">{r.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── Last fetched ── */}
          {dataUpdatedAt > 0 && (
            <p className="text-[10px] text-muted-foreground text-right">
              Data fetched at {new Date(dataUpdatedAt).toLocaleTimeString()} · refreshes every 2 min
            </p>
          )}
        </>
      )}
    </div>
  );
}
