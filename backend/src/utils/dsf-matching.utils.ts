interface MatchingConfig {
  sheetNameWeight: number; // 30%
  libelleWeight: number; // 40%
  accountNumberWeight: number; // 20%
  positionWeight: number; // 10%
}

const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  sheetNameWeight: 0.3,
  libelleWeight: 0.4,
  accountNumberWeight: 0.2,
  positionWeight: 0.1,
};

// Fuzzy string matching using Levenshtein distance
function calculateStringSimilarity(str1: string, str2: string): number {
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Remove accents
      .replace(/[^a-z0-9]/g, " ")
      .trim();

  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 85;

  // Levenshtein distance
  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  const similarity = ((maxLen - distance) / maxLen) * 100;

  return similarity;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

// Account number pattern matching
function matchAccountPattern(
  accountNumber: string,
  patterns: string[]
): number {
  if (!accountNumber) return 0;

  const cleanAccount = accountNumber.replace(/[^0-9]/g, "");

  for (const pattern of patterns) {
    const cleanPattern = pattern.replace(/[^0-9x]/gi, "");

    // Exact match
    if (cleanAccount === cleanPattern) return 100;

    // Pattern match (e.g., "10x" matches "101", "102")
    if (cleanPattern.includes("x")) {
      const regex = new RegExp("^" + cleanPattern.replace(/x/gi, "\\d") + "$");
      if (regex.test(cleanAccount)) return 90;
    }

    // Starts with
    if (cleanAccount.startsWith(cleanPattern)) return 75;
  }

  return 0;
}

// Main matching function
function calculateMatchScore(
  entry: {
    sheetName: string;
    libelle: string;
    accountNumber?: string;
    rowNumber: number;
  },
  template: {
    sheetNamePatterns: string[];
    libellePatterns: string[];
    accountPatterns: string[];
    expectedRow?: number;
  },
  config: MatchingConfig = DEFAULT_MATCHING_CONFIG
): number {
  let score = 0;

  // 1. Sheet name matching
  const sheetScores = template.sheetNamePatterns.map((pattern) =>
    calculateStringSimilarity(entry.sheetName, pattern)
  );
  const bestSheetScore = Math.max(...sheetScores, 0);
  score += bestSheetScore * config.sheetNameWeight;

  // 2. Libellé matching
  const libelleScores = template.libellePatterns.map((pattern) =>
    calculateStringSimilarity(entry.libelle, pattern)
  );
  const bestLibelleScore = Math.max(...libelleScores, 0);
  score += bestLibelleScore * config.libelleWeight;

  // 3. Account number matching
  if (entry.accountNumber && template.accountPatterns.length > 0) {
    const accountScore = matchAccountPattern(
      entry.accountNumber,
      template.accountPatterns
    );
    score += accountScore * config.accountNumberWeight;
  } else {
    // If no account number, redistribute weight to libellé
    score += bestLibelleScore * config.accountNumberWeight;
  }

  // 4. Position matching (if expected row provided)
  if (template.expectedRow) {
    const rowDiff = Math.abs(entry.rowNumber - template.expectedRow);
    const positionScore = Math.max(0, 100 - rowDiff * 10); // Lose 10 points per row difference
    score += positionScore * config.positionWeight;
  } else {
    // Redistribute position weight
    score += bestLibelleScore * config.positionWeight;
  }

  return Math.min(score, 100);
}

export {
  MatchingConfig,
  DEFAULT_MATCHING_CONFIG,
  calculateStringSimilarity,
  levenshteinDistance,
  matchAccountPattern,
  calculateMatchScore,
};
