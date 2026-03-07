/**
 * AWS Usage & Cost Tracking Routes
 *
 * Provides a unified view of all AWS services configured for VidyaMitra.
 * Services are AUTO-DETECTED from environment variables — adding a new AWS
 * service to the env will automatically surface it in the dashboard.
 *
 * Endpoints:
 *   GET /api/aws/usage        — full usage snapshot for all detected services
 *   GET /api/aws/health       — quick connectivity check per service
 */

import type { ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'http';
import {
  CloudWatchClient,
  GetMetricStatisticsCommand,
} from '@aws-sdk/client-cloudwatch';
import {
  LambdaClient,
  GetFunctionConfigurationCommand,
  ListFunctionsCommand,
} from '@aws-sdk/client-lambda';
import { S3Client, ListObjectsV2Command, GetBucketLocationCommand } from '@aws-sdk/client-s3';
import {
  SNSClient,
  ListTopicsCommand,
  ListSubscriptionsByTopicCommand,
  GetTopicAttributesCommand,
} from '@aws-sdk/client-sns';

// ── Pricing constants (public AWS pricing. Update if rates change.) ───────────
const PRICING = {
  s3_storage_per_gb:     0.023,   // Standard storage $/GB/month (first 50 TB)
  s3_put_per_1000:       0.005,   // PUT/COPY/POST/LIST per 1,000
  s3_get_per_1000:       0.0004,  // GET per 1,000
  lambda_per_1M:         0.20,    // Per 1M requests (after free tier)
  lambda_gb_sec:         0.0000166667, // Per GB-second (after free tier)
  lambda_free_requests:  1_000_000,
  lambda_free_gb_sec:    400_000,
  textract_per_page_sync:      0.0015, // Synchronous DetectDocumentText $/page
  textract_free_pages:         1_000,  // /month
  apigw_per_1M:          3.50,   // REST API $/million calls
  apigw_free:            1_000_000, // Per month
  rekognition_per_1000:  0.001,   // DetectFaces $/1000 images (after free tier 1K/month)
  rekognition_free:      1_000,
  sns_per_1M_email:      2.00,   // Email notifications $/1M (after free 1K/month)
  sns_per_1M_sms:        0.00645, // SMS (US) per message
  sns_free_email:        1_000,   // Free tier per month
  ses_per_1000:          0.10,    // $0.10 per 1,000 emails
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAwsCreds(env: Record<string, string>) {
  return {
    accessKeyId:     env.AWS_ACCESS_KEY_ID     || process.env.AWS_ACCESS_KEY_ID     || '',
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
    sessionToken:    env.AWS_SESSION_TOKEN     || process.env.AWS_SESSION_TOKEN     || undefined,
  };
}

function getRegion(env: Record<string, string>) {
  return env.AWS_REGION || process.env.AWS_REGION || 'us-east-1';
}

/** Parse past N days as [start, end] Date objects */
function getDateRange(days = 7): [Date, Date] {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  return [start, end];
}

/** Extract CloudWatch Sum for a given metric over the past `days` */
async function cwSum(
  cw: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: Array<{ Name: string; Value: string }>,
  days = 7
): Promise<number> {
  const [start, end] = getDateRange(days);
  try {
    const cmd = new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: start,
      EndTime: end,
      Period: days * 86400, // single bucket over the period
      Statistics: ['Sum'],
    });
    const resp = await cw.send(cmd);
    return resp.Datapoints?.[0]?.Sum ?? 0;
  } catch {
    return 0;
  }
}

/** Extract CloudWatch Average for a metric */
async function cwAvg(
  cw: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: Array<{ Name: string; Value: string }>,
  days = 7
): Promise<number> {
  const [start, end] = getDateRange(days);
  try {
    const cmd = new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: start,
      EndTime: end,
      Period: days * 86400,
      Statistics: ['Average'],
    });
    const resp = await cw.send(cmd);
    return resp.Datapoints?.[0]?.Average ?? 0;
  } catch {
    return 0;
  }
}

/** Get daily datapoints for charting (1 point per day) */
async function cwDaily(
  cw: CloudWatchClient,
  namespace: string,
  metricName: string,
  dimensions: Array<{ Name: string; Value: string }>,
  days = 7
): Promise<Array<{ date: string; value: number }>> {
  const [start, end] = getDateRange(days);
  try {
    const cmd = new GetMetricStatisticsCommand({
      Namespace: namespace,
      MetricName: metricName,
      Dimensions: dimensions,
      StartTime: start,
      EndTime: end,
      Period: 86400, // 1 day
      Statistics: ['Sum'],
    });
    const resp = await cw.send(cmd);
    const points = (resp.Datapoints ?? [])
      .sort((a, b) => (a.Timestamp?.getTime() ?? 0) - (b.Timestamp?.getTime() ?? 0))
      .map(d => ({
        date: d.Timestamp!.toISOString().slice(0, 10),
        value: d.Sum ?? 0,
      }));
    return points;
  } catch {
    return [];
  }
}

// ─── S3 Stats ────────────────────────────────────────────────────────────────

async function getS3Stats(env: Record<string, string>, isLearnerLab = false) {
  const creds = makeAwsCreds(env);
  const region = getRegion(env);
  const bucketName = env.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'vidyamitra-uploads-629496';

  if (!creds.accessKeyId) return null;

  const s3 = new S3Client({ region, credentials: creds });
  const cw = new CloudWatchClient({ region, credentials: creds });

  let objectCount = 0;
  let totalSizeBytes = 0;
  const folderBreakdown: Record<string, { count: number; sizeBytes: number }> = {};

  // Count objects per folder prefix
  const prefixes = ['resumes/', 'profile-pictures/', 'institution-logos/', 'exports/', ''];
  for (const prefix of prefixes) {
    try {
      let token: string | undefined;
      do {
        const resp = await s3.send(new ListObjectsV2Command({
          Bucket: bucketName,
          Prefix: prefix,
          MaxKeys: 1000,
          ContinuationToken: token,
        }));
        const contents = resp.Contents ?? [];
        // Only count objects directly in this prefix (avoid double-counting for '')
        for (const obj of contents) {
          const key = obj.Key ?? '';
          const isTopLevel = prefix === '' && !prefixes.slice(0, -1).some(p => key.startsWith(p));
          if (prefix !== '' || isTopLevel) {
            objectCount++;
            totalSizeBytes += obj.Size ?? 0;
            const folder = prefix || 'root';
            if (!folderBreakdown[folder]) folderBreakdown[folder] = { count: 0, sizeBytes: 0 };
            folderBreakdown[folder].count++;
            folderBreakdown[folder].sizeBytes += obj.Size ?? 0;
          }
        }
        token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
      } while (token);
    } catch {
      // Skip inaccessible prefix
    }
  }

  // CloudWatch S3 metrics (BucketSizeBytes & NumberOfObjects — only available with daily metrics enabled)
  const cwBytes = await cwSum(cw, 'AWS/S3', 'BucketSizeBytes',
    [{ Name: 'BucketName', Value: bucketName }, { Name: 'StorageType', Value: 'StandardStorage' }], 1);
  const cwObjects = await cwSum(cw, 'AWS/S3', 'NumberOfObjects',
    [{ Name: 'BucketName', Value: bucketName }, { Name: 'StorageType', Value: 'AllStorageTypes' }], 1);

  // Use CW values if available, otherwise fall back to what we counted
  const finalObjects = cwObjects > 0 ? cwObjects : objectCount;
  const finalBytes = cwBytes > 0 ? cwBytes : totalSizeBytes;
  const sizeGB = finalBytes / (1024 ** 3);

  // Cost estimate: AWS Learner Labs has NO free tier - all usage is billable
  const freeTierGB = isLearnerLab ? 0 : 5; // Regular AWS has 5GB free, Learner Lab has 0
  const billableGB = Math.max(0, sizeGB - freeTierGB);
  const storageCost = billableGB * PRICING.s3_storage_per_gb;

  return {
    service: 'S3',
    icon: 'cloud',
    color: 'orange',
    status: 'ok',
    bucket: bucketName,
    region,
    metrics: {
      objectCount: finalObjects,
      sizeGB: +sizeGB.toFixed(4),
      sizeMB: +(finalBytes / (1024 ** 2)).toFixed(2),
      folderBreakdown,
    },
    costs: {
      storageCostMonthly: +storageCost.toFixed(4),
      freeTierNote: isLearnerLab 
        ? 'AWS Learner Lab: NO free tier. All storage billable from first byte.'
        : 'First 5 GB/month free. PUT/GET: 2K PUT + 20K GET free/month.',
    },
  };
}

// ─── Lambda (Textract Resume) Stats ──────────────────────────────────────────

async function getLambdaStats(env: Record<string, string>, isLearnerLab = false) {
  const creds = makeAwsCreds(env);
  const region = getRegion(env);
  const lambdaApiUrl = env.AWS_LAMBDA_RESUME_API || process.env.AWS_LAMBDA_RESUME_API || '';

  if (!creds.accessKeyId || !lambdaApiUrl) return null;

  // Extract function name from API Gateway URL
  // Format: https://{api-id}.execute-api.{region}.amazonaws.com/{stage}/{function-name}
  const urlParts = lambdaApiUrl.split('/');
  const functionName = urlParts[urlParts.length - 1] || '';
  const apiId = lambdaApiUrl.split('.')[0].replace('https://', '');
  const stage = urlParts[urlParts.length - 2] || 'default';

  const cw = new CloudWatchClient({ region, credentials: creds });
  const lambda = new LambdaClient({ region, credentials: creds });

  // Get Lambda function config  
  let memoryMB = 128;
  let timeoutSec = 30;
  let runtime = 'nodejs';
  let lastModified = '';
  try {
    const config = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: functionName }));
    memoryMB = config.MemorySize ?? 128;
    timeoutSec = config.Timeout ?? 30;
    runtime = config.Runtime ?? 'nodejs';
    lastModified = config.LastModified ?? '';
  } catch {
    // Function may be inaccessible — use defaults
  }

  const lambdaDims = [{ Name: 'FunctionName', Value: functionName }];
  const apigwDims = [{ Name: 'ApiId', Value: apiId }, { Name: 'Stage', Value: stage }];

  const [invocations, errors, throttles, avgDurationMs, dailyInvocations, apigwCount] = await Promise.all([
    cwSum(cw, 'AWS/Lambda', 'Invocations',  lambdaDims),
    cwSum(cw, 'AWS/Lambda', 'Errors',       lambdaDims),
    cwSum(cw, 'AWS/Lambda', 'Throttles',    lambdaDims),
    cwAvg(cw, 'AWS/Lambda', 'Duration',     lambdaDims),
    cwDaily(cw, 'AWS/Lambda', 'Invocations', lambdaDims),
    cwSum(cw, 'AWS/ApiGateway', 'Count',    apigwDims),
  ]);

  const errorRate = invocations > 0 ? (errors / invocations) * 100 : 0;

  // Cost estimate (7 days → scale to monthly)
  // AWS Learner Labs has NO free tier - all requests/compute are billable
  const freeTierRequests = isLearnerLab ? 0 : PRICING.lambda_free_requests;
  const freeTierGbSec = isLearnerLab ? 0 : PRICING.lambda_free_gb_sec;
  const freeTierTextractPages = isLearnerLab ? 0 : PRICING.textract_free_pages;

  const monthlyInvocations = Math.round(invocations * (30 / 7));
  const billableRequests = Math.max(0, monthlyInvocations - freeTierRequests);
  const requestCost = (billableRequests / 1_000_000) * PRICING.lambda_per_1M;

  const gbSeconds = invocations * (avgDurationMs / 1000) * (memoryMB / 1024);
  const monthlyGbSec = gbSeconds * (30 / 7);
  const billableGbSec = Math.max(0, monthlyGbSec - freeTierGbSec);
  const computeCost = billableGbSec * PRICING.lambda_gb_sec;

  // Textract pages ~ 1 per Lambda invocation
  const textractPages = Math.round(invocations * (30 / 7)); // Monthly estimate
  const billableTextractPages = Math.max(0, textractPages - freeTierTextractPages);
  const textractCost = billableTextractPages * PRICING.textract_per_page_sync;

  return {
    service: 'Lambda + Textract',
    icon: 'zap',
    color: 'yellow',
    status: 'ok',
    functionName,
    apiId,
    stage,
    region,
    runtime,
    memoryMB,
    timeoutSec,
    lastModified,
    apiGatewayUrl: lambdaApiUrl,
    metrics: {
      invocations7d:   invocations,
      errors7d:        errors,
      throttles7d:     throttles,
      errorRate:       +errorRate.toFixed(2),
      avgDurationMs:   +avgDurationMs.toFixed(0),
      apigwRequests7d: apigwCount,
      dailyInvocations,
    },
    costs: {
      lambdaMonthlyEstimate: +(requestCost + computeCost).toFixed(4),
      textractMonthlyEstimate: +textractCost.toFixed(4),
      totalMonthlyEstimate: +(requestCost + computeCost + textractCost).toFixed(4),
      freeTierNote: isLearnerLab
        ? 'AWS Learner Lab: NO free tier. All Lambda requests, compute, and Textract pages are billable.'
        : 'Lambda: 1M req + 400K GB-sec/month free. Textract: 1K pages/month free.',
    },
  };
}

// ─── SNS (Marketing Notifications) Stats ─────────────────────────────────────

async function getSNSStats(env: Record<string, string>, isLearnerLab = false) {
  const creds = makeAwsCreds(env);
  const region = getRegion(env);

  if (!creds.accessKeyId) return null;

  const sns = new SNSClient({ region, credentials: creds });
  const cw = new CloudWatchClient({ region, credentials: creds });

  try {
    // List all topics (filter for VidyaMitra topics)
    const topicsResp = await sns.send(new ListTopicsCommand({}));
    const allTopics = topicsResp.Topics || [];
    const vidyamitraTopics = allTopics.filter(t => t.TopicArn?.includes('vidyamitra'));

    let totalSubscriptions = 0;
    let confirmedSubscriptions = 0;
    let pendingSubscriptions = 0;
    const topicDetails = [];

    // Get details for each topic
    for (const topic of vidyamitraTopics) {
      if (!topic.TopicArn) continue;

      try {
        const [attrs, subs] = await Promise.all([
          sns.send(new GetTopicAttributesCommand({ TopicArn: topic.TopicArn })),
          sns.send(new ListSubscriptionsByTopicCommand({ TopicArn: topic.TopicArn })),
        ]);

        const subsCount = parseInt(attrs.Attributes?.SubscriptionsConfirmed || '0');
        const pendingCount = parseInt(attrs.Attributes?.SubscriptionsPending || '0');
        const deletedCount = parseInt(attrs.Attributes?.SubscriptionsDeleted || '0');

        totalSubscriptions += subsCount + pendingCount;
        confirmedSubscriptions += subsCount;
        pendingSubscriptions += pendingCount;

        const arnParts = topic.TopicArn.split(':');
        const topicName = arnParts[arnParts.length - 1];

        topicDetails.push({
          topicArn: topic.TopicArn,
          topicName,
          displayName: attrs.Attributes?.DisplayName || topicName,
          subscriptionsConfirmed: subsCount,
          subscriptionsPending: pendingCount,
          subscriptionsDeleted: deletedCount,
        });
      } catch (err) {
        console.error(`Failed to get topic details for ${topic.TopicArn}:`, err);
      }
    }

    // Get SNS CloudWatch metrics for messages published (7 days)
    const totalPublishSum = await cwSum(cw, 'AWS/SNS', 'NumberOfMessagesPublished', [], 7);
    const failedPublishSum = await cwSum(cw, 'AWS/SNS', 'NumberOfNotificationsFailed', [], 7);
    const emailDeliveredSum = await cwSum(cw, 'AWS/SNS', 'NumberOfNotificationsDelivered', 
      [{ Name: 'Protocol', Value: 'email' }], 7);

    // Get daily publish data for chart
    const dailyPublishes = await cwDaily(cw, 'AWS/SNS', 'NumberOfMessagesPublished', [], 7);

    // Cost calculation (scale 7-day to monthly)
    // AWS Learner Labs has NO free tier - all messages are billable
    const freeTierMessages = isLearnerLab ? 0 : PRICING.sns_free_email;
    const monthlyMessages = Math.round(totalPublishSum * (30 / 7));
    const billableMessages = Math.max(0, monthlyMessages - freeTierMessages);
    const snsCost = (billableMessages / 1_000_000) * PRICING.sns_per_1M_email;

    return {
      service: 'SNS',
      icon: 'megaphone',
      color: 'pink',
      status: 'ok' as const,
      region,
      metrics: {
        topicCount: vidyamitraTopics.length,
        totalSubscriptions,
        confirmedSubscriptions,
        pendingSubscriptions,
        messagesPublished7d: totalPublishSum,
        messagesFailed7d: failedPublishSum,
        emailDelivered7d: emailDeliveredSum,
        deliveryRate: totalPublishSum > 0 ? ((emailDeliveredSum / totalPublishSum) * 100) : 0,
        dailyPublishes,
        topicDetails,
      },
      costs: {
        monthlyCostEstimate: +snsCost.toFixed(4),
        freeTierNote: isLearnerLab
          ? 'AWS Learner Lab: NO free tier. All SNS email notifications are billable.'
          : 'First 1,000 email notifications/month free. $2.00 per 1M after that.',
      },
    };
  } catch (err: any) {
    console.error('SNS stats error:', err);
    return {
      service: 'SNS',
      icon: 'megaphone',
      color: 'pink',
      status: 'error' as const,
      error: err?.message || 'Failed to fetch SNS stats',
      region,
      metrics: {
        topicCount: 0,
        totalSubscriptions: 0,
        confirmedSubscriptions: 0,
        pendingSubscriptions: 0,
        messagesPublished7d: 0,
        messagesFailed7d: 0,
        emailDelivered7d: 0,
        deliveryRate: 0,
        dailyPublishes: [],
        topicDetails: [],
      },
      costs: {
        monthlyCostEstimate: 0,
        freeTierNote: isLearnerLab
          ? 'AWS Learner Lab: NO free tier.'
          : 'First 1,000 email notifications/month free.',
      },
    };
  }
}

// ─── Auto-detect any additional configured AWS services ───────────────────────

function getConfiguredServices(env: Record<string, string>): Array<{ name: string; envKey: string; configured: boolean; note: string }> {
  const allEnv = { ...process.env, ...env };
  return [
    {
      name: 'S3 Object Storage',
      envKey: 'S3_BUCKET_NAME',
      configured: !!(allEnv.S3_BUCKET_NAME || allEnv.AWS_ACCESS_KEY_ID),
      note: allEnv.S3_BUCKET_NAME || 'vidyamitra-uploads-629496',
    },
    {
      name: 'Lambda (Textract Resume API)',
      envKey: 'AWS_LAMBDA_RESUME_API',
      configured: !!allEnv.AWS_LAMBDA_RESUME_API,
      note: allEnv.AWS_LAMBDA_RESUME_API ? 'API Gateway + Lambda + Textract' : 'Not configured',
    },
    {
      name: 'SNS Email Marketing',
      envKey: 'AWS_ACCESS_KEY_ID',
      configured: !!(allEnv.AWS_ACCESS_KEY_ID),
      note: allEnv.AWS_ACCESS_KEY_ID ? 'Active (check Marketing tab)' : 'Requires AWS credentials',
    },
    {
      name: 'SES Email',
      envKey: 'SES_FROM_EMAIL',
      configured: !!allEnv.SES_FROM_EMAIL,
      note: allEnv.SES_FROM_EMAIL || 'Not configured (sandbox mode in Learner Lab)',
    },
    {
      name: 'Rekognition Face Detection',
      envKey: 'REKOGNITION_ENABLED',
      configured: !!(allEnv.REKOGNITION_ENABLED || allEnv.REKOGNITION_COLLECTION_ID),
      note: allEnv.REKOGNITION_COLLECTION_ID ? `Collection: ${allEnv.REKOGNITION_COLLECTION_ID}` : 'Replaced by TF.js (client-side)',
    },
    {
      name: 'DynamoDB',
      envKey: 'DYNAMODB_TABLE',
      configured: !!allEnv.DYNAMODB_TABLE,
      note: allEnv.DYNAMODB_TABLE || 'Using Supabase instead',
    },
    {
      name: 'CloudFront CDN',
      envKey: 'CLOUDFRONT_DOMAIN',
      configured: !!allEnv.CLOUDFRONT_DOMAIN,
      note: allEnv.CLOUDFRONT_DOMAIN || 'Not configured',
    },
  ];
}

// ─── Route registration ────────────────────────────────────────────────────────

export function registerAwsUsageRoutes(
  server: ViteDevServer,
  env: Record<string, string>,
  getSessionAsync: (req: IncomingMessage) => Promise<{ userId: string; email: string; isAdmin: boolean; name: string } | null>,
  sendJson: (res: ServerResponse, status: number, data: any) => void,
) {
  // GET /api/aws/usage — full snapshot (admin only)
  server.middlewares.use('/api/aws/usage', async (req: any, res: any, next: any) => {
    if (req.method !== 'GET') return next();

    const session = await getSessionAsync(req);
    if (!session?.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });

    const creds = makeAwsCreds(env);
    if (!creds.accessKeyId) {
      return sendJson(res, 200, {
        configured: false,
        message: 'AWS credentials not configured in .env',
        services: [],
      });
    }

    // Detect AWS Learner Lab (temporary STS credentials with session token)
    const isLearnerLab = !!creds.sessionToken;

    const configuredServices = getConfiguredServices(env);

    // Fetch stats in parallel, fail gracefully per-service
    const [s3, lambda, sns] = await Promise.all([
      getS3Stats(env, isLearnerLab).catch(err => ({ error: err?.message ?? 'Failed', service: 'S3', status: 'error' })),
      getLambdaStats(env, isLearnerLab).catch(err => ({ error: err?.message ?? 'Failed', service: 'Lambda + Textract', status: 'error' })),
      getSNSStats(env, isLearnerLab).catch(err => ({ error: err?.message ?? 'Failed', service: 'SNS', status: 'error' })),
    ]);

    const region = getRegion(env);
    const budget = 50; // AWS Learner Lab credit
    const credentialsType = creds.sessionToken ? 'STS/Learner Lab (temporary)' : 'IAM (permanent)';

    // Calculate total estimated cost
    const s3Cost = (s3 as any)?.costs?.storageCostMonthly || 0;
    const lambdaCost = (lambda as any)?.costs?.totalMonthlyEstimate || 0;
    const snsCost = (sns as any)?.costs?.monthlyCostEstimate || 0;
    const totalCost = s3Cost + lambdaCost + snsCost;

    sendJson(res, 200, {
      configured: true,
      region,
      credentialsType,
      budget,
      isLearnerLab,
      totalMonthlyCost: +totalCost.toFixed(4),
      remainingBudget: +(budget - totalCost).toFixed(2),
      configuredServices,
      services: { s3, lambda, sns },
      fetchedAt: new Date().toISOString(),
    });
  });

  // GET /api/aws/health — quick connectivity ping (admin only)
  server.middlewares.use('/api/aws/health', async (req: any, res: any, next: any) => {
    if (req.method !== 'GET') return next();

    const session = await getSessionAsync(req);
    if (!session?.isAdmin) return sendJson(res, 403, { error: 'Admin access required' });

    const creds = makeAwsCreds(env);
    const region = getRegion(env);
    const bucketName = env.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'vidyamitra-uploads-629496';

    const checks: Record<string, { ok: boolean; detail: string }> = {};

    // S3 ping
    try {
      const s3 = new S3Client({ region, credentials: creds });
      await s3.send(new GetBucketLocationCommand({ Bucket: bucketName }));
      checks.s3 = { ok: true, detail: `Bucket ${bucketName} accessible` };
    } catch (e: any) {
      checks.s3 = { ok: false, detail: e?.message ?? 'S3 check failed' };
    }

    // Lambda ping (list functions — quick and cheap)
    try {
      const lambda = new LambdaClient({ region, credentials: creds });
      await lambda.send(new ListFunctionsCommand({ MaxItems: 1 }));
      checks.lambda = { ok: true, detail: 'Lambda API accessible' };
    } catch (e: any) {
      checks.lambda = { ok: false, detail: e?.message ?? 'Lambda check failed' };
    }

    // Textract Lambda health (HTTP ping to the API GW URL)
    const lambdaUrl = env.AWS_LAMBDA_RESUME_API || process.env.AWS_LAMBDA_RESUME_API;
    if (lambdaUrl) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch(lambdaUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bucket: 'ping', key: 'ping' }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        // Any HTTP response (even 500) means Lambda is reachable — the ping uses
        // a fake bucket/key so Lambda naturally errors, but that proves connectivity.
        checks.textract_lambda = { ok: true, detail: `Reachable (HTTP ${resp.status})` };
      } catch (e: any) {
        checks.textract_lambda = { ok: false, detail: e?.message ?? 'Lambda ping failed' };
      }
    }

    // SNS ping (list topics — quick check)
    try {
      const sns = new SNSClient({ region, credentials: creds });
      const topics = await sns.send(new ListTopicsCommand({ NextToken: undefined }));
      const vidyamitraTopics = (topics.Topics || []).filter(t => t.TopicArn?.includes('vidyamitra'));
      checks.sns = { ok: true, detail: `SNS accessible (${vidyamitraTopics.length} marketing topics)` };
    } catch (e: any) {
      checks.sns = { ok: false, detail: e?.message ?? 'SNS check failed' };
    }

    sendJson(res, 200, { checks, checkedAt: new Date().toISOString() });
  });
}
