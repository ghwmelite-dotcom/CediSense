import type { SMSPatternDef } from './types';
import { mtnMomoPatterns } from './providers/mtn-momo';
import { vodafoneCashPatterns } from './providers/vodafone-cash';
import { airteltigoPatterns } from './providers/airteltigo';
import { gcbPatterns } from './providers/gcb';
import { ecobankPatterns } from './providers/ecobank';
import { fidelityPatterns } from './providers/fidelity';
import { stanbicPatterns } from './providers/stanbic';
import { absaPatterns } from './providers/absa';
import { calbankPatterns } from './providers/calbank';
import { ubaPatterns } from './providers/uba';
import { zenithPatterns } from './providers/zenith';

export const ALL_PATTERNS: SMSPatternDef[] = [
  ...mtnMomoPatterns,
  ...vodafoneCashPatterns,
  ...airteltigoPatterns,
  ...gcbPatterns,
  ...ecobankPatterns,
  ...fidelityPatterns,
  ...stanbicPatterns,
  ...absaPatterns,
  ...calbankPatterns,
  ...ubaPatterns,
  ...zenithPatterns,
];
