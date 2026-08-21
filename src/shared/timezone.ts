const controlCharacterPattern = /[\u0000-\u001f\u007f]/;
const namedTimezonePattern = /^[A-Za-z0-9._+-]+(?:\/[A-Za-z0-9._+-]+)+$/;

export function isValidTimezone(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > 128 ||
    value.trim() !== value ||
    controlCharacterPattern.test(value)
  ) {
    return false;
  }
  if (value !== "UTC" && !namedTimezonePattern.test(value)) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export function detectBrowserTimezone(): string | undefined {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezone && isValidTimezone(timezone) ? timezone : undefined;
  } catch {
    return undefined;
  }
}
