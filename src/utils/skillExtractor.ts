import OpenAI from 'openai';
import { env } from '../config/env';
import { logger } from './logger';

export type DocumentType = 'job_description' | 'resume';

export type SkillImportance = 'must_have' | 'nice_to_have' | 'unspecified';

export type ResumeSkillImportance = null | 'present';

export type SkillCategory = 'hard' | 'soft' | 'tool' | 'technique' | 'domain' | 'other';

export interface ExtractedSkill {
  name: string;
  normalizedName: string;
  category: SkillCategory;
  importance: SkillImportance | ResumeSkillImportance;
  evidenceSnippets: string[];
  source: DocumentType;
}

export interface SkillMatchSummary {
  matchScore: number;
  strengths: string[];
  gaps: string[];
  extraSkills: string[];
  jdSkills: ExtractedSkill[];
  resumeSkills: ExtractedSkill[];
}

interface SkillExtractionModelSkill {
  name: string;
  normalized_name?: string;
  category?: string;
  importance?: SkillImportance | ResumeSkillImportance;
  evidence_snippets?: string[];
}

interface SkillExtractionModelResponse {
  document_type: DocumentType;
  skills: SkillExtractionModelSkill[];
}

const MODEL_NAME = 'gpt-3.5-turbo';
const MAX_DOCUMENT_CHARS = 9000;
const MIN_TEXT_LENGTH = 80;
const MAX_SKILL_RESULTS = 30;
const MAX_MODEL_RETRIES = 1;

const SYSTEM_PROMPT = `You are an Applicant Tracking System (ATS) focused on extracting skills from talent documents.
- You receive either a job description or a resume and must analyse it carefully.
- Identify concrete skills, tools, technologies, methodologies, domains, or soft skills that materially affect the job.
- Ignore personal traits, company names, locations, dates, compensation, or education details unless explicitly tied to a skill.
- When analysing job descriptions infer whether a skill is must-have, nice-to-have, or unspecified based on language like "required", "preferred", "nice to have", "strongly desired", etc.
- When analysing resumes simply mark each skill as present (importance null) and cite short evidence snippets from the resume.
- Return STRICT JSON using the schema shared in the user prompt.
- Be concise and avoid inventing skills that are not clearly supported by the document.`;

function buildUserPrompt(documentType: DocumentType, text: string, attempt: number): string {
  const retryNotice = attempt > 0
    ? `IMPORTANT: Your previous response was invalid JSON. This time you MUST respond with valid JSON only, no commentary. Keep the response concise.`
    : '';

  return `${retryNotice ? retryNotice + '\n\n' : ''}Document type: ${documentType}

Read the document text and output ONLY valid JSON with the following schema:
{
  "document_type": "job_description" | "resume",
  "skills": [
    {
      "name": string,                         // human readable skill as mentioned
      "normalized_name": string,              // lowercase + simplified slug for matching
      "category": "hard" | "soft" | "tool" | "technique" | "domain" | "other",
      "importance": "must_have" | "nice_to_have" | "unspecified" | null,
      "evidence_snippets": string[]          // 1-3 concise snippets from text referencing the skill
    }
  ]
}
Rules:
- The skills list must be empty if no skills are clearly present.
- Do not repeat the same skill with different casing; normalize appropriately.
- For resumes set importance to null for every skill.
- Evidence snippets should be short phrases or bullet excerpts, not full paragraphs.
- Return at most ${MAX_SKILL_RESULTS} skills.
- Keep the entire JSON under 1200 tokens.

Document text:
"""
${text}
"""`;
}

const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

function truncateForPrompt(text: string): string {
  if (text.length <= MAX_DOCUMENT_CHARS) {
    return text;
  }
  return text.slice(0, MAX_DOCUMENT_CHARS);
}

function normalizeSkillName(rawName: string): string {
  return rawName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9+.#/&()\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s([#&+])/g, '$1')
    .trim();
}

function coerceCategory(category?: string): SkillCategory {
  const normalized = (category || '').toLowerCase();
  switch (normalized) {
    case 'hard':
    case 'soft':
    case 'tool':
    case 'technique':
    case 'domain':
      return normalized as SkillCategory;
    default:
      return 'other';
  }
}

function coerceImportance(
  documentType: DocumentType,
  importance?: SkillImportance | ResumeSkillImportance
): SkillImportance | ResumeSkillImportance {
  if (documentType === 'resume') {
    return null;
  }
  if (importance === 'must_have' || importance === 'nice_to_have' || importance === 'unspecified') {
    return importance;
  }
  return 'unspecified';
}

function sanitizeEvidence(snippets?: string[]): string[] {
  if (!snippets || snippets.length === 0) {
    return [];
  }
  return snippets
    .map(snippet => snippet.trim())
    .filter(snippet => snippet.length > 0)
    .map(snippet => snippet.slice(0, 280));
}

async function callSkillExtractionModel(
  documentType: DocumentType,
  text: string,
  attempt: number = 0
): Promise<SkillExtractionModelResponse> {
  const trimmed = text.trim();
  if (trimmed.length < MIN_TEXT_LENGTH) {
    return { document_type: documentType, skills: [] };
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: SYSTEM_PROMPT
    },
    {
      role: 'user',
      content: buildUserPrompt(documentType, truncateForPrompt(trimmed), attempt)
    }
  ];

  const completion = await openai.chat.completions.create({
    model: MODEL_NAME,
    messages,
    temperature: 0,
    max_tokens: 1200
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Skill extraction model returned empty response');
  }

  try {
    const parsed = JSON.parse(content);
    return parsed as SkillExtractionModelResponse;
  } catch (error) {
    logger.error('Failed to parse skill extraction response', { error, content, attempt });
    if (attempt < MAX_MODEL_RETRIES) {
      return callSkillExtractionModel(documentType, text, attempt + 1);
    }
    throw new Error('Unable to parse skill extraction response');
  }
}

function mapToExtractedSkills(
  response: SkillExtractionModelResponse
): ExtractedSkill[] {
  const { document_type: documentType, skills } = response;
  const uniqueSkills = new Map<string, ExtractedSkill>();

  for (const skill of skills || []) {
    const name = (skill.name || '').trim();
    if (!name) {
      continue;
    }

    const normalized = normalizeSkillName(skill.normalized_name || name);
    if (!normalized) {
      continue;
    }

    if (uniqueSkills.has(normalized)) {
      continue;
    }

    uniqueSkills.set(normalized, {
      name,
      normalizedName: normalized,
      category: coerceCategory(skill.category),
      importance: coerceImportance(documentType, skill.importance),
      evidenceSnippets: sanitizeEvidence(skill.evidence_snippets),
      source: documentType
    });
  }

  return Array.from(uniqueSkills.values());
}

export async function extractSkillsFromJobDescription(jdText: string): Promise<ExtractedSkill[]> {
  const response = await callSkillExtractionModel('job_description', jdText || '');
  return mapToExtractedSkills(response);
}

export async function extractSkillsFromResume(resumeText: string): Promise<ExtractedSkill[]> {
  const response = await callSkillExtractionModel('resume', resumeText || '');
  return mapToExtractedSkills(response);
}

const JD_SKILL_WEIGHTS: Record<SkillImportance, number> = {
  must_have: 2,
  nice_to_have: 1,
  unspecified: 1
};

export function calculateSkillMatch(
  jdSkills: ExtractedSkill[],
  resumeSkills: ExtractedSkill[]
): SkillMatchSummary {
  const jdSkillMap = new Map<string, ExtractedSkill>();
  for (const skill of jdSkills) {
    const normalized = skill.normalizedName || normalizeSkillName(skill.name);
    if (!normalized || jdSkillMap.has(normalized)) {
      continue;
    }
    jdSkillMap.set(normalized, { ...skill, normalizedName: normalized });
  }

  const resumeSkillMap = new Map<string, ExtractedSkill>();
  for (const skill of resumeSkills) {
    const normalized = skill.normalizedName || normalizeSkillName(skill.name);
    if (!normalized || resumeSkillMap.has(normalized)) {
      continue;
    }
    resumeSkillMap.set(normalized, { ...skill, normalizedName: normalized });
  }

  let totalWeight = 0;
  let matchedWeight = 0;
  const strengths: string[] = [];
  const gaps: string[] = [];
  const matchedNormalized = new Set<string>();

  for (const [normalized, skill] of jdSkillMap.entries()) {
    const importance = (skill.importance as SkillImportance) || 'unspecified';
    const weight = JD_SKILL_WEIGHTS[importance] ?? JD_SKILL_WEIGHTS.unspecified;
    totalWeight += weight;

    if (resumeSkillMap.has(normalized)) {
      matchedWeight += weight;
      if (!matchedNormalized.has(normalized)) {
        strengths.push(skill.name);
        matchedNormalized.add(normalized);
      }
    } else {
      gaps.push(skill.name);
    }
  }

  const extraSkills: string[] = [];
  for (const [normalized, resumeSkill] of resumeSkillMap.entries()) {
    if (!jdSkillMap.has(normalized)) {
      extraSkills.push(resumeSkill.name);
    }
  }

  const matchScore = totalWeight === 0
    ? 0
    : Math.round((matchedWeight / totalWeight) * 100);

  return {
    matchScore,
    strengths,
    gaps,
    extraSkills,
    jdSkills: Array.from(jdSkillMap.values()),
    resumeSkills: Array.from(resumeSkillMap.values())
  };
}

export async function analyzeSkillsMatch(
  jdText: string,
  resumeText: string
): Promise<SkillMatchSummary> {
  const [jdSkills, resumeSkills] = await Promise.all([
    extractSkillsFromJobDescription(jdText),
    extractSkillsFromResume(resumeText)
  ]);

  return calculateSkillMatch(jdSkills, resumeSkills);
}
