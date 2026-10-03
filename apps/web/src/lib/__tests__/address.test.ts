import { afterEach, describe, expect, test, vi } from "vitest";

import {
  ADDRESS_LENGTH_LIMIT,
  isLookupAddressValid,
  normalizeRememberedAddress,
  readRememberedAddress,
  saveAddressCookie,
} from "@/lib/address";

describe(isLookupAddressValid, () => {
  test("accepts a non-blank address at the length limit", () => {
    expect(isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT))).toBeTruthy();
  });

  test("rejects blank and overlong address input", () => {
    expect(isLookupAddressValid("   ")).toBeFalsy();
    expect(
      isLookupAddressValid("1".repeat(ADDRESS_LENGTH_LIMIT + 1))
    ).toBeFalsy();
  });
});

describe("remembered addresses", () => {
  afterEach(() => vi.unstubAllGlobals());

  test("trims a valid stored address", () => {
    expect(normalizeRememberedAddress("  12 Grey Street, Hamilton  ")).toBe(
      "12 Grey Street, Hamilton"
    );
  });

  test("ignores missing, blank, and overlong stored addresses", () => {
    expect(normalizeRememberedAddress(null)).toBeNull();
    expect(normalizeRememberedAddress("   ")).toBeNull();
    expect(
      normalizeRememberedAddress("x".repeat(ADDRESS_LENGTH_LIMIT + 1))
    ).toBeNull();
    expect(isLookupAddressValid("")).toBeFalsy();
  });

  test("prefers a valid cookie and falls back to local storage for invalid cookies", async () => {
    const getItem = vi
      .fn<() => string | null>()
      .mockReturnValue("  Local address  ");
    vi.stubGlobal("window", {
      cookieStore: {
        get: vi
          .fn<() => Promise<{ value: string }>>()
          .mockResolvedValue({ value: "  Cookie address  " }),
      },
      localStorage: { getItem },
    });

    await expect(readRememberedAddress()).resolves.toBe("Cookie address");
    expect(getItem).not.toHaveBeenCalled();

    vi.stubGlobal("window", {
      cookieStore: {
        get: vi
          .fn<() => Promise<{ value: string }>>()
          .mockResolvedValue({ value: "  " }),
      },
      localStorage: { getItem },
    });
    await expect(readRememberedAddress()).resolves.toBe("Local address");
  });

  test("falls back to local storage when cookies or storage are unavailable", async () => {
    vi.stubGlobal("window", {
      cookieStore: {
        get: vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("blocked")),
      },
      localStorage: {
        getItem: vi
          .fn<() => string | null>()
          .mockReturnValue("  Stored address  "),
      },
    });
    await expect(readRememberedAddress()).resolves.toBe("Stored address");

    vi.stubGlobal("window", {
      cookieStore: {
        get: vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("blocked")),
      },
      localStorage: {
        getItem: vi.fn<() => string | null>().mockImplementation(() => {
          throw new Error("blocked");
        }),
      },
    });
    await expect(readRememberedAddress()).resolves.toBeNull();
  });

  test("stores addresses in cookies and falls back to local storage", async () => {
    const set = vi
      .fn<
        (options: {
          name: string;
          value: string;
          path: string;
          expires: number;
          sameSite: string;
        }) => Promise<void>
      >()
      .mockResolvedValue();
    const setItem = vi.fn<(key: string, value: string) => void>();
    vi.stubGlobal("window", {
      cookieStore: { set },
      localStorage: { setItem },
    });
    await saveAddressCookie("12 Grey Street");
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "hcc-bin-day-address",
        value: "12 Grey Street",
        path: "/",
        sameSite: "lax",
      })
    );
    expect(setItem).not.toHaveBeenCalled();

    vi.stubGlobal("window", {
      cookieStore: {
        set: vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("blocked")),
      },
      localStorage: { setItem },
    });
    await saveAddressCookie("12 Grey Street");
    expect(setItem).toHaveBeenCalledWith(
      "hcc-bin-day-address",
      "12 Grey Street"
    );

    vi.stubGlobal("window", {
      cookieStore: {
        set: vi
          .fn<() => Promise<never>>()
          .mockRejectedValue(new Error("blocked")),
      },
      localStorage: {
        setItem: vi
          .fn<(key: string, value: string) => void>()
          .mockImplementation(() => {
            throw new Error("blocked");
          }),
      },
    });
    await expect(saveAddressCookie("12 Grey Street")).resolves.toBeUndefined();
  });

  test("serializes overlapping address writes in invocation order", async () => {
    const pendingWrites: (() => void)[] = [];
    let storedAddress: string | null = null;
    const set = vi.fn<(options: { value: string }) => Promise<void>>(
      (options) => {
        const write = Promise.withResolvers<null>();
        pendingWrites.push(() => {
          storedAddress = options.value;
          write.resolve(null);
        });
        return write.promise;
      }
    );
    vi.stubGlobal("window", {
      cookieStore: { set },
      localStorage: { setItem: vi.fn<(key: string, value: string) => void>() },
    });

    const firstWrite = saveAddressCookie("Older address");
    const secondWrite = saveAddressCookie("Latest address");

    await Promise.resolve();
    await Promise.resolve();
    expect(set).toHaveBeenCalledOnce();
    pendingWrites[0]?.();
    await firstWrite;
    await Promise.resolve();
    await Promise.resolve();
    expect(set).toHaveBeenCalledTimes(2);
    pendingWrites[1]?.();
    await secondWrite;

    expect(storedAddress).toBe("Latest address");
  });
});
