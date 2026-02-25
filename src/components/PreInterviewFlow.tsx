import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { jobRoles } from '@/utils/interviewUtils';

interface PreInterviewFlowProps {
  onComplete: (name: string, role: string, isFirstTime: boolean) => void;
}

export default function PreInterviewFlow({ onComplete }: PreInterviewFlowProps) {
  const [step, setStep] = useState<'info' | 'experience' | 'rules' | 'loading'>('info');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [agreedToRules, setAgreedToRules] = useState(false);

  const handleInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && role.trim()) {
      setStep('experience');
    }
  };

  const handleExperienceSubmit = (value: boolean) => {
    setIsFirstTime(value);
    setStep('rules');
  };

  const handleStartInterview = () => {
    if (agreedToRules) {
      setStep('loading');
      // Simulate initialization
      setTimeout(() => {
        onComplete(name, role, isFirstTime);
      }, 2000);
    }
  };

  // Step 1: Basic Info
  if (step === 'info') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Welcome to FRIEDE</CardTitle>
            <CardDescription>Your AI Interview Assistant</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInfoSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Your Name *</Label>
                <Input
                  id="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Position Applying For *</Label>
                <Select value={role} onValueChange={setRole} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a position" />
                  </SelectTrigger>
                  <SelectContent>
                    {jobRoles.map((jobRole) => (
                      <SelectItem key={jobRole.id} value={jobRole.title}>
                        {jobRole.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" className="w-full" size="lg">
                Continue
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 2: First Time Experience
  if (step === 'experience') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl">Hi {name}! 👋</CardTitle>
            <CardDescription>One quick question before we start</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-lg font-medium mb-6">
              Is this your first AI interview experience?
            </p>

            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                size="lg"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleExperienceSubmit(true)}
              >
                <span className="text-2xl">👍</span>
                <span>Yes, First Time</span>
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="h-24 flex flex-col gap-2"
                onClick={() => handleExperienceSubmit(false)}
              >
                <span className="text-2xl">✨</span>
                <span>I've Done This Before</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 3: Rules & Agreement
  if (step === 'rules') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="text-2xl">Interview Guidelines</CardTitle>
            <CardDescription>Please read carefully before proceeding</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Do's */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                Do's
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Speak clearly and at a natural pace</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Answer honestly and provide specific examples</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Use your webcam and microphone throughout</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Take your time to think before answering</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-500 mt-1">✓</span>
                  <span>Ask for clarification if needed</span>
                </li>
              </ul>
            </div>

            {/* Don'ts */}
            <div>
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-500" />
                Don'ts
              </h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Don't switch tabs or leave the interview window</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Don't use external resources or notes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Don't pause for extended periods without reason</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span>Don't provide dishonest or exaggerated answers</span>
                </li>
              </ul>
            </div>

            {/* Agreement Checkbox */}
            <div className="border-t pt-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="agree"
                  checked={agreedToRules}
                  onCheckedChange={(checked) => setAgreedToRules(checked as boolean)}
                />
                <Label htmlFor="agree" className="text-sm cursor-pointer">
                  I have read and understood the guidelines. I agree to follow all rules and I'm ready to proceed with the interview.
                </Label>
              </div>
            </div>

            <Button
              onClick={handleStartInterview}
              disabled={!agreedToRules}
              className="w-full"
              size="lg"
            >
              Start Interview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Step 4: Loading
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 flex items-center justify-center p-8">
      <div className="text-center space-y-6">
        <Loader2 className="w-16 h-16 text-blue-400 animate-spin mx-auto" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Initializing Interview...</h2>
          <p className="text-blue-300">Setting up camera, microphone, and AI systems</p>
        </div>
      </div>
    </div>
  );
}
