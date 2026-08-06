import { existsSync, writeFileSync } from "node:fs";

const previousMarker = process.env.PREVIOUS_RUN_MARKER;
const contaminated = previousMarker ? existsSync(previousMarker) : false;
writeFileSync("fake-codex-marker.txt", process.env.RUN_MARKER ?? "marker\n");
process.stdout.write(
  `${JSON.stringify({ type: "thread.started", thread_id: "fake" })}\n`,
);
process.stdout.write(
  `${JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: contaminated ? "contaminated" : "isolated" } })}\n`,
);
process.stderr.write("fake codex stderr\n");
if (process.env.FAKE_CODEX_DELAY_MS) {
  await new Promise((resolve) =>
    setTimeout(resolve, Number(process.env.FAKE_CODEX_DELAY_MS)),
  );
}
process.exitCode = Number(process.env.FAKE_CODEX_EXIT_CODE ?? "0");
