/** Theater groupings — maps named theaters to ISO alpha-2 country codes */
export const THEATERS: Record<string, { label: string; countries: string[] }> = {
  levant:       { label: "Levant",             countries: ["LB", "SY", "JO", "PS", "CY"] },
  israel:       { label: "Israel",             countries: ["IL"] },
  gulf:         { label: "Gulf States",        countries: ["AE", "BH", "KW", "OM", "QA", "SA"] },
  iran_axis:    { label: "Iran & Allies",      countries: ["IR", "IQ", "YE"] },
  north_africa: { label: "North Africa",       countries: ["EG", "LY", "TN", "DZ", "SD"] },
  turkey:       { label: "Turkey & Caucasus",  countries: ["TR", "AZ"] },
  intl:         { label: "International",      countries: ["US", "GB", "FR", "DE", "RU", "CN", "IN", "NO", "CA", "AU", "UA", "PK", "AF", "CH", "AT", "LK", "KR", "ES", "CU", "VA", "JP", "TH", "IT", "GR", "BE", "NL", "ZA", "SG", "PL", "BR", "DJ"] },
};

/** Reverse lookup: country code → theater key */
export const COUNTRY_TO_THEATER: Record<string, string> = {};
for (const [key, { countries }] of Object.entries(THEATERS)) {
  for (const c of countries) {
    COUNTRY_TO_THEATER[c] = key;
  }
}

/** Get the set of country codes for the given theater keys */
export function theaterCountries(theaterKeys: Iterable<string>): Set<string> {
  const result = new Set<string>();
  for (const key of theaterKeys) {
    const theater = THEATERS[key];
    if (theater) {
      for (const c of theater.countries) result.add(c);
    }
  }
  return result;
}
