import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, FileText, CheckCircle, XCircle, AlertCircle, Trophy } from "lucide-react";
import { processResume } from "@/utils/atsParser";
import { ResumeData } from "@/types";
import { toast } from "sonner";
import { analyzeResumeForAllRoles, RoleMatchResult, getConfidenceBadgeVariant } from "@/utils/intelligentRoleDetection";
import LearningRecommendations from "@/components/LearningRecommendations";
import { generateResumeSkillGaps } from "@/utils/learningRecommendations";
import { saveResumeToFirestore } from "@/lib/resumeService";
import { parseResumeFile } from "@/utils/resumeParser";
import { useAuth } from "@/contexts/AuthContext";

interface ResumeUploadProps {
  roleId?: string;
  onResumeProcessed?: (resume: ResumeData) => void;
  minimumScore?: number;
  showBestMatch?: boolean;
}

export const ResumeUpload = ({ roleId, onResumeProcessed, minimumScore = 60, showBestMatch = false }: ResumeUploadProps) => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [topMatches, setTopMatches] = useState<RoleMatchResult[]>([]);
  const [error, setError] = useState<string>("");
  const [skillGapAnalysis, setSkillGapAnalysis] = useState(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        setError("Please upload a PDF file");
        setFile(null);
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError("");
      setResume(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setProcessing(true);
    setError("");
    setTopMatches([]);
    
    console.log("🔍 Starting resume analysis...", { 
      fileName: file.name, 
      fileSize: file.size,
      roleId, 
      showBestMatch,
      mode: showBestMatch ? 'Best Match Detection' : roleId ? 'Single Role Analysis' : 'Unknown'
    });
    toast.success("AI is analyzing your resume...", { duration: 2000 });

    try {
      if (showBestMatch) {
        // Intelligent role detection - analyze against all roles
        console.log("📊 Mode: Analyzing against all roles for best match");
        const matches = await analyzeResumeForAllRoles(file);
        
        console.log(`✅ Found ${matches.length} role matches`);
        setTopMatches(matches);
        
        if (matches.length > 0) {
          // Use the best match for displaying resume details
          console.log(`🎯 Best match: ${matches[0].roleName} (${matches[0].score}%)`);
          const bestMatchResume = await processResume(file, matches[0].roleId);
          setResume(bestMatchResume);
          toast.success(`Top match: ${matches[0].roleName} (${matches[0].score}% - ${matches[0].confidenceLevel})`);
        } else {
          console.warn("⚠️ No suitable role match found");
          toast.error("No suitable role match found. Resume score too low for all roles.");
        }
      } else if (roleId) {
        // Analyze against specific role
        console.log("📊 Mode: Processing resume for specific role:", roleId);
        const processedResume = await processResume(file, roleId);
        console.log("✅ Resume processing completed:", {
          score: processedResume.atsScore,
          matchedSkills: processedResume.atsAnalysis.matchedSkills.length,
          missingSkills: processedResume.atsAnalysis.missingSkills.length,
          fileName: processedResume.fileName
        });
        
        // Save resume to Firestore
        if (user) {
          try {
            console.log("💾 Saving resume to Firestore...");
            const parsedResume = await parseResumeFile(file);
            // Ensure extractedData has required fields
            if (!parsedResume.extractedData) {
              parsedResume.extractedData = {
                email: undefined,
                phone: undefined,
                name: undefined,
                skills: [],
                experience: [],
                education: []
              };
            }
            // Remove undefined fields to prevent Firestore errors
            const cleanedResume = {
              ...parsedResume,
              extractedData: {
                email: parsedResume.extractedData?.email || null,
                phone: parsedResume.extractedData?.phone || null,
                name: parsedResume.extractedData?.name || null,
                skills: parsedResume.extractedData?.skills || [],
                experience: parsedResume.extractedData?.experience || [],
                education: parsedResume.extractedData?.education || []
              }
            };
            const { success, resumeId } = await saveResumeToFirestore(user.id, cleanedResume);
            if (success) {
              console.log('✅ Resume saved to Firestore:', resumeId);
              toast.success('Resume saved successfully!');
            }
          } catch (saveError) {
            console.error('❌ Failed to save resume to Firestore:', saveError);
            // Don't block the flow if saving fails
          }
        }
        
        setResume(processedResume);
        
        // Generate skill gap analysis for learning recommendations
        if (processedResume.atsAnalysis && roleId) {
          try {
            console.log("🎓 Generating skill gap analysis...");
            const allSkills = [
              ...(processedResume.atsAnalysis.matchedSkills || []),
              ...(processedResume.parsedData.skills || [])
            ].filter(Boolean); // Remove any null/undefined values
            
            const skillGaps = generateResumeSkillGaps(
              allSkills,
              roleId,
              processedResume.atsScore
            );
            setSkillGapAnalysis(skillGaps);
            console.log("✅ Skill gap analysis generated");
          } catch (skillGapError) {
            console.error('❌ Failed to generate skill gap analysis:', skillGapError);
            // Continue without skill gap analysis
          }
        }
        
        if (processedResume.atsScore >= minimumScore) {
          console.log(`✅ Resume passed threshold (${processedResume.atsScore}% >= ${minimumScore}%)`);
          toast.success(`Resume scored ${processedResume.atsScore}%. You can proceed with the interview!`);
          onResumeProcessed?.(processedResume);
        } else {
          console.warn(`⚠️ Resume below threshold (${processedResume.atsScore}% < ${minimumScore}%)`);
          toast.error(`Resume scored ${processedResume.atsScore}%. Minimum required is ${minimumScore}%.`);
        }
      } else {
        console.error("❌ Invalid configuration: No roleId and showBestMatch is false");
        toast.error("Invalid configuration. Please try again.");
      }
    } catch (err) {
      console.error("❌ Resume processing failed:", err);
      console.error("Error details:", {
        message: err?.message,
        stack: err?.stack,
        name: err?.name
      });
      
      // Only show error if resume wasn't processed at all
      if (!resume) {
        // Check if it's an API-related error
        if (err?.message?.includes('API') || err?.message?.includes('Gemini')) {
          setError("AI service temporarily unavailable. Using fallback analysis.");
          toast.error("AI service unavailable, using basic analysis");
        } else if (err?.message?.includes('PDF')) {
          setError("Failed to read PDF file. Please ensure it's a valid PDF.");
          toast.error("Invalid PDF file");
        } else {
          setError("Failed to process resume. Please try again.");
          toast.error("Failed to process resume");
        }
      }
    } finally {
      setProcessing(false);
      console.log("🏁 Resume analysis complete");
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-600">Excellent Match</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-600">Good Match</Badge>;
    return <Badge variant="destructive">Below Threshold</Badge>;
  };

  return (
    <Card className="w-full border-2 border-amber-300 bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-amber-100 to-orange-100 border-b border-amber-200">
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <FileText className="h-5 w-5 text-amber-600" />
          {showBestMatch ? 'Resume Analysis - Find Best Role Match' : 'Resume Upload & ATS Analysis'}
        </CardTitle>
        <CardDescription className="text-amber-800 font-medium">
          {showBestMatch 
            ? '✨ Upload your resume to find which role matches best with your profile'
            : `Upload your resume to check compatibility with this role (Minimum score: ${minimumScore}%)`
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-col gap-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="file"
                accept=".pdf"
                onChange={handleFileChange}
                disabled={processing}
                className="flex-1 border-2 border-amber-300 bg-white focus:border-amber-500 focus:ring-amber-500"
              />
              <Button
                onClick={handleUpload}
                disabled={!file || processing}
                className="min-w-[120px] bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 font-semibold shadow-md"
              >
                {processing ? (
                  "Processing..."
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
              <FileText className="h-3 w-3" />
              📄 Supported format: PDF only • Max size: 5MB
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {processing && (
            <div className="space-y-3 p-4 bg-gradient-to-r from-amber-100 to-orange-100 border-2 border-amber-300 rounded-lg">
              <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
                <Upload className="h-4 w-4 animate-bounce" />
                ✨ AI is analyzing your resume...
              </p>
              <Progress value={50} className="w-full bg-amber-200" />
            </div>
          )}

        {/* Display Top Matches with Intelligent Role Detection */}
        {showBestMatch && topMatches.length > 0 && (
          <div className="space-y-4">
            <div className="p-5 bg-gradient-to-r from-amber-100 via-orange-100 to-yellow-100 border-2 border-amber-400 rounded-xl shadow-md">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-6 w-6 text-amber-600" />
                <h3 className="font-bold text-xl text-amber-900">🎯 Best Match (AI-Detected)</h3>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-bold text-amber-900">{topMatches[0].roleName}</p>
                  <Badge variant={getConfidenceBadgeVariant(topMatches[0].confidenceLevel)} className="text-sm">
                    {topMatches[0].confidenceLevel}
                  </Badge>
                </div>
                <p className="text-3xl font-bold text-orange-600">{topMatches[0].score}%</p>
                <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                  <div className="bg-white/70 p-2 rounded border border-amber-200">
                    <span className="text-amber-700 font-medium">Skills:</span>
                    <span className="font-bold ml-1 text-amber-900">{topMatches[0].matchBreakdown.skillsScore}%</span>
                  </div>
                  <div className="bg-white/70 p-2 rounded border border-amber-200">
                    <span className="text-amber-700 font-medium">Experience:</span>
                    <span className="font-bold ml-1 text-amber-900">{topMatches[0].matchBreakdown.experienceScore}%</span>
                  </div>
                  <div className="bg-white/70 p-2 rounded border border-amber-200">
                    <span className="text-amber-700 font-medium">Education:</span>
                    <span className="font-bold ml-1 text-amber-900">{topMatches[0].matchBreakdown.educationScore}%</span>
                  </div>
                  <div className="bg-white/70 p-2 rounded border border-amber-200">
                    <span className="text-amber-700 font-medium">Certifications:</span>
                    <span className="font-bold ml-1 text-amber-900">{topMatches[0].matchBreakdown.certificationsScore}%</span>
                  </div>
                </div>
              </div>
            </div>

            {topMatches.length > 1 && (
              <div>
                <h3 className="font-semibold mb-2">Other Potential Matches</h3>
                <div className="space-y-2">
                  {topMatches.slice(1).map((match) => (
                    <div key={match.roleId} className="p-3 border rounded-lg bg-muted/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium">{match.roleName}</span>
                        <div className="flex gap-2">
                          <Badge variant={getConfidenceBadgeVariant(match.confidenceLevel)}>
                            {match.confidenceLevel}
                          </Badge>
                          <Badge variant="outline" className="font-bold">
                            {match.score}%
                          </Badge>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-xs">
                        <span>Skills: {match.matchBreakdown.skillsScore}%</span>
                        <span>Exp: {match.matchBreakdown.experienceScore}%</span>
                        <span>Edu: {match.matchBreakdown.educationScore}%</span>
                        <span>Cert: {match.matchBreakdown.certificationsScore}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

          {resume && !showBestMatch && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-lg">ATS Analysis Results</h3>
                {getScoreBadge(resume.atsScore)}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium mb-2">Overall ATS Score</p>
                  <p className={`text-4xl font-bold ${getScoreColor(resume.atsScore)}`}>
                    {resume.atsScore}%
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Skills Match:</span>
                    <span className="font-medium">{resume.atsAnalysis.overallMatch}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Experience Match:</span>
                    <span className="font-medium">{resume.atsAnalysis.experienceMatch}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Education Match:</span>
                    <span className="font-medium">{resume.atsAnalysis.educationMatch}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    Matched Skills ({resume.atsAnalysis.matchedSkills.length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {resume.atsAnalysis.matchedSkills.map((skill, idx) => (
                      <Badge key={idx} variant="outline" className="bg-green-50">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>

                {resume.atsAnalysis.missingSkills.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      Missing Skills ({resume.atsAnalysis.missingSkills.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {resume.atsAnalysis.missingSkills.slice(0, 10).map((skill, idx) => (
                        <Badge key={idx} variant="outline" className="bg-yellow-50">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!showBestMatch && (
                <>
                  {resume.atsScore >= minimumScore ? (
                    <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-800">
                        Your resume meets the minimum requirements. You can proceed with the interview!
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="destructive" className="border-2">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>
                        Your resume score ({resume.atsScore}%) is below the minimum threshold of {minimumScore}%. 
                        <strong className="block mt-1">Review the learning recommendations below to improve your skills and try again.</strong>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              )}
            </div>
          )}

          {/* Learning Recommendations for Resume Analysis */}
          {skillGapAnalysis && resume && (
            <div className={`mt-6 ${resume.atsScore < minimumScore ? 'ring-2 ring-amber-400 rounded-lg p-2 bg-amber-50/50' : ''}`}>
              {resume.atsScore < minimumScore && (
                <div className="mb-4 p-3 bg-amber-100 border border-amber-300 rounded-lg">
                  <p className="font-semibold text-amber-900 flex items-center gap-2">
                    <AlertCircle className="h-5 w-5" />
                    🎯 Focus on these skills to improve your resume score
                  </p>
                  <p className="text-sm text-amber-800 mt-1">
                    Complete the recommended courses below to strengthen your profile for this role.
                  </p>
                </div>
              )}
              <LearningRecommendations 
                skillGapAnalysis={skillGapAnalysis}
                title="📚 Skill Gap Analysis & Learning Recommendations"
                showOverallScore={true}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};