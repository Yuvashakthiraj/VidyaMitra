import { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { newsApi, exchangeApi } from '@/lib/api';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    Briefcase, Search, ExternalLink, MapPin, Building, Clock,
    DollarSign, TrendingUp, Filter, Globe, Newspaper, ArrowRight
} from 'lucide-react';

const JOB_PORTALS = [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/jobs/search/?keywords=', icon: '💼', color: 'from-blue-600 to-blue-700' },
    { name: 'Indeed', url: 'https://www.indeed.com/jobs?q=', icon: '🔍', color: 'from-indigo-500 to-blue-600' },
    { name: 'Glassdoor', url: 'https://www.glassdoor.com/Job/jobs.htm?sc.keyword=', icon: '🏢', color: 'from-green-500 to-emerald-600' },
    { name: 'Naukri', url: 'https://www.naukri.com/jobs-in-india?k=', icon: '🇮🇳', color: 'from-blue-500 to-cyan-500' },
    { name: 'AngelList', url: 'https://angel.co/jobs?query=', icon: '🚀', color: 'from-purple-500 to-violet-600' },
    { name: 'Internshala', url: 'https://internshala.com/internships/keywords-', icon: '🎓', color: 'from-cyan-500 to-teal-600' },
];

const FEATURED_ROLES = [
    { title: 'Software Engineer', company: 'Multiple Companies', location: 'Remote / Hybrid', type: 'Full Time', range: '₹8-25 LPA', tags: ['JavaScript', 'Python', 'AWS'] },
    { title: 'Data Scientist', company: 'Top Tech Firms', location: 'Bangalore, India', type: 'Full Time', range: '₹10-30 LPA', tags: ['Python', 'ML', 'TensorFlow'] },
    { title: 'Frontend Developer', company: 'Startups', location: 'Remote', type: 'Full Time / Contract', range: '₹6-18 LPA', tags: ['React', 'TypeScript', 'CSS'] },
    { title: 'DevOps Engineer', company: 'Enterprises', location: 'Hyderabad, India', type: 'Full Time', range: '₹10-28 LPA', tags: ['Docker', 'Kubernetes', 'CI/CD'] },
    { title: 'Product Manager', company: 'Product Companies', location: 'Mumbai / Remote', type: 'Full Time', range: '₹12-35 LPA', tags: ['Strategy', 'Agile', 'Analytics'] },
    { title: 'ML Engineer', company: 'AI Startups', location: 'Remote', type: 'Full Time', range: '₹12-40 LPA', tags: ['Python', 'PyTorch', 'MLOps'] },
];

const JobBoard = () => {
    const { user } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [location, setLocation] = useState('');
    const [jobType, setJobType] = useState<string>('all');
    const [news, setNews] = useState<any[]>([]);
    const [exchangeRates, setExchangeRates] = useState<any>(null);
    const [loadingNews, setLoadingNews] = useState(true);

    useEffect(() => {
        const loadMarketData = async () => {
            try {
                const newsData = await newsApi.search('technology jobs hiring trends');
                setNews(newsData.articles || []);
            } catch { }
            try {
                const rates = await exchangeApi.getRates();
                setExchangeRates(rates);
            } catch { }
            setLoadingNews(false);
        };
        loadMarketData();
    }, []);

    const handlePortalSearch = (portal: typeof JOB_PORTALS[0]) => {
        const query = searchQuery || 'software engineer';
        const url = portal.url + encodeURIComponent(query);
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const filteredRoles = FEATURED_ROLES.filter(role => {
        const matchesSearch = !searchQuery || role.title.toLowerCase().includes(searchQuery.toLowerCase()) || role.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesType = jobType === 'all' || role.type.toLowerCase().includes(jobType.toLowerCase());
        return matchesSearch && matchesType;
    });

    return (
        <Layout>
            <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Job Opportunities</h1>
                    <p className="text-muted-foreground mt-1">Discover jobs, track market trends, and apply across platforms</p>
                </div>

                {/* Search Bar */}
                <Card className="border-border/50 overflow-hidden">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            <div className="md:col-span-2">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                        placeholder="Search roles, skills..." className="pl-9" />
                                </div>
                            </div>
                            <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Location (optional)" />
                            <Select value={jobType} onValueChange={setJobType}>
                                <SelectTrigger><SelectValue placeholder="Job Type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="full time">Full Time</SelectItem>
                                    <SelectItem value="remote">Remote</SelectItem>
                                    <SelectItem value="contract">Contract</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Job Portals */}
                <div>
                    <h2 className="text-lg font-semibold mb-3">Search on Popular Platforms</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {JOB_PORTALS.map((portal, i) => (
                            <motion.div key={portal.name} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                                <button onClick={() => handlePortalSearch(portal)}
                                    className="w-full p-4 rounded-xl border border-border/50 hover:border-primary/50 bg-card card-hover text-center group">
                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${portal.color} flex items-center justify-center mx-auto mb-2 text-xl shadow-lg`}>
                                        {portal.icon}
                                    </div>
                                    <p className="text-xs font-medium">{portal.name}</p>
                                    <ExternalLink className="h-3 w-3 text-muted-foreground mx-auto mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Featured Roles */}
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2"><Briefcase className="h-4 w-4 text-primary" />Trending Roles</h2>
                        <div className="space-y-3">
                            {filteredRoles.map((role, i) => (
                                <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                                    <Card className="card-hover border-border/50">
                                        <CardContent className="pt-4 pb-4">
                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-semibold">{role.title}</h3>
                                                    <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-muted-foreground">
                                                        <span className="flex items-center gap-1"><Building className="h-3 w-3" />{role.company}</span>
                                                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{role.location}</span>
                                                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{role.type}</span>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 mt-2">
                                                        {role.tags.map((tag, j) => (
                                                            <Badge key={j} variant="outline" className="text-[10px]">{tag}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-semibold text-sm text-primary">{role.range}</p>
                                                    <Button size="sm" variant="outline" className="mt-2"
                                                        onClick={() => window.open(`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(role.title)}`, '_blank')}>
                                                        Apply <ArrowRight className="h-3 w-3 ml-1" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Sidebar: Market Data */}
                    <div className="space-y-4">
                        {/* Exchange Rates */}
                        {exchangeRates && (
                            <Card className="border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm flex items-center gap-2"><DollarSign className="h-4 w-4 text-green-500" />Exchange Rates (USD)</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {Object.entries(exchangeRates.rates || {}).map(([currency, rate]: [string, any]) => (
                                            <div key={currency} className="flex justify-between items-center p-2 rounded bg-muted/30">
                                                <span className="text-xs font-medium">{currency}</span>
                                                <span className="text-xs font-bold">{typeof rate === 'number' ? rate.toFixed(2) : rate}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2">Updated: {exchangeRates.lastUpdated ? new Date(exchangeRates.lastUpdated).toLocaleDateString() : 'N/A'}</p>
                                </CardContent>
                            </Card>
                        )}

                        {/* Industry News */}
                        <Card className="border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm flex items-center gap-2"><Newspaper className="h-4 w-4 text-primary" />Industry News</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {loadingNews ? (
                                    <p className="text-xs text-muted-foreground py-4 text-center">Loading news...</p>
                                ) : news.length > 0 ? (
                                    <div className="space-y-3">
                                        {news.slice(0, 5).map((article, i) => (
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
                                    <p className="text-xs text-muted-foreground py-4 text-center">No news available</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default JobBoard;
