export type Member = {
  id: string;
  name: string;
  shopId: number;
  boyId: number | null;
  color: string;
  enabled: boolean;
};

export type ShiftEntry = {
  date: string; // YYYY-MM-DD
  start: string | null;
  end: string | null;
  night: boolean;
  isOff: boolean;
  label: string;
};

export type MemberShifts = {
  member: Member;
  scrapedName: string | null;
  shopLabel: string | null;
  sourceUrl: string;
  shifts: ShiftEntry[];
  error?: string;
};

export type ShiftsResponse = {
  fetchedAt: string;
  cached: boolean;
  members: MemberShifts[];
};
