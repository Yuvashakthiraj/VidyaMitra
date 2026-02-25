import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GraduationCap, ArrowRight, FileText, Route, Briefcase,
  MessageSquare, Brain, Code, Target, Users, Star, Sparkles
} from 'lucide-react';

const features = [
  { icon: FileText, title: 'Smart Resume', desc: 'AI-powered ATS analysis & resume builder with instant scoring', color: 'from-violet-500 to-purple-600' },
  { icon: Route, title: 'Career Roadmap', desc: 'Personalized learning paths with YouTube recommendations', color: 'from-blue-500 to-cyan-500' },
  { icon: MessageSquare, title: 'AI Interviews', desc: 'Realistic mock interviews with detailed feedback', color: 'from-emerald-500 to-green-600' },
  { icon: Briefcase, title: 'Job Board', desc: 'Cross-platform job search with live market trends', color: 'from-orange-500 to-red-500' },
  { icon: Brain, title: 'Aptitude Tests', desc: 'Practice aptitude with category tracking & analytics', color: 'from-pink-500 to-rose-600' },
  { icon: Code, title: 'Coding Lab', desc: 'Code practice with live execution and AI hints', color: 'from-teal-500 to-cyan-600' },
];

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate(isAdmin ? '/admin' : '/dashboard');
    }
  }, [isAuthenticated, isAdmin, navigate]);

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold gradient-text">VidyaMitra</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>Sign In</Button>
            <Button size="sm" onClick={() => navigate('/login')} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/20">
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-violet-500/10 via-transparent to-transparent" />
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <Badge className="mb-6 bg-violet-500/10 text-violet-400 border-violet-500/20 px-4 py-1.5 text-xs">
              <Sparkles className="h-3 w-3 mr-1.5" /> AI-Powered Career Platform
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
              Your Path to{' '}
              <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Career Excellence
              </span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
              Master interviews, build ATS-ready resumes, get personalized career roadmaps, and discover opportunities — all powered by artificial intelligence.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
              <Button size="lg" onClick={() => navigate('/login')}
                className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-xl shadow-violet-500/25 text-base px-8 h-12">
                Start Your Journey <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-base px-8 h-12">
                Explore Features
              </Button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="mt-16 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { label: 'AI Models', value: '6+' },
              { label: 'Job Portals', value: '6+' },
              { label: 'Career Features', value: '10+' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-bold gradient-text">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold">Everything You Need to <span className="gradient-text">Succeed</span></h2>
            <p className="text-muted-foreground mt-3">Comprehensive tools powered by cutting-edge AI</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }} transition={{ delay: i * 0.1 }}>
                <div className="p-6 rounded-2xl border border-border/50 bg-card card-hover group h-full">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-gradient-to-b from-violet-500/5 to-purple-500/5">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Accelerate Your Career?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join VidyaMitra today and get personalized AI guidance for interviews, resumes, and career growth.
          </p>
          <Button size="lg" onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-xl shadow-violet-500/25 text-base px-10 h-12">
            Get Started — Free <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-purple-600 flex items-center justify-center">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span className="text-sm font-semibold gradient-text">VidyaMitra</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2024 VidyaMitra. AI-Powered Career Companion.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;
