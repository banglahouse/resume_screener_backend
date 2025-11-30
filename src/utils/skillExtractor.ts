const SKILL_DICTIONARY = [
  // Programming Languages
  'javascript', 'typescript', 'python', 'java', 'c#', 'c++', 'c', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala',
  
  // Web Technologies
  'react', 'vue', 'angular', 'node.js', 'nodejs', 'express', 'next.js', 'nuxt.js', 'svelte', 'html', 'css', 'sass', 'less',
  
  // Databases
  'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'elasticsearch', 'sqlite', 'dynamodb', 'cassandra', 'neo4j',
  
  // Cloud & DevOps
  'aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'jenkins', 'gitlab', 'github actions', 'circleci',
  
  // Frameworks & Libraries
  'spring', 'django', 'flask', 'laravel', 'rails', 'asp.net', '.net', 'jquery', 'bootstrap', 'tailwind',
  
  // Tools & Technologies
  'git', 'linux', 'nginx', 'apache', 'microservices', 'api', 'rest', 'graphql', 'websockets', 'oauth', 'jwt',
  
  // Data & Analytics
  'machine learning', 'ml', 'ai', 'data science', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'spark', 'hadoop',
  
  // Testing
  'jest', 'cypress', 'selenium', 'unit testing', 'integration testing', 'tdd', 'bdd',
  
  // Project Management
  'agile', 'scrum', 'kanban', 'jira', 'confluence', 'project management'
];

export function extractSkillsFromText(text: string): string[] {
  const lowerText = text.toLowerCase();
  const foundSkills = new Set<string>();

  for (const skill of SKILL_DICTIONARY) {
    // Use word boundaries for better matching
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    if (regex.test(lowerText)) {
      foundSkills.add(skill);
    }
  }

  // Also look for years of experience patterns
  const experiencePatterns = [
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi,
    /(\d+)\+?\s*years?\s+(?:in|with)/gi,
    /experience\s+(?:of\s+)?(\d+)\+?\s*years?/gi
  ];

  for (const pattern of experiencePatterns) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      const years = parseInt(match[1]);
      if (years >= 5) {
        foundSkills.add('senior level');
      } else if (years >= 2) {
        foundSkills.add('mid level');
      } else {
        foundSkills.add('junior level');
      }
    }
  }

  return Array.from(foundSkills);
}