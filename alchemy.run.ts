import { Stack } from "alchemy";
import { D1, providers, state, Website, Workers } from "alchemy/Cloudflare";
import { gen } from "effect/Effect";
import { make as makeRedacted } from "effect/Redacted";
import type { Redacted as RedactedValue } from "effect/Redacted";

const resolveStackValue = Stack.useSync.bind(Stack);

const reminderRateLimitNamespaceId = (stage: string): number => {
  let hash = 7;
  for (const character of `hamilton-bin-day:${stage}`) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) % 2_147_483_647;
  }
  return hash || 1;
};

const websiteProps = (stage: string) => {
  const props = {
    assets: {
      htmlHandling: "force-trailing-slash" as const,
      notFoundHandling: "single-page-application" as const,
      runWorkerFirst: ["/api/*"],
    },
    command: "bun run build",
    crons: ["*/5 * * * *"],
    main: "./apps/web/src/worker.ts",
    name: stage === "prod" ? "hamilton-bin-day" : `hamilton-bin-day-${stage}`,
    outdir: "apps/web/dist",
    workersDev: true,
  };

  if (stage === "prod") {
    return { ...props, domain: "bin-day.mynameistito.com" };
  }

  return props;
};

const Reminders = D1.Database(
  "ReminderSubscriptions",
  resolveStackValue((stack) => ({
    migrations: "./apps/web/migrations",
    name: `hamilton-bin-day-reminders-${stack.stage}`,
    primaryLocationHint: "oc" as const,
  }))
);

interface ProductionVapidEnvironment {
  VAPID_PRIVATE_KEY?: RedactedValue<string>;
  VAPID_PUBLIC_KEY?: string;
  VAPID_SUBJECT?: string;
}

const productionVapidEnvironment = (
  stage: string
): ProductionVapidEnvironment => {
  if (stage !== "prod") {
    return {};
  }
  const privateKey = Bun.env.VAPID_PRIVATE_KEY?.trim();
  const publicKey = Bun.env.VAPID_PUBLIC_KEY?.trim();
  const subject = Bun.env.VAPID_SUBJECT?.trim();
  const environment: ProductionVapidEnvironment = {};
  if (privateKey) {
    environment.VAPID_PRIVATE_KEY = makeRedacted(privateKey);
  }
  if (publicKey) {
    environment.VAPID_PUBLIC_KEY = publicKey;
  }
  if (subject) {
    environment.VAPID_SUBJECT = subject;
  }
  return environment;
};

const Site = Website.StaticSite(
  "Website",
  resolveStackValue((stack) => ({
    ...websiteProps(stack.stage),
    env: {
      REMINDERS: Reminders,
      REMINDER_LIMIT: Workers.RateLimit("ReminderApiLimit", {
        namespaceId: reminderRateLimitNamespaceId(stack.stage),
        simple: { limit: 30, period: 60 },
      }),
      ...productionVapidEnvironment(stack.stage),
    },
  }))
);

export default Stack(
  "hamilton-bin-day",
  { providers: providers(), state: state() },
  gen(function* createStack() {
    yield* Reminders;
    const website = yield* Site;
    return { url: website.url };
  })
);
