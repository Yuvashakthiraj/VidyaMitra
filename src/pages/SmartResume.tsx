import { useState } from 'react';
import Layout from '@/components/Layout';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    Upload, FileText, CheckCircle, XCircle, AlertCircle, Trophy, Download,
    Plus, Trash2, ChevronRight, ChevronLeft, Eye, Sparkles, GraduationCap
} from 'lucide-react';
import { processResume } from '@/utils/atsParser';
import { ResumeData } from '@/types';
import { toast } from 'sonner';
import { geminiApi, resumeBuilderApi } from '@/lib/api';
import { generateResumeSkillGaps } from '@/utils/learningRecommendations';
import LearningRecommendations from '@/components/LearningRecommendations';
import { motion } from 'framer-motion';
import jsPDF from 'jspdf';

const JOB_ROLES = [
    'Software Engineer', 'Frontend Developer', 'Backend Developer', 'Full Stack Developer',
    'Data Scientist', 'Data Analyst', 'Machine Learning Engineer', 'DevOps Engineer',
    'Cloud Architect', 'Cybersecurity Analyst', 'Product Manager', 'UI/UX Designer',
    'Mobile Developer', 'QA Engineer', 'Database Administrator', 'System Administrator',
    'Business Analyst', 'Project Manager', 'Technical Writer', 'Other'
];

const TEMPLATES = [
    { id: 'modern', name: 'Modern', desc: 'Clean, contemporary design with accent colors', color: 'from-violet-500 to-purple-600' },
    { id: 'classic', name: 'Classic', desc: 'Traditional professional layout', color: 'from-blue-500 to-indigo-600' },
    { id: 'creative', name: 'Creative', desc: 'Bold design with visual elements', color: 'from-pink-500 to-rose-600' },
];

// ============= RESUME UPLOAD SECTION =============
const ResumeUploadSection = () => {
    const { user } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [processing, setProcessing] = useState(false);
    const [resume, setResume] = useState<ResumeData | null>(null);
    const [error, setError] = useState('');
    const [targetRole, setTargetRole] = useState('');
    const [customRole, setCustomRole] = useState('');
    const [skillGapAnalysis, setSkillGapAnalysis] = useState<any>(null);

    const effectiveRole = targetRole === 'Other' ? customRole : targetRole;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            if (f.type !== 'application/pdf') { setError('Please upload a PDF file'); setFile(null); return; }
            if (f.size > 5 * 1024 * 1024) { setError('File must be < 5MB'); setFile(null); return; }
            setFile(f); setError(''); setResume(null); setSkillGapAnalysis(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !effectiveRole) { toast.error('Select a target role first'); return; }
        setProcessing(true); setError('');
        toast.success('AI is analyzing your resume...', { duration: 2000 });
        try {
            const processedResume = await processResume(file, effectiveRole);
            setResume(processedResume);

            if (processedResume.atsAnalysis) {
                try {
                    const allSkills = [...(processedResume.atsAnalysis.matchedSkills || []), ...(processedResume.parsedData.skills || [])].filter(Boolean);
                    const gaps = generateResumeSkillGaps(allSkills, effectiveRole, processedResume.atsScore);
                    setSkillGapAnalysis(gaps);
                } catch { }
            }

            toast.success(`Resume scored ${processedResume.atsScore}%`);
        } catch (err: any) {
            setError(err.message || 'Failed to process resume');
            toast.error('Failed to process resume');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Role Selection */}
            <Card className="border-border/50">
                <CardContent className="pt-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <Label>Target Job Role *</Label>
                            <Select value={targetRole} onValueChange={setTargetRole}>
                                <SelectTrigger><SelectValue placeholder="Select a role..." /></SelectTrigger>
                                <SelectContent>
                                    {JOB_ROLES.map(role => <SelectItem key={role} value={role}>{role}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        {targetRole === 'Other' && (
                            <div>
                                <Label>Custom Role</Label>
                                <Input value={customRole} onChange={e => setCustomRole(e.target.value)} placeholder="Enter your target role" />
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3">
                        <Input type="file" accept=".pdf" onChange={handleFileChange} disabled={processing} className="flex-1" />
                        <Button onClick={handleUpload} disabled={!file || processing || !effectiveRole}
                            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 min-w-[120px]">
                            {processing ? 'Analyzing...' : <><Upload className="mr-2 h-4 w-4" />Upload</>}
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">📄 PDF only • Max 5MB</p>
                </CardContent>
            </Card>

            {error && <Alert variant="destructive"><XCircle className="h-4 w-4" /><AlertDescription>{error}</AlertDescription></Alert>}

            {processing && (
                <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                        <p className="text-sm font-medium flex items-center gap-2"><Sparkles className="h-4 w-4 animate-pulse text-primary" /> AI is analyzing your resume...</p>
                        <Progress value={50} className="mt-3" />
                    </CardContent>
                </Card>
            )}

            {/* Results */}
            {resume && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <Card className="border-border/50">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle>ATS Analysis Results</CardTitle>
                                <Badge variant={resume.atsScore >= 80 ? 'default' : resume.atsScore >= 60 ? 'secondary' : 'destructive'}>
                                    {resume.atsScore >= 80 ? 'Excellent' : resume.atsScore >= 60 ? 'Good' : 'Needs Work'}
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-sm font-medium mb-2">Overall ATS Score</p>
                                    <p className={`text-5xl font-bold ${resume.atsScore >= 80 ? 'text-green-500' : resume.atsScore >= 60 ? 'text-yellow-500' : 'text-red-500'}`}>
                                        {resume.atsScore}%
                                    </p>
                                    <Progress value={resume.atsScore} className="mt-3" />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Skills Match</span><span className="font-medium">{resume.atsAnalysis.overallMatch}%</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Experience</span><span className="font-medium">{resume.atsAnalysis.experienceMatch}%</span></div>
                                    <div className="flex justify-between text-sm"><span className="text-muted-foreground">Education</span><span className="font-medium">{resume.atsAnalysis.educationMatch}%</span></div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <p className="text-sm font-medium mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" /> Matched Skills ({resume.atsAnalysis.matchedSkills.length})</p>
                                    <div className="flex flex-wrap gap-1.5">{resume.atsAnalysis.matchedSkills.map((s, i) => <Badge key={i} variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">{s}</Badge>)}</div>
                                </div>
                                {resume.atsAnalysis.missingSkills.length > 0 && (
                                    <div>
                                        <p className="text-sm font-medium mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-yellow-500" /> Missing Skills ({resume.atsAnalysis.missingSkills.length})</p>
                                        <div className="flex flex-wrap gap-1.5">{resume.atsAnalysis.missingSkills.slice(0, 10).map((s, i) => <Badge key={i} variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-xs">{s}</Badge>)}</div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {skillGapAnalysis && (
                        <LearningRecommendations skillGapAnalysis={skillGapAnalysis} title="📚 Skill Gap & Course Recommendations" showOverallScore={true} />
                    )}
                </motion.div>
            )}
        </div>
    );
};

// ============= RESUME BUILDER SECTION =============
interface ResumeFormData {
    personalInfo: { name: string; email: string; phone: string; linkedin: string; location: string; summary: string };
    education: Array<{ institution: string; degree: string; field: string; year: string; gpa: string }>;
    experience: Array<{ company: string; position: string; duration: string; description: string }>;
    projects: Array<{ name: string; description: string; technologies: string; link: string }>;
    skills: string[];
    template: string;
}

const ResumeBuilderSection = () => {
    const { user } = useAuth();
    const [step, setStep] = useState(0);
    const [template, setTemplate] = useState('modern');
    const [atsScore, setAtsScore] = useState<number | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [scoring, setScoring] = useState(false);

    const [formData, setFormData] = useState<ResumeFormData>({
        personalInfo: { name: '', email: user?.email || '', phone: '', linkedin: '', location: '', summary: '' },
        education: [{ institution: '', degree: '', field: '', year: '', gpa: '' }],
        experience: [{ company: '', position: '', duration: '', description: '' }],
        projects: [{ name: '', description: '', technologies: '', link: '' }],
        skills: [],
        template: 'modern',
    });

    const [skillInput, setSkillInput] = useState('');

    const steps = ['Personal Info', 'Education', 'Experience', 'Projects', 'Skills', 'Template'];

    const updatePersonalInfo = (field: string, value: string) =>
        setFormData(prev => ({ ...prev, personalInfo: { ...prev.personalInfo, [field]: value } }));

    const addItem = (section: 'education' | 'experience' | 'projects') => {
        const defaults: Record<string, any> = {
            education: { institution: '', degree: '', field: '', year: '', gpa: '' },
            experience: { company: '', position: '', duration: '', description: '' },
            projects: { name: '', description: '', technologies: '', link: '' },
        };
        setFormData(prev => ({ ...prev, [section]: [...prev[section], defaults[section]] }));
    };

    const removeItem = (section: 'education' | 'experience' | 'projects', index: number) => {
        if (formData[section].length <= 1) return;
        setFormData(prev => ({ ...prev, [section]: prev[section].filter((_, i) => i !== index) }));
    };

    const updateItem = (section: 'education' | 'experience' | 'projects', index: number, field: string, value: string) =>
        setFormData(prev => ({
            ...prev,
            [section]: prev[section].map((item, i) => i === index ? { ...item, [field]: value } : item),
        }));

    const addSkill = () => {
        if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
            setFormData(prev => ({ ...prev, skills: [...prev.skills, skillInput.trim()] }));
            setSkillInput('');
        }
    };

    const removeSkill = (skill: string) =>
        setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));

    const scoreResume = async () => {
        setScoring(true);
        try {
            const result = await geminiApi.generate(
                `Score this resume for ATS friendliness (0-100). Name: ${formData.personalInfo.name}. Skills: ${formData.skills.join(', ')}. Education: ${formData.education.map(e => `${e.degree} in ${e.field} from ${e.institution}`).join('; ')}. Experience: ${formData.experience.map(e => `${e.position} at ${e.company}`).join('; ')}. Return ONLY a JSON object: {"score": number, "feedback": "string"}`,
                0.3, 200
            );
            if (result.success && result.text) {
                try {
                    const clean = result.text.replace(/```json\n?|\n?```/g, '').trim();
                    const match = clean.match(/\{[\s\S]*\}/);
                    if (match) {
                        const parsed = JSON.parse(match[0]);
                        setAtsScore(parsed.score || 70);
                        toast.success(`ATS Score: ${parsed.score}%`);
                    }
                } catch { setAtsScore(72); }
            }
        } catch { setAtsScore(70); toast.info('Using estimated score'); }
        setScoring(false);
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        const { personalInfo, education, experience, projects, skills } = formData;
        let y = 20;

        // Header
        if (template === 'modern' || template === 'creative') {
            doc.setFillColor(124, 58, 237); doc.rect(0, 0, 210, 40, 'F');
            doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
            doc.text(personalInfo.name || 'Your Name', 15, 18);
            doc.setFontSize(10); doc.setFont('helvetica', 'normal');
            doc.text(`${personalInfo.email} | ${personalInfo.phone} | ${personalInfo.location}`, 15, 28);
            if (personalInfo.linkedin) doc.text(personalInfo.linkedin, 15, 34);
            doc.setTextColor(0, 0, 0); y = 50;
        } else {
            doc.setFontSize(20); doc.setFont('helvetica', 'bold');
            doc.text(personalInfo.name || 'Your Name', 105, y, { align: 'center' }); y += 8;
            doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            doc.text(`${personalInfo.email} | ${personalInfo.phone} | ${personalInfo.location}`, 105, y, { align: 'center' }); y += 12;
        }

        // Summary
        if (personalInfo.summary) {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(124, 58, 237);
            doc.text('PROFESSIONAL SUMMARY', 15, y); y += 2;
            doc.setDrawColor(124, 58, 237); doc.line(15, y, 195, y); y += 6;
            doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            const summaryLines = doc.splitTextToSize(personalInfo.summary, 175);
            doc.text(summaryLines, 15, y); y += summaryLines.length * 5 + 6;
        }

        // Skills
        if (skills.length > 0) {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(124, 58, 237);
            doc.text('SKILLS', 15, y); y += 2;
            doc.setDrawColor(124, 58, 237); doc.line(15, y, 195, y); y += 6;
            doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
            const skillText = doc.splitTextToSize(skills.join(' • '), 175);
            doc.text(skillText, 15, y); y += skillText.length * 5 + 6;
        }

        // Experience
        if (experience.some(e => e.company)) {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(124, 58, 237);
            doc.text('EXPERIENCE', 15, y); y += 2;
            doc.setDrawColor(124, 58, 237); doc.line(15, y, 195, y); y += 6;
            doc.setTextColor(0, 0, 0);
            experience.filter(e => e.company).forEach(exp => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.setFontSize(10); doc.setFont('helvetica', 'bold');
                doc.text(`${exp.position} — ${exp.company}`, 15, y); y += 5;
                doc.setFontSize(8); doc.setFont('helvetica', 'italic'); doc.setTextColor(100, 100, 100);
                doc.text(exp.duration, 15, y); y += 5;
                doc.setTextColor(0, 0, 0); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
                if (exp.description) {
                    const descLines = doc.splitTextToSize(exp.description, 175);
                    doc.text(descLines, 15, y); y += descLines.length * 5 + 4;
                }
            });
            y += 4;
        }

        // Education
        if (education.some(e => e.institution)) {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(124, 58, 237);
            doc.text('EDUCATION', 15, y); y += 2;
            doc.setDrawColor(124, 58, 237); doc.line(15, y, 195, y); y += 6;
            doc.setTextColor(0, 0, 0);
            education.filter(e => e.institution).forEach(edu => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.setFontSize(10); doc.setFont('helvetica', 'bold');
                doc.text(`${edu.degree} in ${edu.field}`, 15, y); y += 5;
                doc.setFontSize(9); doc.setFont('helvetica', 'normal');
                doc.text(`${edu.institution} | ${edu.year}${edu.gpa ? ` | GPA: ${edu.gpa}` : ''}`, 15, y); y += 8;
            });
            y += 4;
        }

        // Projects
        if (projects.some(p => p.name)) {
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.setTextColor(124, 58, 237);
            doc.text('PROJECTS', 15, y); y += 2;
            doc.setDrawColor(124, 58, 237); doc.line(15, y, 195, y); y += 6;
            doc.setTextColor(0, 0, 0);
            projects.filter(p => p.name).forEach(proj => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.setFontSize(10); doc.setFont('helvetica', 'bold');
                doc.text(proj.name, 15, y); y += 5;
                doc.setFontSize(9); doc.setFont('helvetica', 'normal');
                if (proj.technologies) { doc.text(`Technologies: ${proj.technologies}`, 15, y); y += 5; }
                if (proj.description) {
                    const pLines = doc.splitTextToSize(proj.description, 175);
                    doc.text(pLines, 15, y); y += pLines.length * 5 + 4;
                }
            });
        }

        const fileName = `${personalInfo.name ? personalInfo.name.replace(/[^a-zA-Z0-9 -]/g, '') : 'resume'}_VidyaMitra.pdf`;
        const blob = doc.output('blob');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast.success('Resume PDF downloaded!');
    };

    return (
        <div className="space-y-6">
            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-1 flex-wrap">
                {steps.map((s, i) => (
                    <button key={i} onClick={() => setStep(i)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${i === step ? 'bg-primary text-primary-foreground shadow-lg' :
                            i < step ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                            }`}>
                        <span className="w-5 h-5 rounded-full bg-background/20 flex items-center justify-center text-[10px]">{i + 1}</span>
                        <span className="hidden sm:inline">{s}</span>
                    </button>
                ))}
            </div>

            <Card className="border-border/50">
                <CardContent className="pt-6">
                    {/* Step 0: Personal Info */}
                    {step === 0 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Personal Information</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div><Label>Full Name *</Label><Input value={formData.personalInfo.name} onChange={e => updatePersonalInfo('name', e.target.value)} placeholder="John Doe" /></div>
                                <div><Label>Email *</Label><Input value={formData.personalInfo.email} onChange={e => updatePersonalInfo('email', e.target.value)} placeholder="john@email.com" /></div>
                                <div><Label>Phone *</Label><Input value={formData.personalInfo.phone} onChange={e => updatePersonalInfo('phone', e.target.value)} placeholder="+91 9876543210" /></div>
                                <div><Label>Location</Label><Input value={formData.personalInfo.location} onChange={e => updatePersonalInfo('location', e.target.value)} placeholder="City, Country" /></div>
                                <div className="md:col-span-2"><Label>LinkedIn URL</Label><Input value={formData.personalInfo.linkedin} onChange={e => updatePersonalInfo('linkedin', e.target.value)} placeholder="linkedin.com/in/..." /></div>
                                <div className="md:col-span-2"><Label>Professional Summary</Label><Textarea value={formData.personalInfo.summary} onChange={e => updatePersonalInfo('summary', e.target.value)} placeholder="Brief professional summary..." rows={3} /></div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: Education */}
                    {step === 1 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between"><h3 className="font-semibold text-lg">Education</h3>
                                <Button size="sm" variant="outline" onClick={() => addItem('education')}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
                            {formData.education.map((edu, i) => (
                                <div key={i} className="p-4 border rounded-lg space-y-3 relative">
                                    {formData.education.length > 1 && <button onClick={() => removeItem('education', i)} className="absolute top-2 right-2 text-destructive"><Trash2 className="h-4 w-4" /></button>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div><Label>Institution *</Label><Input value={edu.institution} onChange={e => updateItem('education', i, 'institution', e.target.value)} placeholder="MIT" /></div>
                                        <div><Label>Degree *</Label><Input value={edu.degree} onChange={e => updateItem('education', i, 'degree', e.target.value)} placeholder="B.Tech" /></div>
                                        <div><Label>Field of Study *</Label><Input value={edu.field} onChange={e => updateItem('education', i, 'field', e.target.value)} placeholder="Computer Science" /></div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div><Label>Year</Label><Input value={edu.year} onChange={e => updateItem('education', i, 'year', e.target.value)} placeholder="2024" /></div>
                                            <div><Label>GPA</Label><Input value={edu.gpa} onChange={e => updateItem('education', i, 'gpa', e.target.value)} placeholder="8.5" /></div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 2: Experience */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between"><h3 className="font-semibold text-lg">Experience</h3>
                                <Button size="sm" variant="outline" onClick={() => addItem('experience')}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
                            {formData.experience.map((exp, i) => (
                                <div key={i} className="p-4 border rounded-lg space-y-3 relative">
                                    {formData.experience.length > 1 && <button onClick={() => removeItem('experience', i)} className="absolute top-2 right-2 text-destructive"><Trash2 className="h-4 w-4" /></button>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div><Label>Company</Label><Input value={exp.company} onChange={e => updateItem('experience', i, 'company', e.target.value)} placeholder="Google" /></div>
                                        <div><Label>Position</Label><Input value={exp.position} onChange={e => updateItem('experience', i, 'position', e.target.value)} placeholder="Software Engineer" /></div>
                                        <div><Label>Duration</Label><Input value={exp.duration} onChange={e => updateItem('experience', i, 'duration', e.target.value)} placeholder="Jan 2023 - Present" /></div>
                                    </div>
                                    <div><Label>Description</Label><Textarea value={exp.description} onChange={e => updateItem('experience', i, 'description', e.target.value)} placeholder="Key achievements..." rows={2} /></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 3: Projects */}
                    {step === 3 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between"><h3 className="font-semibold text-lg">Projects</h3>
                                <Button size="sm" variant="outline" onClick={() => addItem('projects')}><Plus className="h-3 w-3 mr-1" />Add</Button></div>
                            {formData.projects.map((proj, i) => (
                                <div key={i} className="p-4 border rounded-lg space-y-3 relative">
                                    {formData.projects.length > 1 && <button onClick={() => removeItem('projects', i)} className="absolute top-2 right-2 text-destructive"><Trash2 className="h-4 w-4" /></button>}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div><Label>Project Name</Label><Input value={proj.name} onChange={e => updateItem('projects', i, 'name', e.target.value)} placeholder="E-Commerce App" /></div>
                                        <div><Label>Technologies</Label><Input value={proj.technologies} onChange={e => updateItem('projects', i, 'technologies', e.target.value)} placeholder="React, Node.js" /></div>
                                    </div>
                                    <div><Label>Description</Label><Textarea value={proj.description} onChange={e => updateItem('projects', i, 'description', e.target.value)} placeholder="What did you build?" rows={2} /></div>
                                    <div><Label>Link (optional)</Label><Input value={proj.link} onChange={e => updateItem('projects', i, 'link', e.target.value)} placeholder="github.com/..." /></div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Step 4: Skills */}
                    {step === 4 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Skills</h3>
                            <div className="flex gap-2">
                                <Input value={skillInput} onChange={e => setSkillInput(e.target.value)} placeholder="Add a skill..." onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())} />
                                <Button onClick={addSkill} variant="outline"><Plus className="h-4 w-4" /></Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {formData.skills.map((skill, i) => (
                                    <Badge key={i} variant="secondary" className="gap-1 cursor-pointer hover:bg-destructive/20" onClick={() => removeSkill(skill)}>
                                        {skill} <XCircle className="h-3 w-3" />
                                    </Badge>
                                ))}
                            </div>
                            {formData.skills.length === 0 && <p className="text-sm text-muted-foreground">Add your technical and soft skills</p>}
                        </div>
                    )}

                    {/* Step 5: Template */}
                    {step === 5 && (
                        <div className="space-y-4">
                            <h3 className="font-semibold text-lg">Choose Template</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {TEMPLATES.map(t => (
                                    <button key={t.id} onClick={() => { setTemplate(t.id); setFormData(prev => ({ ...prev, template: t.id })); }}
                                        className={`p-4 border-2 rounded-xl text-left transition-all ${template === t.id ? 'border-primary bg-primary/5 shadow-lg' : 'border-border hover:border-primary/50'}`}>
                                        <div className={`w-full h-24 rounded-lg bg-gradient-to-br ${t.color} mb-3 flex items-center justify-center`}>
                                            <FileText className="h-8 w-8 text-white/80" />
                                        </div>
                                        <p className="font-semibold text-sm">{t.name}</p>
                                        <p className="text-xs text-muted-foreground">{t.desc}</p>
                                    </button>
                                ))}
                            </div>

                            {/* Score & Download */}
                            <div className="flex flex-wrap gap-3 pt-4 border-t">
                                <Button onClick={scoreResume} disabled={scoring} variant="outline">
                                    {scoring ? 'Scoring...' : <><Sparkles className="h-4 w-4 mr-2" />Score Resume</>}
                                </Button>
                                <Button onClick={generatePDF} className="bg-gradient-to-r from-violet-600 to-purple-600">
                                    <Download className="h-4 w-4 mr-2" />Download PDF
                                </Button>
                                {atsScore !== null && (
                                    <Badge className={`text-lg px-4 py-2 ${atsScore >= 80 ? 'bg-green-500' : atsScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}>
                                        ATS Score: {atsScore}%
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="flex justify-between pt-6 mt-6 border-t">
                        <Button variant="outline" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
                            <ChevronLeft className="h-4 w-4 mr-1" />Previous
                        </Button>
                        {step < steps.length - 1 ? (
                            <Button onClick={() => setStep(step + 1)}>
                                Next<ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button onClick={generatePDF} className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 gap-2">
                                <Download className="h-4 w-4" />Generate & Download PDF
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ============= MAIN PAGE =============
const SmartResume = () => {
    return (
        <Layout>
            <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold gradient-text">Smart Resume</h1>
                    <p className="text-muted-foreground mt-1">Upload your resume for AI analysis or build one from scratch</p>
                </div>

                <Tabs defaultValue="upload" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                        <TabsTrigger value="upload" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                            <Upload className="h-4 w-4" />Upload & Analyze
                        </TabsTrigger>
                        <TabsTrigger value="builder" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2">
                            <FileText className="h-4 w-4" />Resume Builder
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="upload" className="mt-6"><ResumeUploadSection /></TabsContent>
                    <TabsContent value="builder" className="mt-6"><ResumeBuilderSection /></TabsContent>
                </Tabs>
            </div>
        </Layout>
    );
};

export default SmartResume;
