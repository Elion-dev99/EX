export type Member = {
  id: string;
  name: string;
  shopId: number;
  boyId: number | null;
  color: string;
  enabled: boolean;
};

export type ShiftStatus = "work" | "off" | "inquiry" | "other";

export type ShiftEntry = {
  date: string; // YYYY-MM-DD
  start: string | null;
  end: string | null;
  night: boolean | null;
  isOff: boolean;
  status: ShiftStatus;
  statusText: string | null;
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

export type ShopBoy = {
  boyId: number;
  name: string;
  shopId: number;
  color: string;
  sourceUrl: string;
};

export type ShopRosterResponse = {
  fetchedAt: string;
  cached: boolean;
  shopId: number;
  boys: ShopBoy[];
};
