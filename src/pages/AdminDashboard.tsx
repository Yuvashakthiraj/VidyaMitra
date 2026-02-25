import { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useInterview } from "@/contexts/InterviewContext";
import { useNavigate } from "react-router-dom";
import { InterviewSession, RoundOneAptitudeResult } from "@/types";
import { getAllInterviews, getRound1AptitudeResults, updateRound1AptitudeResult } from "@/lib/firebaseService";
import { adminApi } from "@/lib/api";
import { BulkResumeUpload } from "@/components/BulkResumeUpload";
import { ResumeUpload } from "@/components/ResumeUpload";
import { toast } from "sonner";
import { sendRound2InvitationEmail, isEmailConfigured } from "@/utils/emailService";
import AddQuestionDialog from "@/components/AddQuestionDialog";
import { CodingQuestion } from "@/types/coding";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Users,
  BarChart,
  Clock,
  Filter,
  CheckCheck,
  Mail,
  Bot,
  AlertTriangle,
  Ban,
  MessageSquare,
  Settings,
  Lock,
  Unlock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader2,
  Brain,
  Code,
  Plus,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { subscribeToRoleChanges, toggleRoleStatusInDB } from "@/utils/roleManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { codingQuestions } from "@/data/codingQuestions";
import { getAIProvider, toggleAIProvider, getProviderConfig, type AIProvider } from "@/utils/aiProviderService";
import { jobRoles } from "@/utils/interviewUtils";

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const { sendSelectionEmailToUser, isLoading } = useInterview();
  const navigate = useNavigate();

  const [interviews, setInterviews] = useState<InterviewSession[]>([]);
  const [filteredInterviews, setFilteredInterviews] = useState<InterviewSession[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [processingEmail, setProcessingEmail] = useState<string | null>(null);
  const [rolesWithStatus, setRolesWithStatus] = useState<Array<import("@/types").JobRole & { isOpen: boolean }>>(jobRoles.map(r => ({ ...r, isOpen: true })));
  const [totalResumes, setTotalResumes] = useState(0);

  // Round 1 Aptitude Results
  const [round1Results, setRound1Results] = useState<RoundOneAptitudeResult[]>([]);
  const [filteredRound1Results, setFilteredRound1Results] = useState<RoundOneAptitudeResult[]>([]);
  const [round1SearchQuery, setRound1SearchQuery] = useState("");
  const [sendingRound2Emails, setSendingRound2Emails] = useState<Set<string>>(new Set());

  // Coding Questions State
  const [questions, setQuestions] = useState<CodingQuestion[]>(codingQuestions);

  // AI Provider State
  const [aiProvider, setAiProvider] = useState<AIProvider>(getAIProvider());

  const handleToggleProvider = () => {
    const newProvider = toggleAIProvider();
    setAiProvider(newProvider);
    toast.success(`Switched to ${getProviderConfig(newProvider).displayName}`);
  };

  // Handler for adding new question
  const handleQuestionAdded = (newQuestion: CodingQuestion) => {
    setQuestions(prev => [...prev, newQuestion]);
    toast.success('Question added successfully!');
  };

  useEffect(() => {
    if (!isAdmin) {
      navigate("/login");
    }
  }, [isAdmin, navigate]);

  // Real-time subscription to role changes from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToRoleChanges((roles) => {
      setRolesWithStatus(roles);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const loadInterviews = async () => {
      try {
        console.log('🔄 AdminDashboard: Loading interviews...');
        console.log('User is admin:', isAdmin);

        // Admin sees all interviews from all users via Firebase
        const allInterviews = await getAllInterviews();
        console.log(`✅ Loaded ${allInterviews.length} interviews from Firestore`);

        setInterviews(allInterviews);
        setFilteredInterviews(allInterviews);

        // Load Round 1 aptitude results
        const aptitudeResults = await getRound1AptitudeResults();
        console.log(`✅ Loaded ${aptitudeResults.length} Round 1 aptitude results`);
        setRound1Results(aptitudeResults);
        setFilteredRound1Results(aptitudeResults);

        // Count total resumes saved
        try {
          // TODO: Could add a dedicated admin API endpoint for resume count
          setTotalResumes(0);
        } catch (err) {
          console.error('Error counting resumes:', err);
        }
      } catch (error: any) {
        console.error('❌ Error loading interviews:', error);
        console.error('Error details:', {
          message: error?.message,
          code: error?.code,
          stack: error?.stack
        });
        toast.error('Failed to load interviews');
      }
    };

    loadInterviews();

    // Refresh every 10 seconds
    const intervalId = setInterval(loadInterviews, 10000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let results = interviews;

    if (filterRole) {
      results = results.filter(interview =>
        interview.roleName.toLowerCase().includes(filterRole.toLowerCase())
      );
    }

    if (searchQuery) {
      results = results.filter(interview =>
        interview.roleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        interview.id.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredInterviews(results);
  }, [searchQuery, filterRole, interviews]);

  // Filter Round 1 results
  useEffect(() => {
    let results = round1Results;

    if (round1SearchQuery) {
      results = results.filter(result =>
        result.userEmail.toLowerCase().includes(round1SearchQuery.toLowerCase()) ||
        result.roleName.toLowerCase().includes(round1SearchQuery.toLowerCase()) ||
        result.userName?.toLowerCase().includes(round1SearchQuery.toLowerCase())
      );
    }

    setFilteredRound1Results(results);
  }, [round1SearchQuery, round1Results]);

  const totalInterviews = interviews.length;
  const completedInterviews = interviews.filter(i => i.completed).length;
  const averageScore = completedInterviews > 0
    ? interviews
      .filter(i => i.completed && i.score)
      .reduce((sum, i) => sum + (i.score || 0), 0) / completedInterviews
    : 0;

  const uniqueRoles = Array.from(new Set(interviews.map(i => i.roleName)));

  // AI Detection Statistics
  const interviewsWithAI = interviews.filter(i =>
    i.answers?.some(a => a.feedback?.possiblyAI)
  ).length;

  const totalAIDetections = interviews.reduce((acc, i) =>
    acc + (i.answers?.filter(a => a.feedback?.possiblyAI).length || 0), 0
  );

  const averageAIConfidence = interviews.reduce((acc, i) => {
    const aiAnswers = i.answers?.filter(a => a.feedback?.possiblyAI && a.feedback?.aiConfidence) || [];
    const totalConfidence = aiAnswers.reduce((sum, a) => sum + (a.feedback?.aiConfidence || 0), 0);
    return acc + totalConfidence;
  }, 0) / (totalAIDetections || 1);

  const highConfidenceAI = interviews.reduce((acc, i) =>
    acc + (i.answers?.filter(a => a.feedback?.aiConfidence && a.feedback.aiConfidence >= 80).length || 0), 0
  );

  const handleSendSelectionEmail = async (interviewId: string) => {
    setProcessingEmail(interviewId);
    try {
      await sendSelectionEmailToUser(interviewId);
      // Reload interviews from Firebase
      const updatedInterviews = await getAllInterviews();
      setInterviews(updatedInterviews);
      setFilteredInterviews(updatedInterviews);
    } catch (error) {
      console.error("Failed to send selection email:", error);
    } finally {
      setProcessingEmail(null);
    }
  };

  const getStatusBadge = (interview: InterviewSession) => {
    if (interview.aborted) {
      return <Badge className="bg-red-600 flex items-center gap-1"><Ban className="h-3 w-3" />Aborted</Badge>;
    } else if (interview.selected) {
      return <Badge className="bg-primary">Selected</Badge>;
    } else if (interview.completed) {
      return <Badge className="bg-green-600">Completed</Badge>;
    } else if (interview.answers.length > 0) {
      return <Badge className="bg-amber-500">In Progress</Badge>;
    } else {
      return <Badge variant="outline">Not Started</Badge>;
    }
  };

  const getAIBadge = (interview: InterviewSession) => {
    const aiCount = interview.aiDetectionCount ||
      interview.answers.filter(a => a.feedback?.possiblyAI).length;

    if (aiCount > 0) {
      const highConfidence = interview.answers.filter(
        a => a.feedback?.possiblyAI && a.feedback?.aiConfidence && a.feedback.aiConfidence >= 70
      ).length;

      return (
        <Badge
          variant="outline"
          className={`flex items-center gap-1 ${highConfidence > 0
            ? 'bg-red-100 text-red-800 border-red-300'
            : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
        >
          <Bot className="h-3 w-3" />
          Possible AI Usage ({aiCount})
        </Badge>
      );
    }
    return null;
  };

  const getMessageBadge = (interview: InterviewSession) => {
    if (interview.messageGenerated) {
      return (
        <Badge variant="outline" className="bg-green-100 text-green-800 flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Message Sent
        </Badge>
      );
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleToggleRole = async (roleId: string) => {
    const currentRole = rolesWithStatus.find(r => r.id === roleId);
    const isCurrentlyOpen = currentRole?.isOpen ?? true;
    const confirmed = window.confirm(
      `Are you sure you want to ${isCurrentlyOpen ? 'close' : 'open'} this job role for interviews?`
    );

    if (confirmed) {
      try {
        await toggleRoleStatusInDB(roleId, isCurrentlyOpen);
        // No need to manually update state — the real-time listener will do it
        toast.success(`Role ${isCurrentlyOpen ? 'closed' : 'opened'} successfully`);
      } catch (error) {
        console.error('Failed to toggle role:', error);
        toast.error('Failed to update role status. Please try again.');
      }
    }
  };

  // Handle selecting candidate for Round 2
  const handleSelectForRound2 = async (resultId: string, result: RoundOneAptitudeResult) => {
    const confirmed = window.confirm(
      `Select ${result.userEmail} for Round 2 (Mock Interview) for ${result.roleName}?\n\nThis will send an email notification to the candidate.`
    );

    if (!confirmed) return;

    setSendingRound2Emails(prev => new Set(prev).add(resultId));

    try {
      // Update Firestore to mark as selected for Round 2
      await updateRound1AptitudeResult(resultId, {
        selectedForRound2: true,
        round2EmailSent: true,
      });

      // Send email notification (using client-side email for now, will use Firebase Function in production)
      const emailSent = await sendRound2Email(result);

      if (emailSent) {
        toast.success(`Round 2 invitation sent to ${result.userEmail}`);

        // Reload results
        const updatedResults = await getRound1AptitudeResults();
        setRound1Results(updatedResults);
        setFilteredRound1Results(updatedResults);
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error selecting for Round 2:', error);
      toast.error('Failed to send Round 2 invitation');
    } finally {
      setSendingRound2Emails(prev => {
        const newSet = new Set(prev);
        newSet.delete(resultId);
        return newSet;
      });
    }
  };

  // Send Round 2 invitation email using EmailJS
  const sendRound2Email = async (result: RoundOneAptitudeResult): Promise<boolean> => {
    try {
      console.log('Sending Round 2 invitation email to:', result.userEmail);

      // Check if EmailJS is configured
      if (!isEmailConfigured()) {
        console.warn('⚠️ EmailJS is not configured. Check emailService.ts for setup instructions.');
        toast.warning("Email Configuration Required: EmailJS credentials are not configured. Check console for setup instructions.");

        // Show preview of what would be sent
        const emailPreview = `
📧 EMAIL PREVIEW (not sent - EmailJS not configured):

To: ${result.userEmail}
Subject: Congratulations! Selected for Round 2 - ${result.roleName}

Dear ${result.userName || 'Candidate'},

Congratulations! You have successfully passed Round 1 (Aptitude Test) 
for the ${result.roleName} position.

Your Round 1 Score: ${result.score}%

You have been selected to proceed to Round 2 - Mock Interview.

Please log in to your account and check the History page to start Round 2.

Best regards,
The MockMate Team
        `;

        console.log(emailPreview);
        return true; // Return true to allow process to continue even if email not configured
      }

      // Send actual email using EmailJS
      const emailResult = await sendRound2InvitationEmail(
        result.userEmail,
        result.userName || 'Candidate',
        result.roleName,
        result.score
      );

      if (emailResult.success) {
        console.log('✅ Email sent successfully to:', result.userEmail);
        toast.success(`Email Sent Successfully — Round 2 invitation sent to ${result.userEmail}`);
        return true;
      } else {
        console.error('❌ Failed to send email:', emailResult.error);
        toast.error(`Email Sending Failed: ${emailResult.error || "Failed to send email. Candidate still selected."}`);
        return false;
      }
    } catch (error) {
      console.error('Error sending Round 2 email:', error);
      toast.error("Email Error: An error occurred while sending the email.");
      return false;
    }
  };

  return (
    <Layout>
      <div className="container max-w-6xl mx-auto px-4 py-12">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage and monitor user interviews
            </p>
          </div>
          <div className="flex gap-2">
            {/* AI Provider Toggle */}
            <Button
              variant={aiProvider === 'openai' ? 'default' : 'outline'}
              onClick={handleToggleProvider}
              className="flex items-center gap-2"
              title={`Currently using ${getProviderConfig(aiProvider).displayName}. Click to toggle.`}
            >
              {aiProvider === 'openai' ? (
                <ToggleRight className="h-4 w-4" />
              ) : (
                <ToggleLeft className="h-4 w-4" />
              )}
              {aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/api-test')}
              className="flex items-center gap-2"
            >
              <Bot className="h-4 w-4" />
              Gemini Test
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate('/openai-test')}
              className="flex items-center gap-2"
            >
              <Brain className="h-4 w-4" />
              OpenAI Test
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Users className="mr-2 h-5 w-5 text-primary" />
                Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between mb-1">
                <p className="text-sm text-muted-foreground">Total Interviews:</p>
                <p className="text-sm font-medium">{totalInterviews}</p>
              </div>
              <div className="flex justify-between mb-1">
                <p className="text-sm text-muted-foreground">Completed:</p>
                <p className="text-sm font-medium">{completedInterviews}</p>
              </div>
              <div className="flex justify-between mb-1">
                <p className="text-sm text-muted-foreground">Average Score:</p>
                <p className="text-sm font-medium">
                  {averageScore > 0 ? `${averageScore.toFixed(1)}/10` : 'N/A'}
                </p>
              </div>
              <div className="flex justify-between">
                <p className="text-sm text-muted-foreground">Resumes Saved:</p>
                <p className="text-sm font-medium text-green-600">{totalResumes}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <BarChart className="mr-2 h-5 w-5 text-primary" />
                Popular Roles
              </CardTitle>
            </CardHeader>
            <CardContent>
              {uniqueRoles.length > 0 ? (
                <div className="space-y-1">
                  {uniqueRoles.slice(0, 5).map(role => (
                    <div key={role} className="flex justify-between">
                      <p className="text-sm text-muted-foreground">{role}:</p>
                      <p className="text-sm font-medium">
                        {interviews.filter(i => i.roleName === role).length}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Detection Statistics</CardTitle>
              <CardDescription>Advanced AI content detection metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="text-2xl font-bold text-primary">{interviewsWithAI}</p>
                    <p className="text-sm text-muted-foreground">Interviews with AI</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="text-2xl font-bold text-primary">{totalAIDetections}</p>
                    <p className="text-sm text-muted-foreground">Total AI Answers</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="text-2xl font-bold text-primary">{averageAIConfidence.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Avg Confidence</p>
                  </div>
                  <div className="p-3 rounded-lg bg-accent/50">
                    <p className="text-2xl font-bold text-destructive">{highConfidenceAI}</p>
                    <p className="text-sm text-muted-foreground">High Confidence (≥80%)</p>
                  </div>
                </div>
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Detection Rate</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-accent rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(interviewsWithAI / (interviews.length || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {((interviewsWithAI / (interviews.length || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Clock className="mr-2 h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {interviews.length > 0 ? (
                <div className="space-y-1">
                  {interviews
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 3)
                    .map(interview => (
                      <div key={interview.id} className="flex justify-between">
                        <p className="text-sm text-muted-foreground">
                          {interview.roleName}:
                        </p>
                        <p className="text-sm font-medium">
                          {formatDate(interview.date)}
                        </p>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="mr-2 h-5 w-5 text-primary" />
              Role Management
            </CardTitle>
            <CardDescription>
              Control which job roles are available for interviews
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {rolesWithStatus.map((role) => (
                <Card key={role.id} className={`border-2 ${role.isOpen ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30' : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-medium mb-1">{role.title}</h4>
                        <p className="text-sm text-muted-foreground mb-3">{role.description}</p>
                        <Badge variant={role.isOpen ? "default" : "secondary"} className="mb-2">
                          {role.isOpen ? (
                            <>
                              <Unlock className="h-3 w-3 mr-1" />
                              Open
                            </>
                          ) : (
                            <>
                              <Lock className="h-3 w-3 mr-1" />
                              Closed
                            </>
                          )}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant={role.isOpen ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleRole(role.id)}
                      className="w-full"
                    >
                      {role.isOpen ? (
                        <>
                          <Lock className="h-4 w-4 mr-1" />
                          Close Role
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-1" />
                          Open Role
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Resume Analysis Section */}
        <div className="space-y-6 mb-8">
          {/* Single Resume Check with Best Match */}
          <Card>
            <CardHeader>
              <CardTitle>Single Resume Check - Find Best Role Match</CardTitle>
              <CardDescription>Upload a resume to see which role matches best with the candidate's profile</CardDescription>
            </CardHeader>
            <CardContent>
              <ResumeUpload
                showBestMatch={true}
                minimumScore={0}
              />
            </CardContent>
          </Card>

          {/* Bulk Resume Analysis */}
          <BulkResumeUpload />
        </div>

        {/* Interview Management with Tabs for Round 1, Round 2, and Coding Questions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Multi-Round Interview Management</CardTitle>
            <CardDescription>
              Manage Round 1 (Aptitude), Round 2 (Mock Interview) candidates, and Coding Questions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="round1" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="round1" className="gap-2">
                  <Brain className="h-4 w-4" />
                  Round 1 - Aptitude ({round1Results.length})
                </TabsTrigger>
                <TabsTrigger value="round2" className="gap-2">
                  <Users className="h-4 w-4" />
                  Round 2 - Mock Interview ({interviews.filter(i => i.round === 2).length})
                </TabsTrigger>
                <TabsTrigger value="coding" className="gap-2">
                  <Code className="h-4 w-4" />
                  Coding Questions
                </TabsTrigger>
              </TabsList>

              {/* Round 1 Aptitude Results */}
              <TabsContent value="round1" className="space-y-4">
                <div className="flex gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by email, name, or role..."
                      className="pl-8"
                      value={round1SearchQuery}
                      onChange={(e) => setRound1SearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                {filteredRound1Results.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Candidate</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Correct/Total</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Proctoring</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRound1Results
                          .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
                          .map(result => (
                            <TableRow key={result.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{result.userName || 'N/A'}</p>
                                  <p className="text-sm text-muted-foreground">{result.userEmail}</p>
                                </div>
                              </TableCell>
                              <TableCell>{result.roleName}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={result.score >= 70 ? "default" : result.score >= 50 ? "secondary" : "destructive"}
                                  className="text-base px-3 py-1"
                                >
                                  {result.score}%
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {result.correctAnswers} / {result.totalQuestions}
                              </TableCell>
                              <TableCell>
                                {new Date(result.completedAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </TableCell>
                              <TableCell>
                                {result.selectedForRound2 ? (
                                  <Badge className="bg-green-100 text-green-800 flex items-center gap-1 w-fit">
                                    <CheckCircle className="h-3 w-3" />
                                    Selected for R2
                                  </Badge>
                                ) : result.aborted ? (
                                  <Badge className="bg-red-100 text-red-800 flex items-center gap-1 w-fit">
                                    <Ban className="h-3 w-3" />
                                    Aborted
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                                    <Clock className="h-3 w-3" />
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {result.aborted ? (
                                  <span className="text-xs text-red-600" title={result.abortReason}>
                                    {result.abortReason ? (result.abortReason.length > 30 ? result.abortReason.substring(0, 30) + '...' : result.abortReason) : 'Violated'}
                                  </span>
                                ) : (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">
                                    Clean
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                {!result.selectedForRound2 && !result.aborted && result.score >= 50 && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSelectForRound2(result.id, result)}
                                    disabled={sendingRound2Emails.has(result.id)}
                                    className="gap-2"
                                  >
                                    {sendingRound2Emails.has(result.id) ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Sending...
                                      </>
                                    ) : (
                                      <>
                                        <Mail className="h-4 w-4" />
                                        Select for Round 2
                                      </>
                                    )}
                                  </Button>
                                )}
                                {!result.selectedForRound2 && !result.aborted && result.score < 50 && (
                                  <Badge variant="secondary" className="flex items-center gap-1">
                                    <XCircle className="h-3 w-3" />
                                    Below threshold
                                  </Badge>
                                )}
                                {result.aborted && !result.selectedForRound2 && (
                                  <Badge variant="destructive" className="flex items-center gap-1">
                                    <Ban className="h-3 w-3" />
                                    Disqualified
                                  </Badge>
                                )}
                                {result.selectedForRound2 && result.round2EmailSent && (
                                  <Badge className="bg-green-50 text-green-700 flex items-center gap-1">
                                    <CheckCircle className="h-3 w-3" />
                                    Email Sent
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CheckCheck className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Round 1 Results Found</h3>
                    <p className="text-muted-foreground">
                      No candidates have completed the aptitude test yet
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Round 2 Mock Interview Results */}
              <TabsContent value="round2" className="space-y-4">
                <div className="flex flex-col md:flex-row gap-4 mt-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search interviews..."
                      className="pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="relative w-full md:w-48">
                    <Filter className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <select
                      className="w-full h-10 rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                    >
                      <option value="">All Roles</option>
                      {uniqueRoles.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {/* Filter Round 2 interviews only */}
                {filteredInterviews.filter(i => i.round === 2 || !i.round).length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Email</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>ATS Score</TableHead>
                          <TableHead>Flags</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInterviews
                          .filter(i => i.round === 2 || !i.round) // Show Round 2 and old interviews without round field
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map(interview => (
                            <TableRow key={interview.id}>
                              <TableCell className="font-medium">
                                {interview.userEmail || 'Guest User'}
                              </TableCell>
                              <TableCell>{interview.roleName}</TableCell>
                              <TableCell>{formatDate(interview.date)}</TableCell>
                              <TableCell>{getStatusBadge(interview)}</TableCell>
                              <TableCell>
                                {interview.completed && interview.score && !interview.aborted
                                  ? `${interview.score.toFixed(1)}/10`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {interview.resume ? (
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      variant={interview.resume.atsScore >= 80 ? "default" : interview.resume.atsScore >= 60 ? "secondary" : "destructive"}
                                      className="text-xs"
                                    >
                                      {interview.resume.atsScore}%
                                    </Badge>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  {interview.round === 2 && (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 text-xs">
                                      Round 2
                                    </Badge>
                                  )}
                                  {getAIBadge(interview)}
                                  {getMessageBadge(interview)}
                                  {interview.abortReason && (
                                    <Badge variant="outline" className="bg-red-50 text-red-800 text-xs">
                                      {interview.abortReason.substring(0, 25)}...
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {interview.completed && !interview.aborted && !interview.messageGenerated && interview.score && interview.score >= 4 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center"
                                    onClick={() => handleSendSelectionEmail(interview.id)}
                                    disabled={processingEmail === interview.id || isLoading}
                                  >
                                    <Mail className="mr-1 h-4 w-4" />
                                    {processingEmail === interview.id ? 'Sending...' : 'Generate Message'}
                                  </Button>
                                )}
                                {interview.messageGenerated && (
                                  <Badge variant="outline" className="bg-green-100 text-green-800">
                                    Message Generated
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <CheckCheck className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Interviews Found</h3>
                    <p className="text-muted-foreground">
                      No interviews matching your current filters
                    </p>
                  </div>
                )}
              </TabsContent>

              {/* Coding Questions Management */}
              <TabsContent value="coding" className="space-y-4">
                <div className="flex justify-between items-center mt-4">
                  <div>
                    <h3 className="text-lg font-semibold">Coding Questions Management</h3>
                    <p className="text-sm text-muted-foreground">
                      Manage coding practice questions and test cases
                    </p>
                  </div>
                  <AddQuestionDialog onQuestionAdded={handleQuestionAdded} />
                </div>

                {/* Coding Questions Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Total Questions</p>
                          <p className="text-2xl font-bold">{questions.length}</p>
                        </div>
                        <Code className="h-8 w-8 text-blue-500" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Easy</p>
                          <p className="text-2xl font-bold text-green-600">
                            {questions.filter(q => q.difficulty === 'easy').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <span className="text-green-600 text-sm font-bold">E</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Medium</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {questions.filter(q => q.difficulty === 'medium').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                          <span className="text-yellow-600 text-sm font-bold">M</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-600">Hard</p>
                          <p className="text-2xl font-bold text-red-600">
                            {questions.filter(q => q.difficulty === 'hard').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                          <span className="text-red-600 text-sm font-bold">H</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Coding Questions Table */}
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <CardTitle>All Coding Questions</CardTitle>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">
                          <Filter className="h-4 w-4 mr-2" />
                          Filter
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Question</TableHead>
                            <TableHead>Difficulty</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Test Cases</TableHead>
                            <TableHead>Time Limit</TableHead>
                            <TableHead>Languages</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {questions.map((question, index) => (
                            <TableRow key={question.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{question.title}</p>
                                  <p className="text-sm text-muted-foreground line-clamp-1">
                                    {question.description.slice(0, 60)}...
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  className={
                                    question.difficulty === 'easy'
                                      ? 'bg-green-100 text-green-800'
                                      : question.difficulty === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800'
                                        : 'bg-red-100 text-red-800'
                                  }
                                >
                                  {question.difficulty.toUpperCase()}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{question.category}</Badge>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm">
                                  <span className="font-medium">{question.testCases.length}</span>
                                  <span className="text-muted-foreground ml-1">
                                    ({question.testCases.filter(tc => tc.isHidden).length} hidden)
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                {question.timeLimit ? `${question.timeLimit} min` : 'No limit'}
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {Object.keys(question.starterCode).map(lang => (
                                    <Badge key={lang} variant="secondary" className="text-xs">
                                      {lang}
                                    </Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default AdminDashboard;
