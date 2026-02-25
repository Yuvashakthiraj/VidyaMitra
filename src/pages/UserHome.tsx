import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserInterviews,
  getRound1AptitudeResults,
  getPracticeAptitudeHistory,
  getPracticeInterviewHistory,
  getBotInterviewHistory,
} from '@/lib/firebaseService';
import { newsApi, exchangeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowRight, BarChart, Clock, FileText, Route, Briefcase,
  GraduationCap, Target, Play, TrendingUp, DollarSign, Newspaper,
  Zap, Code, MessageSquare, Brain, ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';

// Unified activity item for the Recent Activity feed
interface ActivityItem {
  id: string;
  type: 'interview' | 'round1' | 'practice-aptitude' | 'practice-interview' | 'bot-interview';
  label: string;
  roleName: string;
  date: string;
  score: number | null;
  scoreMax: number; // 10 for interviews, 100 for aptitude
  status?: string;
}

const UserHome = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allActivities, setAllActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<any[]>([]);
  const [exchangeRates, setExchangeRates] = useState<any>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!user) { setLoading(false); return; }

      const activities: ActivityItem[] = [];

      // 1. Formal interviews (Round 2 / practice interviews saved via InterviewContext)
      try {
        const interviews = await getUserInterviews(user.id);
        interviews.filter(i => i.completed).forEach(i => {
          activities.push({
            id: i.id,
            type: 'interview',
            label: i.isPracticeMode ? 'Practice Interview' : 'Mock Interview (Round 2)',
            roleName: i.roleName || 'Unknown Role',
            date: i.date || i.startTime || i.endTime || '',
            score: i.score ?? null,
            scoreMax: 10,
          });
        });
      } catch (err) { console.error('Error loading interviews:', err); }

      // 2. Round 1 Aptitude results (from mock interview flow)
      try {
        const round1 = await getRound1AptitudeResults(user.id);
        round1.forEach(r => {
          activities.push({
            id: r.id,
            type: 'round1',
            label: r.aborted ? 'Round 1 Aptitude (Aborted)' : 'Round 1 Aptitude',
            roleName: r.roleName || 'Unknown Role',
            date: r.completedAt || '',
            score: r.aborted ? null : (r.score ?? null),
            scoreMax: 100,
            status: r.aborted ? 'aborted' : r.selectedForRound2 ? 'selected' : 'under-review',
          });
        });
      } catch (err) { console.error('Error loading round1:', err); }

      // 3. Practice aptitude
      try {
        const practiceApt = await getPracticeAptitudeHistory(user.id);
        practiceApt.forEach(r => {
          activities.push({
            id: r.id,
            type: 'practice-aptitude',
            label: 'Practice Aptitude',
            roleName: 'Aptitude Test',
            date: r.completedAt || '',
            score: r.score ?? null,
            scoreMax: 100,
          });
        });
      } catch (err) { console.error('Error loading practice aptitude:', err); }

      // 4. Practice interviews (from Practice Hub)
      try {
        const practiceInt = await getPracticeInterviewHistory(user.id);
        practiceInt.forEach(r => {
          activities.push({
            id: r.id,
            type: 'practice-interview',
            label: 'Practice Interview',
            roleName: r.roleName || 'Unknown Role',
            date: r.completedAt || '',
            score: r.overallScore ?? null,
            scoreMax: 10,
          });
        });
      } catch (err) { console.error('Error loading practice interviews:', err); }

      // 5. Bot interviews (FRIEDE AI Interview)
      try {
        const botInt = await getBotInterviewHistory(user.id);
        botInt.forEach(r => {
          activities.push({
            id: r.id,
            type: 'bot-interview',
            label: 'AI Interview (FRIEDE)',
            roleName: r.role || 'Unknown Role',
            date: r.completedAt || '',
            score: r.feedback?.overallScore ?? null,
            scoreMax: 10,
          });
        });
      } catch (err) { console.error('Error loading bot interviews:', err); }

      // Sort all activities by date descending
      activities.sort((a, b) => {
        const da = a.date ? new Date(a.date).getTime() : 0;
        const db = b.date ? new Date(b.date).getTime() : 0;
        return db - da;
      });

      setAllActivities(activities);

      // Load market data (with fallback)
      try {
        const newsData = await newsApi.search('technology career jobs');
        setNews(newsData.articles || []);
      } catch { }

      try {
        const rates = await exchangeApi.getRates();
        setExchangeRates(rates);
      } catch { }

      setLoading(false);
    };
    loadData();
  }, [user]);

  const totalActivities = allActivities.length;
  const scoredActivities = allActivities.filter(a => a.score !== null);
  // Normalise all scores to 0-100 for a unified average
  const averageScore = scoredActivities.length > 0
    ? scoredActivities.reduce((sum, a) => sum + ((a.score! / a.scoreMax) * 100), 0) / scoredActivities.length
    : 0;
  const latestActivity = totalActivities > 0 ? allActivities[0] : null;

  const quickActions = [
    { label: 'Smart Resume', desc: 'Upload & analyze your resume', icon: FileText, path: '/resume', color: 'from-violet-500 to-purple-600', delay: 0 },
    { label: 'Career Roadmap', desc: 'Get a personalized learning path', icon: Route, path: '/career-planner', color: 'from-blue-500 to-cyan-500', delay: 0.1 },
    { label: 'Practice Interview', desc: 'AI-powered mock interviews', icon: MessageSquare, path: '/practice', color: 'from-emerald-500 to-green-600', delay: 0.2 },
    { label: 'Job Board', desc: 'Discover job opportunities', icon: Briefcase, path: '/jobs', color: 'from-orange-500 to-red-500', delay: 0.3 },
  ];

  return (
    <Layout>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold">
              Welcome back, <span className="gradient-text">{user?.name || user?.email?.split('@')[0] || 'User'}</span>
            </h1>
            <p className="text-muted-foreground mt-1">Your AI-powered career dashboard</p>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Activities', value: totalActivities, icon: BarChart, color: 'text-violet-500' },
            { label: 'Avg Score', value: averageScore > 0 ? `${averageScore.toFixed(1)}%` : 'N/A', icon: Target, color: 'text-emerald-500' },
            { label: 'Latest Role', value: latestActivity?.roleName || 'None yet', icon: Briefcase, color: 'text-blue-500' },
            { label: 'Status', value: totalActivities > 5 ? 'Active Learner' : totalActivities > 0 ? 'Getting Started' : 'New User', icon: TrendingUp, color: 'text-orange-500' },
          ].map((stat, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card className="card-hover border-border/50">
                <CardContent className="pt-5 pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</span>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold truncate">{stat.value}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action, i) => (
              <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: action.delay }}>
                <Card
                  className="card-hover cursor-pointer group border-border/50 overflow-hidden"
                  onClick={() => navigate(action.path)}
                >
                  <CardContent className="pt-5 pb-4 relative">
                    <div className={`absolute top-0 right-0 w-20 h-20 rounded-full bg-gradient-to-br ${action.color} opacity-5 group-hover:opacity-10 -translate-y-6 translate-x-6 transition-opacity`} />
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-3 shadow-lg`}>
                      <action.icon className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-semibold text-sm">{action.label}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{action.desc}</p>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary absolute bottom-4 right-4 transition-colors" />
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom Grid: Recent + Market */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Interviews */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-muted-foreground text-sm py-4 text-center">Loading...</p>
              ) : allActivities.length > 0 ? (
                <div className="space-y-3">
                  {allActivities.slice(0, 5).map((activity) => {
                    const displayScore = activity.score !== null
                      ? activity.scoreMax === 100 ? `${activity.score}%` : `${activity.score.toFixed(1)}/${activity.scoreMax}`
                      : activity.status === 'aborted' ? 'Aborted' : 'Pending';
                    const badgeVariant = activity.status === 'aborted' ? 'destructive'
                      : activity.score === null ? 'secondary'
                      : (activity.score / activity.scoreMax) >= 0.7 ? 'default'
                      : (activity.score / activity.scoreMax) >= 0.5 ? 'secondary' : 'destructive';

                    return (
                      <div key={`${activity.type}-${activity.id}`} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="font-medium text-sm truncate">{activity.roleName}</p>
                          <p className="text-xs text-muted-foreground">{activity.label} &middot; {activity.date ? new Date(activity.date).toLocaleDateString() : 'N/A'}</p>
                        </div>
                        <Badge variant={badgeVariant} className="shrink-0">
                          {displayScore}
                        </Badge>
                      </div>
                    );
                  })}
                  <Button variant="ghost" size="sm" className="w-full mt-2" onClick={() => navigate('/history')}>
                    View All History <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-muted-foreground text-sm mb-3">No activity yet</p>
                  <Button size="sm" onClick={() => navigate('/mock-interview')}>Start Mock Interview</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Market Trends */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-primary" /> Market Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Exchange Rates */}
              {exchangeRates && (
                <div className="mb-4 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs font-medium">USD Exchange Rates</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {Object.entries(exchangeRates.rates || {}).map(([currency, rate]: [string, any]) => (
                      <div key={currency} className="text-center">
                        <span className="text-muted-foreground">{currency}</span>
                        <p className="font-semibold">{typeof rate === 'number' ? rate.toFixed(2) : rate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* News */}
              {news.length > 0 ? (
                <div className="space-y-2.5">
                  {news.slice(0, 3).map((article, i) => (
                    <a key={i} href={article.url} target="_blank" rel="noopener noreferrer"
                      className="block p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                      <p className="text-xs font-medium line-clamp-2 group-hover:text-primary transition-colors">{article.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground">{article.source}</span>
                        <ExternalLink className="h-2.5 w-2.5 text-muted-foreground" />
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4 text-center">Loading market data...</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default UserHome;
