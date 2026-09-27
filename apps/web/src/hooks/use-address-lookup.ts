import {
  Array as SchemaArray,
  Boolean as SchemaBoolean,
  decodeUnknownSync,
  Literal,
  optional,
  String as SchemaString,
  Struct,
  Union,
} from "effect/Schema";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

import {
  ADDRESS_LENGTH_LIMIT,
  isLookupAddressValid,
  readRememberedAddress,
  saveAddressCookie,
} from "../lib/address";
import type { ScheduleResponse } from "../lib/schedule";

type LookupState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "not-found"; readonly matches: readonly string[] }
  | { readonly kind: "success"; readonly schedule: ScheduleResponse };

const LookupSchema = Struct({
  found: SchemaBoolean,
  matches: optional(SchemaArray(SchemaString)),
  schedule: optional(
    Struct({
      address: SchemaString,
      collectionDayName: SchemaString,
      nextCollection: Struct({
        bins: SchemaArray(SchemaString),
        date: SchemaString,
        type: Union([Literal("red"), Literal("yellow")]),
      }),
      redBin: SchemaString,
      yellowBin: SchemaString,
    })
  ),
});

const parseLookup = decodeUnknownSync(LookupSchema);

const lookup = async (address: string): Promise<LookupState> => {
  const response = await fetch(
    `/api/lookup?address=${encodeURIComponent(address)}`
  );
  if (!response.ok) {
    throw new Error(
      "The council lookup is unavailable right now. Please try again."
    );
  }

  const result = parseLookup(await response.json());
  if (!result.found || !result.schedule) {
    return { kind: "not-found", matches: result.matches ?? [] };
  }
  return { kind: "success", schedule: result.schedule };
};

export const useAddressLookup = () => {
  const [address, setAddress] = useState(() => {
    const query = new URLSearchParams(window.location.search).get("query");
    return query ?? "";
  });
  const [state, setState] = useState<LookupState>({ kind: "idle" });
  const latestRequest = useRef(0);

  const runLookup = useCallback(async (query: string) => {
    latestRequest.current += 1;
    const requestId = latestRequest.current;
    setState({ kind: "loading" });
    try {
      const result = await lookup(query);
      if (requestId !== latestRequest.current) {
        return;
      }
      setState(result);
      if (result.kind === "success") {
        await saveAddressCookie(query);
      }
    } catch (error) {
      if (requestId !== latestRequest.current) {
        return;
      }
      setState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Something went wrong.",
      });
    }
  }, []);

  useEffect(() => {
    let active = true;
    const requestId = latestRequest.current;
    const loadRememberedAddress = async () => {
      const query = new URLSearchParams(window.location.search).get("query");
      const rememberedAddress = query ?? (await readRememberedAddress());
      if (
        !active ||
        requestId !== latestRequest.current ||
        !rememberedAddress ||
        !isLookupAddressValid(rememberedAddress)
      ) {
        return;
      }
      const normalizedQuery = rememberedAddress.trim();
      setAddress(normalizedQuery);
      await runLookup(normalizedQuery);
    };
    void loadRememberedAddress();
    return () => {
      active = false;
    };
  }, [runLookup]);

  const submitLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = address.trim();
    if (!query) {
      return;
    }
    if (!isLookupAddressValid(query)) {
      setState({
        kind: "error",
        message: `Enter an address with no more than ${ADDRESS_LENGTH_LIMIT} characters.`,
      });
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.set("query", query);
    window.history.replaceState(window.history.state, "", url);
    await runLookup(query);
  };

  return { address, setAddress, state, submitLookup };
};
