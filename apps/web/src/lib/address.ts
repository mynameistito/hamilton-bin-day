export const ADDRESS_LENGTH_LIMIT = 160;

/** Check that a lookup address is non-empty and within the supported length. */
/**
 * @param address - Address text entered for lookup.
 * @returns Whether the address can be submitted to the lookup service.
 */
export const isLookupAddressValid = (address: string): boolean =>
  address.length > 0 &&
  address.length <= ADDRESS_LENGTH_LIMIT &&
  address.trim().length > 0;

const ADDRESS_COOKIE_NAME = "hcc-bin-day-address";
const ADDRESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
let addressWriteQueue: Promise<void> = Promise.resolve();

/** Trim a valid remembered address, or return `null` for invalid input. */
/**
 * @param address - Address value read from browser storage.
 * @returns The normalized address, or `null` when it is unusable.
 */
export const normalizeRememberedAddress = (
  address: string | null | undefined
): string | null =>
  address && isLookupAddressValid(address) ? address.trim() : null;

const readAddressStorage = (): string | null => {
  try {
    return window.localStorage.getItem(ADDRESS_COOKIE_NAME);
  } catch {
    return null;
  }
};

const writeAddressStorage = (address: string): void => {
  try {
    window.localStorage.setItem(ADDRESS_COOKIE_NAME, address);
  } catch {
    // Keep lookup usable if browser storage is unavailable.
  }
};

/** Read and validate the remembered address from cookie or local storage. */
/** @returns The remembered address, or `null` when none can be read. */
export const readRememberedAddress = async (): Promise<string | null> => {
  try {
    const cookie = await window.cookieStore.get(ADDRESS_COOKIE_NAME);
    const address = normalizeRememberedAddress(cookie?.value);
    return address ?? normalizeRememberedAddress(readAddressStorage());
  } catch {
    return normalizeRememberedAddress(readAddressStorage());
  }
};

const persistAddress = async (address: string): Promise<void> => {
  try {
    await window.cookieStore.set({
      name: ADDRESS_COOKIE_NAME,
      value: address,
      path: "/",
      expires: Date.now() + ADDRESS_COOKIE_MAX_AGE * 1000,
      sameSite: "lax",
    });
  } catch {
    writeAddressStorage(address);
  }
};

const persistAddressAfter = async (
  previousWrite: Promise<void>,
  address: string
): Promise<void> => {
  try {
    await previousWrite;
  } catch {
    // A failed earlier write must not block this address.
  }
  await persistAddress(address);
};

/** Save the lookup address and serialize writes to preserve their order. */
/**
 * @param address - Address value to remember.
 * @returns A promise that settles when this address has been persisted.
 */
export const saveAddressCookie = (address: string): Promise<void> => {
  addressWriteQueue = persistAddressAfter(addressWriteQueue, address);
  return addressWriteQueue;
};
