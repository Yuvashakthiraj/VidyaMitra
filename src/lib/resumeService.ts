/**
 * Resume Service - Handles resume storage in S3 and database.
 */

import { resumesApi, apiFetch } from './api';
import { ParsedResume } from '@/utils/resumeParser';

/**
 * Uploads a resume file to S3 bucket (resumes/ folder) via presigned URL.
 * Returns the S3 object key on success, or null on failure.
 */
export const uploadResumeToS3 = async (file: File): Promise<string | null> => {
  try {
    // Step 1: Get a presigned upload URL from the server
    const { uploadUrl, key } = await apiFetch('/api/s3/upload-url', {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        contentType: file.type || 'application/pdf',
        folder: 'resumes',
      }),
    });

    // Step 2: PUT the file directly to S3 using the presigned URL (no auth headers)
    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type || 'application/pdf' },
    });

    if (!uploadRes.ok) {
      throw new Error(`S3 upload failed: ${uploadRes.status} ${uploadRes.statusText}`);
    }

    return key as string;
  } catch (err) {
    console.error('uploadResumeToS3 error:', err);
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
