/**
 * ProctoringSettingsTab - Admin Panel Component
 * 
 * Allows admins to configure proctoring settings:
 * - Select proctoring mode (TensorFlow, AWS Rekognition, or Both)
 * - Configure TensorFlow detection settings
 * - Configure Rekognition detection settings and thresholds
 */

import React, { useState, useEffect } from 'react';
import { useProctoringSettings, type ProctoringMode } from '@/hooks/useProctoringSettings';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Smartphone,
  RefreshCw,
  Save,
  Loader2,
  Brain,
  Cloud,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';

// Rekognition status check
async function checkRekognitionStatus(): Promise<{ configured: boolean; region?: string }> {
  try {
    const res = await fetch('/api/rekognition/status');
    if (res.ok) return res.json();
    return { configured: false };
  } catch {
    return { configured: false };
  }
}

export default function ProctoringSettingsTab() {
  const { 
    settings, 
    loading, 
    saving, 
    error, 
    saveSettings, 
    updateSettings, 
    refetch 
  } = useProctoringSettings();
  
  const [rekognitionConfigured, setRekognitionConfigured] = useState<boolean | null>(null);
  const [rekognitionRegion, setRekognitionRegion] = useState<string>('');
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState(settings);

  // Check Rekognition status on mount
  useEffect(() => {
    checkRekognitionStatus().then(status => {
      setRekognitionConfigured(status.configured);
      setRekognitionRegion(status.region || 'us-east-1');
    });
  }, []);

  // Track changes
  useEffect(() => {
    if (!loading) {
      setOriginalSettings(settings);
    }
  }, [loading]);

  useEffect(() => {
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const handleSave = async () => {
    const success = await saveSettings(settings);
    if (success) {
      toast.success('Proctoring settings saved successfully');
      setOriginalSettings(settings);
      setHasChanges(false);
    } else {
      toast.error(error || 'Failed to save settings');
    }
  };

  const handleModeChange = (mode: ProctoringMode) => {
    updateSettings({
      proctoringMode: mode,
      tensorflow: mode === 'tensorflow' || mode === 'both',
      rekognition: mode === 'rekognition' || mode === 'both',
    });
  };

  const getModeIcon = (mode: ProctoringMode) => {
    switch (mode) {
      case 'tensorflow':
        return <Brain className="h-4 w-4" />;
      case 'rekognition':
        return <Cloud className="h-4 w-4" />;
      case 'both':
        return <Zap className="h-4 w-4" />;
    }
  };

  const getModeDescription = (mode: ProctoringMode) => {
    switch (mode) {
      case 'tensorflow':
        return 'Client-side detection using TensorFlow.js. Fast, free, runs in browser.';
      case 'rekognition':
        return 'Server-side detection using AWS Rekognition. More accurate, costs per API call.';
      case 'both':
        return 'Dual engine: TensorFlow for speed + Rekognition for accuracy. Best protection.';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Proctoring Settings
          </h2>
          <p className="text-muted-foreground mt-1">
            Configure AI-powered exam proctoring and cheating detection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refetch}
            disabled={loading || saving}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={`border-l-4 ${settings.tensorflow ? 'border-l-green-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-indigo-600" />
                <span className="font-medium">TensorFlow.js</span>
              </div>
              <Badge variant={settings.tensorflow ? 'default' : 'secondary'}>
                {settings.tensorflow ? 'Active' : 'Disabled'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Client-side, free, ~1s detection
            </p>
          </CardContent>
        </Card>

        <Card className={`border-l-4 ${settings.rekognition ? 'border-l-green-500' : 'border-l-gray-300'}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-orange-500" />
                <span className="font-medium">AWS Rekognition</span>
              </div>
              {rekognitionConfigured === null ? (
                <Badge variant="outline">Checking...</Badge>
              ) : rekognitionConfigured ? (
                <Badge variant={settings.rekognition ? 'default' : 'secondary'}>
                  {settings.rekognition ? 'Active' : 'Ready'}
                </Badge>
              ) : (
                <Badge variant="destructive">Not Configured</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Server-side, paid API, high accuracy
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-blue-600" />
                <span className="font-medium">Protection Level</span>
              </div>
              <Badge className={
                settings.proctoringMode === 'both' ? 'bg-purple-600' :
                settings.proctoringMode === 'rekognition' ? 'bg-orange-600' :
                'bg-indigo-600'
              }>
                {settings.proctoringMode === 'both' ? 'Maximum' :
                 settings.proctoringMode === 'rekognition' ? 'High' : 'Standard'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {getModeDescription(settings.proctoringMode)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Proctoring Mode Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Proctoring Engine
          </CardTitle>
          <CardDescription>
            Choose which detection engine to use during proctored exams
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['tensorflow', 'rekognition', 'both'] as ProctoringMode[]).map(mode => (
              <div
                key={mode}
                className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  settings.proctoringMode === mode
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-primary/50'
                } ${mode === 'rekognition' && !rekognitionConfigured ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => {
                  if (mode === 'rekognition' && !rekognitionConfigured) {
                    toast.error('AWS Rekognition is not configured. Please set up AWS credentials.');
                    return;
                  }
                  if (mode === 'both' && !rekognitionConfigured) {
                    toast.error('AWS Rekognition is not configured. Please set up AWS credentials.');
                    return;
                  }
                  handleModeChange(mode);
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  {getModeIcon(mode)}
                  <span className="font-semibold capitalize">{mode}</span>
                  {settings.proctoringMode === mode && (
                    <CheckCircle className="h-4 w-4 text-primary ml-auto" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {getModeDescription(mode)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TensorFlow Settings */}
      <Card className={!settings.tensorflow ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-indigo-600" />
            TensorFlow.js Settings
            {!settings.tensorflow && <Badge variant="secondary" className="ml-2">Disabled</Badge>}
          </CardTitle>
          <CardDescription>
            Configure client-side face and object detection using TensorFlow.js
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Detection Interval */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Detection Interval
                </Label>
                <span className="text-sm font-medium">{settings.tfIntervalMs}ms</span>
              </div>
              <Slider
                value={[settings.tfIntervalMs]}
                onValueChange={([v]) => updateSettings({ tfIntervalMs: v })}
                min={1000}
                max={5000}
                step={250}
                disabled={!settings.tensorflow}
              />
              <p className="text-xs text-muted-foreground">
                How often to run face detection. Lower = more responsive but uses more CPU.
              </p>
            </div>

            {/* No Face Strike Timeout */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <EyeOff className="h-4 w-4" />
                  No Face Strike Timeout
                </Label>
                <span className="text-sm font-medium">{settings.noFaceStrikeSec}s</span>
              </div>
              <Slider
                value={[settings.noFaceStrikeSec]}
                onValueChange={([v]) => updateSettings({ noFaceStrikeSec: v })}
                min={3}
                max={15}
                step={1}
                disabled={!settings.tensorflow}
              />
              <p className="text-xs text-muted-foreground">
                Seconds without a face before counting as a strike.
              </p>
            </div>
          </div>

          {/* Object Detection Toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <Smartphone className="h-5 w-5 text-orange-500" />
              <div>
                <Label className="text-sm font-medium">Object Detection</Label>
                <p className="text-xs text-muted-foreground">
                  Detect phones, books, and other prohibited items using COCO-SSD
                </p>
              </div>
            </div>
            <Switch
              checked={settings.objectDetection}
              onCheckedChange={(v) => updateSettings({ objectDetection: v })}
              disabled={!settings.tensorflow}
            />
          </div>
        </CardContent>
      </Card>

      {/* Rekognition Settings */}
      <Card className={!settings.rekognition ? 'opacity-60' : ''}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4 text-orange-500" />
            AWS Rekognition Settings
            {!settings.rekognition && <Badge variant="secondary" className="ml-2">Disabled</Badge>}
            {!rekognitionConfigured && <Badge variant="destructive" className="ml-2">Not Configured</Badge>}
          </CardTitle>
          <CardDescription>
            Configure server-side face analysis using AWS Rekognition API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rekognition not configured warning */}
          {!rekognitionConfigured && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    AWS Rekognition Not Configured
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                    To enable Rekognition proctoring, configure AWS credentials (AWS_ACCESS_KEY_ID, 
                    AWS_SECRET_ACCESS_KEY) in your environment variables with Rekognition permissions.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rekognition Interval */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Analysis Interval
                </Label>
                <span className="text-sm font-medium">{settings.rekognitionIntervalMs}ms</span>
              </div>
              <Slider
                value={[settings.rekognitionIntervalMs]}
                onValueChange={([v]) => updateSettings({ rekognitionIntervalMs: v })}
                min={2000}
                max={10000}
                step={500}
                disabled={!settings.rekognition || !rekognitionConfigured}
              />
              <p className="text-xs text-muted-foreground">
                How often to send frames to Rekognition. Higher = lower cost, but less responsive.
              </p>
            </div>

            {/* Object Detection Toggle - now in grid */}
            <div className="flex items-center justify-between p-4 rounded-lg border h-fit">
              <div className="flex items-center gap-3">
                <Smartphone className="h-5 w-5 text-orange-500" />
                <div>
                  <Label className="text-sm font-medium">Object Detection</Label>
                  <p className="text-xs text-muted-foreground">
                    Detect phones, tablets, books
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.rekognitionObjectDetection}
                onCheckedChange={(v) => updateSettings({ rekognitionObjectDetection: v })}
                disabled={!settings.rekognition || !rekognitionConfigured}
              />
            </div>
          </div>

          {/* Critical Violations Info */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <span className="font-medium text-sm">Monitored Violations (2-Strike System)</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <EyeOff className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-medium">No Face Detected</p>
                  <p className="text-muted-foreground">5s timeout before strike</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <Eye className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-medium">Multiple Faces</p>
                  <p className="text-muted-foreground">Another person detected</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 bg-background rounded border">
                <Smartphone className="h-4 w-4 text-red-500" />
                <div>
                  <p className="font-medium">Prohibited Object</p>
                  <p className="text-muted-foreground">Phone, tablet, or book</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Additional data (emotions, face pose, attention score) is collected for admin reports but does not trigger strikes.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cost Info */}
      {settings.rekognition && rekognitionConfigured && (
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">AWS Rekognition Pricing</p>
                <ul className="mt-2 text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                  <li>DetectFaces: ~$0.001 per image analyzed</li>
                  <li>DetectLabels (object detection): ~$0.001 per image</li>
                  <li>At {settings.rekognitionIntervalMs}ms interval: ~{Math.round(60000 / settings.rekognitionIntervalMs)} API calls/minute per exam</li>
                  <li>Estimated cost: ~${(Math.round(60000 / settings.rekognitionIntervalMs) * 0.002 * 30).toFixed(2)}/30min exam (with object detection)</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Changes indicator */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-sm font-medium">Unsaved changes</span>
          <Button size="sm" variant="secondary" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
