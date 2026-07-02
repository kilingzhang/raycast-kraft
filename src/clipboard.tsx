import { launchCommand, LaunchProps, LaunchType } from "@raycast/api";

/* eslint-disable @typescript-eslint/no-unused-vars */
export default async function Command(props: LaunchProps) {
  await launchCommand({
    name: "translate",
    type: LaunchType.UserInitiated,
    context: {
      mode: "translate",
      autoStart: true,
      loadSelected: false,
      loadClipboard: true,
    },
  });
}
