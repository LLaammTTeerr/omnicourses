export interface CourseDescriptionSource {
  id: string;
  title: string;
  shortName: string;
  issuer: string;
  issued: string;
  language: 'en' | 'vi';
  sourceUrl: string | null;
  pdf: { file: string; sha256: string; pages: number };
  textLayer: { command: string; tool: string; sha256: string };
  notes: string[];
}

export interface CourseDescription {
  id: string;
  code: string;
  name_vi: string | null;
  name_en: string;
  credits: number;
  knowledge_block: string;
  prerequisites_printed: string | null;
  description: string;
  goals: string[];
  content: string[];
  pages: number[];
}

export interface CourseDescriptionDocument extends CourseDescriptionSource {
  courses: CourseDescription[];
}
