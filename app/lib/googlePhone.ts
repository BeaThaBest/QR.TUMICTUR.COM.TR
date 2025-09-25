export type PhoneUtil = {
  parse: (input: string, region: string) => any;
  isValidNumber: (num: any) => boolean;
  format: (num: any, fmt: any) => string;
  getExampleNumber: (region: string) => any | undefined;
};

let instancePromise: Promise<any> | null = null;

export async function getPhoneUtil(): Promise<PhoneUtil> {
  if (!instancePromise) {
    instancePromise = import('google-libphonenumber').then(m => m.PhoneNumberUtil.getInstance());
  }
  return instancePromise as Promise<any>;
}

export async function getExample(region: string): Promise<string | null> {
  try {
    const util = await getPhoneUtil();
    const ex = util.getExampleNumber(region);
    if (!ex) return null;
    const PNF = (await import('google-libphonenumber')).PhoneNumberFormat;
    return util.format(ex, PNF.NATIONAL) as string;
  } catch {
    return null;
  }
}

