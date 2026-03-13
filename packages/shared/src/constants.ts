// Mobile Money and bank providers available in Ghana
export const PROVIDERS = {
  momo: [
    { id: 'mtn', name: 'MTN MoMo', color: '#FFCC00' },
    { id: 'vodafone', name: 'Vodafone Cash', color: '#E60000' },
    { id: 'airteltigo', name: 'AirtelTigo Money', color: '#FF0000' },
  ],
  bank: [
    { id: 'gcb', name: 'GCB Bank', color: '#004C99' },
    { id: 'ecobank', name: 'Ecobank', color: '#003DA5' },
    { id: 'fidelity', name: 'Fidelity Bank', color: '#1B3C6E' },
    { id: 'stanbic', name: 'Stanbic Bank', color: '#0033A0' },
    { id: 'absa', name: 'Absa Bank', color: '#DC0032' },
    { id: 'calbank', name: 'CalBank', color: '#007A33' },
    { id: 'uba', name: 'UBA', color: '#D71920' },
    { id: 'zenith', name: 'Zenith Bank', color: '#E31837' },
  ],
} as const;

export const ACCOUNT_TYPES = ['momo', 'bank', 'cash', 'susu'] as const;

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tw', name: 'Twi' },
  { code: 'ee', name: 'Ewe' },
  { code: 'dag', name: 'Dagbani' },
] as const;
