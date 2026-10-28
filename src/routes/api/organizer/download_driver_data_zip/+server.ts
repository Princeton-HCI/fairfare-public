import JSZip from 'jszip';
import { USDformatter } from '$lib/utils';
import type { RequestHandler } from './$types';
import makeDriverReportPdfBlob from '@src/routes/organizer/driver_report_pdf/makeDriverReportPdfBlob';
import getDriverActivities from '@src/lib/components/organizer/getDriverActivities';
import { hasCapability } from '@src/lib/rbac';

export const POST: RequestHandler = async ({ request, locals }) => {
  // 1. Parse request body
  const {
    driverUserId,
    driverName,
    averageDailyPay,
    deactivationPeriodDuration,
    annualInterestRate,
    startDateString,
    endDateString,
    selectedEmployer,
    pdfData,
    includesPdf,
    affiliateOrganizationKey
  } = await request.json();

  // 2. Authentication check - verify user is logged in
  const { user, roles } = await locals.safeGetSession();

  if (!user) {
    console.error('No authenticated user found.');
    return new Response('Unauthorized', { status: 401 });
  }

  // 3. Validate required fields
  if (!affiliateOrganizationKey) {
    console.error('affiliateOrganizationKey does not exist');
    return new Response('affiliateOrganizationKey is required to continue', { status: 400 });
  }

  // 4. Authorization check - verify organizer has access to this organization
  if (!hasCapability(roles, 'org:export_driver_data', affiliateOrganizationKey)) {
    return new Response('You do not have access to this organization', { status: 403 });
  }

  // 5. Now safe to fetch data - user is authenticated and authorized
  const activities = await getDriverActivities(
    locals.supabase,
    driverUserId,
    startDateString || undefined,
    endDateString || undefined,
    selectedEmployer
  );

  // Pre-calculate summary values
  const incomeTotal = activities.reduce((acc, curr) => acc + (curr.income_total || 0), 0);
  const grossEstimatedLostPay = averageDailyPay * deactivationPeriodDuration;
  const grossEstimatedLostPayWithInterest =
    grossEstimatedLostPay * (1 + (annualInterestRate / 100) * (deactivationPeriodDuration / 365));

  // Helper function to escape CSV values
  const escapeCSV = (value: string | null) => {
    if (value === null || value === '') return '';
    // If value contains comma, quote, or newline, wrap in quotes and escape existing quotes
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  // Prepare CSV data
  const csvRows = [
    // Header row
    [
      'Employer',
      'Status',
      'Time Zone',
      'Start Date',
      'End Date',
      'Duration (in seconds)',
      'Start Location Latitude',
      'Start Location Longitude',
      'Start Location Formatted Address',
      'End Location Latitude',
      'End Location Longitude',
      'End Location Formatted Address',
      'Distance',
      'Distance Unit',
      'Surge Ride',
      'Income Total Charge',
      'Income Pay',
      'Income Total',
      'Income Bonus',
      'Income Tips',
      'Income Fees'
    ].map(escapeCSV),
    // Activity rows
    ...activities.map((activity) => [
      escapeCSV(activity.employer),
      escapeCSV(activity.status),
      escapeCSV(activity.timezone),
      escapeCSV(activity.start_datetime),
      escapeCSV(activity.end_datetime),
      escapeCSV(activity.duration?.toString() ?? ''),
      escapeCSV(activity.start_location_lat),
      escapeCSV(activity.start_location_lng),
      escapeCSV(activity.start_location_formatted_address),
      escapeCSV(activity.end_location_lat),
      escapeCSV(activity.end_location_lng),
      escapeCSV(activity.end_location_formatted_address),
      escapeCSV(activity.distance?.toString() ?? ''),
      escapeCSV(activity.distance_unit),
      escapeCSV(activity.circumstances_is_surge),
      escapeCSV(
        activity.income_total_charge !== null
          ? USDformatter.format(activity.income_total_charge)
          : ''
      ),
      escapeCSV(activity.income_pay !== null ? USDformatter.format(activity.income_pay) : ''),
      escapeCSV(activity.income_total !== null ? USDformatter.format(activity.income_total) : ''),
      escapeCSV(activity.income_bonus !== null ? USDformatter.format(activity.income_bonus) : ''),
      escapeCSV(activity.income_tips !== null ? USDformatter.format(activity.income_tips) : ''),
      escapeCSV(activity.income_fees !== null ? USDformatter.format(activity.income_fees) : '')
    ]),
    // Empty row
    [''],
    // Summary rows
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      escapeCSV(USDformatter.format(incomeTotal)),
      'Total pay',
      '',
      ''
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      escapeCSV(USDformatter.format(averageDailyPay)),
      'Average daily pay',
      '',
      ''
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      escapeCSV(USDformatter.format(grossEstimatedLostPay)),
      'Gross estimated lost pay',
      '',
      ''
    ],
    [
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      escapeCSV(USDformatter.format(grossEstimatedLostPayWithInterest)),
      'Gross estimated lost pay with interest',
      '',
      ''
    ]
  ];

  // Convert to CSV string - no need to escape here since values are already escaped
  const csv = csvRows.map((row) => row.join(',')).join('\n');

  // Create ZIP file
  const zip = new JSZip();
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const zipFilename = `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data_${timestamp}.zip`;
  const csvFilename = `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_ride_data_${timestamp}.csv`;
  const pdfFilename = `${driverName.replace(/[^a-zA-Z]+/g, '_').toLowerCase()}_earnings_report_${timestamp}.pdf`;

  try {
    // Add CSV file with compression
    zip.file(csvFilename, csv, {
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9 // Maximum compression
      }
    });

    // Generate and add PDF if requested
    if (includesPdf && pdfData) {
      const pdfBlob = await makeDriverReportPdfBlob(
        pdfData.driverFullName,
        pdfData.driverEmail,
        pdfData.driverPhone,
        pdfData.referencePeriodString,
        pdfData.deactivationPeriodString,
        pdfData.totalNumberOfTrips,
        pdfData.averageDailyPayString,
        pdfData.grossEstimatedLostPay,
        pdfData.grossEstimatedLostPayWithInterest,
        pdfData.annualInterestRateAsString,
        // Use null coalescing operator (??) to convert null values to undefined
        // This ensures the PDF generation function receives the correct type
        // - selectedEmployer: null -> undefined (optional parameter)
        // - demandLetterDate: null -> undefined (optional parameter)
        pdfData.selectedEmployer ?? undefined,
        pdfData.interestPeriod,
        pdfData.demandLetterDate ?? undefined
      );

      // Convert blob to ArrayBuffer
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();

      zip.file(pdfFilename, pdfArrayBuffer, {
        compression: 'DEFLATE',
        compressionOptions: {
          level: 9
        }
      });
    }

    // Generate ZIP file with specific options
    const zipContent = await zip.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 9
      },
      streamFiles: true // Stream files for better memory handling
    });

    // Look up the UUID for the affiliate organization key for audit logging
    const { data, error } = await locals.supabase
      .from('affiliate_organizations')
      .select('id')
      .eq('key', affiliateOrganizationKey)
      .single();

    if (error || !data) {
      console.error('Invalid affiliateOrganizationKey:', affiliateOrganizationKey);
      return new Response('Invalid organization key', { status: 400 });
    }

    const affiliateOrganizationId = data.id;

    const auditInsertResponse = await locals.supabase
      .from('driver_data_downloads_by_organizers')
      .insert({
        // Removed metadate and made columns seperate const
        downloading_user_id: user.id,
        downloaded_user_data_id: driverUserId,
        start_date: startDateString || undefined,
        end_date: endDateString || undefined,
        selected_employer: selectedEmployer,
        includes_pdf: includesPdf, // promoted to its own column
        affiliate_organization_id: affiliateOrganizationId
      });

    if (auditInsertResponse.error) {
      console.error('Failed to write audit log:', auditInsertResponse.error);
      return new Response('Internal Server Error: Failed to audit download activity', {
        status: 500
      });
    }

    return new Response(zipContent, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error) {
    console.error('Error generating ZIP file:', error);
    return new Response('Error generating ZIP file', { status: 500 });
  }
};
