/**
 * Resume Service - Replaces Firebase-based resume storage
 */

import { resumesApi, s3Api } from './api';
import { ParsedResume } from '@/utils/resumeParser';

/**
 * Upload the actual PDF file to S3 for permanent storage.
 * Returns the S3 key if successful, null otherwise.
 */
export const uploadResumeToS3 = async (file: File): Promise<string | null> => {
  try {
    const result = await s3Api.uploadFile(file, 'resumes');
    console.log('☁️ Resume uploaded to S3:', result.key);
    return result.key;
  } catch (error) {
    console.error('❌ Failed to upload resume to S3:', error);
    return null;
  }
};

export const saveResumeToFirestore = async (
  userId: string,
  resume: ParsedResume
): Promise<{ success: boolean; resumeId: string }> => {
  try {
    const data = await resumesApi.save({
      fileName: resume.fileName,
      rawText: resume.rawText,
      parsedData: resume.extractedData,
      atsScore: 0,
      targetRole: '',
    });
    return { success: true, resumeId: data.id || '' };
  } catch (error) {
    console.error('Error saving resume:', error);
    return { success: false, resumeId: '' };
  }
};

export const getUserResumes = async (userId: string): Promise<ParsedResume[]> => {
  try {
    const data = await resumesApi.getAll();
    return (data.resumes || []).map((r: any) => ({
      fileName: r.file_name || r.fileName,
      rawText: r.raw_text || r.rawText || '',
      extractedData: typeof r.parsed_data === 'string' ? JSON.parse(r.parsed_data) : (r.parsed_data || r.parsedData || {}),
    }));
  } catch {
    return [];
  }
};

export const processResumeForInterview = async (
  file: File,
  userId: string
): Promise<{ success: boolean; resume?: ParsedResume; error?: string }> => {
  try {
    const { parseResumeFile } = await import('@/utils/resumeParser');
    const parsedResume = await parseResumeFile(file);

    const { success } = await saveResumeToFirestore(userId, parsedResume);
    if (!success) {
      return { success: false, error: 'Failed to save resume to database' };
    }
    return { success: true, resume: parsedResume };
  } catch (error) {
    console.error('Error processing resume:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process resume',
    };
  }
};
