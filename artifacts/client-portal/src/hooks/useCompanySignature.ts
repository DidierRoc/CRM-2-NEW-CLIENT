import { useState, useEffect } from 'react';
import { callCrmApi } from '@/lib/crmApi';

const normalizeBrandingText = (value: unknown) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const containsLegacyContractBranding = (...values: unknown[]) => {
  const normalized = normalizeBrandingText(values.join(' '));
  return (
    normalized.includes('jupiter asset management') ||
    normalized.includes('70 victoria street') ||
    normalized.includes('contrat societe') ||
    normalized.includes('document genere electroniquement') ||
    normalized.includes('valeur contractuelle apres signature')
  );
};

export interface CompanyBranding {
  companySignatureUrl: string | null;
  companyStampUrl: string | null;
  contractLogoUrl: string | null;
  logoUrl: string | null;
  companyName: string;
  companyAddress: string;
  companyPostalCode: string;
  companyCity: string;
  companyPhone: string;
  companyEmail: string;
  companySiret: string;
  companyCountry: string;
  primaryColor: string;
  accentColor: string;
}

export function useCompanySignature() {
  const [companySignatureUrl, setCompanySignatureUrl] = useState<string | null>(null);
  const [companyStampUrl, setCompanyStampUrl] = useState<string | null>(null);
  const [branding, setBranding] = useState<CompanyBranding>({
    companySignatureUrl: null,
    companyStampUrl: null,
    contractLogoUrl: null,
    logoUrl: null,
    companyName: '',
    companyAddress: '',
    companyPostalCode: '',
    companyCity: '',
    companyPhone: '',
    companyEmail: '',
    companySiret: '',
    companyCountry: 'France',
    primaryColor: '',
    accentColor: '',
  });

  useEffect(() => {
    callCrmApi('public-branding')
      .then((data: any) => {
        if (data) {
          const legacyBranding = containsLegacyContractBranding(
            data.company_name,
            data.company_address,
            data.company_city,
            data.company_country,
            data.company_email,
          );

          if (legacyBranding) {
            console.warn('Ancien branding contrat bloqué côté client', {
              companyName: data.company_name,
              companyAddress: data.company_address,
            });
          }

          setCompanySignatureUrl(legacyBranding ? null : data.company_signature_url || null);
          setCompanyStampUrl(legacyBranding ? null : data.company_stamp_url || null);
          setBranding({
            companySignatureUrl: legacyBranding ? null : data.company_signature_url || null,
            companyStampUrl: legacyBranding ? null : data.company_stamp_url || null,
            contractLogoUrl: legacyBranding ? null : data.contract_logo_url || null,
            logoUrl: legacyBranding ? null : data.logo_url || null,
            companyName: legacyBranding ? '' : data.company_name || '',
            companyAddress: legacyBranding ? '' : data.company_address || '',
            companyPostalCode: legacyBranding ? '' : data.company_postal_code || '',
            companyCity: legacyBranding ? '' : data.company_city || '',
            companyPhone: legacyBranding ? '' : data.company_phone || '',
            companyEmail: legacyBranding ? '' : data.company_email || '',
            companySiret: legacyBranding ? '' : data.company_siret || '',
            companyCountry: legacyBranding ? '' : data.company_country || 'France',
            primaryColor: data.primary_color || '',
            accentColor: data.accent_color || '',
          });
        }
      })
      .catch(() => {});
  }, []);

  return { companySignatureUrl, companyStampUrl, branding };
}
