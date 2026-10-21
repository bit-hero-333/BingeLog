// ISO 3166-1 alpha-2 country codes to friendly names

export const COUNTRY_NAMES: Record<string, string> = {
  US: 'United States',
  GB: 'United Kingdom',
  JP: 'Japan',
  KR: 'South Korea',
  DE: 'Germany',
  FR: 'France',
  CA: 'Canada',
  AU: 'Australia',
  IT: 'Italy',
  ES: 'Spain',
  BR: 'Brazil',
  MX: 'Mexico',
  IN: 'India',
  NL: 'Netherlands',
  SE: 'Sweden',
  CN: 'China',
  TW: 'Taiwan',
  HK: 'Hong Kong',
  TH: 'Thailand',
  TR: 'Turkey',
  NO: 'Norway',
  DK: 'Denmark',
  FI: 'Finland',
  PL: 'Poland',
  NZ: 'New Zealand',
  IE: 'Ireland',
  RU: 'Russia',
  PH: 'Philippines',
  ID: 'Indonesia',
  MY: 'Malaysia',
  SG: 'Singapore',
  VN: 'Vietnam',
  CO: 'Colombia',
  AR: 'Argentina',
  CL: 'Chile',
  PE: 'Peru',
  BE: 'Belgium',
  AT: 'Austria',
  CH: 'Switzerland',
  PT: 'Portugal',
  CZ: 'Czech Republic',
  IL: 'Israel',
  ZA: 'South Africa',
  GR: 'Greece',
  HU: 'Hungary',
  RO: 'Romania',
  IS: 'Iceland',
  UA: 'Ukraine',
  EG: 'Egypt',
  NG: 'Nigeria',
};

/**
 * Returns the full friendly name of a country given its 2-letter ISO code.
 * Falls back to the uppercase code if unknown.
 */
export function getCountryName(code?: string | null): string {
  if (!code) return '';
  const upper = code.trim().toUpperCase();
  return COUNTRY_NAMES[upper] || upper;
}

/**
 * Returns a high-speed CDN URL for a country's flag image.
 */
export function getCountryFlagUrl(code?: string | null): string | null {
  if (!code || code.trim().length === 0) return null;
  const lower = code.trim().toLowerCase();
  return `https://flagcdn.com/w40/${lower}.png`;
}
