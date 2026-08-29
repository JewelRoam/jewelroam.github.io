export type JournalDateParts = {
  year: string;
  month: string;
  period: string;
};

function getJournalPeriodKey(createdAt: string) {
  return createdAt.slice(0, 7);
}

export function getJournalDateParts(createdAt: string): JournalDateParts {
  return {
    year: createdAt.slice(0, 4),
    month: createdAt.slice(5, 7),
    period: getJournalPeriodKey(createdAt),
  };
}

export function isSameJournalPeriod(currentCreatedAt: string, previousCreatedAt?: string) {
  return previousCreatedAt
    ? getJournalPeriodKey(currentCreatedAt) === getJournalPeriodKey(previousCreatedAt)
    : false;
}
