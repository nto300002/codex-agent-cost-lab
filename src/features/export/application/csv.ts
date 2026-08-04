const dangerousFormulaPrefix = /^[=+\-@]/;

export function neutralizeCsvFormula(value: string) {
  return dangerousFormulaPrefix.test(value) ? `'${value}` : value;
}

function escapeCsvCell(value: string | number | null | undefined) {
  const normalized = neutralizeCsvFormula(
    value === null || value === undefined ? "" : String(value),
  );
  return `"${normalized.replaceAll('"', '""')}"`;
}

export function createCsv(
  headers: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>,
) {
  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\r\n");
}
