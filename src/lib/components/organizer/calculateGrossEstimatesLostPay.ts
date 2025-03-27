export const calculateGrossEstimatedLostPay = (
  averageDailyPay: number,
  deactivationPeriodDuration: number
) => {
  const roundedAverageDailyPay = Math.round(averageDailyPay * 100) / 100;
  return roundedAverageDailyPay * deactivationPeriodDuration;
};

export const calculateGrossEstimatedLostPayWithInterest = (
  averageDailyPay: number,
  deactivationPeriodDuration: number,
  annualInterestRate: number
) => {
  const roundedAverageDailyPay = Math.round(averageDailyPay * 100) / 100;

  const earnedInterest =
    (((deactivationPeriodDuration / 365) * annualInterestRate) / 100) *
    roundedAverageDailyPay *
    deactivationPeriodDuration;

  return roundedAverageDailyPay * deactivationPeriodDuration + earnedInterest;
};
