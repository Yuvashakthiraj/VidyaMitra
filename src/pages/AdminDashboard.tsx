import React, { useState, useEffect, useMemo } from "react";
import Layout from "@/components/Layout";
import { useAuth } from "@/contexts/AuthContext";
import { useInterview } from "@/contexts/InterviewContext";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { InterviewSession, RoundOneAptitudeResult } from "@/types";
import { updateRound1AptitudeResult } from "@/lib/firebaseService";
import { adminApi, emailApi, round1Api, snsApi } from "@/lib/api";
import { BulkResumeUpload } from "@/components/BulkResumeUpload";
import { ResumeUpload } from "@/components/ResumeUpload";
import { toast } from "sonner";
import AddQuestionDialog from "@/components/AddQuestionDialog";
import { CodingQuestion } from "@/types/coding";
import { useAdminStats, useAdminInterviews, useRound1Results, useInstitutions, useCreateInstitution, useUpdateInstitution, QUERY_KEYS } from "@/hooks/useDataQueries";
import { Skeleton } from "@/components/ui/skeleton";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ToggleRight,
  Building2,
  HardDrive,
  DollarSign,
  Megaphone,
  Send,
  RefreshCw
} from "lucide-react";
import S3Manager from "@/components/S3Manager";
import AWSUsageDashboard from "@/components/AWSUsageDashboard";
import { subscribeToRoleChanges, toggleRoleStatusInDB } from "@/utils/roleManagement";
import { codingQuestions } from "@/data/codingQuestions";
import { getAIProvider, toggleAIProvider, getProviderConfig, type AIProvider } from "@/utils/aiProviderService";
import { jobRoles } from "@/utils/interviewUtils";

const AdminDashboard = () => {
  const { user, isAdmin } = useAuth();
  const { sendSelectionEmailToUser, isLoading } = useInterview();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // React Query hooks for cached data
  const { data: adminStats, isLoading: statsLoading } = useAdminStats();
  const { data: interviews = [], isLoading: interviewsLoading } = useAdminInterviews();
  const { data: round1Results = [], isLoading: round1Loading } = useRound1Results();
  const { data: institutions = [], isLoading: institutionsLoading } = useInstitutions();
  const createInstitutionMutation = useCreateInstitution();
  const updateInstitutionMutation = useUpdateInstitution();

  // Local state for UI filtering
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [processingEmail, setProcessingEmail] = useState<string | null>(null);
  const [rolesWithStatus, setRolesWithStatus] = useState<Array<import("@/types").JobRole & { isOpen: boolean }>>(jobRoles.map(r => ({ ...r, isOpen: true })));
  const [round1SearchQuery, setRound1SearchQuery] = useState("");
  const [sendingRound2Emails, setSendingRound2Emails] = useState<Set<string>>(new Set());
  const [seedingData, setSeedingData] = useState(false);

  // Bypass dialog state — add test candidate without doing full aptitude test
  const [showBypassDialog, setShowBypassDialog] = useState(false);
  const [bypassForm, setBypassForm] = useState({ name: '', email: '', role: '', score: '80' });
  const [submittingBypass, setSubmittingBypass] = useState(false);

  // Custom send-email dialog (admin enters any email address)
  const [showSendEmailDialog, setShowSendEmailDialog] = useState(false);
  const [emailTarget, setEmailTarget] = useState<RoundOneAptitudeResult | null>(null);
  const [customEmailForm, setCustomEmailForm] = useState({ to_email: '', to_name: '', role_name: '', round1_score: '' });
  const [sendingCustomEmail, setSendingCustomEmail] = useState(false);
  
  // Institution Dialog State
  const [showInstitutionDialog, setShowInstitutionDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [institutionFormData, setInstitutionFormData] = useState({
    id: '',
    name: '',
    email: '',
    password: '',
    institutionCode: '',
    institutionType: 'University',
    location: '',
    contactPerson: '',
    phone: '',
    website: ''
  });
  const [creatingInstitution, setCreatingInstitution] = useState(false);
  const [updatingInstitution, setUpdatingInstitution] = useState<string | null>(null);

  // Coding Questions State
  const [questions, setQuestions] = useState<CodingQuestion[]>(codingQuestions);

  // AI Provider State
  const [aiProvider, setAiProvider] = useState<AIProvider>(getAIProvider());

  // Active View State for sidebar navigation
  const [activeView, setActiveView] = React.useState<'dashboard' | 'round1' | 'round2' | 'coding' | 'institutions' | 'roles' | 'resume' | 'storage' | 'aws' | 'marketing'>('dashboard');

  // SNS Marketing State
  const [snsTopics, setSnsTopics] = useState<any[]>([]);
  const [loadingSNS, setLoadingSNS] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<any>(null);
  const [showCreateTopicDialog, setShowCreateTopicDialog] = useState(false);
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [topicFormData, setTopicFormData] = useState({ name: '', displayName: '', description: '' });
  const [subscribeEmail, setSubscribeEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [publishFormData, setPublishFormData] = useState({ subject: '', message: '' });
  const [processingAction, setProcessingAction] = useState(false);
  const [topicSubscriptions, setTopicSubscriptions] = useState<any[]>([]);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);

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

  // Filter interviews using useMemo for performance
  const filteredInterviews = useMemo(() => {
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

    return results;
  }, [interviews, filterRole, searchQuery]);

  // Filter Round 1 results using useMemo
  const filteredRound1Results = useMemo(() => {
    let results = round1Results;

    if (round1SearchQuery) {
      results = results.filter(result =>
        result.userEmail.toLowerCase().includes(round1SearchQuery.toLowerCase()) ||
        result.roleName.toLowerCase().includes(round1SearchQuery.toLowerCase()) ||
        result.userName?.toLowerCase().includes(round1SearchQuery.toLowerCase())
      );
    }

    return results;
  }, [round1Results, round1SearchQuery]);

  // Total resumes from admin stats
  const totalResumes = adminStats?.totalResumes || 0;

  // Handle institution creation/update using React Query mutations
  const handleSaveInstitution = async () => {
    // Validation
    if (!institutionFormData.name.trim()) {
      toast.error('Institution name is required');
      return;
    }
    if (!institutionFormData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!editMode && (!institutionFormData.password.trim() || institutionFormData.password.length < 6)) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!institutionFormData.institutionCode.trim()) {
      toast.error('Institution code is required');
      return;
    }
    
    try {
      setCreatingInstitution(true);
      
      if (editMode) {
        // Update existing institution using mutation
        await updateInstitutionMutation.mutateAsync({
          id: institutionFormData.id,
          data: {
            name: institutionFormData.name,
            email: institutionFormData.email,
            institutionCode: institutionFormData.institutionCode,
            institutionType: institutionFormData.institutionType,
            location: institutionFormData.location,
            contactPerson: institutionFormData.contactPerson,
            phone: institutionFormData.phone,
            website: institutionFormData.website,
            isActive: true
          }
        });
        
        toast.success(`Institution "${institutionFormData.name}" updated successfully!`);
      } else {
        // Create new institution using mutation
        await createInstitutionMutation.mutateAsync(institutionFormData);
        
        toast.success(`Institution "${institutionFormData.name}" created successfully!`);
        
        // Show credentials info
        toast.info(`Login Code: ${institutionFormData.institutionCode} | Password: ${institutionFormData.password}`, {
          duration: 10000
        });
      }
      
      // Reset form
      setInstitutionFormData({
        id: '',
        name: '',
        email: '',
        password: '',
        institutionCode: '',
        institutionType: 'University',
        location: '',
        contactPerson: '',
        phone: '',
        website: ''
      });
      
      setEditMode(false);
      setShowInstitutionDialog(false);
      
      // Institutions list will auto-refresh via React Query cache invalidation
    } catch (error: any) {
      console.error('Failed to save institution:', error);
      const errorMessage = error instanceof Error ? error.message : `Failed to ${editMode ? 'update' : 'create'} institution`;
      toast.error(errorMessage);
    } finally {
      setCreatingInstitution(false);
    }
  };
  
  // Handle view institution details
  const handleViewInstitution = (institution: any) => {
    setSelectedInstitution(institution);
    setShowViewDialog(true);
  };
  
  // Handle edit institution
  const handleEditInstitution = (institution: any) => {
    setInstitutionFormData({
      id: institution.id,
      name: institution.name,
      email: institution.email,
      password: '', // Don't show existing password
      institutionCode: institution.institution_code,
      institutionType: institution.institution_type || 'University',
      location: institution.location || '',
      contactPerson: institution.contact_person || '',
      phone: institution.phone || '',
      website: institution.website || ''
    });
    setEditMode(true);
    setShowInstitutionDialog(true);
  };
  
  // Handle toggle institution active status
  const handleToggleInstitutionStatus = async (institution: any) => {
    try {
      setUpdatingInstitution(institution.id);
      const newStatus = !institution.is_active;
      
      await updateInstitutionMutation.mutateAsync({
        id: institution.id,
        data: {
          name: institution.name,
          email: institution.email,
          institutionCode: institution.institution_code,
          institutionType: institution.institution_type,
          location: institution.location,
          contactPerson: institution.contact_person,
          phone: institution.phone,
          website: institution.website,
          isActive: newStatus
        }
      });
      
      toast.success(`Institution ${newStatus ? 'activated' : 'deactivated'} successfully!`);
    } catch (error: any) {
      console.error('Failed to toggle institution status:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update institution status';
      toast.error(errorMessage);
    } finally {
      setUpdatingInstitution(null);
    }
  };
  
  // Open create dialog (reset form)
  const handleOpenCreateDialog = () => {
    setInstitutionFormData({
      id: '',
      name: '',
      email: '',
      password: '',
      institutionCode: '',
      institutionType: 'University',
      location: '',
      contactPerson: '',
      phone: '',
      website: ''
    });
    setEditMode(false);
    setShowInstitutionDialog(true);
  };

  // Use admin stats from API for accurate counts, fallback to client-side computation
  const totalInterviews = adminStats?.totalAllActivities ?? interviews.length;
  const completedInterviews = adminStats?.completedInterviews ?? interviews.filter(i => i.completed).length;
  const averageScore = adminStats?.averageScore ?? (
    interviews.filter(i => i.completed).length > 0
      ? interviews
        .filter(i => i.completed && i.score)
        .reduce((sum, i) => sum + (i.score || 0), 0) / interviews.filter(i => i.completed).length
      : 0
  );

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
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_INTERVIEWS] });
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

  // Handle selecting candidate for Round 2 and sending SES email
  const handleSelectForRound2 = async (resultId: string, result: RoundOneAptitudeResult) => {
    setSendingRound2Emails(prev => new Set(prev).add(resultId));
    try {
      // Mark as selected in DB
      await round1Api.update(resultId, { selectedForRound2: true, round2EmailSent: false });

      // Send email via AWS SES
      const emailResult = await emailApi.sendRound2Email({
        to_email: result.userEmail,
        to_name: result.userName || 'Candidate',
        role_name: result.roleName,
        round1_score: result.score,
      });

      // Mark email as sent
      await round1Api.update(resultId, { round2EmailSent: true });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ROUND1_RESULTS] });
      toast.success(`Round 2 invitation sent to ${result.userEmail}`);
    } catch (error: any) {
      console.error('Error selecting for Round 2:', error);
      // Still mark as selected even if email failed — admin can retry
      try { await round1Api.update(resultId, { selectedForRound2: true }); } catch { }
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ROUND1_RESULTS] });
      toast.error(`Selected for R2, but email failed: ${error.message || 'Unknown error'}. Use "Send Email" to retry.`);
    } finally {
      setSendingRound2Emails(prev => {
        const newSet = new Set(prev);
        newSet.delete(resultId);
        return newSet;
      });
    }
  };

  // Seed mock test candidates into Round 1 results (bypass for testing)
  const handleSeedTestCandidates = async () => {
    setSeedingData(true);
    try {
      const result = await adminApi.seedTestCandidates();
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ROUND1_RESULTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_STATS] });
      toast.success(result.message || 'Mock candidates seeded successfully!');
    } catch (error: any) {
      toast.error(`Failed to seed data: ${error.message}`);
    } finally {
      setSeedingData(false);
    }
  };

  // Add a single bypass candidate manually
  const handleBypassSubmit = async () => {
    if (!bypassForm.name.trim() || !bypassForm.email.trim() || !bypassForm.role.trim()) {
      toast.error('Name, email, and role are required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(bypassForm.email)) {
      toast.error('Invalid email address');
      return;
    }
    const score = parseInt(bypassForm.score, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error('Score must be 0–100');
      return;
    }
    setSubmittingBypass(true);
    try {
      const correct = Math.round((score / 100) * 25);
      await round1Api.save({
        userId: 'bypass-' + Date.now(),
        userEmail: bypassForm.email.trim(),
        userName: bypassForm.name.trim(),
        roleId: bypassForm.role.toLowerCase().replace(/\s+/g, '-'),
        roleName: bypassForm.role.trim(),
        score,
        totalQuestions: 25,
        correctAnswers: correct,
        categoryPerformance: {},
        completedAt: new Date().toISOString(),
        aborted: false,
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ROUND1_RESULTS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.ADMIN_STATS] });
      toast.success(`Candidate ${bypassForm.name} added to Round 1 results!`);
      setBypassForm({ name: '', email: '', role: '', score: '80' });
      setShowBypassDialog(false);
    } catch (error: any) {
      toast.error(`Failed: ${error.message}`);
    } finally {
      setSubmittingBypass(false);
    }
  };

  // Send email to any address (custom / retry)
  const handleCustomEmailSend = async () => {
    if (!customEmailForm.to_email || !customEmailForm.to_name || !customEmailForm.role_name) {
      toast.error('Email, name, and role are required');
      return;
    }
    setSendingCustomEmail(true);
    try {
      await emailApi.sendRound2Email({
        to_email: customEmailForm.to_email.trim(),
        to_name: customEmailForm.to_name.trim(),
        role_name: customEmailForm.role_name.trim(),
        round1_score: customEmailForm.round1_score ? parseInt(customEmailForm.round1_score, 10) : undefined,
      });
      toast.success(`Email sent to ${customEmailForm.to_email}!`);
      setShowSendEmailDialog(false);
      setEmailTarget(null);
      setCustomEmailForm({ to_email: '', to_name: '', role_name: '', round1_score: '' });
    } catch (error: any) {
      toast.error(`Email failed: ${error.message}`);
    } finally {
      setSendingCustomEmail(false);
    }
  };

  // ==================== SNS MARKETING FUNCTIONS ====================
  const loadSNSTopics = async () => {
    setLoadingSNS(true);
    try {
      const result = await snsApi.listTopics();
      setSnsTopics(result.topics || []);
    } catch (error: any) {
      toast.error(`Failed to load topics: ${error.message}`);
    } finally {
      setLoadingSNS(false);
    }
  };

  const handleCreateTopic = async () => {
    if (!topicFormData.name.trim()) {
      toast.error('Topic name is required');
      return;
    }
    setProcessingAction(true);
    try {
      await snsApi.createTopic(
        topicFormData.name.trim(),
        topicFormData.displayName.trim() || undefined,
        topicFormData.description.trim() || undefined
      );
      toast.success('Topic created successfully!');
      setShowCreateTopicDialog(false);
      setTopicFormData({ name: '', displayName: '', description: '' });
      await loadSNSTopics();
    } catch (error: any) {
      toast.error(`Failed to create topic: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleDeleteTopic = async (topicArn: string) => {
    if (!window.confirm('Are you sure you want to delete this topic? All subscriptions will be removed.')) {
      return;
    }
    setProcessingAction(true);
    try {
      await snsApi.deleteTopic(topicArn);
      toast.success('Topic deleted successfully!');
      setSelectedTopic(null);
      await loadSNSTopics();
    } catch (error: any) {
      toast.error(`Failed to delete topic: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSubscribe = async () => {
    if (!selectedTopic || !subscribeEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    setProcessingAction(true);
    try {
      const result = await snsApi.subscribe(selectedTopic.topicArn, subscribeEmail.trim());
      toast.success(result.message);
      setSubscribeEmail('');
      setShowSubscribeDialog(false);
      await loadTopicSubscriptions(selectedTopic.topicArn);
    } catch (error: any) {
      toast.error(`Failed to subscribe: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleBulkSubscribe = async () => {
    if (!selectedTopic || !bulkEmails.trim()) {
      toast.error('Emails are required');
      return;
    }
    const emails = bulkEmails.split(/[\n,;]+/).map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      toast.error('No valid emails found');
      return;
    }
    setProcessingAction(true);
    try {
      const result = await snsApi.bulkSubscribe(selectedTopic.topicArn, emails);
      toast.success(result.message);
      setBulkEmails('');
      setShowSubscribeDialog(false);
      await loadTopicSubscriptions(selectedTopic.topicArn);
    } catch (error: any) {
      toast.error(`Failed to bulk subscribe: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleUnsubscribe = async (subscriptionArn: string) => {
    if (!window.confirm('Are you sure you want to unsubscribe this email?')) {
      return;
    }
    setProcessingAction(true);
    try {
      await snsApi.unsubscribe(subscriptionArn);
      toast.success('Unsubscribed successfully!');
      if (selectedTopic) {
        await loadTopicSubscriptions(selectedTopic.topicArn);
      }
    } catch (error: any) {
      toast.error(`Failed to unsubscribe: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const handlePublishMessage = async () => {
    if (!selectedTopic || !publishFormData.message.trim()) {
      toast.error('Message is required');
      return;
    }
    setProcessingAction(true);
    try {
      const result = await snsApi.publish(
        selectedTopic.topicArn,
        publishFormData.subject.trim() || 'VidyaMitra Notification',
        publishFormData.message.trim()
      );
      toast.success(result.message);
      setShowPublishDialog(false);
      setPublishFormData({ subject: '', message: '' });
    } catch (error: any) {
      toast.error(`Failed to publish: ${error.message}`);
    } finally {
      setProcessingAction(false);
    }
  };

  const loadTopicSubscriptions = async (topicArn: string) => {
    setLoadingSubscriptions(true);
    try {
      const result = await snsApi.listSubscriptions(topicArn);
      setTopicSubscriptions(result.subscriptions || []);
    } catch (error: any) {
      console.error('Failed to load subscriptions:', error);
      setTopicSubscriptions([]);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  const handleSelectTopic = async (topic: any) => {
    setSelectedTopic(topic);
    await loadTopicSubscriptions(topic.topicArn);
  };

  // Load SNS topics when marketing tab is accessed
  useEffect(() => {
    if (activeView === 'marketing' && snsTopics.length === 0) {
      loadSNSTopics();
    }
  }, [activeView]);

  return (
    <Layout>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="container max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage and monitor interview system</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={aiProvider === 'openai' ? 'default' : 'outline'}
                  onClick={handleToggleProvider}
                  size="sm"
                  className="gap-2"
                >
                  {aiProvider === 'openai' ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                  {aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'}
                </Button>
                <Button variant="outline" onClick={() => navigate('/api-test')} size="sm">
                  <Bot className="h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={() => navigate('/openai-test')} size="sm">
                  <Brain className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              <Button
                variant={activeView === 'dashboard' ? 'default' : 'ghost'}
                onClick={() => setActiveView('dashboard')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <BarChart className="h-4 w-4" />
                Overview
              </Button>
              <Button
                variant={activeView === 'round1' ? 'default' : 'ghost'}
                onClick={() => setActiveView('round1')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Brain className="h-4 w-4" />
                Round 1 <Badge variant="secondary" className="ml-1">{round1Results.length}</Badge>
              </Button>
              <Button
                variant={activeView === 'round2' ? 'default' : 'ghost'}
                onClick={() => setActiveView('round2')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Users className="h-4 w-4" />
                Round 2 <Badge variant="secondary" className="ml-1">{interviews.filter(i => i.round === 2).length}</Badge>
              </Button>
              <Button
                variant={activeView === 'coding' ? 'default' : 'ghost'}
                onClick={() => setActiveView('coding')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Code className="h-4 w-4" />
                Coding
              </Button>
              <Button
                variant={activeView === 'institutions' ? 'default' : 'ghost'}
                onClick={() => setActiveView('institutions')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Building2 className="h-4 w-4" />
                Institutions <Badge variant="secondary" className="ml-1">{institutions.length}</Badge>
              </Button>
              <Button
                variant={activeView === 'roles' ? 'default' : 'ghost'}
                onClick={() => setActiveView('roles')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Settings className="h-4 w-4" />
                Roles
              </Button>
              <Button
                variant={activeView === 'resume' ? 'default' : 'ghost'}
                onClick={() => setActiveView('resume')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <CheckCheck className="h-4 w-4" />
                Resume
              </Button>
              <Button
                variant={activeView === 'storage' ? 'default' : 'ghost'}
                onClick={() => setActiveView('storage')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <HardDrive className="h-4 w-4" />
                Storage (S3)
              </Button>
              <Button
                variant={activeView === 'aws' ? 'default' : 'ghost'}
                onClick={() => setActiveView('aws')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <DollarSign className="h-4 w-4" />
                AWS Usage
              </Button>
              <Button
                variant={activeView === 'marketing' ? 'default' : 'ghost'}
                onClick={() => setActiveView('marketing')}
                className="gap-2 whitespace-nowrap"
                size="sm"
              >
                <Megaphone className="h-4 w-4" />
                Marketing
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="container max-w-7xl mx-auto px-6 py-6">
            
            {/* Dashboard View */}
            {activeView === 'dashboard' && (
              <div className="space-y-6">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                          <h3 className="text-3xl font-bold mt-1">{adminStats?.totalUsers ?? 0}</h3>
                          <p className="text-xs text-muted-foreground mt-2">{totalResumes} resumes saved</p>
                        </div>
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                          <Users className="h-8 w-8 text-blue-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                          <h3 className="text-3xl font-bold mt-1">{totalInterviews}</h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            Avg: {averageScore > 0 ? `${averageScore.toFixed(1)}/10` : 'N/A'}
                          </p>
                        </div>
                        <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                          <BarChart className="h-8 w-8 text-green-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-purple-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Institutions</p>
                          <h3 className="text-3xl font-bold mt-1">{institutions.length}</h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            {institutions.filter(i => i.is_active).length} active
                          </p>
                        </div>
                        <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                          <Building2 className="h-8 w-8 text-purple-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-orange-500">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">AI Detections</p>
                          <h3 className="text-3xl font-bold mt-1">{interviewsWithAI}</h3>
                          <p className="text-xs text-muted-foreground mt-2">
                            {averageAIConfidence.toFixed(1)}% confidence
                          </p>
                        </div>
                        <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                          <AlertTriangle className="h-8 w-8 text-orange-600" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed Stats Row */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Activity Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                        <span className="text-sm text-muted-foreground">Mock Interviews</span>
                        <Badge variant="secondary">{adminStats?.totalInterviews ?? interviews.length}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                        <span className="text-sm text-muted-foreground">Round 1 Aptitude</span>
                        <Badge variant="secondary">{adminStats?.totalRound1 ?? round1Results.length}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                        <span className="text-sm text-muted-foreground">AI Bot Interviews</span>
                        <Badge variant="secondary">{adminStats?.totalBotInterviews ?? 0}</Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                        <span className="text-sm text-muted-foreground">Practice Sessions</span>
                        <Badge variant="secondary">{(adminStats?.totalPracticeInterviews ?? 0) + (adminStats?.totalPracticeAptitude ?? 0) + (adminStats?.totalPracticeCoding ?? 0)}</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart className="h-4 w-4" />
                        Popular Roles
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(adminStats?.popularRoles && adminStats.popularRoles.length > 0) ? (
                        <div className="space-y-2">
                          {adminStats.popularRoles.map(({ role, count }) => (
                            <div key={role} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                              <span className="text-sm text-muted-foreground">{role}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : uniqueRoles.length > 0 ? (
                        <div className="space-y-2">
                          {uniqueRoles.slice(0, 4).map(role => (
                            <div key={role} className="flex justify-between items-center p-2 rounded hover:bg-muted/50 transition-colors">
                              <span className="text-sm text-muted-foreground">{role}</span>
                              <Badge variant="secondary">{interviews.filter(i => i.roleName === role).length}</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">No data available</p>
                      )}
                    </CardContent>
        </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Recent Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(adminStats?.recentActivity && adminStats.recentActivity.length > 0) ? (
                        <div className="space-y-2">
                          {adminStats.recentActivity.slice(0, 4).map((activity) => (
                            <div key={activity.id} className="p-2 rounded border hover:bg-muted/50 transition-colors">
                              <div className="flex justify-between items-start gap-2">
                                <p className="text-xs text-muted-foreground line-clamp-1 flex-1">
                                  {activity.type === 'interview' && `Mock: ${activity.roleName || 'N/A'}`}
                                  {activity.type === 'round1' && `R1: ${activity.roleName || 'N/A'}`}
                                  {activity.type === 'bot_interview' && `Bot: ${activity.roleName || 'N/A'}`}
                                </p>
                                <span className="text-xs font-medium whitespace-nowrap text-muted-foreground">
                                  {formatDate(activity.date)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* AI Detection Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      AI Detection Analytics
                    </CardTitle>
                    <CardDescription>Monitor AI-generated content detection across interviews</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border">
                        <p className="text-xs text-muted-foreground mb-1">With AI</p>
                        <p className="text-2xl font-bold">{interviewsWithAI}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border">
                        <p className="text-xs text-muted-foreground mb-1">Total Answers</p>
                        <p className="text-2xl font-bold">{totalAIDetections}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border">
                        <p className="text-xs text-muted-foreground mb-1">Avg Confidence</p>
                        <p className="text-2xl font-bold">{averageAIConfidence.toFixed(1)}%</p>
                      </div>
                      <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border">
                        <p className="text-xs text-muted-foreground mb-1">High Confidence</p>
                        <p className="text-2xl font-bold">{highConfidenceAI}</p>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Detection Rate</p>
                        <p className="text-sm font-bold">{((interviewsWithAI / (interviews.length || 1)) * 100).toFixed(1)}%</p>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-400 to-red-500 transition-all"
                          style={{ width: `${(interviewsWithAI / (interviews.length || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Role Management View */}
            {activeView === 'roles' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {rolesWithStatus.map((role) => (
                    <Card key={role.id} className={`transition-all hover:shadow-md ${
                      role.isOpen ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'
                    }`}>
                      <CardContent className="p-5">
                        <div className="space-y-3">
                          <div>
                            <h4 className="font-semibold text-base mb-1">{role.title}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">{role.description}</p>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant={role.isOpen ? "default" : "secondary"} className={role.isOpen ? "bg-green-500" : ""}>
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
                            <Button
                              variant={role.isOpen ? "destructive" : "default"}
                              size="sm"
                              onClick={() => handleToggleRole(role.id)}
                            >
                              {role.isOpen ? (
                                <>
                                  <Lock className="h-3 w-3 mr-1" />
                                  Close
                                </>
                              ) : (
                                <>
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Open
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Resume Analysis View */}
            {activeView === 'resume' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Single Resume Analysis</CardTitle>
                    <CardDescription>Upload a resume to find the best matching role</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResumeUpload showBestMatch={true} minimumScore={0} />
                  </CardContent>
                </Card>

                <BulkResumeUpload />
              </div>
            )}

            {/* S3 Storage Management View */}
            {activeView === 'storage' && (
              <S3Manager />
            )}

            {/* AWS Usage & Cost Tracking View */}
            {activeView === 'aws' && (
              <AWSUsageDashboard />
            )}

            {/* SNS Marketing View */}
            {activeView === 'marketing' && (
              <div className="space-y-6">
                {/* Header with Actions */}
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Megaphone className="h-6 w-6 text-primary" />
                      Email Marketing (SNS)
                    </h2>
                    <p className="text-muted-foreground mt-1">
                      Create topics, manage subscribers, and send marketing notifications via AWS SNS
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={loadSNSTopics}
                      disabled={loadingSNS}
                      className="gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingSNS ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button onClick={() => setShowCreateTopicDialog(true)} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Create Topic
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Topics List */}
                  <Card className="lg:col-span-1">
                    <CardHeader>
                      <CardTitle className="text-base">Topics ({snsTopics.length})</CardTitle>
                      <CardDescription>Select a topic to manage subscribers</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {loadingSNS ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : snsTopics.length === 0 ? (
                        <div className="text-center py-8">
                          <Megaphone className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                          <p className="text-muted-foreground">No topics yet</p>
                          <Button
                            variant="link"
                            onClick={() => setShowCreateTopicDialog(true)}
                            className="mt-2"
                          >
                            Create your first topic
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {snsTopics.map((topic) => (
                            <div
                              key={topic.topicArn}
                              className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                                selectedTopic?.topicArn === topic.topicArn
                                  ? 'bg-primary/10 border-primary'
                                  : 'hover:bg-muted/50'
                              }`}
                              onClick={() => handleSelectTopic(topic)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{topic.displayName}</p>
                                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                                    {topic.topicName}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Topic
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Topic Details & Subscribers */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">
                            {selectedTopic ? selectedTopic.displayName : 'Select a Topic'}
                          </CardTitle>
                          <CardDescription>
                            {selectedTopic
                              ? `${topicSubscriptions.length} subscribers`
                              : 'Choose a topic from the list to manage'}
                          </CardDescription>
                        </div>
                        {selectedTopic && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShowSubscribeDialog(true)}
                              className="gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Subscribers
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => setShowPublishDialog(true)}
                              className="gap-1"
                            >
                              <Send className="h-3 w-3" />
                              Send Message
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteTopic(selectedTopic.topicArn)}
                              disabled={processingAction}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      {!selectedTopic ? (
                        <div className="text-center py-12">
                          <Mail className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                          <p className="text-muted-foreground">Select a topic to view subscribers</p>
                        </div>
                      ) : loadingSubscriptions ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : topicSubscriptions.length === 0 ? (
                        <div className="text-center py-12">
                          <Users className="h-12 w-12 mx-auto text-muted-foreground opacity-50 mb-3" />
                          <p className="text-muted-foreground mb-2">No subscribers yet</p>
                          <Button
                            variant="outline"
                            onClick={() => setShowSubscribeDialog(true)}
                            className="gap-2"
                          >
                            <Plus className="h-4 w-4" />
                            Add Subscribers
                          </Button>
                        </div>
                      ) : (
                        <div className="rounded-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Protocol</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topicSubscriptions.map((sub, idx) => (
                                <TableRow key={sub.subscriptionArn || idx}>
                                  <TableCell className="font-medium">{sub.endpoint}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline">{sub.protocol}</Badge>
                                  </TableCell>
                                  <TableCell>
                                    {sub.isPending ? (
                                      <Badge variant="secondary" className="gap-1">
                                        <Clock className="h-3 w-3" />
                                        Pending
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-green-100 text-green-800 gap-1">
                                        <CheckCircle className="h-3 w-3" />
                                        Confirmed
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {!sub.isPending && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnsubscribe(sub.subscriptionArn)}
                                        disabled={processingAction}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Info Box */}
                <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
                        <AlertTriangle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="text-sm">
                        <p className="font-medium text-blue-900 dark:text-blue-100">How SNS Email Marketing Works</p>
                        <ul className="mt-2 text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
                          <li>Create topics for different campaigns (newsletters, updates, promotions)</li>
                          <li>Add subscriber emails - they'll receive a confirmation email</li>
                          <li>Only confirmed subscribers will receive your messages</li>
                          <li>Send bulk notifications to all confirmed topic subscribers</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Create Topic Dialog */}
                <Dialog open={showCreateTopicDialog} onOpenChange={setShowCreateTopicDialog}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Marketing Topic</DialogTitle>
                      <DialogDescription>
                        Create an SNS topic for email marketing campaigns
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="topic-name">Topic Name *</Label>
                        <Input
                          id="topic-name"
                          placeholder="e.g. newsletter, promotions"
                          value={topicFormData.name}
                          onChange={(e) => setTopicFormData(f => ({ ...f, name: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Will be prefixed with "vidyamitra-"
                        </p>
                      </div>
                      <div>
                        <Label htmlFor="topic-display">Display Name</Label>
                        <Input
                          id="topic-display"
                          placeholder="e.g. VidyaMitra Newsletter"
                          value={topicFormData.displayName}
                          onChange={(e) => setTopicFormData(f => ({ ...f, displayName: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="topic-desc">Description</Label>
                        <Input
                          id="topic-desc"
                          placeholder="What is this topic for?"
                          value={topicFormData.description}
                          onChange={(e) => setTopicFormData(f => ({ ...f, description: e.target.value }))}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowCreateTopicDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateTopic} disabled={processingAction} className="gap-2">
                        {processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create Topic
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Subscribe Dialog */}
                <Dialog open={showSubscribeDialog} onOpenChange={setShowSubscribeDialog}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Add Subscribers</DialogTitle>
                      <DialogDescription>
                        Add email subscribers to {selectedTopic?.displayName}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="single-email">Single Email</Label>
                        <div className="flex gap-2 mt-1">
                          <Input
                            id="single-email"
                            type="email"
                            placeholder="email@example.com"
                            value={subscribeEmail}
                            onChange={(e) => setSubscribeEmail(e.target.value)}
                          />
                          <Button onClick={handleSubscribe} disabled={processingAction || !subscribeEmail.trim()}>
                            Add
                          </Button>
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-background px-2 text-muted-foreground">Or bulk add</span>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="bulk-emails">Bulk Emails (one per line or comma-separated)</Label>
                        <textarea
                          id="bulk-emails"
                          className="w-full h-32 mt-1 p-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="email1@example.com&#10;email2@example.com&#10;email3@example.com"
                          value={bulkEmails}
                          onChange={(e) => setBulkEmails(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {bulkEmails.split(/[\n,;]+/).filter(e => e.trim()).length} emails detected
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSubscribeDialog(false)}>
                        Close
                      </Button>
                      <Button
                        onClick={handleBulkSubscribe}
                        disabled={processingAction || !bulkEmails.trim()}
                        className="gap-2"
                      >
                        {processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                        Add All Emails
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Publish Message Dialog */}
                <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>Send Marketing Message</DialogTitle>
                      <DialogDescription>
                        Send a message to all confirmed subscribers of {selectedTopic?.displayName}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="msg-subject">Subject</Label>
                        <Input
                          id="msg-subject"
                          placeholder="e.g. Special Offer Inside!"
                          value={publishFormData.subject}
                          onChange={(e) => setPublishFormData(f => ({ ...f, subject: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="msg-body">Message *</Label>
                        <textarea
                          id="msg-body"
                          className="w-full h-40 mt-1 p-3 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                          placeholder="Write your marketing message here..."
                          value={publishFormData.message}
                          onChange={(e) => setPublishFormData(f => ({ ...f, message: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          {publishFormData.message.length} / 262144 characters
                        </p>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          ⚠️ This will send to <strong>{topicSubscriptions.filter(s => !s.isPending).length}</strong> confirmed subscribers.
                          Pending confirmations won't receive the message.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handlePublishMessage}
                        disabled={processingAction || !publishFormData.message.trim()}
                        className="gap-2"
                      >
                        {processingAction ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send to All
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            )}

            {/* Round 1 - Aptitude View */}
            {activeView === 'round1' && (
              <div className="space-y-4">
                {/* Admin Testing Bypass Toolbar */}
                <Card className="border-dashed border-amber-400 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                        <Brain className="h-4 w-4" />
                        <span className="text-sm font-medium">Admin Testing Tools</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100"
                        onClick={handleSeedTestCandidates}
                        disabled={seedingData}
                      >
                        {seedingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        {seedingData ? 'Seeding...' : 'Seed 6 Mock Candidates'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-amber-400 text-amber-700 hover:bg-amber-100"
                        onClick={() => setShowBypassDialog(true)}
                      >
                        <Edit className="h-4 w-4" />
                        Add Test Candidate
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-blue-400 text-blue-700 hover:bg-blue-100"
                        onClick={() => {
                          setCustomEmailForm({ to_email: '', to_name: '', role_name: '', round1_score: '' });
                          setEmailTarget(null);
                          setShowSendEmailDialog(true);
                        }}
                      >
                        <Mail className="h-4 w-4" />
                        Send Email to Any Address
                      </Button>
                      <span className="text-xs text-muted-foreground">Bypass for testing — no aptitude test needed</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Round 1 - Aptitude Test Results</CardTitle>
                    <CardDescription>{round1Results.length} candidates completed • Review and select for Round 2</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4">
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
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
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
                                <TableRow key={result.id} className="hover:bg-muted/20 transition-colors">
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
                                  <TableCell className="text-sm">
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
                                    <div className="flex flex-col items-end gap-1">
                                      {!result.selectedForRound2 && !result.aborted && result.score >= 50 && (
                                        <Button
                                          size="sm"
                                          onClick={() => handleSelectForRound2(result.id, result)}
                                          disabled={sendingRound2Emails.has(result.id)}
                                          className="gap-2"
                                        >
                                          {sendingRound2Emails.has(result.id) ? (
                                            <><Loader2 className="h-4 w-4 animate-spin" />Sending...</>
                                          ) : (
                                            <><Mail className="h-4 w-4" />Select & Email R2</>
                                          )}
                                        </Button>
                                      )}
                                      {result.selectedForRound2 && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="gap-1 text-xs"
                                          onClick={() => {
                                            setCustomEmailForm({ to_email: result.userEmail, to_name: result.userName || 'Candidate', role_name: result.roleName, round1_score: String(result.score) });
                                            setEmailTarget(result);
                                            setShowSendEmailDialog(true);
                                          }}
                                        >
                                          <Mail className="h-3 w-3" />
                                          Resend Email
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
                                    </div>
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
                        <p className="text-muted-foreground mb-4">
                          No candidates have completed the aptitude test yet
                        </p>
                        <Button
                          variant="outline"
                          onClick={handleSeedTestCandidates}
                          disabled={seedingData}
                          className="gap-2"
                        >
                          {seedingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Load 6 Mock Candidates for Testing
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Round 2 - Mock Interview View */}
            {activeView === 'round2' && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Round 2 - Mock Interview Results</CardTitle>
                    <CardDescription>{interviews.filter(i => i.round === 2).length} interviews conducted • Monitor and send selection messages</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-col md:flex-row gap-4">
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
                    
                    {filteredInterviews.filter(i => i.round === 2 || !i.round).length > 0 ? (
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
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
                              .filter(i => i.round === 2 || !i.round)
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map(interview => (
                                <TableRow key={interview.id} className="hover:bg-muted/20 transition-colors">
                                  <TableCell className="font-medium">
                                    {interview.userEmail || 'Guest User'}
                                  </TableCell>
                                  <TableCell>{interview.roleName}</TableCell>
                                  <TableCell className="text-sm">{formatDate(interview.date)}</TableCell>
                                  <TableCell>{getStatusBadge(interview)}</TableCell>
                                  <TableCell>
                                    {interview.completed && interview.score && !interview.aborted
                                      ? `${interview.score.toFixed(1)}/10`
                                      : '-'}
                                  </TableCell>
                                  <TableCell>
                                    {interview.resume ? (
                                      <Badge
                                        variant={interview.resume.atsScore >= 80 ? "default" : interview.resume.atsScore >= 60 ? "secondary" : "destructive"}
                                        className="text-xs"
                                      >
                                        {interview.resume.atsScore}%
                                      </Badge>
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
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Coding Questions View */}
            {activeView === 'coding' && (
              <div className="space-y-4">
                {/* Statistics Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-2xl font-bold">{questions.length}</p>
                        </div>
                        <Code className="h-8 w-8 text-blue-600" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-green-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Easy</p>
                          <p className="text-2xl font-bold text-green-600">
                            {questions.filter(q => q.difficulty === 'easy').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                          <span className="text-green-600 font-bold">E</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-yellow-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Medium</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {questions.filter(q => q.difficulty === 'medium').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                          <span className="text-yellow-600 font-bold">M</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-red-500">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Hard</p>
                          <p className="text-2xl font-bold text-red-600">
                            {questions.filter(q => q.difficulty === 'hard').length}
                          </p>
                        </div>
                        <div className="h-8 w-8 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                          <span className="text-red-600 font-bold">H</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Questions Table */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">All Coding Questions</CardTitle>
                        <CardDescription>Manage coding practice questions</CardDescription>
                      </div>
                      <AddQuestionDialog onQuestionAdded={handleQuestionAdded} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
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
                          {questions.map((question) => (
                            <TableRow key={question.id} className="hover:bg-muted/20 transition-colors">
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
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                      : question.difficulty === 'medium'
                                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                        : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
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
                                  <Button variant="ghost" size="sm" title="View Details">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" title="Edit">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" title="Delete">
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
              </div>
            )}

            {/* Institutions Management View */}
            {activeView === 'institutions' && (
              <div className="space-y-4">
                {/* Institution Create/Edit Dialog */}
                <Dialog open={showInstitutionDialog} onOpenChange={(open) => {
                  setShowInstitutionDialog(open);
                  if (!open) {
                    setEditMode(false);
                  }
                }}>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-2xl">{editMode ? 'Edit Institution' : 'Create New Institution'}</DialogTitle>
                      <DialogDescription>
                        {editMode 
                          ? 'Update institution details. Leave password empty to keep existing password.'
                          : 'Add a new institution to the system. They can login using the institution code and password.'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                      {/* Institution Name */}
                      <div className="grid gap-2">
                        <Label htmlFor="inst-name">Institution Name *</Label>
                        <Input
                          id="inst-name"
                          placeholder="e.g., MIT University"
                          value={institutionFormData.name}
                          onChange={(e) => setInstitutionFormData(prev => ({ ...prev, name: e.target.value }))}
                        />
                      </div>

                      {/* Institution Code */}
                      <div className="grid gap-2">
                        <Label htmlFor="inst-code">Institution Code * (Unique Identifier)</Label>
                        <Input
                          id="inst-code"
                          placeholder="e.g., MIT or MITECH"
                          value={institutionFormData.institutionCode}
                          onChange={(e) => setInstitutionFormData(prev => ({ 
                            ...prev, 
                            institutionCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')
                          }))}
                        />
                        <p className="text-xs text-muted-foreground">
                          This code will be used for login. Only letters and numbers allowed.
                        </p>
                      </div>

                      {/* Email and Password Row */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="inst-email">Email *</Label>
                          <Input
                            id="inst-email"
                            type="email"
                            placeholder="contact@institution.edu"
                            value={institutionFormData.email}
                            onChange={(e) => setInstitutionFormData(prev => ({ ...prev, email: e.target.value }))}
                          />
                        </div>
                        
                        <div className="grid gap-2">
                          <Label htmlFor="inst-password">Password {editMode ? '(leave empty to keep existing)' : '* (min 6 chars)'}</Label>
                          <Input
                            id="inst-password"
                            type="text"
                            placeholder={editMode ? "Leave empty to keep current password" : "Enter password"}
                            value={institutionFormData.password}
                            onChange={(e) => setInstitutionFormData(prev => ({ ...prev, password: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Institution Type and Location */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="inst-type">Institution Type</Label>
                          <Select 
                            value={institutionFormData.institutionType}
                            onValueChange={(value) => setInstitutionFormData(prev => ({ ...prev, institutionType: value }))}
                          >
                            <SelectTrigger id="inst-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="University">University</SelectItem>
                              <SelectItem value="College">College</SelectItem>
                              <SelectItem value="School">School</SelectItem>
                              <SelectItem value="Company">Company</SelectItem>
                              <SelectItem value="Training Center">Training Center</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="inst-location">Location</Label>
                          <Input
                            id="inst-location"
                            placeholder="e.g., Boston, MA"
                            value={institutionFormData.location}
                            onChange={(e) => setInstitutionFormData(prev => ({ ...prev, location: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Contact Person and Phone */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="inst-contact">Contact Person</Label>
                          <Input
                            id="inst-contact"
                            placeholder="e.g., John Doe"
                            value={institutionFormData.contactPerson}
                            onChange={(e) => setInstitutionFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="inst-phone">Phone</Label>
                          <Input
                            id="inst-phone"
                            placeholder="e.g., +1-234-567-8900"
                            value={institutionFormData.phone}
                            onChange={(e) => setInstitutionFormData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>
                      </div>

                      {/* Website */}
                      <div className="grid gap-2">
                        <Label htmlFor="inst-website">Website</Label>
                        <Input
                          id="inst-website"
                          placeholder="https://institution.edu"
                          value={institutionFormData.website}
                          onChange={(e) => setInstitutionFormData(prev => ({ ...prev, website: e.target.value }))}
                        />
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                          <strong>Login Instructions:</strong> After creation, institutions can login using their Institution Code and Password on the login page.
                        </p>
                      </div>
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => {
                        setShowInstitutionDialog(false);
                        setEditMode(false);
                      }} disabled={creatingInstitution}>
                        Cancel
                      </Button>
                      <Button onClick={handleSaveInstitution} disabled={creatingInstitution}>
                        {creatingInstitution ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {editMode ? 'Updating...' : 'Creating...'}
                          </>
                        ) : (
                          <>
                            {editMode ? <Edit className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                            {editMode ? 'Update Institution' : 'Create Institution'}
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* View Institution Details Dialog */}
                <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Institution Details</DialogTitle>
                      <DialogDescription>
                        View complete information about this institution
                      </DialogDescription>
                    </DialogHeader>
                    
                    {selectedInstitution && (
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Institution Name</Label>
                            <p className="font-medium mt-1">{selectedInstitution.name}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Institution Code</Label>
                            <p className="font-medium mt-1">
                              <Badge variant="outline" className="text-base">{selectedInstitution.institution_code}</Badge>
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Email</Label>
                            <p className="font-medium mt-1">{selectedInstitution.email}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Type</Label>
                            <p className="font-medium mt-1">{selectedInstitution.institution_type}</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Location</Label>
                            <p className="font-medium mt-1">{selectedInstitution.location || 'Not specified'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Status</Label>
                            <p className="font-medium mt-1">
                              {selectedInstitution.is_active ? (
                                <Badge variant="default" className="bg-green-500">Active</Badge>
                              ) : (
                                <Badge variant="secondary">Inactive</Badge>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Contact Person</Label>
                            <p className="font-medium mt-1">{selectedInstitution.contact_person || 'Not specified'}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Phone</Label>
                            <p className="font-medium mt-1">{selectedInstitution.phone || 'Not specified'}</p>
                          </div>
                        </div>

                        <div>
                          <Label className="text-muted-foreground">Website</Label>
                          <p className="font-medium mt-1">
                            {selectedInstitution.website ? (
                              <a 
                                href={selectedInstitution.website} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-primary hover:underline"
                              >
                                {selectedInstitution.website}
                              </a>
                            ) : (
                              'Not specified'
                            )}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Total Students</Label>
                            <p className="font-medium mt-1 flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              {selectedInstitution.student_count || 0}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Created Date</Label>
                            <p className="font-medium mt-1">
                              {selectedInstitution.created_at ? new Date(selectedInstitution.created_at).toLocaleDateString() : 'N/A'}
                            </p>
                          </div>
                        </div>

                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                          <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>Login Credentials:</strong> Institution Code: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">{selectedInstitution.institution_code}</code>
                          </p>
                          <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                            Password is securely stored and cannot be viewed. Use the edit button to change it.
                          </p>
                        </div>
                      </div>
                    )}

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowViewDialog(false)}>
                        Close
                      </Button>
                      <Button onClick={() => {
                        if (selectedInstitution) {
                          handleEditInstitution(selectedInstitution);
                          setShowViewDialog(false);
                        }
                      }}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Institution
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {institutionsLoading ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center">
                        <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary mb-4" />
                        <p className="text-muted-foreground">Loading institutions...</p>
                      </div>
                    </CardContent>
                  </Card>
                ) : institutions.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">All Institutions</CardTitle>
                          <CardDescription>{institutions.length} registered • {institutions.filter(i => i.is_active).length} active</CardDescription>
                        </div>
                        <Button className="gap-2" onClick={handleOpenCreateDialog} size="sm">
                          <Plus className="h-4 w-4" />
                          Add Institution
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-md border overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead>Institution Name</TableHead>
                              <TableHead>Code</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Location</TableHead>
                              <TableHead>Students</TableHead>
                              <TableHead>Contact</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {institutions.map((inst: any) => (
                              <TableRow key={inst.id} className="hover:bg-muted/20 transition-colors">
                                <TableCell className="font-medium">{inst.name}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="font-mono">{inst.institution_code}</Badge>
                                </TableCell>
                                <TableCell>{inst.institution_type}</TableCell>
                                <TableCell className="text-muted-foreground">{inst.location || 'N/A'}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{inst.student_count || 0}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm">{inst.email}</TableCell>
                                <TableCell>
                                  {inst.is_active ? (
                                    <Badge variant="default" className="bg-green-500">
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary">
                                      <XCircle className="h-3 w-3 mr-1" />
                                      Inactive
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      title="View Details"
                                      onClick={() => handleViewInstitution(inst)}
                                      className="hover:bg-blue-50 dark:hover:bg-blue-950"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      title="Edit"
                                      onClick={() => handleEditInstitution(inst)}
                                      className="hover:bg-purple-50 dark:hover:bg-purple-950"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      title={inst.is_active ? "Deactivate" : "Activate"}
                                      className={inst.is_active ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950" : "text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"}
                                      onClick={() => handleToggleInstitutionStatus(inst)}
                                      disabled={updatingInstitution === inst.id}
                                    >
                                      {updatingInstitution === inst.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        inst.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />
                                      )}
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
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <h3 className="text-lg font-semibold mb-1">No institutions yet</h3>
                      <p className="text-sm text-muted-foreground mb-4">Add your first institution to get started</p>
                      <Button className="gap-2" onClick={handleOpenCreateDialog}>
                        <Plus className="h-4 w-4" />
                        Add First Institution
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </main>

          {/* ========== BYPASS: Add Test Candidate Dialog ========== */}
          <Dialog open={showBypassDialog} onOpenChange={setShowBypassDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Edit className="h-5 w-5 text-amber-600" />
                  Add Test Candidate (Bypass)
                </DialogTitle>
                <DialogDescription>
                  Directly add a candidate to Round 1 results without them taking the aptitude test. For testing only.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="bypass-name">Candidate Name *</Label>
                  <Input
                    id="bypass-name"
                    placeholder="e.g. John Doe"
                    value={bypassForm.name}
                    onChange={(e) => setBypassForm(f => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="bypass-email">Email Address *</Label>
                  <Input
                    id="bypass-email"
                    type="email"
                    placeholder="e.g. john@example.com"
                    value={bypassForm.email}
                    onChange={(e) => setBypassForm(f => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="bypass-role">Role Applied For *</Label>
                  <Input
                    id="bypass-role"
                    placeholder="e.g. Software Engineer"
                    value={bypassForm.role}
                    onChange={(e) => setBypassForm(f => ({ ...f, role: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="bypass-score">Score (%) *</Label>
                  <Input
                    id="bypass-score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="80"
                    value={bypassForm.score}
                    onChange={(e) => setBypassForm(f => ({ ...f, score: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowBypassDialog(false)}>Cancel</Button>
                <Button onClick={handleBypassSubmit} disabled={submittingBypass} className="gap-2">
                  {submittingBypass ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add Candidate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* ========== Send Email Dialog ========== */}
          <Dialog open={showSendEmailDialog} onOpenChange={(open) => { setShowSendEmailDialog(open); if (!open) { setEmailTarget(null); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  Send Round 2 Invitation Email
                </DialogTitle>
                <DialogDescription>
                  Send a Round 2 invitation via AWS SES to any email address.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label htmlFor="email-to">To (Email Address) *</Label>
                  <Input
                    id="email-to"
                    type="email"
                    placeholder="candidate@example.com"
                    value={customEmailForm.to_email}
                    onChange={(e) => setCustomEmailForm(f => ({ ...f, to_email: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email-name">Candidate Name *</Label>
                  <Input
                    id="email-name"
                    placeholder="e.g. John Doe"
                    value={customEmailForm.to_name}
                    onChange={(e) => setCustomEmailForm(f => ({ ...f, to_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email-role">Role *</Label>
                  <Input
                    id="email-role"
                    placeholder="e.g. Software Engineer"
                    value={customEmailForm.role_name}
                    onChange={(e) => setCustomEmailForm(f => ({ ...f, role_name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="email-score">Round 1 Score (%) — Optional</Label>
                  <Input
                    id="email-score"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 80"
                    value={customEmailForm.round1_score}
                    onChange={(e) => setCustomEmailForm(f => ({ ...f, round1_score: e.target.value }))}
                  />
                </div>
                <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  ⚠️ AWS SES sandbox mode requires both sender (<code>SES_FROM_EMAIL</code>) and recipient addresses to be verified. In production mode, any address can receive emails.
                </p>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowSendEmailDialog(false)}>Cancel</Button>
                <Button onClick={handleCustomEmailSend} disabled={sendingCustomEmail} className="gap-2">
                  {sendingCustomEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  {sendingCustomEmail ? 'Sending...' : 'Send Email'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

      </div>
    </Layout>
  );
};

export default AdminDashboard;
