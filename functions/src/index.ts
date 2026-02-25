import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as nodemailer from 'nodemailer';

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Gemini AI with API key from environment
const geminiApiKey = functions.config().gemini?.apikey || process.env.GEMINI_API_KEY;
if (!geminiApiKey) {
  console.error('GEMINI_API_KEY not configured. Set using: firebase functions:config:set gemini.apikey="YOUR_KEY"');
}
const genAI = new GoogleGenerativeAI(geminiApiKey);

// Gemini model configurations
const model = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    temperature: 0.7,
    maxOutputTokens: 2048,
  }
});

const evaluationModel = genAI.getGenerativeModel({ 
  model: "gemini-2.5-flash-lite",
  generationConfig: {
    temperature: 0.3,
    maxOutputTokens: 1500,
  }
});

// ============= GENERATE INTERVIEW QUESTIONS =============
export const generateInterviewQuestions = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to generate questions.'
    );
  }

  const { roleTitle } = data;

  if (!roleTitle) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Role title is required.'
    );
  }

  try {
    const prompt = `You are an expert HR interviewer.

Generate exactly 10 interview questions for the job role: "${roleTitle}".

The questions must be strictly related to this role. 
Include a balanced mix of:
1. Technical questions
2. Conceptual understanding
3. Problem-solving / scenario-based
4. Behavioral / soft-skill related questions

Return ONLY a valid JSON array of objects with this exact format:
[
  {"id": "q1", "text": "Question text here", "category": "technical"},
  {"id": "q2", "text": "Question text here", "category": "behavioral"},
  ...
]

Categories must be one of: "technical", "behavioral", "situational"
Do not include markdown, explanations, or any text outside the JSON array.`;

    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const questions = JSON.parse(cleanedText);

    return { success: true, questions };
  } catch (error) {
    console.error('Error generating questions:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to generate interview questions.'
    );
  }
});

// ============= EVALUATE ANSWER =============
export const evaluateAnswer = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to evaluate answers.'
    );
  }

  const { question, answer } = data;

  if (!question || !answer) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Question and answer are required.'
    );
  }

  try {
    const prompt = `You are an expert interviewer evaluating a candidate's response.

QUESTION: ${question}

CANDIDATE'S ANSWER: ${answer}

Provide detailed feedback in the following JSON format:
{
  "overall": 7.5,
  "relevance": 8,
  "clarity": 7,
  "depth": 7,
  "strengths": ["Point 1", "Point 2"],
  "improvements": ["Point 1", "Point 2"],
  "possiblyAI": false,
  "comment": "Overall assessment"
}

- overall: Score from 0-10
- relevance: How relevant the answer is (0-10)
- clarity: How clear and well-structured (0-10)
- depth: Level of detail and insight (0-10)
- strengths: Array of positive aspects
- improvements: Array of areas to improve
- possiblyAI: Boolean indicating if answer seems AI-generated
- comment: Brief overall assessment

Return ONLY valid JSON, no markdown or extra text.`;

    const result = await evaluationModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // Parse the JSON response
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const feedback = JSON.parse(cleanedText);

    return { success: true, feedback };
  } catch (error) {
    console.error('Error evaluating answer:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to evaluate answer.'
    );
  }
});

// ============= SEND SELECTION EMAIL =============
export const sendSelectionEmail = functions.https.onCall(async (data, context) => {
  // Check if user is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
    );
  }

  // Check admin status from Firestore
  const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
  const userData = userDoc.data();

  if (!userData?.isAdmin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can send selection emails.'
    );
  }

  const { candidateEmail, candidateName, roleName, score } = data;

  if (!candidateEmail || !candidateName || !roleName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Candidate email, name, and role name are required.'
    );
  }

  try {
    // Configure email transport (use your SMTP settings)
    const transporter = nodemailer.createTransporter({
      service: 'gmail', // or your email service
      auth: {
        user: functions.config().email?.user || process.env.EMAIL_USER,
        pass: functions.config().email?.password || process.env.EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: `MockMate Interview Platform <${functions.config().email?.user}>`,
      to: candidateEmail,
      subject: `Congratulations! You've been selected for ${roleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Congratulations, ${candidateName}!</h2>
          <p>We are pleased to inform you that you have been selected for the <strong>${roleName}</strong> position.</p>
          <p>Your interview performance was outstanding, with a score of <strong>${score}/100</strong>.</p>
          <p>Our team will reach out to you shortly with the next steps.</p>
          <br>
          <p>Best regards,</p>
          <p><strong>MockMate Team</strong></p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending email:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send selection email.'
    );
  }
});

// ============= ATS RESUME ANALYSIS =============
export const analyzeResume = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
    );
  }

  const { resumeText, roleTitle } = data;

  if (!resumeText || !roleTitle) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Resume text and role title are required.'
    );
  }

  try {
    const atsModel = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash-lite",
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 3000,
      }
    });

    const prompt = `You are an ATS (Applicant Tracking System) analyzer.

Analyze this resume for the role: "${roleTitle}"

RESUME:
${resumeText}

Provide analysis in this JSON format:
{
  "atsScore": 75,
  "matchedSkills": ["skill1", "skill2"],
  "missingSkills": ["skill1", "skill2"],
  "experience": "Summary of experience",
  "strengths": ["strength1", "strength2"],
  "recommendations": ["recommendation1", "recommendation2"],
  "eligible": true
}

- atsScore: 0-100 score
- matchedSkills: Skills matching the role
- missingSkills: Important skills not found
- experience: Brief experience summary
- strengths: Key strengths for this role
- recommendations: Suggestions for improvement
- eligible: Boolean if candidate meets minimum requirements (score >= 60)

Return ONLY valid JSON.`;

    const result = await atsModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    const cleanedText = text.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();
    const analysis = JSON.parse(cleanedText);

    return { success: true, analysis };
  } catch (error) {
    console.error('Error analyzing resume:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to analyze resume.'
    );
  }
});

// ============= SEND ROUND 2 INVITATION EMAIL =============
export const sendRound2Invitation = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated and is admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated.'
    );
  }

  const { candidateEmail, candidateName, roleName, round1Score } = data;

  if (!candidateEmail || !roleName) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Candidate email and role name are required.'
    );
  }

  try {
    // Configure email transporter (you need to set up SMTP credentials)
    const transporter = nodemailer.createTransport({
      service: 'gmail', // or your preferred email service
      auth: {
        user: functions.config().email?.user || 'your-email@gmail.com',
        pass: functions.config().email?.password || 'your-app-password',
      },
    });

    const mailOptions = {
      from: `MockMate Recruitment <${functions.config().email?.user || 'noreply@mockmate.com'}>`,
      to: candidateEmail,
      subject: `🎉 Congratulations! You've been selected for Round 2 - ${roleName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
          <div style="background-color: #2563eb; padding: 20px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="color: white; margin: 0;">🎉 Congratulations!</h1>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1e293b;">Dear ${candidateName || 'Candidate'},</h2>
            
            <p style="font-size: 16px; line-height: 1.6; color: #334155;">
              We are pleased to inform you that you have successfully passed <strong>Round 1 (Aptitude Test)</strong> 
              for the <strong>${roleName}</strong> position!
            </p>
            
            <div style="background-color: #f0f9ff; padding: 20px; border-left: 4px solid #2563eb; margin: 20px 0;">
              <p style="margin: 0; font-size: 16px; color: #1e40af;">
                <strong>Your Round 1 Score:</strong> ${round1Score}%
              </p>
            </div>
            
            <p style="font-size: 16px; line-height: 1.6; color: #334155;">
              You have been selected to proceed to <strong>Round 2 - Mock Interview</strong>.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${functions.config().app?.url || 'https://your-app-url.com'}/history" 
                 style="background-color: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">
                Start Round 2 Interview
              </a>
            </div>
            
            <p style="font-size: 14px; line-height: 1.6; color: #64748b;">
              <strong>What to expect in Round 2:</strong><br>
              • Technical and behavioral interview questions<br>
              • Real-time AI evaluation of your responses<br>
              • Comprehensive feedback on your performance<br>
              • Duration: Approximately 20-30 minutes
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #334155; margin-top: 30px;">
              Please log in to your account and check the History page to begin Round 2.
            </p>
            
            <p style="font-size: 16px; line-height: 1.6; color: #334155;">
              Good luck with your interview!
            </p>
            
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
            
            <p style="font-size: 14px; color: #64748b; text-align: center;">
              Best regards,<br>
              <strong>The MockMate Team</strong>
            </p>
          </div>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Round 2 invitation sent to ${candidateEmail}`);

    return { success: true, message: 'Round 2 invitation sent successfully' };
  } catch (error) {
    console.error('Error sending Round 2 invitation:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send Round 2 invitation email.'
    );
  }
});

