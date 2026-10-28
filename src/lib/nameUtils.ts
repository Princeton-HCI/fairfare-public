// Helper Method to Return Last Name

export function getLastInitialsFromLastName(lastName: string): string {
  if (!lastName) return '';

  return lastName
    .replace(/[^A-Za-z\s-]/g, '') // remove non-letter chars
    .split(/[\s-]+/)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .substring(0, 3);
}

export const formatDriverNameForDownload = (driverName: string): string => {
  return driverName
    .trim()
    .replace(/\s+/g, '_') // replace spaces with _
    .replace(/[^a-zA-Z0-9_-]/g, '') // remove special characters
    .toLowerCase();
};
