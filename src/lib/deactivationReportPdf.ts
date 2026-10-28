import { jsPDF } from 'jspdf';
import moment from 'moment';
import { type PeriodMetrics } from './onlineTimeEstimation';

/**
 * Draw time series chart directly using jsPDF drawing functions (no dependencies)
 */
function drawTimeSeriesChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  beforeMetrics: PeriodMetrics,
  deactivationMetrics: PeriodMetrics,
  afterMetrics: PeriodMetrics
): void {
  // jsPDF uses inches when unit: 'in', so work in inches
  // Convert padding from points to inches (1 inch = 72 points)
  const padding = { top: 40 / 72, right: 30 / 72, bottom: 50 / 72, left: 50 / 72 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Collect all weekly data
  const allWeeks: Array<{ date: Date; hours: number; period: string }> = [];

  if (beforeMetrics.weeklyData) {
    beforeMetrics.weeklyData.forEach((week) => {
      if (week.weekStart) {
        allWeeks.push({
          date: moment(week.weekStart).toDate(),
          hours: week.totalOnlineHours || 0,
          period: 'Before'
        });
      }
    });
  }
  if (deactivationMetrics.weeklyData) {
    deactivationMetrics.weeklyData.forEach((week) => {
      if (week.weekStart) {
        allWeeks.push({
          date: moment(week.weekStart).toDate(),
          hours: week.totalOnlineHours || 0,
          period: 'Deactivation'
        });
      }
    });
  }
  if (afterMetrics.weeklyData) {
    afterMetrics.weeklyData.forEach((week) => {
      if (week.weekStart) {
        allWeeks.push({
          date: moment(week.weekStart).toDate(),
          hours: week.totalOnlineHours || 0,
          period: 'After'
        });
      }
    });
  }

  if (allWeeks.length === 0) {
    // Draw placeholder if no data
    doc.setFontSize(10);
    doc.setTextColor(128, 128, 128);
    doc.text('No weekly data available for chart', x + width / 2, y + height / 2, {
      align: 'center'
    });
    return;
  }

  allWeeks.sort((a, b) => a.date.getTime() - b.date.getTime());

  const minDate = new Date(Math.min(...allWeeks.map((w) => w.date.getTime())));
  const maxDate = new Date(Math.max(...allWeeks.map((w) => w.date.getTime())));
  const dateRange = Math.max(maxDate.getTime() - minDate.getTime(), 1);
  const maxHours = Math.max(...allWeeks.map((w) => w.hours), 1);

  const dateToX = (date: Date) =>
    x + padding.left + ((date.getTime() - minDate.getTime()) / dateRange) * innerWidth;
  const hoursToY = (hours: number) =>
    y + padding.top + innerHeight - (hours / maxHours) * innerHeight;

  // Draw grid lines
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.005); // Thin line in inches
  for (let i = 0; i <= 5; i++) {
    const yPos = y + padding.top + (innerHeight / 5) * i;
    doc.line(x + padding.left, yPos, x + padding.left + innerWidth, yPos);
    const hours = maxHours - (maxHours / 5) * i;
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text(Math.round(hours).toString(), x + padding.left - 0.07, yPos + 0.04, {
      align: 'right'
    });
  }

  // Draw lines and points
  const drawPeriod = (data: typeof allWeeks, color: number[]) => {
    if (data.length === 0) return;
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.02); // Line width in inches

    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      const px = dateToX(point.date);
      const py = hoursToY(point.hours);

      // Draw point (radius in inches)
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(px, py, 0.04, 'F');

      // Draw line to next point
      if (i < data.length - 1) {
        const nextPoint = data[i + 1];
        const nextX = dateToX(nextPoint.date);
        const nextY = hoursToY(nextPoint.hours);
        doc.line(px, py, nextX, nextY);
      }
    }
  };

  const beforeData = allWeeks.filter((w) => w.period === 'Before');
  const deactivationData = allWeeks.filter((w) => w.period === 'Deactivation');
  const afterData = allWeeks.filter((w) => w.period === 'After');

  drawPeriod(beforeData, [46, 204, 113]); // #2ecc71
  drawPeriod(deactivationData, [231, 76, 60]); // #e74c3c
  drawPeriod(afterData, [52, 152, 219]); // #3498db

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text('Weekly Online Hours Over Time', x + width / 2, y + 0.28, { align: 'center' });

  // Y-axis label
  doc.setFontSize(10);
  doc.text('Estimated Online Hours', x + 0.21, y + height / 2, { align: 'center', angle: 90 });

  // Legend
  const legendY = y + 0.42;
  const legends = [
    { color: [46, 204, 113], label: 'Before Deactivation' },
    { color: [231, 76, 60], label: 'Deactivation Period' },
    { color: [52, 152, 219], label: 'After Deactivation' }
  ];
  legends.forEach((item, index) => {
    const legendX = x + width - 2.5 + index * 1.67;
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.circle(legendX, legendY, 0.028, 'F');
    doc.setFontSize(8);
    doc.setTextColor(26, 26, 26);
    doc.text(item.label, legendX + 0.11, legendY + 0.028);
  });

  // X-axis labels (sample a few dates)
  doc.setFontSize(7);
  doc.setTextColor(102, 102, 102);
  const numLabels = Math.min(6, allWeeks.length);
  for (let i = 0; i < numLabels; i++) {
    const index = Math.floor((allWeeks.length - 1) * (i / (numLabels - 1)));
    const week = allWeeks[index];
    const labelX = dateToX(week.date);
    doc.text(moment(week.date).format('MMM D'), labelX, y + height - padding.bottom + 0.21, {
      align: 'center',
      angle: -45
    });
  }
}

/**
 * Draw hourly pay distribution chart directly using jsPDF drawing functions (no dependencies)
 */
function drawHourlyPayChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  beforeMetrics: PeriodMetrics,
  deactivationMetrics: PeriodMetrics,
  afterMetrics: PeriodMetrics
): void {
  // jsPDF uses inches when unit: 'in', so work in inches
  // Convert padding from points to inches (1 inch = 72 points)
  const padding = { top: 40 / 72, right: 30 / 72, bottom: 50 / 72, left: 50 / 72 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;

  // Collect hourly pay rates
  const beforeRates = (beforeMetrics.weeklyData || [])
    .map((w) => w.avgHourlyPay)
    .filter((r) => r > 0);
  const deactivationRates = (deactivationMetrics.weeklyData || [])
    .map((w) => w.avgHourlyPay)
    .filter((r) => r > 0);
  const afterRates = (afterMetrics.weeklyData || [])
    .map((w) => w.avgHourlyPay)
    .filter((r) => r > 0);

  const calculateStats = (values: number[]) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    return {
      min: sorted[0],
      q1: sorted[Math.floor(sorted.length * 0.25)],
      median: sorted[Math.floor(sorted.length * 0.5)],
      q3: sorted[Math.floor(sorted.length * 0.75)],
      max: sorted[sorted.length - 1]
    };
  };

  const beforeStats = calculateStats(beforeRates);
  const deactivationStats = calculateStats(deactivationRates);
  const afterStats = calculateStats(afterRates);

  const allValues = [
    ...(beforeStats ? [beforeStats.max] : []),
    ...(deactivationStats ? [deactivationStats.max] : []),
    ...(afterStats ? [afterStats.max] : [])
  ];
  const maxValue = Math.max(...allValues, 50);

  const valueToY = (value: number) =>
    y + padding.top + innerHeight - (value / maxValue) * innerHeight;

  // Draw grid
  doc.setDrawColor(224, 224, 224);
  doc.setLineWidth(0.005); // Thin line in inches
  for (let i = 0; i <= 5; i++) {
    const yPos = y + padding.top + (innerHeight / 5) * i;
    doc.line(x + padding.left, yPos, x + padding.left + innerWidth, yPos);
    const value = maxValue - (maxValue / 5) * i;
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text(`$${Math.round(value)}`, x + padding.left - 0.07, yPos + 0.04, { align: 'right' });
  }

  // Draw box plots
  const periods = [
    {
      stats: beforeStats,
      color: [46, 204, 113],
      label: 'Before Deactivation',
      x: x + padding.left + innerWidth / 6
    },
    {
      stats: deactivationStats,
      color: [231, 76, 60],
      label: 'During Deactivation',
      x: x + padding.left + innerWidth / 2
    },
    {
      stats: afterStats,
      color: [52, 152, 219],
      label: 'After Deactivation',
      x: x + padding.left + (innerWidth * 5) / 6
    }
  ];

  periods.forEach((period) => {
    if (!period.stats) return;
    const boxWidth = 0.4; // Box width in inches

    // Whiskers
    doc.setDrawColor(period.color[0], period.color[1], period.color[2]);
    doc.setLineWidth(0.02); // Line width in inches
    const minY = valueToY(period.stats.min);
    const maxY = valueToY(period.stats.max);
    doc.line(period.x, minY, period.x, maxY);

    // Box
    const q1Y = valueToY(period.stats.q1);
    const q3Y = valueToY(period.stats.q3);
    // Use lighter fill color for transparency effect
    const lightColor = [
      Math.min(255, period.color[0] + 50),
      Math.min(255, period.color[1] + 50),
      Math.min(255, period.color[2] + 50)
    ];
    doc.setFillColor(lightColor[0], lightColor[1], lightColor[2]);
    doc.rect(period.x - boxWidth / 2, q3Y, boxWidth, q1Y - q3Y, 'F');
    doc.setDrawColor(period.color[0], period.color[1], period.color[2]);
    doc.setLineWidth(0.014); // Line width in inches
    doc.rect(period.x - boxWidth / 2, q3Y, boxWidth, q1Y - q3Y, 'S');

    // Median
    const medianY = valueToY(period.stats.median);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.02); // Line width in inches
    doc.line(period.x - boxWidth / 2, medianY, period.x + boxWidth / 2, medianY);

    // Label
    doc.setFontSize(8);
    doc.setTextColor(102, 102, 102);
    doc.text(period.label, period.x, y + height - padding.bottom + 0.2, { align: 'center' });
  });

  // Title
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 26, 26);
  doc.text('Hourly Pay Distribution by Period', x + width / 2, y + 0.28, { align: 'center' });

  // Y-axis label
  doc.setFontSize(10);
  doc.text('Hourly Pay ($)', x + 0.21, y + height / 2, { align: 'center', angle: 90 });
}

/**
 * Draw a table with borders matching the Python reportlab format
 */
function drawTable(
  doc: jsPDF,
  data: string[][],
  startX: number,
  startY: number,
  colWidths: number[],
  rowHeight: number
): number {
  const numRows = data.length;
  const numCols = data[0]?.length || 0;
  const totalWidth = colWidths.reduce((sum, w) => sum + w, 0);

  // Draw table borders and cells
  for (let row = 0; row < numRows; row++) {
    const y = startY + row * rowHeight;

    // Header row styling
    if (row === 0) {
      doc.setFillColor(128, 128, 128); // Gray background
      doc.rect(startX, y - rowHeight + 0.05, totalWidth, rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      // Alternating row colors
      const bgColor = row % 2 === 1 ? [245, 245, 220] : [255, 255, 255]; // Beige/White
      doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
      doc.rect(startX, y - rowHeight + 0.05, totalWidth, rowHeight, 'F');
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
    }

    // Draw vertical lines
    let xPos = startX;
    for (let col = 0; col <= numCols; col++) {
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.001);
      doc.line(xPos, y - rowHeight + 0.05, xPos, y + 0.05);
      if (col < numCols) {
        xPos += colWidths[col];
      }
    }

    // Draw horizontal lines
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.001);
    doc.line(startX, y - rowHeight + 0.05, startX + totalWidth, y - rowHeight + 0.05);
    doc.line(startX, y + 0.05, startX + totalWidth, y + 0.05);

    // Draw cell text
    xPos = startX;
    for (let col = 0; col < numCols; col++) {
      const cellText = data[row][col] || '';
      const textX = xPos + 0.05;
      // Add more vertical padding - move text down from top of cell
      const textY = y - rowHeight + 0.12; // Start text lower in the cell

      // Split text if too long
      const maxWidth = colWidths[col] - 0.1;
      const lines = doc.splitTextToSize(cellText, maxWidth);

      // Center text vertically in cell if multiple lines
      const lineHeight = 0.12;
      const totalTextHeight = lines.length * lineHeight;
      const startTextY = textY + (rowHeight - totalTextHeight) / 2;

      lines.forEach((line: string, lineIdx: number) => {
        doc.text(line, textX, startTextY + lineIdx * lineHeight, { align: 'left' });
      });

      xPos += colWidths[col];
    }
  }

  // Reset text color
  doc.setTextColor(0, 0, 0);

  return startY + numRows * rowHeight;
}

export async function generateDeactivationReportPdf(
  driverName: string,
  driverEmail: string,
  platformLabel: string,
  beforeMetrics: PeriodMetrics,
  deactivationMetrics: PeriodMetrics,
  afterMetrics: PeriodMetrics
): Promise<Blob> {
  const doc = new jsPDF({
    unit: 'in',
    format: [8.5, 11]
  });

  const LEFT_MARGIN = 0.5;
  const RIGHT_MARGIN = 8.0;
  const TOP_MARGIN = 0.5;
  let yPos = TOP_MARGIN;

  // Helper function to format dates
  const formatDateRange = (start: string | null, end: string | null): string => {
    if (start && end) {
      return `${moment(start).format('MMMM D, YYYY')} - ${moment(end).format('MMMM D, YYYY')}`;
    }
    return 'N/A';
  };

  // Helper function to calculate percentage change
  const calcPctChange = (beforeVal: number, afterVal: number): number => {
    if (beforeVal === 0) return 0.0;
    return ((afterVal - beforeVal) / beforeVal) * 100;
  };

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Driver Hourly Pay Report', 4.25, yPos, { align: 'center' });
  yPos += 0.35;

  // Plain-language description of what the report is for
  const reportPurpose =
    'This report estimates how many hours a driver was online and what they could have earned during a period when they were deactivated or unable to work. It converts driver-reported or baseline hours into platform-equivalent hours so missed opportunity can be documented and can support a driver’s account of lost work.';
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const purposeLines = doc.splitTextToSize(reportPurpose, 7.5);
  doc.text(purposeLines, LEFT_MARGIN, yPos);
  yPos += purposeLines.length * 0.18 + 0.25;

  // Driver Info
  doc.setFontSize(11);
  doc.text(`Driver: ${driverName}`, LEFT_MARGIN, yPos);
  yPos += 0.15;
  doc.text(`Email: ${driverEmail}`, LEFT_MARGIN, yPos);
  yPos += 0.15;
  doc.text(`Report Date: ${moment().format('MMMM D, YYYY')}`, LEFT_MARGIN, yPos);
  yPos += 0.15;
  doc.text(`Platform: ${platformLabel}`, LEFT_MARGIN, yPos);
  yPos += 0.3;

  // Before Period Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Before Deactivation Period', LEFT_MARGIN, yPos);
  yPos += 0.2;

  doc.setFontSize(10);
  const beforeDailyRate =
    beforeMetrics.workingDays > 0 ? beforeMetrics.totalEarnings / beforeMetrics.workingDays : 0;
  const beforeData = [
    ['Metric', 'Value'],
    ['Dates', formatDateRange(beforeMetrics.startDate, beforeMetrics.endDate)],
    ['Weeks', `${beforeMetrics.weeks} weeks`],
    ['Calendar days', `${beforeMetrics.workingDays}`],
    ['Total trips', `${beforeMetrics.totalTrips}`],
    [
      'Total Earnings',
      `$${beforeMetrics.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ],
    [
      'Average daily rate (earnings ÷ days)',
      `$${beforeDailyRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ],
    ['Average estimated daily online hours', `${beforeMetrics.avgDailyOnlineHours.toFixed(2)}`],
    ['Total estimated online hours', `${beforeMetrics.totalOnlineHours.toFixed(2)}`],
    [
      'Estimated average hourly pay (total pay / total hours)',
      `$${beforeMetrics.avgHourlyPay.toFixed(2)}`
    ]
  ];

  yPos = drawTable(doc, beforeData, LEFT_MARGIN, yPos, [4.0, 2.5], 0.2);
  yPos += 0.3;

  // Deactivation Period Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Deactivation Period', LEFT_MARGIN, yPos);
  yPos += 0.2;

  doc.setFontSize(10);
  const duringDailyRate =
    deactivationMetrics.workingDays > 0
      ? deactivationMetrics.totalEarnings / deactivationMetrics.workingDays
      : 0;
  const deactivationDailyRatePctChange = calcPctChange(beforeDailyRate, duringDailyRate);
  const deactivationHourlyPctChange = calcPctChange(
    beforeMetrics.avgHourlyPay,
    deactivationMetrics.avgHourlyPay
  );

  const deactivationData = [
    ['Metric', 'Value'],
    ['Dates', formatDateRange(deactivationMetrics.startDate, deactivationMetrics.endDate)],
    ['Weeks', `${deactivationMetrics.weeks} weeks`],
    ['Calendar days', `${deactivationMetrics.workingDays}`],
    ['Total trips', `${deactivationMetrics.totalTrips}`],
    [
      'Total Earnings',
      `$${deactivationMetrics.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ],
    [
      'Average daily rate (earnings ÷ days)',
      `$${duringDailyRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${deactivationDailyRatePctChange >= 0 ? '+' : ''}${deactivationDailyRatePctChange.toFixed(1)}% vs before)`
    ],
    [
      'Average estimated daily online hours',
      `${deactivationMetrics.avgDailyOnlineHours.toFixed(2)}`
    ],
    ['Total estimated online hours', `${deactivationMetrics.totalOnlineHours.toFixed(2)}`],
    [
      'Estimated average hourly pay (total pay / total hours)',
      `$${deactivationMetrics.avgHourlyPay.toFixed(2)} (${deactivationHourlyPctChange >= 0 ? '+' : ''}${deactivationHourlyPctChange.toFixed(1)}% vs before)`
    ]
  ];

  yPos = drawTable(doc, deactivationData, LEFT_MARGIN, yPos, [4.0, 2.5], 0.2);
  yPos += 0.3;

  // After Period Section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('After Deactivation Period', LEFT_MARGIN, yPos);
  yPos += 0.2;

  doc.setFontSize(10);
  const afterDailyRate =
    afterMetrics.workingDays > 0 ? afterMetrics.totalEarnings / afterMetrics.workingDays : 0;
  const afterData = [
    ['Metric', 'Value'],
    ['Dates', formatDateRange(afterMetrics.startDate, afterMetrics.endDate)],
    ['Weeks', `${afterMetrics.weeks} weeks`],
    ['Calendar days', `${afterMetrics.workingDays}`],
    ['Total trips', `${afterMetrics.totalTrips}`],
    [
      'Total Earnings',
      `$${afterMetrics.totalEarnings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ],
    [
      'Average daily rate (earnings ÷ days)',
      `$${afterDailyRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ],
    ['Average estimated daily online hours', `${afterMetrics.avgDailyOnlineHours.toFixed(2)}`],
    ['Total estimated online hours', `${afterMetrics.totalOnlineHours.toFixed(2)}`],
    [
      'Estimated average hourly pay (total pay / total hours)',
      `$${afterMetrics.avgHourlyPay.toFixed(2)}`
    ]
  ];

  yPos = drawTable(doc, afterData, LEFT_MARGIN, yPos, [4.0, 2.5], 0.2);
  yPos += 0.3;

  // Add time series chart - always try to draw (will show placeholder if no data)
  // Check if we need a new page
  if (yPos + 3.7 > 10.5) {
    doc.addPage();
    yPos = TOP_MARGIN;
  }

  try {
    drawTimeSeriesChart(
      doc,
      LEFT_MARGIN,
      yPos,
      6.0,
      3.5,
      beforeMetrics,
      deactivationMetrics,
      afterMetrics
    );
    yPos += 3.7;
  } catch {
    // Continue without chart on error
  }

  if (yPos + 3.7 > 10.5) {
    doc.addPage();
    yPos = TOP_MARGIN;
  }

  try {
    drawHourlyPayChart(
      doc,
      LEFT_MARGIN,
      yPos,
      6.0,
      3.5,
      beforeMetrics,
      deactivationMetrics,
      afterMetrics
    );
    yPos += 3.7;
  } catch {
    // Continue without chart on error
  }

  doc.addPage();
  yPos = TOP_MARGIN;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('Methodology', LEFT_MARGIN, yPos);
  yPos += 0.35;

  const sectionSpacing = 0.28;
  const lineHeight = 0.16;
  const addSection = (title: string, body: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(title, LEFT_MARGIN, yPos);
    yPos += 0.22;
    doc.setFont('helvetica', 'normal');
    const lines = doc.splitTextToSize(body, RIGHT_MARGIN - LEFT_MARGIN);
    doc.text(lines, LEFT_MARGIN, yPos);
    yPos += lines.length * lineHeight + sectionSpacing;
  };

  addSection(
    '1. Data collection and ground truth',
    `The model was built from a paired dataset: (1) screenshot-reported hours from driver earnings screenshots via LLM-powered OCR, and (2) actual on-trip hours from the Argyle API. This gives a ground-truth mapping between in-app hours and platform-recorded activity, so we can learn how reported hours relate to actual hours. Data was validated in a consistent pipeline; only records passing validation were used for model development.`
  );

  addSection(
    '2. Model choice: Ridge Regression',
    `The model is a single formula that converts screenshot-reported hours into an estimate of actual online hours; we use Ridge Regression because it gave the best and most stable performance on held-out data compared to other options we tried. Technically: we use Ridge Regression (L2-regularized linear regression) to predict actual online hours from screenshot-reported hours. The fitting process minimizes prediction error on the training data while applying a penalty that keeps the coefficient from overfitting to noise. Ridge was selected over other alternatives.`
  );

  addSection(
    '3. Model formulation and coefficients',
    `The fitted model is linear: Predicted actual hours = 8.83 + 0.71 * (screenshot-reported hours). How the coefficient and intercept are calculated: they are the values that minimize prediction error on the training data (with regularization strength chosen by cross-validation on the training set only). When we only observe actual hours in the baseline period we use the inverse: screenshot-equivalent = (actual hours - 8.83) / 0.71, then apply the forward model to get refined estimates for the deactivation period.`
  );

  addSection(
    '4. Validation and performance metrics',
    `The model was trained and validated with an 80/20 train/test split; the coefficient and intercept were fit only on the training portion, and regularization was tuned by cross-validation on the training set only. Out-of-sample performance on the held-out test set: Mean Absolute Error (MAE) ~ 5.6 hours. No test data was used in fitting or tuning.`
  );

  addSection(
    '5. Baseline and missed-opportunity computation',
    `Baseline activity is taken from the Before period, or from the After period if Before is insufficient. Baseline daily on-trip hours and hourly pay come from Argyle. For hourly pay we use (a) combined Before + After total earnings over total hours when total hours >= 20, or (b) the median of weekly hourly rates when data is sparser. Missed hours = estimated would-have-worked hours (from baseline and the Ridge model) minus actual hours. Missed earnings = missed hours * baseline hourly pay. Same coefficients and inverse/forward model throughout.`
  );

  addSection(
    '6. Technical notes and limitations',
    `Performance varies by driver volume; estimates are most reliable in the 10-20 hours per week range. Results are conservative estimates intended as supporting evidence, not exact calculations. Methodology is documented for transparency and reproducibility.`
  );

  // Citation with URLs printed underneath
  yPos += 0.25;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Report generated with System, a tool by the Sample Organization.', LEFT_MARGIN, yPos);
  yPos += 0.18;
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 80);
  const urlLine = 'https://getsystem.org/   |   https://organization.university.edu/';
  doc.text(urlLine, LEFT_MARGIN, yPos);
  doc.setTextColor(0, 0, 0);

  return doc.output('blob');
}
