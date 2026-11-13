import {
  parseCSVLine,
  countNewlines,
  stripLastColumn,
  buildSummaryCSV,
  CSV_HEADERS
} from './policyAnalysisCsv';

describe('parseCSVLine', () => {
  it('parses simple unquoted fields', () => {
    expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('parses quoted fields containing commas', () => {
    expect(parseCSVLine('"hello, world",b')).toEqual(['hello, world', 'b']);
  });

  it('handles escaped double quotes inside quoted fields', () => {
    expect(parseCSVLine('"say ""hi""",b')).toEqual(['say "hi"', 'b']);
  });

  it('handles empty fields between commas', () => {
    expect(parseCSVLine(',,')).toEqual(['', '']);
  });

  it('parses a single field with no commas', () => {
    expect(parseCSVLine('abc')).toEqual(['abc']);
  });

  it('returns empty array for empty string', () => {
    expect(parseCSVLine('')).toEqual([]);
  });

  it('does not produce trailing empty field after final comma', () => {
    expect(parseCSVLine('a,b,')).toEqual(['a', 'b']);
  });

  it('handles a mix of quoted and unquoted fields', () => {
    expect(parseCSVLine('plain,"with,comma",another')).toEqual(['plain', 'with,comma', 'another']);
  });

  it('handles a real-world CSV row with many fields', () => {
    const line =
      'Uber,completed,America/New_York,2024-01-15 08:30:00,2024-01-15 09:00:00,1800,40.7128,-74.006,"New York, NY",40.758,-73.9855,"Times Square, NY",5.2,miles,false,25.50,18.00,20.00,0,2.00,1.50,abc-123';
    const fields = parseCSVLine(line);
    expect(fields[0]).toBe('Uber');
    expect(fields[8]).toBe('New York, NY');
    expect(fields[11]).toBe('Times Square, NY');
    expect(fields[fields.length - 1]).toBe('abc-123');
  });
});

describe('countNewlines', () => {
  it('returns 0 for text with no newlines', () => {
    expect(countNewlines('hello world')).toBe(0);
  });

  it('counts multiple newlines', () => {
    expect(countNewlines('a\nb\nc\nd')).toBe(3);
  });

  it('counts string of only newlines', () => {
    expect(countNewlines('\n\n\n')).toBe(3);
  });

  it('returns 0 for empty string', () => {
    expect(countNewlines('')).toBe(0);
  });

  it('counts trailing newline', () => {
    expect(countNewlines('row1\nrow2\n')).toBe(2);
  });
});

describe('stripLastColumn', () => {
  it('strips the last column from a single line', () => {
    expect(stripLastColumn('a,b,c')).toBe('a,b');
  });

  it('strips the last column from multiple lines', () => {
    expect(stripLastColumn('a,b,c\nd,e,f')).toBe('a,b\nd,e');
  });

  it('returns empty string for a line with no commas', () => {
    expect(stripLastColumn('onlyfield')).toBe('onlyfield');
  });

  it('preserves content when the last column is empty', () => {
    expect(stripLastColumn('a,b,')).toBe('a,b');
  });

  it('handles lines with varying column counts', () => {
    expect(stripLastColumn('a,b,c\nx,y')).toBe('a,b\nx');
  });
});

describe('buildSummaryCSV', () => {
  const fullAggData = {
    total_trips: 5000,
    avg_distance: 8.5,
    avg_charge: 25.0,
    avg_charge_no_tip: 22.0,
    avg_hourly_rate: 30.0,
    avg_hourly_rate_no_tip: 27.0,
    avg_pay: 18.0,
    avg_pay_no_tip: 15.0
  };

  it('produces correct summary with all fields from an object', () => {
    const result = buildSummaryCSV(fullAggData);
    expect(result).toContain('Summary');
    expect(result).toContain('Total number of trips,5000');
    expect(result).toContain('Average distance per trip,8.5,=AVERAGE(M2:M5001)');
    expect(result).toContain(
      'Average customer charge per trip (including tips),25,=AVERAGE(P2:P5001)'
    );
    expect(result).toContain(
      'Average hourly rate (including tips),30,=SUM(R2:R5001) / (SUM(F2:F5001)/3600)'
    );
    expect(result).toContain('Average account pay per trip (including tips),18,=AVERAGE(R2:R5001)');
  });

  it('uses first element when given an array', () => {
    const result = buildSummaryCSV([fullAggData]);
    expect(result).toContain('Total number of trips,5000');
    expect(result).toContain('Average distance per trip,8.5');
  });

  it('defaults missing fields to 0', () => {
    const result = buildSummaryCSV({} as Record<string, number>);
    expect(result).toContain('Total number of trips,0');
    expect(result).toContain('Average distance per trip,0,=AVERAGE(M2:MNaN)');
    expect(result).toContain(
      'Average hourly rate (including tips),0,=SUM(R2:RNaN) / (SUM(F2:FNaN)/3600)'
    );
  });

  it('produces the correct number of summary lines', () => {
    const result = buildSummaryCSV(fullAggData);
    const lines = result.split('\n');
    expect(lines).toHaveLength(11);
    expect(lines[0]).toBe('');
    expect(lines[1]).toBe('Summary');
  });

  it('exports CSV_HEADERS with the expected count', () => {
    expect(CSV_HEADERS).toHaveLength(21);
    expect(CSV_HEADERS[0]).toBe('Employer');
    expect(CSV_HEADERS[CSV_HEADERS.length - 1]).toBe('Income Fees');
  });
});
