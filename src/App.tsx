
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { InterviewProvider } from "@/contexts/InterviewContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import AuthGuard from "@/components/AuthGuard";

import Home from "./pages/Home";
import Login from "./pages/Login";
import UserHome from "./pages/UserHome";
import SmartResume from "./pages/SmartResume";
import CareerPlanner from "./pages/CareerPlanner";
import JobBoard from "./pages/JobBoard";
import Interview from "./pages/Interview";
import PracticeHome from "./pages/PracticeHome";
import PracticeDashboard from "./pages/PracticeDashboard";
import PracticeInterview from "./pages/PracticeInterview";
import AptitudePractice from "./pages/AptitudePractice";
import CodingPractice from "./pages/CodingPractice";
import PracticeHistory from "./pages/PracticeHistory";
import BotInterview from "./pages/BotInterview";
import Summary from "./pages/Summary";
import InterviewThankYou from "./pages/InterviewThankYou";
import History from "./pages/History";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";
import Round1Aptitude from "./pages/Round1Aptitude";
import MockInterview from "./pages/MockInterview";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <InterviewProvider>
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/login" element={<Login />} />

                {/* Protected routes */}
                <Route path="/dashboard" element={<AuthGuard><UserHome /></AuthGuard>} />

                {/* New VidyaMitra modules */}
                <Route path="/resume" element={<AuthGuard><SmartResume /></AuthGuard>} />
                <Route path="/career-planner" element={<AuthGuard><CareerPlanner /></AuthGuard>} />
                <Route path="/jobs" element={<AuthGuard><JobBoard /></AuthGuard>} />

                {/* Interview / Test */}
                <Route path="/interview" element={<AuthGuard><Interview /></AuthGuard>} />
                <Route path="/mock-interview" element={<AuthGuard><MockInterview /></AuthGuard>} />
                <Route path="/round1-aptitude" element={<AuthGuard><Round1Aptitude /></AuthGuard>} />

                {/* Practice Mode */}
                <Route path="/practice" element={<AuthGuard><PracticeHome /></AuthGuard>} />
                <Route path="/practice-dashboard" element={<AuthGuard><PracticeDashboard /></AuthGuard>} />
                <Route path="/practice-interview" element={<AuthGuard><PracticeInterview /></AuthGuard>} />
                <Route path="/practice-aptitude" element={<AuthGuard><AptitudePractice /></AuthGuard>} />
                <Route path="/practice-coding" element={<AuthGuard><CodingPractice /></AuthGuard>} />
                <Route path="/practice-history" element={<AuthGuard><PracticeHistory /></AuthGuard>} />
                <Route path="/bot-interview" element={<AuthGuard><BotInterview /></AuthGuard>} />
                <Route path="/summary" element={<AuthGuard><Summary /></AuthGuard>} />
                <Route path="/interview-thank-you" element={<AuthGuard><InterviewThankYou /></AuthGuard>} />
                <Route path="/history" element={<AuthGuard><History /></AuthGuard>} />

                {/* Admin routes */}
                <Route path="/admin" element={<AuthGuard requireAdmin={true}><AdminDashboard /></AuthGuard>} />

                {/* Fallbacks */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </InterviewProvider>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
