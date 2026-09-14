export type SessionFilters = {
  category?: string;
  level?: string;
  startsAfter?: string;
  startsBefore?: string;
};

export type ClassSession = {
  id: string;
  classId: string;
  className: string;
  category: string;
  level: string;
  instructorName: string;
  startsAt: string;
  endsAt: string;
  capacity: number;
  confirmedCount: number;
  remainingSpots: number;
};

export type ClassSessionDetails = ClassSession & {
  description: string;
};
