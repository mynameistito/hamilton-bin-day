export const ADDRESS_LENGTH_LIMIT = 160;

export const isLookupAddressValid = (address: string): boolean =>
  address.length > 0 &&
  address.length <= ADDRESS_LENGTH_LIMIT &&
  address.trim().length > 0;

const ADDRESS_COOKIE_NAME = "hcc-bin-day-address";
const ADDRESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const normalizeRememberedAddress = (
  address: string | null | undefined
): string | null =>
  address && isLookupAddressValid(address) ? address.trim() : null;

export const readRememberedAddress = async (): Promise<string | null> => {
  try {
    const cookie = await window.cookieStore.get(ADDRESS_COOKIE_NAME);
    return normalizeRememberedAddress(cookie?.value);
  } catch {
    return null;
  }
};

export const saveAddressCookie = async (address: string): Promise<void> => {
  try {
    await window.cookieStore.set({
      name: ADDRESS_COOKIE_NAME,
      value: address,
      path: "/",
      expires: Date.now() + ADDRESS_COOKIE_MAX_AGE * 1000,
      sameSite: "lax",
    });
  } catch {
    // Keep lookup usable if browser cookie storage is unavailable.
  }
};
